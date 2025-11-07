/**
 * Unit tests for Response Validator Utility Module
 * Tests response quality validation, hallucination detection, and confidence scoring
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateResponseQuality,
  assessQueryRelevance,
  calculateOverallConfidence,
  adjustConfidenceForQuery,
  calculateQualityScore,
  cleanAndValidateText,
  INVALID_PATTERNS
} from '../../../src/scripts/modules/semantic-qa/utils/response-validator.js';

describe('Response Validator Utility', () => {
  let mockResponse;

  beforeEach(() => {
    mockResponse = {
      answer: 'I have 4+ years of React development experience with modern patterns and best practices.',
      confidence: 0.85,
      matchedSections: [
        { id: 'exp_react', similarity: 0.9 },
        { id: 'exp_javascript', similarity: 0.7 }
      ],
      metrics: {
        processingTime: 150,
        sectionsAnalyzed: 2
      }
    };
  });

  describe('validateResponseQuality', () => {
    it('should validate a good quality response', () => {
      const result = validateResponseQuality(mockResponse, 'React experience');
      
      expect(result).toBeDefined();
      expect(result.answer).toBe(mockResponse.answer);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.metrics.qualityScore).toBeDefined();
    });

    it('should penalize short responses', () => {
      const shortResponse = {
        ...mockResponse,
        answer: 'Yes.',
        confidence: 0.8
      };
      
      const result = validateResponseQuality(shortResponse, 'React experience');
      
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.metrics.qualityFlags).toContain('short_response');
    });

    it('should penalize low relevance responses', () => {
      const irrelevantResponse = {
        ...mockResponse,
        answer: 'I enjoy hiking and photography in my free time.',
        confidence: 0.8
      };
      
      const result = validateResponseQuality(irrelevantResponse, 'React experience');
      
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.metrics.qualityFlags).toContain('low_relevance');
    });

    it('should trigger fallback for very low confidence', () => {
      const lowConfidenceResponse = {
        ...mockResponse,
        confidence: 0.2
      };
      
      const result = validateResponseQuality(lowConfidenceResponse, 'React experience');
      
      expect(result.confidence).toBe(0.2);
      expect(result.answer).toContain('I\'d be happy to help');
      expect(result.matchedSections).toEqual([]);
      expect(result.metrics.qualityFlags).toContain('fallback_triggered');
    });

    it('should handle empty or invalid input', () => {
      expect(() => validateResponseQuality(null, 'query')).toThrow('Response must be an object');
      expect(() => validateResponseQuality({}, null)).toThrow('Original query must be a non-empty string');
      expect(() => validateResponseQuality({}, '')).toThrow('Original query must be a non-empty string');
    });

    it('should handle response with missing properties', () => {
      const minimalResponse = {};
      
      const result = validateResponseQuality(minimalResponse, 'test query');
      
      expect(result.answer).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.matchedSections).toEqual([]);
      expect(result.metrics).toBeDefined();
    });

    it('should calculate quality score', () => {
      const result = validateResponseQuality(mockResponse, 'React experience');
      
      expect(result.metrics.qualityScore).toBeDefined();
      expect(typeof result.metrics.qualityScore).toBe('number');
      expect(result.metrics.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.metrics.qualityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('assessQueryRelevance', () => {
    it('should assess high relevance correctly', () => {
      const response = 'I have extensive React development experience with hooks and components.';
      const query = 'React experience';
      
      const relevance = assessQueryRelevance(response, query);
      
      expect(relevance).toBeGreaterThan(0.5);
      expect(relevance).toBeLessThanOrEqual(1);
    });

    it('should assess low relevance correctly', () => {
      const response = 'I enjoy hiking and photography in my free time.';
      const query = 'React experience';
      
      const relevance = assessQueryRelevance(response, query);
      
      expect(relevance).toBeLessThan(0.5);
    });

    it('should handle partial matches', () => {
      const response = 'I have experience with various technologies and frameworks.';
      const query = 'React experience';
      
      const relevance = assessQueryRelevance(response, query);
      
      expect(relevance).toBeGreaterThan(0);
      expect(relevance).toBeLessThan(1);
    });

    it('should handle empty or invalid input', () => {
      expect(assessQueryRelevance('', 'query')).toBe(0);
      expect(assessQueryRelevance(null, 'query')).toBe(0);
      expect(assessQueryRelevance('response', '')).toBe(0);
      expect(assessQueryRelevance('response', null)).toBe(0);
    });

    it('should filter out short words', () => {
      const response = 'I am a React developer with experience in the field.';
      const query = 'React experience in the field';
      
      const relevance = assessQueryRelevance(response, query);
      
      // Should match 'React', 'experience', 'field' but not 'in', 'the'
      expect(relevance).toBeGreaterThan(0.5);
    });

    it('should handle case insensitive matching', () => {
      const response = 'I have REACT development EXPERIENCE.';
      const query = 'react experience';
      
      const relevance = assessQueryRelevance(response, query);
      
      expect(relevance).toBe(1); // Perfect match
    });

    it('should handle substring matching', () => {
      const response = 'I work with ReactJS and JavaScript frameworks.';
      const query = 'React JavaScript';
      
      const relevance = assessQueryRelevance(response, query);
      
      expect(relevance).toBe(1); // Both terms found as substrings
    });
  });

  describe('calculateOverallConfidence', () => {
    it('should calculate confidence from relevant sections', () => {
      const relevantSections = [
        { similarity: 0.9 },
        { similarity: 0.7 }
      ];
      
      const confidence = calculateOverallConfidence(relevantSections, 'React experience');
      
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
      expect(confidence).toBeCloseTo(0.95, 1); // 0.9 + 0.05 boost
    });

    it('should boost confidence for multiple relevant sections', () => {
      const singleSection = [{ similarity: 0.8 }];
      const multipleSections = [
        { similarity: 0.8 },
        { similarity: 0.7 }
      ];
      
      const singleConfidence = calculateOverallConfidence(singleSection, 'query');
      const multipleConfidence = calculateOverallConfidence(multipleSections, 'query');
      
      expect(multipleConfidence).toBeGreaterThan(singleConfidence);
    });

    it('should not boost for low secondary similarity', () => {
      const sections = [
        { similarity: 0.8 },
        { similarity: 0.5 } // Below 0.6 threshold
      ];
      
      const confidence = calculateOverallConfidence(sections, 'query');
      
      expect(confidence).toBeCloseTo(0.8, 1); // No boost applied
    });

    it('should handle empty or invalid input', () => {
      expect(calculateOverallConfidence([], 'query')).toBe(0);
      expect(calculateOverallConfidence(null, 'query')).toBe(0);
      expect(calculateOverallConfidence([{ similarity: 0.8 }], '')).toBe(0);
      expect(calculateOverallConfidence([{ similarity: 0.8 }], null)).toBe(0);
    });

    it('should cap confidence at 1.0', () => {
      const sections = [
        { similarity: 0.98 },
        { similarity: 0.9 }
      ];
      
      const confidence = calculateOverallConfidence(sections, 'specific technical query');
      
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should ensure minimum confidence of 0', () => {
      const sections = [{ similarity: -0.5 }]; // Invalid negative similarity
      
      const confidence = calculateOverallConfidence(sections, 'query');
      
      expect(confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('adjustConfidenceForQuery', () => {
    it('should boost confidence for specific technical terms', () => {
      const baseConfidence = 0.7;
      const technicalQueries = [
        'React development',
        'JavaScript frameworks',
        'Node.js backend',
        'TypeScript interfaces',
        'SCSS styling'
      ];
      
      technicalQueries.forEach(query => {
        const adjusted = adjustConfidenceForQuery(baseConfidence, query);
        expect(adjusted).toBeGreaterThan(baseConfidence);
      });
    });

    it('should reduce confidence for broad terms', () => {
      const baseConfidence = 0.7;
      const broadQueries = [
        'experience',
        'skills',
        'background',
        'about yourself'
      ];
      
      broadQueries.forEach(query => {
        const adjusted = adjustConfidenceForQuery(baseConfidence, query);
        expect(adjusted).toBeLessThan(baseConfidence);
      });
    });

    it('should boost confidence for project questions', () => {
      const baseConfidence = 0.7;
      const query = 'What projects have you worked on?';
      
      const adjusted = adjustConfidenceForQuery(baseConfidence, query);
      
      expect(adjusted).toBeGreaterThan(baseConfidence);
    });

    it('should handle empty or invalid input', () => {
      expect(adjustConfidenceForQuery('invalid', 'query')).toBe(0);
      expect(adjustConfidenceForQuery(0.7, '')).toBe(0.7);
      expect(adjustConfidenceForQuery(0.7, null)).toBe(0.7);
    });

    it('should handle combined adjustments', () => {
      const baseConfidence = 0.7;
      
      // Technical term + broad term
      const query1 = 'React experience'; // +0.03 - 0.05 = -0.02
      const adjusted1 = adjustConfidenceForQuery(baseConfidence, query1);
      expect(adjusted1).toBeCloseTo(0.68, 1);
      
      // Technical term + project question
      const query2 = 'What React projects have you built?'; // +0.03 + 0.02 = +0.05
      const adjusted2 = adjustConfidenceForQuery(baseConfidence, query2);
      expect(adjusted2).toBeCloseTo(0.75, 1);
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score from validation object', () => {
      const validation = {
        confidence: 0.8,
        answer: 'I have extensive React experience with modern patterns and best practices.',
        matchedSections: [{ id: 'exp_react' }, { id: 'exp_javascript' }],
        metrics: { qualityFlags: [] }
      };
      
      const score = calculateQualityScore(validation);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should weight confidence heavily in score', () => {
      const highConfidence = {
        confidence: 0.9,
        answer: 'Short answer.',
        matchedSections: [],
        metrics: { qualityFlags: [] }
      };
      
      const lowConfidence = {
        confidence: 0.3,
        answer: 'This is a much longer and more detailed answer with lots of information.',
        matchedSections: [{ id: 'section1' }, { id: 'section2' }],
        metrics: { qualityFlags: [] }
      };
      
      const highScore = calculateQualityScore(highConfidence);
      const lowScore = calculateQualityScore(lowConfidence);
      
      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('should add points for answer length', () => {
      const shortAnswer = {
        confidence: 0.5,
        answer: 'Yes.',
        matchedSections: [],
        metrics: { qualityFlags: [] }
      };
      
      const longAnswer = {
        confidence: 0.5,
        answer: 'I have extensive experience with React development, including modern patterns, hooks, context API, and state management solutions like Redux. I\'ve built multiple production applications using these technologies.',
        matchedSections: [],
        metrics: { qualityFlags: [] }
      };
      
      const shortScore = calculateQualityScore(shortAnswer);
      const longScore = calculateQualityScore(longAnswer);
      
      expect(longScore).toBeGreaterThan(shortScore);
    });

    it('should add points for multiple matched sections', () => {
      const singleSection = {
        confidence: 0.5,
        answer: 'Good answer.',
        matchedSections: [{ id: 'section1' }],
        metrics: { qualityFlags: [] }
      };
      
      const multipleSections = {
        confidence: 0.5,
        answer: 'Good answer.',
        matchedSections: [{ id: 'section1' }, { id: 'section2' }, { id: 'section3' }],
        metrics: { qualityFlags: [] }
      };
      
      const singleScore = calculateQualityScore(singleSection);
      const multipleScore = calculateQualityScore(multipleSections);
      
      expect(multipleScore).toBeGreaterThan(singleScore);
    });

    it('should subtract points for quality flags', () => {
      const noFlags = {
        confidence: 0.8,
        answer: 'Good answer.',
        matchedSections: [],
        metrics: { qualityFlags: [] }
      };
      
      const withFlags = {
        confidence: 0.8,
        answer: 'Good answer.',
        matchedSections: [],
        metrics: { qualityFlags: ['short_response', 'low_relevance'] }
      };
      
      const noFlagsScore = calculateQualityScore(noFlags);
      const withFlagsScore = calculateQualityScore(withFlags);
      
      expect(withFlagsScore).toBeLessThan(noFlagsScore);
    });

    it('should handle empty or invalid input', () => {
      expect(calculateQualityScore(null)).toBe(0);
      expect(calculateQualityScore(undefined)).toBe(0);
      expect(calculateQualityScore({})).toBeGreaterThanOrEqual(0);
    });

    it('should cap score between 0 and 1', () => {
      const extremeValidation = {
        confidence: 2.0, // Invalid high confidence
        answer: 'A'.repeat(1000), // Very long answer
        matchedSections: new Array(100).fill({ id: 'section' }), // Many sections
        metrics: { qualityFlags: [] }
      };
      
      const score = calculateQualityScore(extremeValidation);
      
      expect(score).toBeLessThanOrEqual(1);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cleanAndValidateText', () => {
    it('should clean valid text correctly', () => {
      const text = 'I have extensive React development experience.';
      const result = cleanAndValidateText(text);
      
      expect(result).toBe(text);
    });

    it('should remove response prefixes', () => {
      const text = 'Response: I have React experience.';
      const result = cleanAndValidateText(text);
      
      expect(result).toBe('I have React experience.');
    });

    it('should normalize whitespace', () => {
      const text = 'I  have   React\n\nexperience.';
      const result = cleanAndValidateText(text);
      
      expect(result).toBe('I have React experience.');
    });

    it('should reject text with hallucinated content', () => {
      const invalidTexts = [
        'I am Serdii and I love React.',
        'Webpack makes my life so much easier.',
        'I work with pylons framework.',
        'There are 5 guys on my team.'
      ];
      
      invalidTexts.forEach(text => {
        const result = cleanAndValidateText(text);
        expect(result).toBe(null);
      });
    });

    it('should reject text that is too short', () => {
      const result = cleanAndValidateText('Yes.');
      
      expect(result).toBe(null);
    });

    it('should reject text that does not start appropriately', () => {
      const invalidStarts = [
        'The system has React experience.',
        'React is a great framework.',
        'Based on the information provided...'
      ];
      
      invalidStarts.forEach(text => {
        const result = cleanAndValidateText(text);
        expect(result).toBe(null);
      });
    });

    it('should accept text starting with valid patterns', () => {
      const validStarts = [
        'I have React experience.',
        'Yes, I work with JavaScript.',
        'No, I haven\'t used that framework.'
      ];
      
      validStarts.forEach(text => {
        const result = cleanAndValidateText(text);
        expect(result).toBe(text);
      });
    });

    it('should handle empty or invalid input', () => {
      expect(cleanAndValidateText('')).toBe(null);
      expect(cleanAndValidateText(null)).toBe(null);
      expect(cleanAndValidateText(undefined)).toBe(null);
      expect(cleanAndValidateText(123)).toBe(null);
    });

    it('should handle edge cases', () => {
      // Text with only prefixes
      expect(cleanAndValidateText('Response:')).toBe(null);
      
      // Text with multiple prefixes
      const result = cleanAndValidateText('Answer: Response: I have experience.');
      expect(result).toBe('I have experience.');
    });
  });

  describe('INVALID_PATTERNS', () => {
    it('should be an array of RegExp objects', () => {
      expect(Array.isArray(INVALID_PATTERNS)).toBe(true);
      expect(INVALID_PATTERNS.length).toBeGreaterThan(0);
      
      INVALID_PATTERNS.forEach(pattern => {
        expect(pattern instanceof RegExp).toBe(true);
      });
    });

    it('should match known hallucination patterns', () => {
      const testCases = [
        { text: 'I am Serdii', shouldMatch: true },
        { text: 'webpack configuration', shouldMatch: true },
        { text: 'pylons framework', shouldMatch: true },
        { text: '5 guys working', shouldMatch: true },
        { text: 'I have React experience', shouldMatch: false },
        { text: 'JavaScript development', shouldMatch: false }
      ];
      
      testCases.forEach(({ text, shouldMatch }) => {
        const matches = INVALID_PATTERNS.some(pattern => pattern.test(text));
        expect(matches).toBe(shouldMatch);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should process complete validation workflow', () => {
      const response = {
        answer: 'I have 4+ years of React development experience with hooks and modern patterns.',
        confidence: 0.85,
        matchedSections: [{ id: 'exp_react', similarity: 0.9 }],
        metrics: { processingTime: 150 }
      };
      
      const validated = validateResponseQuality(response, 'React development experience');
      
      expect(validated.answer).toBeDefined();
      expect(validated.confidence).toBeGreaterThan(0);
      expect(validated.metrics.qualityScore).toBeDefined();
      
      // Test individual components
      const relevance = assessQueryRelevance(validated.answer, 'React development experience');
      expect(relevance).toBeGreaterThan(0.5);
      
      const cleanedText = cleanAndValidateText(validated.answer);
      expect(cleanedText).toBe(validated.answer);
    });

    it('should handle complete failure scenario', () => {
      const badResponse = {
        answer: 'Serdii loves webpack and pylons.',
        confidence: 0.1,
        matchedSections: [],
        metrics: {}
      };
      
      const validated = validateResponseQuality(badResponse, 'React experience');
      
      expect(validated.confidence).toBe(0.2); // Fallback confidence
      expect(validated.answer).toContain('I\'d be happy to help');
      expect(validated.metrics.qualityFlags).toContain('fallback_triggered');
    });
  });
});