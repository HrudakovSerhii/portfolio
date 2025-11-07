/**
 * Unit tests for Query Processor Utility Module
 * Tests query preprocessing, synonym expansion, and normalization functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  preprocessQuery,
  extractContextKeywords,
  expandQueryWithSynonyms,
  normalizeQuery,
  getAdaptiveThreshold
} from '../../../src/scripts/modules/semantic-qa/utils/query-processor.js';

describe('Query Processor Utility', () => {
  describe('preprocessQuery', () => {
    it('should process a basic query correctly', () => {
      const result = preprocessQuery('What is your React experience?');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('react');
    });

    it('should handle empty or invalid input', () => {
      expect(() => preprocessQuery('')).toThrow('Message must be a non-empty string');
      expect(() => preprocessQuery(null)).toThrow('Message must be a non-empty string');
      expect(() => preprocessQuery(undefined)).toThrow('Message must be a non-empty string');
      expect(() => preprocessQuery(123)).toThrow('Message must be a non-empty string');
    });

    it('should incorporate context keywords when provided', () => {
      const context = [
        {
          matchedSections: ['exp_react', 'proj_portfolio']
        }
      ];
      
      const result = preprocessQuery('Tell me more', context);
      
      expect(result).toContain('react');
      expect(result).toContain('proj'); // 'portfolio' gets split to 'proj' and 'portfolio', but only 'proj' is kept due to length filtering
    });

    it('should handle context without matched sections', () => {
      const context = [
        { userMessage: 'Hello' },
        { botResponse: 'Hi there!' }
      ];
      
      const result = preprocessQuery('What is your experience?', context);
      
      expect(result).toBeDefined();
      expect(result).toContain('experience');
    });
  });

  describe('extractContextKeywords', () => {
    it('should extract keywords from matched sections', () => {
      const context = [
        {
          matchedSections: ['exp_react', 'exp_javascript', 'proj_portfolio']
        },
        {
          matchedSections: ['exp_node']
        }
      ];
      
      const keywords = extractContextKeywords(context);
      
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords).toContain('exp');
      expect(keywords).toContain('react');
      expect(keywords).toContain('javascript');
      expect(keywords.length).toBeLessThanOrEqual(3); // Limited to 3
    });

    it('should handle empty or invalid context', () => {
      expect(extractContextKeywords([])).toEqual([]);
      expect(extractContextKeywords(null)).toEqual([]);
      expect(extractContextKeywords(undefined)).toEqual([]);
      expect(extractContextKeywords('invalid')).toEqual([]);
    });

    it('should handle context without matched sections', () => {
      const context = [
        { userMessage: 'Hello' },
        { botResponse: 'Hi!' }
      ];
      
      const keywords = extractContextKeywords(context);
      
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBe(0);
    });

    it('should filter out short keywords', () => {
      const context = [
        {
          matchedSections: ['a_b', 'exp_js', 'very_long_section_name']
        }
      ];
      
      const keywords = extractContextKeywords(context);
      
      expect(keywords).not.toContain('a');
      expect(keywords).not.toContain('b');
      expect(keywords).toContain('exp');
      expect(keywords).toContain('very');
    });
  });

  describe('expandQueryWithSynonyms', () => {
    it('should expand React queries with synonyms', () => {
      const result = expandQueryWithSynonyms('react experience');
      
      expect(result).toContain('react');
      expect(result).toContain('reactjs');
    });

    it('should expand JavaScript queries with synonyms', () => {
      const result = expandQueryWithSynonyms('javascript skills');
      
      expect(result).toContain('javascript');
      expect(result).toContain('js');
    });

    it('should expand multiple terms correctly', () => {
      const result = expandQueryWithSynonyms('react and node experience');
      
      expect(result).toContain('react');
      expect(result).toContain('reactjs');
      expect(result).toContain('node');
      expect(result).toContain('nodejs');
    });

    it('should handle queries without expandable terms', () => {
      const query = 'tell me about yourself';
      const result = expandQueryWithSynonyms(query);
      
      expect(result).toBe(query);
    });

    it('should handle empty or invalid input', () => {
      expect(expandQueryWithSynonyms('')).toBe('');
      expect(expandQueryWithSynonyms(null)).toBe(null);
      expect(expandQueryWithSynonyms(undefined)).toBe(undefined);
    });

    it('should expand CSS-related terms', () => {
      const result = expandQueryWithSynonyms('css styling');
      
      expect(result).toContain('css');
      expect(result).toContain('styling');
    });

    it('should expand database-related terms', () => {
      const result = expandQueryWithSynonyms('database experience');
      
      expect(result).toContain('database');
      expect(result).toContain('db');
    });
  });

  describe('normalizeQuery', () => {
    it('should remove special characters', () => {
      const result = normalizeQuery('What is your React experience???');
      
      expect(result).toBe('What is your React experience');
    });

    it('should normalize whitespace', () => {
      const result = normalizeQuery('What   about    JavaScript   skills?');
      
      expect(result).toBe('What about JavaScript skills');
    });

    it('should trim leading and trailing whitespace', () => {
      const result = normalizeQuery('  React experience  ');
      
      expect(result).toBe('React experience');
    });

    it('should handle mixed special characters and whitespace', () => {
      const result = normalizeQuery('Tell me about your Node.js work!!!   ');
      
      expect(result).toBe('Tell me about your Node js work');
    });

    it('should handle empty or invalid input', () => {
      expect(normalizeQuery('')).toBe('');
      expect(normalizeQuery(null)).toBe('');
      expect(normalizeQuery(undefined)).toBe('');
      expect(normalizeQuery(123)).toBe('');
    });

    it('should handle queries with only special characters', () => {
      const result = normalizeQuery('!@#$%^&*()');
      
      expect(result).toBe('');
    });

    it('should preserve alphanumeric characters', () => {
      const result = normalizeQuery('React16 and ES2020 features');
      
      expect(result).toBe('React16 and ES2020 features');
    });
  });

  describe('getAdaptiveThreshold', () => {
    it('should return default threshold for normal queries', () => {
      const result = getAdaptiveThreshold('Tell me about your background');
      
      expect(result).toBe(0.7);
    });

    it('should lower threshold for short queries', () => {
      const result = getAdaptiveThreshold('React?');
      
      expect(result).toBe(0.6);
    });

    it('should lower threshold for question queries', () => {
      const testCases = [
        'What is your experience with React development?', // Long enough to not trigger short query rule
        'How do you handle state management in applications?',
        'Do you know TypeScript and its advanced features?'
      ];
      
      testCases.forEach(query => {
        const result = getAdaptiveThreshold(query);
        expect(result).toBeCloseTo(0.65, 2);
      });
    });

    it('should raise threshold for technical queries', () => {
      const testCases = [
        'framework architecture patterns',
        'library implementation details',
        'algorithm optimization strategies'
      ];
      
      testCases.forEach(query => {
        const result = getAdaptiveThreshold(query);
        expect(result).toBe(0.75);
      });
    });

    it('should handle empty or invalid input', () => {
      expect(getAdaptiveThreshold('')).toBe(0.7);
      expect(getAdaptiveThreshold(null)).toBe(0.7);
      expect(getAdaptiveThreshold(undefined)).toBe(0.7);
    });

    it('should handle edge cases correctly', () => {
      // Very short query with question
      expect(getAdaptiveThreshold('What?')).toBe(0.6); // Short takes precedence
      
      // Technical question (question takes precedence over technical)
      expect(getAdaptiveThreshold('How does the framework work?')).toBeCloseTo(0.65, 2); // Question rule applies
      
      // Long technical query
      expect(getAdaptiveThreshold('Explain the implementation details of the framework architecture')).toBe(0.75);
    });

    it('should return values within valid range', () => {
      const testQueries = [
        'React?',
        'What is your experience with React development?',
        'framework architecture implementation',
        'Tell me about your background',
        '',
        'How does the library implementation work in complex scenarios?'
      ];
      
      testQueries.forEach(query => {
        const result = getAdaptiveThreshold(query);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should process complex queries end-to-end', () => {
      const context = [
        {
          matchedSections: ['exp_react', 'proj_portfolio']
        }
      ];
      
      const result = preprocessQuery('What about hooks???', context);
      
      expect(result).toBeDefined();
      expect(result).toContain('hooks');
      expect(result).toContain('react'); // From context
      expect(result).toContain('proj'); // From context (portfolio gets split)
      expect(result).not.toContain('?'); // Normalized
    });

    it('should handle queries with multiple processing steps', () => {
      const query = 'Tell me about your JavaScript and CSS experience!!!';
      const processed = preprocessQuery(query);
      
      expect(processed).toContain('javascript');
      expect(processed).toContain('js'); // Synonym expansion
      expect(processed).toContain('css');
      expect(processed).toContain('styling'); // Synonym expansion
      expect(processed).not.toContain('!'); // Normalized
    });
  });
});