/**
 * Unit tests for Cache Manager Utility Module
 * Tests embedding and query result caching functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cacheEmbedding,
  getCachedEmbedding,
  cacheQueryResult,
  getCachedQueryResult,
  generateCacheKey,
  clearCache,
  getCacheStats,
  cleanExpiredEntries
} from '../../../src/scripts/modules/semantic-qa/utils/cache-manager.js';

describe('Cache Manager Utility', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearCache();
  });

  describe('cacheEmbedding', () => {
    it('should cache embedding successfully', () => {
      const text = 'React development experience';
      const embedding = [0.1, 0.2, 0.3, 0.4];
      
      const result = cacheEmbedding(text, embedding);
      
      expect(result).toBe(true);
    });

    it('should handle empty or invalid input', () => {
      expect(() => cacheEmbedding('', [1, 2, 3])).toThrow('Text must be a non-empty string');
      expect(() => cacheEmbedding(null, [1, 2, 3])).toThrow('Text must be a non-empty string');
      expect(() => cacheEmbedding(undefined, [1, 2, 3])).toThrow('Text must be a non-empty string');
      expect(() => cacheEmbedding('text', 'not an array')).toThrow('Embedding must be an array');
      expect(() => cacheEmbedding('text', null)).toThrow('Embedding must be an array');
    });

    it('should store embedding with metadata', () => {
      const text = 'JavaScript programming';
      const embedding = [0.5, 0.6, 0.7];
      
      cacheEmbedding(text, embedding);
      const cached = getCachedEmbedding(text);
      
      expect(cached).toEqual(embedding);
      expect(cached).not.toBe(embedding); // Should be a copy
    });

    it('should handle large embeddings', () => {
      const text = 'Large embedding test';
      const embedding = new Array(768).fill(0).map((_, i) => i / 768);
      
      const result = cacheEmbedding(text, embedding);
      
      expect(result).toBe(true);
      
      const cached = getCachedEmbedding(text);
      expect(cached).toEqual(embedding);
      expect(cached.length).toBe(768);
    });

    it('should implement LRU eviction when cache is full', () => {
      // Fill cache to capacity (200 items)
      for (let i = 0; i < 200; i++) {
        cacheEmbedding(`text${i}`, [i]);
      }
      
      // Verify cache is full
      const stats = getCacheStats();
      expect(stats.embeddings.size).toBe(200);
      
      // Add one more item to trigger eviction
      cacheEmbedding('new_text', [999]);
      
      // Cache should still be at capacity
      const newStats = getCacheStats();
      expect(newStats.embeddings.size).toBe(200);
      
      // First item should be evicted, new item should be present
      expect(getCachedEmbedding('text0')).toBe(null);
      expect(getCachedEmbedding('new_text')).toEqual([999]);
    });

    it('should handle duplicate caching', () => {
      const text = 'Duplicate test';
      const embedding1 = [1, 2, 3];
      const embedding2 = [4, 5, 6];
      
      cacheEmbedding(text, embedding1);
      cacheEmbedding(text, embedding2); // Should overwrite
      
      const cached = getCachedEmbedding(text);
      expect(cached).toEqual(embedding2);
    });
  });

  describe('getCachedEmbedding', () => {
    it('should retrieve cached embedding', () => {
      const text = 'Test retrieval';
      const embedding = [0.8, 0.9, 1.0];
      
      cacheEmbedding(text, embedding);
      const retrieved = getCachedEmbedding(text);
      
      expect(retrieved).toEqual(embedding);
    });

    it('should return null for non-existent cache entries', () => {
      const result = getCachedEmbedding('non-existent text');
      
      expect(result).toBe(null);
    });

    it('should handle empty or invalid input', () => {
      expect(getCachedEmbedding('')).toBe(null);
      expect(getCachedEmbedding(null)).toBe(null);
      expect(getCachedEmbedding(undefined)).toBe(null);
    });

    it('should return copies to avoid reference issues', () => {
      const text = 'Reference test';
      const embedding = [1, 2, 3];
      
      cacheEmbedding(text, embedding);
      const retrieved1 = getCachedEmbedding(text);
      const retrieved2 = getCachedEmbedding(text);
      
      expect(retrieved1).toEqual(retrieved2);
      expect(retrieved1).not.toBe(retrieved2); // Different objects
      
      // Modifying retrieved embedding shouldn't affect cache
      retrieved1[0] = 999;
      const retrieved3 = getCachedEmbedding(text);
      expect(retrieved3[0]).toBe(1); // Original value preserved
    });

    it('should handle case sensitivity', () => {
      const embedding = [1, 2, 3];
      
      cacheEmbedding('Test', embedding);
      
      expect(getCachedEmbedding('Test')).toEqual(embedding);
      expect(getCachedEmbedding('test')).toBe(null); // Different case
      expect(getCachedEmbedding('TEST')).toBe(null); // Different case
    });
  });

  describe('cacheQueryResult', () => {
    it('should cache query result successfully', () => {
      const query = 'React experience';
      const result = {
        answer: 'I have React experience',
        confidence: 0.9,
        matchedSections: ['exp_react']
      };
      
      const cached = cacheQueryResult(query, result);
      
      expect(cached).toBe(true);
    });

    it('should handle empty or invalid input', () => {
      const result = { answer: 'test' };
      
      expect(() => cacheQueryResult('', result)).toThrow('Query must be a non-empty string');
      expect(() => cacheQueryResult(null, result)).toThrow('Query must be a non-empty string');
      expect(() => cacheQueryResult('query', null)).toThrow('Result must be an object');
      expect(() => cacheQueryResult('query', 'not an object')).toThrow('Result must be an object');
    });

    it('should implement LRU eviction for query cache', () => {
      // Fill query cache to capacity (50 items)
      for (let i = 0; i < 50; i++) {
        cacheQueryResult(`query${i}`, { answer: `answer${i}` });
      }
      
      const stats = getCacheStats();
      expect(stats.queryResults.size).toBe(50);
      
      // Add one more to trigger eviction
      cacheQueryResult('new_query', { answer: 'new_answer' });
      
      const newStats = getCacheStats();
      expect(newStats.queryResults.size).toBe(50);
      
      // First query should be evicted
      expect(getCachedQueryResult('query0')).toBe(null);
      expect(getCachedQueryResult('new_query')).toEqual({ answer: 'new_answer' });
    });

    it('should store deep copies of results', () => {
      const query = 'Deep copy test';
      const result = {
        answer: 'Test answer',
        metadata: {
          nested: {
            value: 42
          }
        }
      };
      
      cacheQueryResult(query, result);
      
      // Modify original result
      result.metadata.nested.value = 999;
      
      // Cached result should be unchanged
      const cached = getCachedQueryResult(query);
      expect(cached.metadata.nested.value).toBe(42);
    });
  });

  describe('getCachedQueryResult', () => {
    it('should retrieve cached query result', () => {
      const query = 'Test query';
      const result = {
        answer: 'Test answer',
        confidence: 0.8
      };
      
      cacheQueryResult(query, result);
      const retrieved = getCachedQueryResult(query);
      
      expect(retrieved).toEqual(result);
    });

    it('should return null for non-existent queries', () => {
      const result = getCachedQueryResult('non-existent query');
      
      expect(result).toBe(null);
    });

    it('should handle empty or invalid input', () => {
      expect(getCachedQueryResult('')).toBe(null);
      expect(getCachedQueryResult(null)).toBe(null);
      expect(getCachedQueryResult(undefined)).toBe(null);
    });

    it('should return deep copies to avoid reference issues', () => {
      const query = 'Reference test';
      const result = {
        answer: 'Test',
        metadata: { count: 1 }
      };
      
      cacheQueryResult(query, result);
      const retrieved1 = getCachedQueryResult(query);
      const retrieved2 = getCachedQueryResult(query);
      
      expect(retrieved1).toEqual(retrieved2);
      expect(retrieved1).not.toBe(retrieved2);
      
      // Modifying retrieved result shouldn't affect cache
      retrieved1.metadata.count = 999;
      const retrieved3 = getCachedQueryResult(query);
      expect(retrieved3.metadata.count).toBe(1);
    });

    it('should handle TTL expiration', () => {
      vi.useFakeTimers();
      
      const query = 'TTL test';
      const result = { answer: 'Test answer' };
      
      cacheQueryResult(query, result);
      
      // Should be available immediately
      expect(getCachedQueryResult(query)).toEqual(result);
      
      // Fast forward past TTL (5 minutes)
      vi.advanceTimersByTime(300001);
      
      // Should be expired and return null
      expect(getCachedQueryResult(query)).toBe(null);
      
      vi.useRealTimers();
    });

    it('should clean up expired entries automatically', () => {
      vi.useFakeTimers();
      
      const query = 'Auto cleanup test';
      const result = { answer: 'Test answer' };
      
      cacheQueryResult(query, result);
      
      const statsBefore = getCacheStats();
      expect(statsBefore.queryResults.size).toBe(1);
      
      // Fast forward past TTL
      vi.advanceTimersByTime(300001);
      
      // Accessing expired entry should remove it
      getCachedQueryResult(query);
      
      const statsAfter = getCacheStats();
      expect(statsAfter.queryResults.size).toBe(0);
      
      vi.useRealTimers();
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent keys for same text', () => {
      const text = 'Test text for key generation';
      
      const key1 = generateCacheKey(text);
      const key2 = generateCacheKey(text);
      
      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBeGreaterThan(0);
    });

    it('should generate different keys for different text', () => {
      const key1 = generateCacheKey('Text 1');
      const key2 = generateCacheKey('Text 2');
      
      expect(key1).not.toBe(key2);
    });

    it('should handle empty or invalid input', () => {
      expect(generateCacheKey('')).toBe('');
      expect(generateCacheKey(null)).toBe('');
      expect(generateCacheKey(undefined)).toBe('');
    });

    it('should be case sensitive', () => {
      const key1 = generateCacheKey('Test');
      const key2 = generateCacheKey('test');
      
      expect(key1).not.toBe(key2);
    });

    it('should handle special characters', () => {
      const text = 'Text with special chars: !@#$%^&*()';
      const key = generateCacheKey(text);
      
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const text = 'Unicode test: 你好 🚀 café';
      const key = generateCacheKey(text);
      
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should handle very long text', () => {
      const longText = 'A'.repeat(10000);
      const key = generateCacheKey(longText);
      
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
      expect(key.length).toBeLessThan(100); // Should be reasonably short
    });

    it('should distribute keys well for similar text', () => {
      const keys = [
        generateCacheKey('React development'),
        generateCacheKey('React developments'),
        generateCacheKey('React developer'),
        generateCacheKey('React developing')
      ];
      
      // All keys should be different
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(4);
    });
  });

  describe('clearCache', () => {
    it('should clear all caches and return statistics', () => {
      // Add some data to both caches
      cacheEmbedding('text1', [1, 2, 3]);
      cacheEmbedding('text2', [4, 5, 6]);
      cacheQueryResult('query1', { answer: 'answer1' });
      cacheQueryResult('query2', { answer: 'answer2' });
      
      const stats = clearCache();
      
      expect(stats.embeddingsCacheSize).toBe(2);
      expect(stats.queryResultsCacheSize).toBe(2);
      expect(stats.totalCleared).toBe(4);
      
      // Verify caches are empty
      expect(getCachedEmbedding('text1')).toBe(null);
      expect(getCachedQueryResult('query1')).toBe(null);
      
      const newStats = getCacheStats();
      expect(newStats.embeddings.size).toBe(0);
      expect(newStats.queryResults.size).toBe(0);
    });

    it('should handle empty caches', () => {
      const stats = clearCache();
      
      expect(stats.embeddingsCacheSize).toBe(0);
      expect(stats.queryResultsCacheSize).toBe(0);
      expect(stats.totalCleared).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return accurate cache statistics', () => {
      // Add some data
      cacheEmbedding('text1', [1, 2, 3]);
      cacheEmbedding('text2', [4, 5, 6]);
      cacheQueryResult('query1', { answer: 'answer1' });
      
      const stats = getCacheStats();
      
      expect(stats.embeddings.size).toBe(2);
      expect(stats.embeddings.maxSize).toBe(200);
      expect(stats.embeddings.utilization).toBeCloseTo(0.01, 2);
      
      expect(stats.queryResults.size).toBe(1);
      expect(stats.queryResults.maxSize).toBe(50);
      expect(stats.queryResults.utilization).toBeCloseTo(0.02, 2);
      
      expect(stats.config).toBeDefined();
      expect(stats.config.maxEmbeddingCacheSize).toBe(200);
      expect(stats.config.maxQueryCacheSize).toBe(50);
      expect(stats.config.queryResultTTL).toBe(300000);
    });

    it('should handle empty caches', () => {
      const stats = getCacheStats();
      
      expect(stats.embeddings.size).toBe(0);
      expect(stats.embeddings.utilization).toBe(0);
      expect(stats.queryResults.size).toBe(0);
      expect(stats.queryResults.utilization).toBe(0);
    });

    it('should calculate utilization correctly', () => {
      // Fill embedding cache to 50%
      for (let i = 0; i < 100; i++) {
        cacheEmbedding(`text${i}`, [i]);
      }
      
      // Fill query cache to 80%
      for (let i = 0; i < 40; i++) {
        cacheQueryResult(`query${i}`, { answer: `answer${i}` });
      }
      
      const stats = getCacheStats();
      
      expect(stats.embeddings.utilization).toBeCloseTo(0.5, 2);
      expect(stats.queryResults.utilization).toBeCloseTo(0.8, 2);
    });
  });

  describe('cleanExpiredEntries', () => {
    it('should remove expired query results', () => {
      vi.useFakeTimers();
      
      // Add some query results
      cacheQueryResult('query1', { answer: 'answer1' });
      cacheQueryResult('query2', { answer: 'answer2' });
      cacheQueryResult('query3', { answer: 'answer3' });
      
      // Fast forward to expire some entries
      vi.advanceTimersByTime(150000); // 2.5 minutes
      
      // Add more entries (these should not expire)
      cacheQueryResult('query4', { answer: 'answer4' });
      cacheQueryResult('query5', { answer: 'answer5' });
      
      // Fast forward to expire first batch
      vi.advanceTimersByTime(200000); // Total 4.5 minutes (past 5 min TTL for first batch)
      
      const removedCount = cleanExpiredEntries();
      
      expect(removedCount).toBe(3); // First 3 queries should be expired
      
      // Verify expired entries are gone
      expect(getCachedQueryResult('query1')).toBe(null);
      expect(getCachedQueryResult('query2')).toBe(null);
      expect(getCachedQueryResult('query3')).toBe(null);
      
      // Verify non-expired entries remain
      expect(getCachedQueryResult('query4')).toEqual({ answer: 'answer4' });
      expect(getCachedQueryResult('query5')).toEqual({ answer: 'answer5' });
      
      vi.useRealTimers();
    });

    it('should return 0 when no entries are expired', () => {
      cacheQueryResult('query1', { answer: 'answer1' });
      cacheQueryResult('query2', { answer: 'answer2' });
      
      const removedCount = cleanExpiredEntries();
      
      expect(removedCount).toBe(0);
    });

    it('should handle empty cache', () => {
      const removedCount = cleanExpiredEntries();
      
      expect(removedCount).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete caching workflow', () => {
      // Cache embeddings
      const texts = ['React', 'JavaScript', 'Node.js'];
      const embeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9]
      ];
      
      texts.forEach((text, i) => {
        cacheEmbedding(text, embeddings[i]);
      });
      
      // Cache query results
      const queries = ['React experience', 'JavaScript skills'];
      const results = [
        { answer: 'I have React experience', confidence: 0.9 },
        { answer: 'I know JavaScript well', confidence: 0.8 }
      ];
      
      queries.forEach((query, i) => {
        cacheQueryResult(query, results[i]);
      });
      
      // Verify all data is cached
      texts.forEach((text, i) => {
        expect(getCachedEmbedding(text)).toEqual(embeddings[i]);
      });
      
      queries.forEach((query, i) => {
        expect(getCachedQueryResult(query)).toEqual(results[i]);
      });
      
      // Check statistics
      const stats = getCacheStats();
      expect(stats.embeddings.size).toBe(3);
      expect(stats.queryResults.size).toBe(2);
      
      // Clear and verify
      const clearStats = clearCache();
      expect(clearStats.totalCleared).toBe(5);
      
      texts.forEach(text => {
        expect(getCachedEmbedding(text)).toBe(null);
      });
      
      queries.forEach(query => {
        expect(getCachedQueryResult(query)).toBe(null);
      });
    });

    it('should handle cache size limits correctly', () => {
      // Test embedding cache limit
      const embeddingTexts = [];
      for (let i = 0; i < 205; i++) {
        const text = `embedding_text_${i}`;
        embeddingTexts.push(text);
        cacheEmbedding(text, [i]);
      }
      
      const embeddingStats = getCacheStats();
      expect(embeddingStats.embeddings.size).toBe(200); // Should be capped
      
      // First 5 should be evicted
      for (let i = 0; i < 5; i++) {
        expect(getCachedEmbedding(`embedding_text_${i}`)).toBe(null);
      }
      
      // Last 200 should be present
      for (let i = 5; i < 205; i++) {
        expect(getCachedEmbedding(`embedding_text_${i}`)).toEqual([i]);
      }
      
      // Test query cache limit
      for (let i = 0; i < 55; i++) {
        cacheQueryResult(`query_${i}`, { answer: `answer_${i}` });
      }
      
      const queryStats = getCacheStats();
      expect(queryStats.queryResults.size).toBe(50); // Should be capped
      
      // First 5 queries should be evicted
      for (let i = 0; i < 5; i++) {
        expect(getCachedQueryResult(`query_${i}`)).toBe(null);
      }
    });

    it('should handle concurrent operations safely', () => {
      const operations = [];
      
      // Simulate concurrent caching operations
      for (let i = 0; i < 100; i++) {
        operations.push(() => cacheEmbedding(`text${i}`, [i]));
        operations.push(() => cacheQueryResult(`query${i}`, { answer: `answer${i}` }));
      }
      
      // Execute all operations
      operations.forEach(op => op());
      
      // Verify data integrity
      const stats = getCacheStats();
      expect(stats.embeddings.size).toBe(100);
      expect(stats.queryResults.size).toBe(50); // Limited by cache size
      
      // Verify some cached data
      expect(getCachedEmbedding('text99')).toEqual([99]);
      expect(getCachedQueryResult('query99')).toEqual({ answer: 'answer99' });
    });
  });
});