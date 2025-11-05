/**
 * Tests for ML Worker functionality
 * Note: These tests focus on testing the core algorithms and data structures
 * since the actual worker runs in a different context
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock sample CV data for testing
const mockCVData = {
  sections: {
    experience: {
      react: {
        id: 'exp_react',
        keywords: ['react', 'reactjs', 'jsx', 'hooks'],
        responses: {
          hr: 'Serhii has 3+ years of professional React development experience.',
          developer: 'I\'ve been working with React for 3+ years now. Really love the hooks ecosystem.',
          friend: 'Oh React! 🚀 That\'s definitely one of my favorite frameworks to work with.'
        },
        details: {
          years: 3,
          skills: ['Hooks', 'Context API', 'Redux']
        }
      }
    },
    skills: {
      javascript: {
        id: 'skill_js',
        keywords: ['javascript', 'js', 'es6'],
        responses: {
          hr: 'Serhii possesses advanced JavaScript skills with 5+ years of experience.',
          developer: 'JavaScript is my bread and butter - 5+ years of experience.',
          friend: 'JavaScript is like my native language at this point! 😄'
        },
        details: {
          years: 5,
          level: 'advanced'
        }
      }
    }
  }
};

// Helper functions to test (extracted from worker logic)
class MLWorkerHelpers {
  static createEmbeddingText(section) {
    const parts = [];
    
    if (section.keywords && Array.isArray(section.keywords)) {
      parts.push(section.keywords.join(' '));
    }

    if (section.responses && section.responses.developer) {
      parts.push(section.responses.developer);
    }

    if (section.details) {
      if (section.details.skills && Array.isArray(section.details.skills)) {
        parts.push(section.details.skills.join(' '));
      }
      if (section.details.technologies && Array.isArray(section.details.technologies)) {
        parts.push(section.details.technologies.join(' '));
      }
    }

    return parts.join(' ').toLowerCase();
  }

  static cosineSimilarity(vecA, vecB) {
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

  static getTotalSectionCount(sections) {
    let count = 0;
    for (const category of Object.values(sections)) {
      count += Object.keys(category).length;
    }
    return count;
  }

  static getNoMatchResponse(style) {
    const responses = {
      hr: "I don't have specific information about that in my professional background. Could you rephrase your question or ask about my experience, skills, or projects?",
      developer: "Hmm, I'm not sure I have relevant experience with that specific topic. Could you try rephrasing or ask about something else from my background?",
      friend: "Oops! 🤔 I'm not sure I can help with that one. Maybe try asking about my projects, skills, or work experience? I'd love to share more about those!"
    };

    return responses[style] || responses.developer;
  }
}

describe('ML Worker Core Functionality', () => {

  describe('Embedding Text Generation', () => {
    it('should create appropriate embedding text from section data', () => {
      const section = mockCVData.sections.experience.react;
      const embeddingText = MLWorkerHelpers.createEmbeddingText(section);
      
      expect(embeddingText).toContain('react');
      expect(embeddingText).toContain('hooks');
      expect(embeddingText).toContain('working with react');
      expect(embeddingText).toContain('context api');
    });

    it('should handle sections with missing data gracefully', () => {
      const incompleteSection = {
        id: 'test_section',
        responses: {
          developer: 'Test response'
        }
        // Missing keywords and details
      };

      const embeddingText = MLWorkerHelpers.createEmbeddingText(incompleteSection);
      expect(embeddingText).toBe('test response');
    });

    it('should handle completely empty section', () => {
      const emptySection = {};
      const embeddingText = MLWorkerHelpers.createEmbeddingText(emptySection);
      expect(embeddingText).toBe('');
    });
  });

  describe('Similarity Computation', () => {
    it('should calculate cosine similarity correctly for identical vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [1, 0, 0];
      
      const similarity = MLWorkerHelpers.cosineSimilarity(vecA, vecB);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate cosine similarity correctly for perpendicular vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      
      const similarity = MLWorkerHelpers.cosineSimilarity(vecA, vecB);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should handle zero vectors without division by zero', () => {
      const zeroVec = [0, 0, 0];
      const normalVec = [1, 2, 3];

      const similarity = MLWorkerHelpers.cosineSimilarity(zeroVec, normalVec);
      expect(similarity).toBe(0);
    });

    it('should throw error for vectors of different lengths', () => {
      const vecA = [1, 0];
      const vecB = [0, 1, 0];

      expect(() => {
        MLWorkerHelpers.cosineSimilarity(vecA, vecB);
      }).toThrow('Vectors must have the same length');
    });
  });

  describe('Response Generation', () => {
    it('should generate appropriate responses for different styles', () => {
      const section = mockCVData.sections.experience.react;

      // Verify all conversation styles have responses
      expect(section.responses.hr).toContain('professional');
      expect(section.responses.developer).toContain('working with React');
      expect(section.responses.friend).toContain('🚀');
    });

    it('should generate no-match responses for different styles', () => {
      const hrResponse = MLWorkerHelpers.getNoMatchResponse('hr');
      const devResponse = MLWorkerHelpers.getNoMatchResponse('developer');
      const friendResponse = MLWorkerHelpers.getNoMatchResponse('friend');

      expect(hrResponse).toContain('professional background');
      expect(devResponse).toContain('relevant experience');
      expect(friendResponse).toContain('🤔');
    });

    it('should fallback to developer style for unknown styles', () => {
      const unknownStyleResponse = MLWorkerHelpers.getNoMatchResponse('unknown');
      const devResponse = MLWorkerHelpers.getNoMatchResponse('developer');

      expect(unknownStyleResponse).toBe(devResponse);
    });
  });

  describe('CV Data Processing', () => {
    it('should count total sections correctly', () => {
      const sections = mockCVData.sections;
      const count = MLWorkerHelpers.getTotalSectionCount(sections);
      
      expect(count).toBe(2); // react + javascript
    });

    it('should handle empty CV data', () => {
      const emptySections = {};
      const count = MLWorkerHelpers.getTotalSectionCount(emptySections);
      
      expect(count).toBe(0);
    });

    it('should validate CV data structure', () => {
      // Verify required structure exists
      expect(mockCVData.sections).toBeDefined();
      expect(typeof mockCVData.sections).toBe('object');
      
      // Verify section structure
      const reactSection = mockCVData.sections.experience.react;
      expect(reactSection.id).toBeDefined();
      expect(reactSection.keywords).toBeDefined();
      expect(reactSection.responses).toBeDefined();
    });

    it('should handle nested category structure', () => {
      const complexSections = {
        experience: {
          react: { id: 'exp_react' },
          vue: { id: 'exp_vue' }
        },
        skills: {
          javascript: { id: 'skill_js' },
          python: { id: 'skill_py' },
          css: { id: 'skill_css' }
        },
        projects: {
          portfolio: { id: 'proj_portfolio' }
        }
      };

      const count = MLWorkerHelpers.getTotalSectionCount(complexSections);
      expect(count).toBe(6); // 2 + 3 + 1
    });
  });
});