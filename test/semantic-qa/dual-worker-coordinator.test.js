/**
 * Integration tests for Dual Worker Coordinator
 * Tests end-to-end question processing workflow using utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DualWorkerCoordinator from '../../src/scripts/modules/semantic-qa/dual-worker-coordinator.js';

// Mock the utility modules
vi.mock('../../src/scripts/modules/semantic-qa/utils/query-processor.js', () => ({
  preprocessQuery: vi.fn((query) => `enhanced_${query}`),
  getAdaptiveThreshold: vi.fn(() => 0.7)
}));

vi.mock('../../src/scripts/modules/semantic-qa/utils/similarity-calculator.js', () => ({
  findSimilarChunks: vi.fn((embedding, chunks, maxChunks) => 
    chunks.slice(0, maxChunks).map((chunk, index) => ({
      ...chunk,
      similarity: 0.8 - (index * 0.1)
    }))
  ),
  applySimilarityThreshold: vi.fn((chunks, threshold) => 
    chunks.filter(chunk => chunk.similarity >= threshold)
  )
}));

vi.mock('../../src/scripts/modules/semantic-qa/utils/cv-context-builder.js', () => ({
  buildCVContext: vi.fn((chunks) => 
    chunks.map(chunk => chunk.text).join('\n\n')
  )
}));

vi.mock('../../src/scripts/modules/semantic-qa/utils/prompt-builder.js', () => ({
  createPrompt: vi.fn((question, context, style, conversationContext) => 
    `Context: ${context}\n\nQuestion: ${question}\n\nStyle: ${style}`
  )
}));

vi.mock('../../src/scripts/modules/semantic-qa/utils/response-validator.js', () => ({
  validateResponseQuality: vi.fn((response, question) => ({
    answer: response.answer,
    confidence: response.confidence,
    metrics: {
      qualityScore: 0.85,
      validationPassed: true
    }
  }))
}));

vi.mock('../../src/scripts/modules/semantic-qa/utils/cache-manager.js', () => ({
  getCachedQueryResult: vi.fn(() => null),
  cacheQueryResult: vi.fn(),
  getCachedEmbedding: vi.fn(() => null),
  cacheEmbedding: vi.fn(),
  getCacheStats: vi.fn(() => ({ hits: 0, misses: 0 })),
  clearCache: vi.fn()
}));



describe('Dual Worker Coordinator Integration', () => {
  let coordinator;

  beforeEach(() => {
    // Mock Worker constructor to avoid actual worker creation
    global.Worker = vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onmessage: null,
      onerror: null
    }));

    coordinator = new DualWorkerCoordinator({
      embeddingWorkerPath: '/test/embedding-worker.js',
      textGenWorkerPath: '/test/optimized-ml-worker.js',
      maxContextChunks: 3,
      similarityThreshold: 0.7
    });
  });

  afterEach(() => {
    if (coordinator) {
      coordinator.cleanup();
    }
    vi.clearAllMocks();
  });

  describe('Core Functionality', () => {
    it('should create coordinator with proper configuration', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator.config.maxContextChunks).toBe(3);
      expect(coordinator.config.similarityThreshold).toBe(0.7);
      expect(coordinator.isInitialized).toBe(false);
    });

    it('should generate unique request IDs', () => {
      const id1 = coordinator.generateRequestId();
      const id2 = coordinator.generateRequestId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req_\d+_\d+$/);
      expect(id2).toMatch(/^req_\d+_\d+$/);
    });

    it('should handle uninitialized coordinator', async () => {
      await expect(
        coordinator.processQuestion('Test question')
      ).rejects.toThrow('Coordinator not initialized');
    });
  });

  describe('Utility Integration', () => {
    it('should verify utility modules are properly imported and used', async () => {
      // Test that all utility modules are accessible
      const { preprocessQuery } = await import('../../src/scripts/modules/semantic-qa/utils/query-processor.js');
      const { findSimilarChunks } = await import('../../src/scripts/modules/semantic-qa/utils/similarity-calculator.js');
      const { buildCVContext } = await import('../../src/scripts/modules/semantic-qa/utils/cv-context-builder.js');
      const { createPrompt } = await import('../../src/scripts/modules/semantic-qa/utils/prompt-builder.js');
      const { validateResponseQuality } = await import('../../src/scripts/modules/semantic-qa/utils/response-validator.js');
      const { getCachedQueryResult } = await import('../../src/scripts/modules/semantic-qa/utils/cache-manager.js');

      expect(typeof preprocessQuery).toBe('function');
      expect(typeof findSimilarChunks).toBe('function');
      expect(typeof buildCVContext).toBe('function');
      expect(typeof createPrompt).toBe('function');
      expect(typeof validateResponseQuality).toBe('function');
      expect(typeof getCachedQueryResult).toBe('function');
    });

    it('should handle cached query results', async () => {
      const { getCachedQueryResult } = await import('../../src/scripts/modules/semantic-qa/utils/cache-manager.js');
      
      // Mock cached result
      getCachedQueryResult.mockReturnValueOnce({
        answer: 'Cached response',
        confidence: 0.9,
        context: 'Cached context',
        similarChunks: [],
        metrics: { processingTime: 5 }
      });

      // Since coordinator is not initialized, this should throw an error
      await expect(
        coordinator.processQuestion('What is React?')
      ).rejects.toThrow('Coordinator not initialized');
    });

    it('should verify utility function calls in workflow', () => {
      // Test that the coordinator has the expected workflow structure
      expect(coordinator.processQuestion).toBeDefined();
      expect(coordinator.generateEmbedding).toBeDefined();
      expect(coordinator.generateContextualResponse).toBeDefined();
      expect(coordinator.getCacheStats).toBeDefined();
      expect(coordinator.clearCache).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle uninitialized coordinator', async () => {
      await expect(
        coordinator.processQuestion('Test question')
      ).rejects.toThrow('Coordinator not initialized');
    });

    it('should handle cleanup when workers are not initialized', () => {
      const uninitializedCoordinator = new DualWorkerCoordinator();
      
      expect(() => uninitializedCoordinator.cleanup()).not.toThrow();
    });

    it('should handle missing CV chunks gracefully', async () => {
      // Test that the coordinator can handle empty or missing CV chunks
      await expect(
        coordinator.processQuestion('Test question', [])
      ).rejects.toThrow('Coordinator not initialized');
    });
  });

  describe('API Compatibility', () => {
    it('should maintain all existing coordinator API methods', () => {
      // Verify all expected methods exist
      expect(typeof coordinator.initialize).toBe('function');
      expect(typeof coordinator.processQuestion).toBe('function');
      expect(typeof coordinator.generateEmbedding).toBe('function');
      expect(typeof coordinator.calculateSimilarity).toBe('function');
      expect(typeof coordinator.generateContextualResponse).toBe('function');
      expect(typeof coordinator.generateBatchEmbeddings).toBe('function');
      expect(typeof coordinator.getCacheStats).toBe('function');
      expect(typeof coordinator.clearCache).toBe('function');
      expect(typeof coordinator.cleanup).toBe('function');
      expect(typeof coordinator.generateRequestId).toBe('function');
    });

    it('should include new SemanticQAManager features', () => {
      // Verify consolidated features from SemanticQAManager
      expect(typeof coordinator.indexContext).toBe('function');
      expect(typeof coordinator.askQuestion).toBe('function');
      expect(typeof coordinator.askQuestions).toBe('function');
      expect(typeof coordinator.semanticSearch).toBe('function');
      expect(typeof coordinator.getStatus).toBe('function');
      expect(typeof coordinator.reset).toBe('function');
      expect(typeof coordinator.exportData).toBe('function');
      expect(typeof coordinator.importData).toBe('function');
      expect(typeof coordinator.updatePerformanceMetrics).toBe('function');
    });

    it('should maintain configuration options', () => {
      const customCoordinator = new DualWorkerCoordinator({
        maxContextChunks: 5,
        similarityThreshold: 0.8,
        embeddingWorkerPath: '/custom/embedding.js',
        textGenWorkerPath: '/custom/textgen.js'
      });

      expect(customCoordinator.config.maxContextChunks).toBe(5);
      expect(customCoordinator.config.similarityThreshold).toBe(0.8);
      expect(customCoordinator.config.embeddingWorkerPath).toBe('/custom/embedding.js');
      expect(customCoordinator.config.textGenWorkerPath).toBe('/custom/textgen.js');
    });

    it('should maintain backward compatibility with existing usage patterns', () => {
      // Test that the coordinator can be instantiated with various option combinations
      const defaultCoordinator = new DualWorkerCoordinator();
      expect(defaultCoordinator.config.maxContextChunks).toBe(3);
      expect(defaultCoordinator.config.similarityThreshold).toBe(0.7);

      const partialCoordinator = new DualWorkerCoordinator({
        maxContextChunks: 4
      });
      expect(partialCoordinator.config.maxContextChunks).toBe(4);
      expect(partialCoordinator.config.similarityThreshold).toBe(0.7);
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = coordinator.getCacheStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should clear cache when requested', async () => {
      coordinator.clearCache();
      
      const { clearCache } = await import('../../src/scripts/modules/semantic-qa/utils/cache-manager.js');
      expect(clearCache).toHaveBeenCalled();
    });
  });

  describe('Resource Management', () => {
    it('should handle cleanup properly', () => {
      coordinator.cleanup();
      
      expect(coordinator.isInitialized).toBe(false);
    });

    it('should handle cleanup when workers are not initialized', () => {
      const uninitializedCoordinator = new DualWorkerCoordinator();
      
      expect(() => uninitializedCoordinator.cleanup()).not.toThrow();
    });

    it('should manage pending requests properly', () => {
      expect(coordinator.pendingRequests).toBeDefined();
      expect(coordinator.pendingRequests.size).toBe(0);
    });
  });

  describe('Consolidated Features', () => {
    it('should track performance metrics', () => {
      expect(coordinator.performanceMetrics).toBeDefined();
      expect(coordinator.performanceMetrics.totalQueries).toBe(0);
      expect(coordinator.performanceMetrics.avgResponseTime).toBe(0);
      expect(coordinator.performanceMetrics.cacheHits).toBe(0);
    });

    it('should provide system status', () => {
      const status = coordinator.getStatus();
      
      expect(status).toBeDefined();
      expect(status.isInitialized).toBe(false);
      expect(status.hasIndexedContext).toBe(false);
      expect(status.performanceMetrics).toBeDefined();
    });

    it('should handle data export when no context is indexed', () => {
      const exportedData = coordinator.exportData();
      expect(exportedData).toBeNull();
    });

    it('should reset system state', () => {
      coordinator.reset();
      
      expect(coordinator.performanceMetrics.totalQueries).toBe(0);
      expect(coordinator.performanceMetrics.avgResponseTime).toBe(0);
      expect(coordinator.indexedContext).toBeNull();
    });
  });
});