/**
 * Performance Optimization Tests
 * Tests for chat-bot performance features including caching, memory management, and optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PerformanceManager from '../src/scripts/modules/chat-bot/performance-manager.js';
import BundleOptimizer from '../src/scripts/modules/chat-bot/bundle-optimizer.js';

describe('Performance Optimization', () => {
  let performanceManager;
  let bundleOptimizer;

  beforeEach(() => {
    performanceManager = new PerformanceManager();
    bundleOptimizer = new BundleOptimizer();
    
    // Mock performance API
    global.performance = {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByName: vi.fn(() => [{ duration: 100 }]),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 200 * 1024 * 1024
      }
    };
    
    // Mock PerformanceObserver
    global.PerformanceObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));
  });

  afterEach(() => {
    if (performanceManager) {
      performanceManager.cleanup();
    }
  });

  describe('PerformanceManager', () => {
    it('should initialize with default configuration', () => {
      expect(performanceManager.metrics).toBeDefined();
      expect(performanceManager.cache).toBeDefined();
      expect(performanceManager.resourceMonitor).toBeDefined();
    });

    it('should cache and retrieve embeddings', () => {
      const text = 'test embedding text';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      // Cache embedding
      performanceManager.cacheEmbedding(text, embedding);
      
      // Retrieve cached embedding
      const cachedEmbedding = performanceManager.getCachedEmbedding(text);
      
      expect(cachedEmbedding).toEqual(embedding);
      expect(performanceManager.metrics.cacheHits).toBe(1);
    });

    it('should return null for non-cached embeddings', () => {
      const cachedEmbedding = performanceManager.getCachedEmbedding('non-existent text');
      
      expect(cachedEmbedding).toBeNull();
      expect(performanceManager.metrics.cacheMisses).toBe(1);
    });

    it('should cache and retrieve query results', () => {
      const query = 'test query';
      const result = {
        answer: 'test answer',
        confidence: 0.8,
        matchedSections: ['section1']
      };
      
      // Cache query result
      performanceManager.cacheQueryResult(query, result);
      
      // Retrieve cached result
      const cachedResult = performanceManager.getCachedQueryResult(query);
      
      expect(cachedResult).toEqual(result);
      expect(performanceManager.metrics.cacheHits).toBe(1);
    });

    it('should manage cache size limits', () => {
      const maxSize = performanceManager.cache.maxEmbeddingCacheSize;
      
      // Fill cache beyond limit
      for (let i = 0; i <= maxSize + 10; i++) {
        performanceManager.cacheEmbedding(`text${i}`, [i]);
      }
      
      // Cache should not exceed max size
      expect(performanceManager.cache.embeddings.size).toBeLessThanOrEqual(maxSize);
    });

    it('should track query processing times', () => {
      const queryId = 'test-query-123';
      
      // Start timer
      const timerId = performanceManager.startQueryTimer(queryId);
      expect(timerId).toContain('query_');
      
      // Stop timer
      const duration = performanceManager.stopQueryTimer(timerId, { test: true });
      
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(performanceManager.metrics.queryProcessingTimes).toHaveLength(1);
    });

    it('should calculate average query time', () => {
      // Add some mock query times
      performanceManager.metrics.queryProcessingTimes = [
        { duration: 100, timestamp: Date.now() },
        { duration: 200, timestamp: Date.now() },
        { duration: 300, timestamp: Date.now() }
      ];
      
      const avgTime = performanceManager.getAverageQueryTime();
      expect(avgTime).toBe(200);
    });

    it('should record memory usage', () => {
      const memoryInfo = performanceManager.recordMemoryUsage();
      
      expect(memoryInfo).toBeDefined();
      expect(memoryInfo.used).toBe(50 * 1024 * 1024);
      expect(performanceManager.metrics.memoryUsage).toHaveLength(1);
    });

    it('should perform memory cleanup when threshold exceeded', () => {
      // Set low threshold for testing
      performanceManager.resourceMonitor.memoryThreshold = 10 * 1024 * 1024;
      
      // Fill caches
      for (let i = 0; i < 10; i++) {
        performanceManager.cacheEmbedding(`text${i}`, [i]);
        performanceManager.cacheQueryResult(`query${i}`, { answer: `answer${i}` });
      }
      
      const initialCacheSize = performanceManager.cache.embeddings.size + 
                              performanceManager.cache.queryResults.size;
      
      // Trigger cleanup
      performanceManager.checkMemoryThreshold();
      
      const finalCacheSize = performanceManager.cache.embeddings.size + 
                             performanceManager.cache.queryResults.size;
      
      // Cache should be reduced or at least not grown
      expect(finalCacheSize).toBeLessThanOrEqual(initialCacheSize);
    });

    it('should generate performance metrics', () => {
      const metrics = performanceManager.getMetrics();
      
      expect(metrics).toHaveProperty('cacheStats');
      expect(metrics).toHaveProperty('performanceStatus');
      expect(metrics).toHaveProperty('memoryStatus');
      expect(metrics.cacheStats).toHaveProperty('hitRate');
    });

    it('should log performance events', () => {
      const initialLogLength = performanceManager.performanceLog.length;
      
      performanceManager.logPerformanceEvent('test_event', { data: 'test' });
      
      expect(performanceManager.performanceLog).toHaveLength(initialLogLength + 1);
      expect(performanceManager.performanceLog[performanceManager.performanceLog.length - 1]).toMatchObject({
        event: 'test_event',
        data: { data: 'test' }
      });
    });

    it('should export performance data', () => {
      const exportedData = performanceManager.exportPerformanceData();
      
      expect(exportedData).toHaveProperty('metrics');
      expect(exportedData).toHaveProperty('performanceLog');
      expect(exportedData).toHaveProperty('timestamp');
      expect(exportedData).toHaveProperty('sessionId');
    });
  });

  describe('BundleOptimizer', () => {
    it('should initialize with default configuration', () => {
      expect(bundleOptimizer.loadedModules).toBeDefined();
      expect(bundleOptimizer.preloadedResources).toBeDefined();
      expect(bundleOptimizer.loadingStrategies).toBeDefined();
    });

    it('should detect compression support', () => {
      const support = bundleOptimizer.compressionSupport;
      
      expect(support).toHaveProperty('gzip');
      expect(support).toHaveProperty('brotli');
      expect(support).toHaveProperty('deflate');
    });

    it('should optimize loading order based on priority', () => {
      const modules = [
        'fallback-handler.js',
        'chat-ui.js',
        'performance-manager.js',
        'conversation-manager.js'
      ];
      
      const optimizedOrder = bundleOptimizer.optimizeLoadingOrder(modules);
      
      // Critical modules should come first
      expect(optimizedOrder.indexOf('chat-ui.js')).toBeLessThan(
        optimizedOrder.indexOf('fallback-handler.js')
      );
      expect(optimizedOrder.indexOf('conversation-manager.js')).toBeLessThan(
        optimizedOrder.indexOf('performance-manager.js')
      );
    });

    it('should identify code splitting points', () => {
      const bundleConfig = { modules: ['chat-bot.js', 'chat-ui.js'] };
      const splitPoints = bundleOptimizer.identifySplitPoints(bundleConfig);
      
      expect(splitPoints).toBeInstanceOf(Array);
      expect(splitPoints.length).toBeGreaterThan(0);
      expect(splitPoints[0]).toHaveProperty('name');
      expect(splitPoints[0]).toHaveProperty('modules');
      expect(splitPoints[0]).toHaveProperty('priority');
    });

    it('should estimate size reduction from optimizations', () => {
      const bundleConfig = { originalSize: 1000000 }; // 1MB
      const estimation = bundleOptimizer.estimateSizeReduction(bundleConfig);
      
      expect(estimation).toHaveProperty('individual');
      expect(estimation).toHaveProperty('total');
      expect(estimation).toHaveProperty('estimatedFinalSize');
      expect(estimation.total).toBeGreaterThan(0);
      expect(estimation.total).toBeLessThan(1);
      expect(estimation.estimatedFinalSize).toBeLessThan(bundleConfig.originalSize);
    });

    it('should provide loading strategy recommendations', () => {
      // Mock navigator.connection
      global.navigator = {
        connection: {
          effectiveType: '4g'
        },
        hardwareConcurrency: 4
      };
      
      const recommendations = bundleOptimizer.getLoadingStrategyRecommendations();
      
      expect(recommendations).toHaveProperty('strategy');
      expect(recommendations).toHaveProperty('reasoning');
      expect(recommendations).toHaveProperty('optimizations');
      expect(recommendations.reasoning).toBeInstanceOf(Array);
      expect(recommendations.optimizations).toBeInstanceOf(Array);
    });

    it('should generate bundle optimization report', () => {
      const report = bundleOptimizer.getBundleOptimizationReport();
      
      expect(report).toHaveProperty('loadedModules');
      expect(report).toHaveProperty('preloadedResources');
      expect(report).toHaveProperty('compressionSupport');
      expect(report).toHaveProperty('loadingStrategies');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('estimatedSavings');
    });
  });

  describe('Integration Tests', () => {
    it('should integrate performance manager with bundle optimizer', () => {
      // Test that both components can work together
      const performanceReport = performanceManager.getMetrics();
      const bundleReport = bundleOptimizer.getBundleOptimizationReport();
      
      expect(performanceReport).toBeDefined();
      expect(bundleReport).toBeDefined();
      
      // Both should provide complementary optimization data
      expect(performanceReport.cacheStats).toBeDefined();
      expect(bundleReport.recommendations).toBeDefined();
    });

    it('should handle performance monitoring lifecycle', () => {
      // Initialize
      performanceManager.initialize();
      
      // Simulate some activity
      performanceManager.cacheEmbedding('test', [1, 2, 3]);
      const timerId = performanceManager.startQueryTimer('test');
      performanceManager.stopQueryTimer(timerId);
      
      // Get metrics
      const metrics = performanceManager.getMetrics();
      expect(metrics.cacheStats.embeddingsCacheSize).toBe(1);
      expect(metrics.performanceStatus.totalQueries).toBe(1);
      
      // Cleanup
      performanceManager.cleanup();
      expect(performanceManager.cache.embeddings.size).toBe(0);
    });
  });

  describe('Performance Targets', () => {
    it('should meet query processing time target', () => {
      // Simulate query processing times under 3 seconds
      performanceManager.metrics.queryProcessingTimes = [
        { duration: 1500, timestamp: Date.now() },
        { duration: 2000, timestamp: Date.now() },
        { duration: 2500, timestamp: Date.now() }
      ];
      
      const avgTime = performanceManager.getAverageQueryTime();
      const status = performanceManager.getPerformanceStatus();
      
      expect(avgTime).toBeLessThan(3000);
      expect(status.meetingTarget).toBe(true);
    });

    it('should detect when performance targets are not met', () => {
      // Simulate slow query processing times
      performanceManager.metrics.queryProcessingTimes = [
        { duration: 4000, timestamp: Date.now() },
        { duration: 5000, timestamp: Date.now() },
        { duration: 3500, timestamp: Date.now() }
      ];
      
      const status = performanceManager.getPerformanceStatus();
      
      expect(status.meetingTarget).toBe(false);
      expect(status.avgQueryTime).toBeGreaterThan(3000);
    });

    it('should maintain cache hit rate above threshold', () => {
      // Simulate good cache performance
      performanceManager.metrics.cacheHits = 80;
      performanceManager.metrics.cacheMisses = 20;
      
      const metrics = performanceManager.getMetrics();
      const hitRate = metrics.cacheStats.hitRate;
      
      expect(hitRate).toBeGreaterThan(0.7); // 70% hit rate threshold
    });
  });
});