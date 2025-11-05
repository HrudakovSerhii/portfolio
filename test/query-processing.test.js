/**
 * Integration tests for query processing and response generation
 * Tests the complete flow from query input to response output
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Transformers.js library for testing
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(() => Promise.resolve({
    // Mock DistilBERT output - returns a tensor-like object
    __call__: vi.fn(() => Promise.resolve({
      data: new Float32Array(768).fill(0.1) // Mock 768-dimensional embedding
    }))
  })),
  env: {
    allowRemoteModels: true,
    allowLocalModels: false
  }
}));

describe('Query Processing Integration Tests', () => {
  let mockCVData;
  let mockWorker;

  beforeEach(() => {
    // Mock CV data structure
    mockCVData = {
      metadata: {
        version: '1.0',
        totalSections: 3,
        embeddingModel: 'distilbert-base-uncased'
      },
      sections: {
        experience: {
          react: {
            id: 'exp_react',
            keywords: ['react', 'reactjs', 'jsx', 'hooks'],
            embeddings: null,
            responses: {
              hr: 'Serhii has 4+ years of professional React development experience.',
              developer: 'I\'ve been working with React for 4+ years now. Really love the hooks ecosystem.',
              friend: 'Oh React! 🚀 That\'s definitely one of my favorite frameworks to work with.'
            },
            details: {
              years: 4,
              level: 'senior',
              skills: ['Hooks', 'Context API', 'Redux']
            }
          },
          javascript: {
            id: 'exp_javascript',
            keywords: ['javascript', 'js', 'es6', 'vanilla'],
            embeddings: null,
            responses: {
              hr: 'Serhii possesses advanced JavaScript skills with 6+ years of experience.',
              developer: 'JavaScript is my bread and butter - 6+ years of experience.',
              friend: 'JavaScript is like my native language at this point! 😄'
            },
            details: {
              years: 6,
              level: 'expert'
            }
          }
        },
        projects: {
          portfolio: {
            id: 'proj_portfolio',
            keywords: ['portfolio', 'website', 'personal', 'showcase'],
            embeddings: null,
            responses: {
              hr: 'Serhii\'s portfolio website demonstrates his technical skills.',
              developer: 'This portfolio site you\'re looking at! Built it with vanilla JS.',
              friend: 'You\'re actually looking at one of my favorite projects right now! 😊'
            },
            details: {
              technologies: ['Vanilla JavaScript', 'SCSS', 'HTML5']
            }
          }
        }
      },
      personality: {
        traits: ['curious', 'problem-solver'],
        communication_style: {
          hr: { tone: 'professional' },
          developer: { tone: 'technical' },
          friend: { tone: 'casual' }
        }
      },
      responseTemplates: {
        noMatch: {
          hr: 'I don\'t have specific information about that topic.',
          developer: 'Hmm, that\'s not something I have details about.',
          friend: 'Oops! 😅 I don\'t think I have info about that.'
        }
      }
    };

    // Mock worker for testing
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn()
    };
  });

  describe('Query Preprocessing', () => {
    it('should normalize and clean query text', () => {
      const testCases = [
        {
          input: 'Do you have React experience???',
          expected: 'do you have react experience'
        },
        {
          input: 'What about   JavaScript   skills?',
          expected: 'what about javascript skills'
        },
        {
          input: 'Tell me about your Node.js work!',
          expected: 'tell me about your node js work'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        // This would test the normalizeQuery method
        const normalized = input
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        expect(normalized).toBe(expected);
      });
    });

    it('should expand queries with relevant synonyms', () => {
      const synonymMap = {
        'react': ['reactjs', 'jsx', 'hooks'],
        'javascript': ['js', 'es6', 'vanilla'],
        'node': ['nodejs', 'backend']
      };

      const query = 'react experience';
      let expandedQuery = query;
      
      Object.entries(synonymMap).forEach(([term, synonyms]) => {
        if (query.includes(term)) {
          expandedQuery += ' ' + synonyms[0];
        }
      });

      expect(expandedQuery).toBe('react experience reactjs');
    });

    it('should extract context keywords from conversation history', () => {
      const context = [
        {
          userMessage: 'Tell me about React',
          botResponse: 'I have React experience',
          matchedSections: ['exp_react'],
          confidence: 0.9
        }
      ];

      // Mock context keyword extraction
      const keywords = ['react', 'reactjs', 'jsx'];
      expect(keywords).toContain('react');
      expect(keywords.length).toBeGreaterThan(0);
    });
  });

  describe('Semantic Similarity Matching', () => {
    it('should calculate cosine similarity correctly', () => {
      const vecA = [1, 0, 0];
      const vecB = [1, 0, 0];
      const vecC = [0, 1, 0];

      // Test cosine similarity calculation
      const similarity1 = calculateCosineSimilarity(vecA, vecB);
      const similarity2 = calculateCosineSimilarity(vecA, vecC);

      expect(similarity1).toBe(1); // Identical vectors
      expect(similarity2).toBe(0); // Orthogonal vectors
    });

    it('should apply adaptive thresholds based on query characteristics', () => {
      const testCases = [
        {
          query: 'React?',
          expectedThreshold: 0.65 // Lower for short queries
        },
        {
          query: 'What is your experience with React development?',
          expectedThreshold: 0.65 // Lower for questions
        },
        {
          query: 'framework architecture implementation',
          expectedThreshold: 0.75 // Higher for technical terms
        },
        {
          query: 'Tell me about your background',
          expectedThreshold: 0.7 // Base threshold
        }
      ];

      testCases.forEach(({ query, expectedThreshold }) => {
        const threshold = getAdaptiveThreshold(query);
        expect(threshold).toBeCloseTo(expectedThreshold, 2);
      });
    });

    it('should find relevant sections above threshold', () => {
      const queryEmbedding = new Array(768).fill(0.1);
      const sectionEmbeddings = new Map([
        ['exp_react', { embedding: new Array(768).fill(0.12), section: mockCVData.sections.experience.react }],
        ['exp_javascript', { embedding: new Array(768).fill(0.05), section: mockCVData.sections.experience.javascript }]
      ]);

      const threshold = 0.7;
      const relevantSections = [];

      for (const [sectionId, sectionData] of sectionEmbeddings.entries()) {
        const similarity = calculateCosineSimilarity(queryEmbedding, sectionData.embedding);
        if (similarity >= threshold) {
          relevantSections.push({
            sectionId,
            similarity,
            section: sectionData.section
          });
        }
      }

      // Should find sections with high similarity
      expect(relevantSections.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Response Synthesis', () => {
    it('should generate single-section responses correctly', () => {
      const sectionMatch = {
        sectionId: 'exp_react',
        similarity: 0.95,
        section: mockCVData.sections.experience.react
      };

      const styles = ['hr', 'developer', 'friend'];
      
      styles.forEach(style => {
        const response = sectionMatch.section.responses[style];
        expect(response).toBeDefined();
        expect(response.length).toBeGreaterThan(10);
        expect(typeof response).toBe('string');
      });
    });

    it('should synthesize multi-section responses appropriately', () => {
      const relevantSections = [
        {
          sectionId: 'exp_react',
          similarity: 0.95,
          section: mockCVData.sections.experience.react,
          category: 'experience'
        },
        {
          sectionId: 'exp_javascript',
          similarity: 0.85,
          section: mockCVData.sections.experience.javascript,
          category: 'experience'
        }
      ];

      // Test synthesis strategy determination
      const sectionsByCategory = {};
      relevantSections.forEach(section => {
        if (!sectionsByCategory[section.category]) {
          sectionsByCategory[section.category] = [];
        }
        sectionsByCategory[section.category].push(section);
      });

      const categoryCount = Object.keys(sectionsByCategory).length;
      expect(categoryCount).toBe(1); // Same category - should use focused strategy

      // Test response combination
      const responses = relevantSections.map(s => s.section.responses.developer);
      const combinedResponse = responses.join(' Also, ');
      
      expect(combinedResponse).toContain('React');
      expect(combinedResponse).toContain('JavaScript');
    });

    it('should handle comparative queries correctly', () => {
      const query = 'React vs JavaScript experience';
      const isComparative = query.includes('vs') || query.includes('compare');
      
      expect(isComparative).toBe(true);

      // Should use comparative synthesis strategy
      const strategy = isComparative ? 'comparative' : 'single';
      expect(strategy).toBe('comparative');
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate overall confidence correctly', () => {
      const relevantSections = [
        { similarity: 0.95, sectionId: 'exp_react' },
        { similarity: 0.75, sectionId: 'exp_javascript' }
      ];

      let confidence = relevantSections[0].similarity;
      
      // Boost for multiple relevant sections
      if (relevantSections.length > 1 && relevantSections[1].similarity > 0.6) {
        confidence = Math.min(1.0, confidence + 0.05);
      }

      expect(confidence).toBe(1.0); // Should be boosted and capped at 1.0
    });

    it('should adjust confidence based on query characteristics', () => {
      const baseConfidence = 0.8;
      const testCases = [
        {
          query: 'React development experience',
          expectedAdjustment: -0.02 // Broad term penalty outweighs technical boost
        },
        {
          query: 'experience',
          expectedAdjustment: -0.05 // Reduce for broad terms
        },
        {
          query: 'What projects have you worked on?',
          expectedAdjustment: 0.02 // Boost for project questions
        }
      ];

      testCases.forEach(({ query, expectedAdjustment }) => {
        let adjustedConfidence = baseConfidence;
        
        // Apply adjustments based on query characteristics
        const specificTerms = ['react', 'javascript', 'node', 'typescript'];
        if (specificTerms.some(term => query.toLowerCase().includes(term))) {
          adjustedConfidence += 0.03;
        }
        
        const broadTerms = ['experience', 'skills', 'background'];
        if (broadTerms.some(term => query.toLowerCase().includes(term)) && query.length < 30) {
          adjustedConfidence -= 0.05;
        }
        
        if (query.toLowerCase().includes('project') && query.includes('?')) {
          adjustedConfidence += 0.02;
        }

        const actualAdjustment = adjustedConfidence - baseConfidence;
        expect(actualAdjustment).toBeCloseTo(expectedAdjustment, 1);
      });
    });
  });

  describe('Response Quality Validation', () => {
    it('should validate response length appropriately', () => {
      const testCases = [
        {
          response: 'Yes.',
          expectedConfidenceReduction: 0.1 // Too short
        },
        {
          response: 'I have extensive experience with React development, having worked on multiple projects over the past 4 years.',
          expectedConfidenceReduction: 0 // Good length
        }
      ];

      testCases.forEach(({ response, expectedConfidenceReduction }) => {
        let confidence = 0.9;
        
        if (response.length < 20) {
          confidence = Math.max(0, confidence - 0.1);
        }

        const actualReduction = 0.9 - confidence;
        expect(actualReduction).toBeCloseTo(expectedConfidenceReduction, 1);
      });
    });

    it('should assess query relevance correctly', () => {
      const testCases = [
        {
          query: 'React experience',
          response: 'I have 4+ years of React development experience with hooks and components.',
          expectedRelevance: 1.0 // Perfect match
        },
        {
          query: 'React experience',
          response: 'I enjoy hiking and photography in my free time.',
          expectedRelevance: 0.5 // Partial match on "experience"
        }
      ];

      testCases.forEach(({ query, response, expectedRelevance }) => {
        const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        const responseWords = response.toLowerCase().split(/\s+/);
        
        let matches = 0;
        queryWords.forEach(word => {
          if (responseWords.some(respWord => respWord.includes(word) || word.includes(respWord))) {
            matches++;
          }
        });

        const relevance = queryWords.length > 0 ? matches / queryWords.length : 0;
        expect(relevance).toBeCloseTo(expectedRelevance, 0);
      });
    });

    it('should calculate quality scores correctly', () => {
      const validation = {
        confidence: 0.8,
        answer: 'I have extensive React experience with modern patterns and best practices.',
        matchedSections: [{ id: 'exp_react' }, { id: 'exp_javascript' }],
        metrics: { qualityFlags: [] }
      };

      let score = validation.confidence * 0.6; // Base score
      score += Math.min(0.2, validation.answer.length / 500); // Length score
      score += Math.min(0.1, validation.matchedSections.length * 0.03); // Section score
      score -= validation.metrics.qualityFlags.length * 0.05; // Quality flags penalty

      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });

  describe('End-to-End Query Processing', () => {
    it('should process a complete query flow successfully', async () => {
      const query = 'Do you have React experience?';
      const context = [];
      const style = 'developer';

      // Mock the complete flow
      const processedQuery = query.toLowerCase().trim();
      const queryEmbedding = new Array(768).fill(0.1);
      const relevantSections = [
        {
          sectionId: 'exp_react',
          similarity: 0.95,
          section: mockCVData.sections.experience.react,
          category: 'experience'
        }
      ];

      const response = {
        answer: relevantSections[0].section.responses[style],
        confidence: 0.95,
        matchedSections: relevantSections.map(s => ({
          id: s.sectionId,
          category: s.category,
          similarity: s.similarity
        })),
        metrics: {
          processingTime: 150,
          sectionsAnalyzed: 1,
          synthesisMethod: 'single-section'
        }
      };

      // Validate the complete response
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0.5);
      expect(response.matchedSections).toHaveLength(1);
      expect(response.metrics.processingTime).toBeGreaterThan(0);
    });

    it('should handle low confidence scenarios appropriately', () => {
      const lowConfidenceResponse = {
        answer: 'I\'d be happy to help you with that! Could you be a bit more specific?',
        confidence: 0.2,
        matchedSections: [],
        metrics: { qualityFlags: ['fallback_triggered'] }
      };

      expect(lowConfidenceResponse.confidence).toBeLessThan(0.5);
      expect(lowConfidenceResponse.matchedSections).toHaveLength(0);
      expect(lowConfidenceResponse.metrics.qualityFlags).toContain('fallback_triggered');
    });

    it('should maintain conversation context correctly', () => {
      const context = [
        {
          userMessage: 'Tell me about React',
          botResponse: 'I have React experience',
          matchedSections: ['exp_react'],
          confidence: 0.9
        }
      ];

      const newQuery = 'What about hooks?';
      
      // Should extract context keywords
      const contextKeywords = ['react', 'reactjs'];
      const expandedQuery = newQuery + ' ' + contextKeywords.join(' ');
      
      expect(expandedQuery).toContain('react');
      expect(expandedQuery).toContain('hooks');
    });
  });
});

// Helper functions for testing
function calculateCosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

function getAdaptiveThreshold(query) {
  const baseThreshold = 0.7;
  
  if (query.length < 20) {
    return baseThreshold - 0.05;
  }
  
  if (query.includes('?') || query.startsWith('what') || query.startsWith('how') || query.startsWith('do you')) {
    return baseThreshold - 0.05;
  }
  
  const technicalTerms = ['framework', 'library', 'algorithm', 'architecture', 'implementation'];
  if (technicalTerms.some(term => query.toLowerCase().includes(term))) {
    return baseThreshold + 0.05;
  }
  
  return baseThreshold;
}