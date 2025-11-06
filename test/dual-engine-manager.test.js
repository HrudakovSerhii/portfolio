/**
 * Dual Engine Manager Tests
 * Comprehensive test suite for dual engine management and A/B testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';



// Mock DistilBERT Worker
class MockDistilBERTWorker {
  constructor() {
    this.isInitialized = true;
    this.eventListeners = [];
  }

  addEventListener(event, callback) {
    this.eventListeners.push({ event, callback });
  }

  removeEventListener(event, callback) {
    this.eventListeners = this.eventListeners.filter(
      listener => listener.event !== event || listener.callback !== callback
    );
  }

  postMessage(data) {
    // Simulate async response
    setTimeout(() => {
      const responseCallback = this.eventListeners.find(
        listener => listener.event === 'message'
      );
      
      if (responseCallback) {
        if (data.type === 'process_query') {
          responseCallback.callback({
            data: {
              type: 'response',
              answer: `DistilBERT response to: ${data.message}`,
              confidence: 0.9,
              matchedSections: [{ id: 'test_section', similarity: 0.85 }],
              processingMetrics: {
                processingTime: 1000,
                cached: false
              }
            }
          });
        }
      }
    }, 10);
  }
}

// Mock CV Data Service
class MockCVDataService {
  async loadCVData() {
    return {
      metadata: { version: '1.0', totalSections: 3 },
      sections: {
        experience: {
          react: {
            id: 'exp_react',
            keywords: ['react', 'javascript'],
            responses: { developer: 'React experience' }
          }
        }
      }
    };
  }

  findSectionsByKeywords(keywords) {
    return [
      {
        section: {
          id: 'exp_react',
          keywords: ['react'],
          responses: { developer: 'React experience' }
        },
        relevanceScore: 0.9
      }
    ];
  }
}

// Mock WebLLMService import
vi.mock('../src/scripts/modules/chat-bot/webllm-service.js', () => {
  return {
    default: class MockWebLLMService {
      constructor() {
        this.initialized = false;
        this.eventListeners = new Map();
      }

      static isSupported() {
        return true;
      }

      async initialize(cvData, config) {
        this.initialized = true;
        return true;
      }

      isReady() {
        return this.initialized;
      }

      async processQuery(message, context, style, cvSections) {
        return {
          answer: `WebLLM response to: ${message}`,
          confidence: 0.8,
          matchedSections: cvSections.slice(0, 2),
          processingMetrics: {
            processingTime: 2000,
            cached: false,
            tokensGenerated: 75
          }
        };
      }

      async getMetrics() {
        return {
          service: {
            queriesProcessed: 10,
            averageResponseTime: 2000,
            errorCount: 1
          },
          worker: {
            cacheHitRate: 0.3
          }
        };
      }

      on(event, callback) {
        if (!this.eventListeners.has(event)) {
          this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
      }

      async cleanup() {
        this.initialized = false;
        this.eventListeners.clear();
      }
    }
  };
});

import DualEngineManager from '../src/scripts/modules/chat-bot/dual-engine-manager.js';
import WebLLMService from '../src/scripts/modules/chat-bot/webllm-service.js';

describe('DualEngineManager', () => {
  let dualEngineManager;
  let mockDistilBERTWorker;
  let mockCVDataService;

  beforeEach(() => {
    dualEngineManager = new DualEngineManager();
    mockDistilBERTWorker = new MockDistilBERTWorker();
    mockCVDataService = new MockCVDataService();
  });

  afterEach(async () => {
    if (dualEngineManager) {
      await dualEngineManager.cleanup();
    }
  });

  describe('Initialization', () => {
    it('should initialize both engines successfully', async () => {
      const result = await dualEngineManager.initialize(
        mockDistilBERTWorker,
        mockCVDataService
      );

      expect(result.success).toBe(true);
      expect(result.availableEngines).toContain('distilbert');
      expect(result.availableEngines).toContain('webllm');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial initialization (DistilBERT only)', async () => {
      // Mock WebLLM as unsupported
      vi.mocked(WebLLMService).isSupported = vi.fn().mockReturnValue(false);

      const result = await dualEngineManager.initialize(
        mockDistilBERTWorker,
        mockCVDataService
      );

      expect(result.success).toBe(true);
      expect(result.availableEngines).toContain('distilbert');
      expect(result.availableEngines).not.toContain('webllm');
      expect(result.errors).toHaveLength(1);
    });

    it('should handle WebLLM initialization failure', async () => {
      // Create a new dual engine manager for this test
      const testManager = new DualEngineManager();
      
      // Mock WebLLM to fail initialization by creating a failing instance
      const originalWebLLMService = vi.mocked(WebLLMService);
      vi.mocked(WebLLMService).mockImplementation(() => ({
        initialize: async () => {
          throw new Error('WebLLM init failed');
        },
        on: vi.fn(),
        cleanup: vi.fn()
      }));

      const result = await testManager.initialize(
        mockDistilBERTWorker,
        mockCVDataService
      );

      expect(result.success).toBe(true); // DistilBERT should still work
      expect(result.availableEngines).toContain('distilbert');
      expect(result.errors.some(e => e.engine === 'webllm')).toBe(true);
      
      await testManager.cleanup();
    });

    it('should setup A/B testing when enabled', async () => {
      const config = {
        abTestingEnabled: true,
        abTestingRatio: 0.5
      };

      await dualEngineManager.initialize(
        mockDistilBERTWorker,
        mockCVDataService,
        config
      );

      expect(dualEngineManager.config.abTestingEnabled).toBe(true);
      expect(dualEngineManager.abTestSession.engineAssignment).toBeDefined();
    });
  });

  describe('Engine Selection', () => {
    beforeEach(async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);
    });

    it('should select primary engine by default', () => {
      const selectedEngine = dualEngineManager.selectEngine();
      expect(selectedEngine).toBe(dualEngineManager.config.primaryEngine);
    });

    it('should respect A/B testing assignment', async () => {
      dualEngineManager.config.abTestingEnabled = true;
      dualEngineManager.abTestSession.engineAssignment = 'webllm';

      const selectedEngine = dualEngineManager.selectEngine();
      expect(selectedEngine).toBe('webllm');
    });

    it('should fallback to available engine when primary unavailable', () => {
      dualEngineManager.config.primaryEngine = 'unavailable_engine';
      
      const selectedEngine = dualEngineManager.selectEngine();
      expect(['distilbert', 'webllm']).toContain(selectedEngine);
    });
  });

  describe('Query Processing', () => {
    beforeEach(async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);
    });

    it('should process query with DistilBERT', async () => {
      dualEngineManager.config.primaryEngine = 'distilbert';

      const result = await dualEngineManager.processQuery(
        'Tell me about React',
        [],
        'developer'
      );

      expect(result.answer).toContain('DistilBERT response');
      expect(result.engineUsed).toBe('distilbert');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should process query with WebLLM', async () => {
      dualEngineManager.config.primaryEngine = 'webllm';

      const result = await dualEngineManager.processQuery(
        'Tell me about React',
        [],
        'developer'
      );

      expect(result.answer).toContain('WebLLM response');
      expect(result.engineUsed).toBe('webllm');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should include processing metrics', async () => {
      const result = await dualEngineManager.processQuery(
        'Test query',
        [],
        'developer'
      );

      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.queryId).toBeDefined();
      expect(result.fallbackAvailable).toBe(true);
    });

    it('should handle conversation context', async () => {
      const context = [
        {
          userMessage: 'Previous question',
          botResponse: 'Previous answer'
        }
      ];

      const result = await dualEngineManager.processQuery(
        'Follow-up question',
        context,
        'developer'
      );

      expect(result.answer).toBeDefined();
    });
  });

  describe('Fallback Mechanism', () => {
    beforeEach(async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);
    });

    it('should fallback to secondary engine on primary failure', async () => {
      // Mock DistilBERT to fail
      mockDistilBERTWorker.postMessage = (data) => {
        setTimeout(() => {
          const errorCallback = mockDistilBERTWorker.eventListeners.find(
            listener => listener.event === 'message'
          );
          if (errorCallback) {
            errorCallback.callback({
              data: { type: 'error', error: 'DistilBERT failed' }
            });
          }
        }, 10);
      };

      dualEngineManager.config.primaryEngine = 'distilbert';
      dualEngineManager.config.fallbackEnabled = true;

      const result = await dualEngineManager.processQuery('Test query');

      expect(result.engineUsed).toBe('webllm');
      expect(result.fallbackUsed).toBe(true);
      expect(result.originalError).toContain('DistilBERT failed');
    });

    it('should throw error when all engines fail', async () => {
      // Mock both engines to fail
      mockDistilBERTWorker.postMessage = (data) => {
        setTimeout(() => {
          const errorCallback = mockDistilBERTWorker.eventListeners.find(
            listener => listener.event === 'message'
          );
          if (errorCallback) {
            errorCallback.callback({
              data: { type: 'error', error: 'DistilBERT failed' }
            });
          }
        }, 10);
      };

      // Mock WebLLM service to fail
      if (dualEngineManager.webllmService) {
        dualEngineManager.webllmService.processQuery = async () => {
          throw new Error('WebLLM failed');
        };
      }

      await expect(dualEngineManager.processQuery('Test query'))
        .rejects.toThrow('All engines failed');
    });

    it('should update fallback metrics', async () => {
      // Force fallback scenario
      mockDistilBERTWorker.postMessage = (data) => {
        setTimeout(() => {
          const errorCallback = mockDistilBERTWorker.eventListeners.find(
            listener => listener.event === 'message'
          );
          if (errorCallback) {
            errorCallback.callback({
              data: { type: 'error', error: 'Primary failed' }
            });
          }
        }, 10);
      };

      await dualEngineManager.processQuery('Test query');

      expect(dualEngineManager.metrics.fallbacks).toBe(1);
    });
  });

  describe('A/B Testing', () => {
    beforeEach(async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);
    });

    it('should record A/B test results', async () => {
      dualEngineManager.setABTesting(true, 0.5);

      await dualEngineManager.processQuery('Test query 1');
      await dualEngineManager.processQuery('Test query 2');

      const summary = dualEngineManager.getABTestSummary();
      expect(summary.available).toBe(true);
      expect(summary.totalTests).toBe(2);
    });

    it('should provide A/B test summary', async () => {
      dualEngineManager.setABTesting(true, 0.5);
      
      // Force specific engine assignment for predictable testing
      dualEngineManager.abTestSession.engineAssignment = 'distilbert';

      await dualEngineManager.processQuery('Test query');

      const summary = dualEngineManager.getABTestSummary();
      expect(summary.available).toBe(true);
      expect(summary.distilbert.count).toBeGreaterThan(0);
    });

    it('should handle A/B testing toggle', () => {
      const eventSpy = vi.fn();
      dualEngineManager.on('ab_testing_changed', eventSpy);

      dualEngineManager.setABTesting(true, 0.3);

      expect(dualEngineManager.config.abTestingEnabled).toBe(true);
      expect(dualEngineManager.config.abTestingRatio).toBe(0.3);
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);
    });

    it('should track engine performance metrics', async () => {
      await dualEngineManager.processQuery('Test query 1');
      await dualEngineManager.processQuery('Test query 2');

      const engine = dualEngineManager.config.primaryEngine;
      const metrics = dualEngineManager.metrics[engine];

      expect(metrics.queries).toBe(2);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.averageConfidence).toBeGreaterThan(0);
    });

    it('should generate comparison metrics', async () => {
      // Process queries with both engines
      dualEngineManager.config.primaryEngine = 'distilbert';
      await dualEngineManager.processQuery('Test query 1');

      dualEngineManager.config.primaryEngine = 'webllm';
      await dualEngineManager.processQuery('Test query 2');

      const metrics = await dualEngineManager.getMetrics();
      const comparison = metrics.comparison;

      expect(comparison.available).toBe(true);
      expect(comparison.responseTime.winner).toBeDefined();
      expect(comparison.confidence.winner).toBeDefined();
    });

    it('should get comprehensive metrics including WebLLM details', async () => {
      const metrics = await dualEngineManager.getMetrics();

      expect(metrics.distilbert).toBeDefined();
      expect(metrics.webllm).toBeDefined();
      expect(metrics.webllmDetailed).toBeDefined();
      expect(metrics.comparison).toBeDefined();
    });
  });

  describe('Engine Management', () => {
    beforeEach(async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);
    });

    it('should switch primary engine', () => {
      const eventSpy = vi.fn();
      dualEngineManager.on('primary_engine_changed', eventSpy);

      dualEngineManager.switchPrimaryEngine('webllm');

      expect(dualEngineManager.config.primaryEngine).toBe('webllm');
      expect(eventSpy).toHaveBeenCalledWith({
        previous: 'distilbert',
        current: 'webllm'
      });
    });

    it('should throw error when switching to unavailable engine', () => {
      expect(() => {
        dualEngineManager.switchPrimaryEngine('unavailable_engine');
      }).toThrow('Engine unavailable_engine is not available');
    });

    it('should check engine availability', () => {
      expect(dualEngineManager.isEngineAvailable('distilbert')).toBe(true);
      expect(dualEngineManager.isEngineAvailable('webllm')).toBe(true);
      expect(dualEngineManager.isEngineAvailable('nonexistent')).toBe(false);
    });

    it('should get available engines list', () => {
      const engines = dualEngineManager.getAvailableEngines();
      expect(engines).toContain('distilbert');
      expect(engines).toContain('webllm');
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);
    });

    it('should emit query lifecycle events', async () => {
      const startedSpy = vi.fn();
      const completedSpy = vi.fn();

      dualEngineManager.on('query_started', startedSpy);
      dualEngineManager.on('query_completed', completedSpy);

      await dualEngineManager.processQuery('Test query');

      expect(startedSpy).toHaveBeenCalled();
      expect(completedSpy).toHaveBeenCalled();
    });

    it('should emit engine ready events', () => {
      const readySpy = vi.fn();
      dualEngineManager.on('engine_ready', readySpy);

      // Trigger engine ready event
      dualEngineManager.emit('engine_ready', { engine: 'distilbert' });

      expect(readySpy).toHaveBeenCalledWith({ engine: 'distilbert' });
    });

    it('should emit fallback events', async () => {
      const fallbackSpy = vi.fn();
      dualEngineManager.on('fallback_triggered', fallbackSpy);

      // Mock primary engine failure
      mockDistilBERTWorker.postMessage = (data) => {
        setTimeout(() => {
          const errorCallback = mockDistilBERTWorker.eventListeners.find(
            listener => listener.event === 'message'
          );
          if (errorCallback) {
            errorCallback.callback({
              data: { type: 'error', error: 'Engine failed' }
            });
          }
        }, 10);
      };

      await dualEngineManager.processQuery('Test query');

      expect(fallbackSpy).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup all resources', async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);
      
      expect(dualEngineManager.isInitialized).toBe(true);
      expect(dualEngineManager.availableEngines.size).toBeGreaterThan(0);

      await dualEngineManager.cleanup();

      expect(dualEngineManager.isInitialized).toBe(false);
      expect(dualEngineManager.availableEngines.size).toBe(0);
      expect(dualEngineManager.webllmService).toBeNull();
    });

    it('should handle cleanup errors gracefully', async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);

      // Mock WebLLM cleanup to fail
      dualEngineManager.webllmService.cleanup = async () => {
        throw new Error('Cleanup failed');
      };

      // Should not throw
      await expect(dualEngineManager.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);
    });

    it('should handle uninitialized manager queries', async () => {
      const uninitializedManager = new DualEngineManager();

      await expect(uninitializedManager.processQuery('test'))
        .rejects.toThrow('Dual engine manager not initialized');
    });

    it('should handle event listener errors gracefully', () => {
      const faultyCallback = () => {
        throw new Error('Callback error');
      };

      dualEngineManager.on('test_event', faultyCallback);

      // Should not throw
      expect(() => {
        dualEngineManager.emit('test_event', {});
      }).not.toThrow();
    });
  });

  describe('Configuration Management', () => {
    it('should accept custom configuration', async () => {
      const customConfig = {
        primaryEngine: 'webllm',
        fallbackEnabled: false,
        abTestingEnabled: true,
        performanceThreshold: 10000
      };

      await dualEngineManager.initialize(
        mockDistilBERTWorker,
        mockCVDataService,
        customConfig
      );

      expect(dualEngineManager.config.primaryEngine).toBe('webllm');
      expect(dualEngineManager.config.fallbackEnabled).toBe(false);
      expect(dualEngineManager.config.abTestingEnabled).toBe(true);
      expect(dualEngineManager.config.performanceThreshold).toBe(10000);
    });

    it('should use default configuration when not provided', async () => {
      await dualEngineManager.initialize(mockDistilBERTWorker, mockCVDataService);

      expect(dualEngineManager.config.primaryEngine).toBe('distilbert');
      expect(dualEngineManager.config.fallbackEnabled).toBe(true);
      expect(dualEngineManager.config.abTestingEnabled).toBe(false);
    });
  });
});