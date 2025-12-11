import { describe, it, expect, beforeEach, vi } from 'vitest';
import CVDataService from '../src/scripts/modules/chat-bot/cv-data-service.js';

// Mock CV data for testing
const mockCVData = {
  metadata: {
    version: "1.0",
    lastUpdated: "2024-10-30",
    totalSections: 2,
    embeddingModel: "distilbert-base-uncased",
    embeddingDimensions: 768
  },
  sections: {
    experience: {
      react: {
        id: "exp_react",
        keywords: ["react", "reactjs", "jsx"],
        embeddings: null,
        responses: {
          hr: "Professional React experience with modern patterns and best practices.",
          developer: "I've been working with React for several years, love the ecosystem.",
          friend: "React is awesome! 🚀 Been using it for years and still love it."
        },
        details: {
          years: 4,
          level: "senior"
        },
        relatedSections: ["javascript", "frontend"]
      }
    },
    skills: {
      javascript: {
        id: "skill_js",
        keywords: ["javascript", "js", "es6"],
        embeddings: [0.1, 0.2, 0.3],
        responses: {
          hr: "Advanced JavaScript skills with modern ES6+ development experience.",
          developer: "JavaScript is my primary language, comfortable with all modern features.",
          friend: "JavaScript is like my native language at this point! 😄"
        },
        details: {
          years: 6,
          level: "expert"
        }
      }
    }
  },
  personality: {
    traits: ["curious", "problem-solver"],
    values: ["clean code", "user experience"],
    workStyle: ["analytical", "methodical"],
    interests: ["emerging technologies", "best practices"],
    communication_style: {
      hr: {
        tone: "professional, structured",
        language: "formal business language",
        focus: "accomplishments, metrics",
        greeting: "Hello! I'm excited to discuss my professional background."
      },
      developer: {
        tone: "technical, collaborative",
        language: "conversational with technical depth",
        focus: "technical details, problem-solving",
        greeting: "Hey there! Ready to dive into some technical discussions?"
      },
      friend: {
        tone: "casual, enthusiastic",
        language: "informal, expressive",
        focus: "personal experiences, learning journey",
        greeting: "Hi! 👋 So great to meet you!"
      }
    }
  },
  responseTemplates: {
    noMatch: {
      hr: "I don't have specific information about that topic in my professional background.",
      developer: "Hmm, that's not something I have details about in my experience.",
      friend: "Oops! 😅 I don't think I have info about that particular thing."
    },
    lowConfidence: {
      hr: "I may have some relevant experience, but could you be more specific?",
      developer: "I might have something related to that, but could you be a bit more specific?",
      friend: "I think I might know what you're asking about, but could you give me more detail? 🤔"
    },
    fallbackRequest: {
      hr: "Could you please rephrase your question or provide more specific details?",
      developer: "Let me make sure I understand what you're looking for. Could you rephrase that?",
      friend: "Hmm, I want to make sure I get this right! 🎯 Could you try asking that differently?"
    },
    emailFallback: {
      hr: "I'd be happy to connect you directly with Serhii for more detailed discussions.",
      developer: "Looks like this might need a more detailed conversation! Want to reach out directly?",
      friend: "You know what? This sounds like something Serhii should chat with you about directly! 😊"
    }
  }
};

const invalidCVData = {
  metadata: {
    version: "1.0"
    // Missing required fields
  },
  sections: {},
  personality: {},
  responseTemplates: {}
};

