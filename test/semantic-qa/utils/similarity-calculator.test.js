/**
 * Unit tests for Similarity Calculator Utility Module
 * Tests cosine similarity calculations, chunk ranking, and threshold filtering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateCosineSimilarity,
  findSimilarChunks,
  rankSectionsBySimilarity,
  applySimilarityThreshold
} from '../../../src/scripts/modules/semantic-qa/utils/similarity-calculator.js';

describe('Similarity Calculator Utility', () => {
  describe('calculateCosineSimilarity', () => {
    it('should calculate similarity for identical vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      
      const similarity = calculateCosineSimilarity(vec1, vec2);
      
      expect(similarity).toBe(1);
    });

    it('should calculate similarity for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      
      const similarity = calculateCosineSimilarity(vec1, vec2);
      
      expect(similarity).toBe(0);
    });

    it('should calculate similarity for opposite vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      
      const similarity = calculateCosineSimilarity(vec1, vec2);
      
      expect(similarity).toBe(-1);
    });

    it('should calculate similarity for real-world embeddings', () => {
      const vec1 = [0.5, 0.3, 0.8, 0.1];
      const vec2 = [0.4, 0.2, 0.7, 0.2];
      
      const similarity = calculateCosineSimilarity(vec1, vec2);
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
      expect(similarity).toBeCloseTo(0.97, 1);
    });

    it('should handle zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 2, 3];
      
      const similarity = calculateCosineSimilarity(vec1, vec2);
      
      expect(similarity).toBe(0);
    });

    it('should handle vectors with negative values', () => {
      const vec1 = [-0.5, 0.3, -0.8];
      const vec2 = [0.4, -0.2, 0.7];
      
      const similarity = calculateCosineSimilarity(vec1, vec2);
      
      expect(similarity).toBeGreaterThan(-1);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle empty vectors', () => {
      const vec1 = [];
      const vec2 = [];
      
      const similarity = calculateCosineSimilarity(vec1, vec2);
      
      expect(similarity).toBe(0);
    });

    it('should handle single-element vectors', () => {
      const vec1 = [5];
      const vec2 = [3];
      
      const similarity = calculateCosineSimilarity(vec1, vec2);
      
      expect(similarity).toBe(1); // Same direction
    });

    it('should handle large vectors efficiently', () => {
      const size = 768; // Common embedding size
      const vec1 = new Array(size).fill(0).map(() => Math.random());
      const vec2 = new Array(size).fill(0).map(() => Math.random());
      
      const start = performance.now();
      const similarity = calculateCosineSimilarity(vec1, vec2);
      const end = performance.now();
      
      expect(similarity).toBeGreaterThan(-1);
      expect(similarity).toBeLessThan(1);
      expect(end - start).toBeLessThan(10); // Should be fast
    });

    it('should throw error for mismatched vector lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      
      expect(() => calculateCosineSimilarity(vec1, vec2)).toThrow('Embeddings must have the same length');
    });

    it('should throw error for non-array inputs', () => {
      expect(() => calculateCosineSimilarity('invalid', [1, 2, 3])).toThrow('Embeddings must be arrays');
      expect(() => calculateCosineSimilarity([1, 2, 3], null)).toThrow('Embeddings must be arrays');
      expect(() => calculateCosineSimilarity(undefined, [1, 2, 3])).toThrow('Embeddings must be arrays');
    });

    it('should be symmetric', () => {
      const vec1 = [0.5, 0.3, 0.8];
      const vec2 = [0.4, 0.2, 0.7];
      
      const similarity1 = calculateCosineSimilarity(vec1, vec2);
      const similarity2 = calculateCosineSimilarity(vec2, vec1);
      
      expect(similarity1).toBeCloseTo(similarity2, 10);
    });
  });

  describe('findSimilarChunks', () => {
    let mockCVChunks;

    beforeEach(() => {
      mockCVChunks = [
        {
          id: 'chunk1',
          text: 'React development experience',
          embedding: [0.8, 0.2, 0.1, 0.5],
          category: 'experience'
        },
        {
          id: 'chunk2',
          text: 'JavaScript programming skills',
          embedding: [0.7, 0.3, 0.2, 0.4],
          category: 'skills'
        },
        {
          id: 'chunk3',
          text: 'Node.js backend development',
          embedding: [0.3, 0.7, 0.8, 0.1],
          category: 'experience'
        },
        {
          id: 'chunk4',
          text: 'CSS styling and design',
          embedding: [0.1, 0.1, 0.9, 0.8],
          category: 'skills'
        }
      ];
    });

    it('should find similar chunks and rank by similarity', () => {
      const questionEmbedding = [0.8, 0.2, 0.1, 0.5]; // Similar to chunk1
      
      const result = findSimilarChunks(questionEmbedding, mockCVChunks, 3);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(3);
      expect(result[0].id).toBe('chunk1'); // Should be most similar
      expect(result[0].similarity).toBe(1); // Identical vectors
      
      // Should be sorted by similarity (highest first)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].similarity).toBeGreaterThanOrEqual(result[i + 1].similarity);
      }
    });

    it('should respect maxChunks parameter', () => {
      const questionEmbedding = [0.5, 0.5, 0.5, 0.5];
      
      const result = findSimilarChunks(questionEmbedding, mockCVChunks, 2);
      
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should handle default maxChunks', () => {
      const questionEmbedding = [0.5, 0.5, 0.5, 0.5];
      
      const result = findSimilarChunks(questionEmbedding, mockCVChunks);
      
      expect(result.length).toBeLessThanOrEqual(5); // Default maxChunks
    });

    it('should handle chunks without embeddings', () => {
      const chunksWithMissing = [
        ...mockCVChunks,
        {
          id: 'chunk5',
          text: 'No embedding chunk',
          category: 'other'
        }
      ];
      
      const questionEmbedding = [0.5, 0.5, 0.5, 0.5];
      
      const result = findSimilarChunks(questionEmbedding, chunksWithMissing);
      
      expect(result.length).toBe(4); // Should skip chunk without embedding
      expect(result.every(chunk => chunk.embedding)).toBe(true);
    });

    it('should handle invalid embeddings gracefully', () => {
      const chunksWithInvalid = [
        ...mockCVChunks,
        {
          id: 'chunk6',
          text: 'Invalid embedding chunk',
          embedding: 'not an array',
          category: 'other'
        }
      ];
      
      const questionEmbedding = [0.5, 0.5, 0.5, 0.5];
      
      const result = findSimilarChunks(questionEmbedding, chunksWithInvalid);
      
      expect(result.length).toBe(4); // Should skip invalid embedding
    });

    it('should handle empty or invalid input', () => {
      expect(() => findSimilarChunks('invalid', mockCVChunks)).toThrow('Question embedding must be an array');
      expect(findSimilarChunks([1, 2, 3], [])).toEqual([]);
      expect(findSimilarChunks([1, 2, 3], null)).toEqual([]);
      expect(findSimilarChunks([1, 2, 3], 'invalid')).toEqual([]);
    });

    it('should handle invalid maxChunks parameter', () => {
      const questionEmbedding = [0.5, 0.5, 0.5, 0.5];
      
      const result1 = findSimilarChunks(questionEmbedding, mockCVChunks, 0);
      expect(result1.length).toBeLessThanOrEqual(5); // Should use default
      
      const result2 = findSimilarChunks(questionEmbedding, mockCVChunks, -1);
      expect(result2.length).toBeLessThanOrEqual(5); // Should use default
      
      const result3 = findSimilarChunks(questionEmbedding, mockCVChunks, 'invalid');
      expect(result3.length).toBeLessThanOrEqual(5); // Should use default
    });

    it('should preserve original chunk data', () => {
      const questionEmbedding = [0.8, 0.2, 0.1, 0.5];
      
      const result = findSimilarChunks(questionEmbedding, mockCVChunks, 2);
      
      expect(result[0].text).toBe('React development experience');
      expect(result[0].category).toBe('experience');
      expect(result[0].index).toBe(0);
    });
  });

  describe('rankSectionsBySimilarity', () => {
    let mockSections;

    beforeEach(() => {
      mockSections = [
        {
          id: 'section1',
          title: 'React Experience',
          embedding: [0.8, 0.2, 0.1],
          content: 'React development'
        },
        {
          id: 'section2',
          title: 'JavaScript Skills',
          embedding: [0.7, 0.3, 0.2],
          content: 'JavaScript programming'
        },
        {
          id: 'section3',
          title: 'Backend Development',
          embedding: [0.3, 0.7, 0.8],
          content: 'Node.js backend'
        }
      ];
    });

    it('should rank sections by similarity to query', () => {
      const queryEmbedding = [0.8, 0.2, 0.1]; // Similar to section1
      
      const result = rankSectionsBySimilarity(mockSections, queryEmbedding);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0].id).toBe('section1'); // Most similar
      expect(result[0].similarity).toBeCloseTo(1, 10); // Identical (handle floating point precision)
      
      // Should be sorted by similarity (highest first)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].similarity).toBeGreaterThanOrEqual(result[i + 1].similarity);
      }
    });

    it('should preserve original section data', () => {
      const queryEmbedding = [0.5, 0.5, 0.5];
      
      const result = rankSectionsBySimilarity(mockSections, queryEmbedding);
      
      // The result is sorted by similarity, so we need to check the originalIndex property
      expect(result[0].originalIndex).toBeDefined();
      expect(result[1].originalIndex).toBeDefined();
      expect(result[2].originalIndex).toBeDefined();
      
      // Verify all original data is preserved
      result.forEach(section => {
        const originalSection = mockSections[section.originalIndex];
        expect(section.id).toBe(originalSection.id);
        expect(section.title).toBe(originalSection.title);
        expect(section.content).toBe(originalSection.content);
      });
    });

    it('should handle sections without embeddings', () => {
      const sectionsWithMissing = [
        ...mockSections,
        {
          id: 'section4',
          title: 'No Embedding Section',
          content: 'No embedding'
        }
      ];
      
      const queryEmbedding = [0.5, 0.5, 0.5];
      
      const result = rankSectionsBySimilarity(sectionsWithMissing, queryEmbedding);
      
      expect(result.length).toBe(4);
      const noEmbeddingSection = result.find(s => s.id === 'section4');
      expect(noEmbeddingSection.similarity).toBe(0);
    });

    it('should handle invalid embeddings gracefully', () => {
      const sectionsWithInvalid = [
        {
          id: 'section1',
          embedding: [0.8, 0.2, 0.1],
          title: 'Valid Section'
        },
        {
          id: 'section2',
          embedding: 'invalid',
          title: 'Invalid Section'
        }
      ];
      
      const queryEmbedding = [0.5, 0.5, 0.5];
      
      const result = rankSectionsBySimilarity(sectionsWithInvalid, queryEmbedding);
      
      expect(result.length).toBe(2);
      expect(result[0].similarity).toBeGreaterThan(0); // Valid section
      expect(result[1].similarity).toBe(0); // Invalid section gets 0
    });

    it('should handle empty or invalid input', () => {
      expect(rankSectionsBySimilarity([], [1, 2, 3])).toEqual([]);
      expect(rankSectionsBySimilarity(null, [1, 2, 3])).toEqual([]);
      expect(rankSectionsBySimilarity('invalid', [1, 2, 3])).toEqual([]);
      
      expect(() => rankSectionsBySimilarity(mockSections, 'invalid')).toThrow('Query embedding must be an array');
      expect(() => rankSectionsBySimilarity(mockSections, null)).toThrow('Query embedding must be an array');
    });

    it('should maintain stable sort for equal similarities', () => {
      const sectionsWithEqualSim = [
        {
          id: 'section1',
          embedding: [0.5, 0.5, 0.5],
          order: 1
        },
        {
          id: 'section2',
          embedding: [0.5, 0.5, 0.5],
          order: 2
        }
      ];
      
      const queryEmbedding = [0.5, 0.5, 0.5];
      
      const result = rankSectionsBySimilarity(sectionsWithEqualSim, queryEmbedding);
      
      expect(result[0].similarity).toBe(result[1].similarity);
      expect(result[0].originalIndex).toBe(0);
      expect(result[1].originalIndex).toBe(1);
    });
  });

  describe('applySimilarityThreshold', () => {
    let mockMatches;

    beforeEach(() => {
      mockMatches = [
        { id: 'match1', similarity: 0.9, text: 'High similarity' },
        { id: 'match2', similarity: 0.7, text: 'Medium similarity' },
        { id: 'match3', similarity: 0.4, text: 'Low similarity' },
        { id: 'match4', similarity: 0.2, text: 'Very low similarity' }
      ];
    });

    it('should filter matches above threshold', () => {
      const result = applySimilarityThreshold(mockMatches, 0.6);
      
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('match1');
      expect(result[1].id).toBe('match2');
      expect(result.every(match => match.similarity >= 0.6)).toBe(true);
    });

    it('should use default threshold when not provided', () => {
      const result = applySimilarityThreshold(mockMatches);
      
      expect(result.length).toBe(2); // Above 0.5 default
      expect(result.every(match => match.similarity >= 0.5)).toBe(true);
    });

    it('should handle threshold of 0', () => {
      const result = applySimilarityThreshold(mockMatches, 0);
      
      expect(result.length).toBe(4); // All matches
    });

    it('should handle threshold of 1', () => {
      const result = applySimilarityThreshold(mockMatches, 1);
      
      expect(result.length).toBe(0); // No perfect matches
    });

    it('should handle matches without similarity property', () => {
      const matchesWithMissing = [
        { id: 'match1', similarity: 0.8 },
        { id: 'match2' }, // No similarity property
        { id: 'match3', similarity: 0.6 }
      ];
      
      const result = applySimilarityThreshold(matchesWithMissing, 0.5);
      
      expect(result.length).toBe(2); // Only matches with similarity >= 0.5
      expect(result.every(match => match.similarity >= 0.5)).toBe(true);
    });

    it('should handle empty or invalid input', () => {
      expect(applySimilarityThreshold([], 0.5)).toEqual([]);
      expect(applySimilarityThreshold(null, 0.5)).toEqual([]);
      expect(applySimilarityThreshold(undefined, 0.5)).toEqual([]);
      expect(applySimilarityThreshold('invalid', 0.5)).toEqual([]);
    });

    it('should handle invalid threshold values', () => {
      // Should clamp threshold to valid range [0, 1]
      const result1 = applySimilarityThreshold(mockMatches, -0.5);
      expect(result1.length).toBe(4); // Threshold clamped to 0
      
      const result2 = applySimilarityThreshold(mockMatches, 1.5);
      expect(result2.length).toBe(0); // Threshold clamped to 1
      
      const result3 = applySimilarityThreshold(mockMatches, 'invalid');
      expect(result3.length).toBe(2); // Uses default 0.5
    });

    it('should preserve match order', () => {
      const result = applySimilarityThreshold(mockMatches, 0.6);
      
      expect(result[0].id).toBe('match1');
      expect(result[1].id).toBe('match2');
    });

    it('should handle edge case similarities', () => {
      const edgeCaseMatches = [
        { id: 'exact', similarity: 0.5 },
        { id: 'just_above', similarity: 0.5000001 },
        { id: 'just_below', similarity: 0.4999999 }
      ];
      
      const result = applySimilarityThreshold(edgeCaseMatches, 0.5);
      
      expect(result.length).toBe(2); // exact and just_above
      expect(result.some(match => match.id === 'exact')).toBe(true);
      expect(result.some(match => match.id === 'just_above')).toBe(true);
      expect(result.some(match => match.id === 'just_below')).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should work together in a complete similarity workflow', () => {
      const queryEmbedding = [0.8, 0.2, 0.1, 0.5];
      const cvChunks = [
        {
          id: 'chunk1',
          embedding: [0.8, 0.2, 0.1, 0.5], // Identical
          text: 'React development'
        },
        {
          id: 'chunk2',
          embedding: [0.7, 0.3, 0.2, 0.4], // Similar
          text: 'JavaScript programming'
        },
        {
          id: 'chunk3',
          embedding: [0.1, 0.1, 0.9, 0.8], // Different
          text: 'CSS styling'
        }
      ];
      
      // Find similar chunks
      const similarChunks = findSimilarChunks(queryEmbedding, cvChunks, 5);
      expect(similarChunks.length).toBe(3);
      
      // Apply threshold
      const filteredChunks = applySimilarityThreshold(similarChunks, 0.7);
      expect(filteredChunks.length).toBe(2); // Should filter out CSS chunk
      
      // Verify similarity calculations
      const topChunk = filteredChunks[0];
      const manualSimilarity = calculateCosineSimilarity(queryEmbedding, topChunk.embedding);
      expect(topChunk.similarity).toBeCloseTo(manualSimilarity, 10);
    });

    it('should handle large-scale similarity calculations efficiently', () => {
      const queryEmbedding = new Array(768).fill(0).map(() => Math.random());
      const largeCVChunks = new Array(100).fill(0).map((_, i) => ({
        id: `chunk${i}`,
        embedding: new Array(768).fill(0).map(() => Math.random()),
        text: `Chunk ${i} content`
      }));
      
      const start = performance.now();
      const similarChunks = findSimilarChunks(queryEmbedding, largeCVChunks, 10);
      const filteredChunks = applySimilarityThreshold(similarChunks, 0.5);
      const end = performance.now();
      
      expect(similarChunks.length).toBeLessThanOrEqual(10);
      expect(filteredChunks.length).toBeLessThanOrEqual(similarChunks.length);
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });
  });
});