describe('CVDataService', () => {
  let service;

  beforeEach(() => {
    service = new CVDataService();
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(service.cvData).toBeNull();
      expect(service.isLoaded).toBe(false);
      expect(service.embeddingsCache).toBeInstanceOf(Map);
      expect(service.sectionsIndex).toBeInstanceOf(Map);
    });
  });

  describe('loadCVData', () => {
    it('should load and validate CV data successfully', async () => {
      // Mock successful fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCVData)
      });

      const result = await service.loadCVData();

      expect(global.fetch).toHaveBeenCalledWith('./cv/cv-data.json');
      expect(result).toEqual(mockCVData);
      expect(service.isLoaded).toBe(true);
      expect(service.cvData).toEqual(mockCVData);
    });

    it('should return cached data on subsequent calls', async () => {
      // First call
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCVData)
      });

      await service.loadCVData();

      // Second call should not fetch again
      const result = await service.loadCVData();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockCVData);
    });

    it('should throw error on fetch failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(service.loadCVData()).rejects.toThrow('Failed to load CV data: 404 Not Found');
    });

    it('should throw error on network failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.loadCVData()).rejects.toThrow('CV data loading failed: Network error');
    });

    it('should throw error on invalid data', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(invalidCVData)
      });

      await expect(service.loadCVData()).rejects.toThrow('CV data loading failed');
    });
  });

  describe('validateCVData', () => {
    it('should validate correct CV data structure', () => {
      expect(() => service.validateCVData(mockCVData)).not.toThrow();
    });

    it('should throw error for missing top-level properties', () => {
      const invalidData = { metadata: {} };
      expect(() => service.validateCVData(invalidData)).toThrow('Missing required property: sections');
    });

    it('should throw error for invalid metadata', () => {
      const invalidData = {
        ...mockCVData,
        metadata: { version: "1.0" } // Missing required fields
      };
      expect(() => service.validateCVData(invalidData)).toThrow('Invalid metadata structure');
    });

    it('should throw error for invalid section count', () => {
      const invalidData = {
        ...mockCVData,
        metadata: {
          ...mockCVData.metadata,
          totalSections: "invalid" // Should be number
        }
      };
      expect(() => service.validateCVData(invalidData)).toThrow('Invalid totalSections in metadata');
    });

    it('should throw error for missing communication styles', () => {
      const invalidData = {
        ...mockCVData,
        personality: {
          ...mockCVData.personality,
          communication_style: {
            hr: mockCVData.personality.communication_style.hr
            // Missing developer and friend styles
          }
        }
      };
      expect(() => service.validateCVData(invalidData)).toThrow('Missing communication style: developer');
    });
  });

  describe('validateSection', () => {
    it('should validate correct section structure', () => {
      const section = mockCVData.sections.experience.react;
      expect(() => service.validateSection(section, 'test.path')).not.toThrow();
    });

    it('should throw error for missing section properties', () => {
      const invalidSection = {
        id: "test_id",
        keywords: ["test"]
        // Missing required properties
      };
      expect(() => service.validateSection(invalidSection, 'test.path')).toThrow('Missing property embeddings in section: test.path');
    });

    it('should throw error for invalid ID format', () => {
      const invalidSection = {
        ...mockCVData.sections.experience.react,
        id: "invalid-id-format!" // Contains invalid characters
      };
      expect(() => service.validateSection(invalidSection, 'test.path')).toThrow('Invalid ID format in section: test.path');
    });

    it('should throw error for empty keywords', () => {
      const invalidSection = {
        ...mockCVData.sections.experience.react,
        keywords: [] // Empty array
      };
      expect(() => service.validateSection(invalidSection, 'test.path')).toThrow('Invalid keywords in section: test.path');
    });

    it('should throw error for invalid embeddings', () => {
      const invalidSection = {
        ...mockCVData.sections.experience.react,
        embeddings: ["invalid"] // Should be numbers or null
      };
      expect(() => service.validateSection(invalidSection, 'test.path')).toThrow('Invalid embeddings in section: test.path');
    });

    it('should throw error for short responses', () => {
      const invalidSection = {
        ...mockCVData.sections.experience.react,
        responses: {
          hr: "Short", // Too short (< 10 characters)
          developer: "Valid response text here",
          friend: "Another valid response text"
        }
      };
      expect(() => service.validateSection(invalidSection, 'test.path')).toThrow('Invalid hr response in section: test.path');
    });
  });

  describe('Section retrieval methods', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCVData)
      });
      await service.loadCVData();
    });

    describe('getSectionById', () => {
      it('should return section by ID', () => {
        const section = service.getSectionById('exp_react');
        expect(section).toEqual(mockCVData.sections.experience.react);
      });

      it('should return null for non-existent ID', () => {
        const section = service.getSectionById('non_existent');
        expect(section).toBeNull();
      });

      it('should throw error if data not loaded', () => {
        const newService = new CVDataService();
        expect(() => newService.getSectionById('exp_react')).toThrow('CV data not loaded');
      });
    });

    describe('getSectionsByCategory', () => {
      it('should return sections by category', () => {
        const sections = service.getSectionsByCategory('experience');
        expect(sections).toHaveLength(1);
        expect(sections[0].name).toBe('react');
        expect(sections[0].id).toBe('exp_react');
      });

      it('should return empty array for non-existent category', () => {
        const sections = service.getSectionsByCategory('non_existent');
        expect(sections).toEqual([]);
      });

      it('should throw error if data not loaded', () => {
        const newService = new CVDataService();
        expect(() => newService.getSectionsByCategory('experience')).toThrow('CV data not loaded');
      });
    });

    describe('findSectionsByKeywords', () => {
      it('should find sections by keywords', () => {
        const matches = service.findSectionsByKeywords(['react', 'javascript']);
        expect(matches).toHaveLength(2);

        // React section should have higher score (matches 'react')
        const reactMatch = matches.find(m => m.section.id === 'exp_react');
        const jsMatch = matches.find(m => m.section.id === 'skill_js');

        expect(reactMatch).toBeDefined();
        expect(jsMatch).toBeDefined();
        expect(reactMatch.matchedKeywords).toContain('react');
        expect(jsMatch.matchedKeywords).toContain('javascript');
      });

      it('should return empty array for no matches', () => {
        const matches = service.findSectionsByKeywords(['nonexistent']);
        expect(matches).toEqual([]);
      });

      it('should calculate relevance scores correctly', () => {
        const matches = service.findSectionsByKeywords(['react']);
        const reactMatch = matches.find(m => m.section.id === 'exp_react');
        expect(reactMatch.relevanceScore).toBe(1); // 1 match out of 1 keyword
      });

      it('should throw error if data not loaded', () => {
        const newService = new CVDataService();
        expect(() => newService.findSectionsByKeywords(['react'])).toThrow('CV data not loaded');
      });
    });
  });

  describe('Embeddings management', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCVData)
      });
      await service.loadCVData();
    });

    describe('getEmbeddings', () => {
      it('should return embeddings for section with embeddings', () => {
        const embeddings = service.getEmbeddings('skill_js');
        expect(embeddings).toEqual([0.1, 0.2, 0.3]);
      });

      it('should return null for section without embeddings', () => {
        const embeddings = service.getEmbeddings('exp_react');
        expect(embeddings).toBeNull();
      });

      it('should return null for non-existent section', () => {
        const embeddings = service.getEmbeddings('non_existent');
        expect(embeddings).toBeNull();
      });
    });

    describe('cacheEmbeddings', () => {
      it('should cache embeddings successfully', () => {
        const testEmbeddings = [0.4, 0.5, 0.6];
        service.cacheEmbeddings('exp_react', testEmbeddings);

        const cached = service.getCachedEmbeddings('exp_react');
        expect(cached).toEqual(testEmbeddings);
      });

      it('should update section embeddings when caching', () => {
        const testEmbeddings = [0.4, 0.5, 0.6];
        service.cacheEmbeddings('exp_react', testEmbeddings);

        const section = service.getSectionById('exp_react');
        expect(section.embeddings).toEqual(testEmbeddings);
      });

      it('should throw error for invalid embeddings format', () => {
        expect(() => service.cacheEmbeddings('exp_react', ['invalid'])).toThrow('Invalid embeddings format');
        expect(() => service.cacheEmbeddings('exp_react', 'invalid')).toThrow('Invalid embeddings format');
      });
    });

    describe('getCachedEmbeddings', () => {
      it('should return null for non-cached embeddings', () => {
        const cached = service.getCachedEmbeddings('non_existent');
        expect(cached).toBeNull();
      });
    });
  });

  describe('Data access methods', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCVData)
      });
      await service.loadCVData();
    });

    describe('getPersonality', () => {
      it('should return personality data', () => {
        const personality = service.getPersonality();
        expect(personality).toEqual(mockCVData.personality);
      });

      it('should throw error if data not loaded', () => {
        const newService = new CVDataService();
        expect(() => newService.getPersonality()).toThrow('CV data not loaded');
      });
    });

    describe('getResponseTemplates', () => {
      it('should return response templates', () => {
        const templates = service.getResponseTemplates();
        expect(templates).toEqual(mockCVData.responseTemplates);
      });

      it('should throw error if data not loaded', () => {
        const newService = new CVDataService();
        expect(() => newService.getResponseTemplates()).toThrow('CV data not loaded');
      });
    });

    describe('getCommunicationStyle', () => {
      it('should return communication style for valid style', () => {
        const hrStyle = service.getCommunicationStyle('hr');
        expect(hrStyle).toEqual(mockCVData.personality.communication_style.hr);
      });

      it('should throw error for invalid style', () => {
        expect(() => service.getCommunicationStyle('invalid')).toThrow('Invalid communication style: invalid');
      });
    });

    describe('getAllSections', () => {
      it('should return all sections with metadata', () => {
        const sections = service.getAllSections();
        expect(sections).toHaveLength(2);

        const reactSection = sections.find(s => s.id === 'exp_react');
        expect(reactSection.category).toBe('experience');
        expect(reactSection.name).toBe('react');
        expect(reactSection.path).toBe('experience.react');
      });

      it('should throw error if data not loaded', () => {
        const newService = new CVDataService();
        expect(() => newService.getAllSections()).toThrow('CV data not loaded');
      });
    });

    describe('getMetadata', () => {
      it('should return metadata', () => {
        const metadata = service.getMetadata();
        expect(metadata).toEqual(mockCVData.metadata);
      });

      it('should throw error if data not loaded', () => {
        const newService = new CVDataService();
        expect(() => newService.getMetadata()).toThrow('CV data not loaded');
      });
    });
  });

  describe('Utility methods', () => {
    describe('isDataLoaded', () => {
      it('should return false initially', () => {
        expect(service.isDataLoaded()).toBe(false);
      });

      it('should return true after loading data', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCVData)
        });

        await service.loadCVData();
        expect(service.isDataLoaded()).toBe(true);
      });
    });

    describe('reset', () => {
      it('should reset all service state', async () => {
        // Load data first
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCVData)
        });
        await service.loadCVData();

        // Cache some embeddings
        service.cacheEmbeddings('test_id', [0.1, 0.2, 0.3]);

        // Reset
        service.reset();

        expect(service.cvData).toBeNull();
        expect(service.isLoaded).toBe(false);
        expect(service.embeddingsCache.size).toBe(0);
        expect(service.sectionsIndex.size).toBe(0);
      });
    });
  });

  describe('buildSectionsIndex', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCVData)
      });
      await service.loadCVData();
    });

    it('should build index for section IDs', () => {
      const reactEntry = service.sectionsIndex.get('exp_react');
      expect(reactEntry).toBeDefined();
      expect(reactEntry.path).toBe('experience.react');
      expect(reactEntry.category).toBe('experience');
      expect(reactEntry.name).toBe('react');
    });

    it('should build index for keywords', () => {
      const reactKeywordEntries = service.sectionsIndex.get('keyword:react');
      expect(reactKeywordEntries).toBeDefined();
      expect(reactKeywordEntries).toHaveLength(1);
      expect(reactKeywordEntries[0].path).toBe('experience.react');
    });

    it('should handle multiple sections with same keyword', () => {
      const jsKeywordEntries = service.sectionsIndex.get('keyword:javascript');
      expect(jsKeywordEntries).toBeDefined();
      expect(jsKeywordEntries).toHaveLength(1);
      expect(jsKeywordEntries[0].section.id).toBe('skill_js');
    });
  });
});
