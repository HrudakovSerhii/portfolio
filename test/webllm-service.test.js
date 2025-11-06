/**
 * WebLLM Service Tests
 * Comprehensive test suite for WebLLM integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebLLMService from '../src/scripts/modules/chat-bot/webllm-service.js';

// Setup browser environment mocks
global.HTMLCanvasElement = class HTMLCanvasElement {
  getContext() {
    return {
      createShader: vi.fn(),
      shaderSource: vi.fn(),
      compileShader: vi.fn()
    };
  }
};

global.document = {
  createElement: vi.fn().mockImplementation((tagName) => {
    if (tagName === 'canvas') {
      return new HTMLCanvasElement();
    }
    return {};
  })
};

global.navigator = {
  deviceMemory: 8,
  userAgent: 'Mozilla/5.0 (Test Browser)'
};

global.WebAssembly = {
  compile: vi.fn(),
  instantiate: vi.fn()
};

// Mock Worker class that simulates real WebLLM worker behavior
class TestWebLLMWorker {
  constructor(scriptURL, options) {
    this.scriptURL = scriptURL;
    this.options = options;
    this.onmessage = null;
    this.onerror = null;
    this.messageQueue = [];
    this.terminated = false;
    this.initialized = false;
  }

  postMessage(data) {
    if (this.terminated) return;
    
    this.messageQueue.push(data);
    
    // Simulate realistic async behavior
    setTimeout(() => {
      if (this.onmessage && !this.terminated) {
        this._handleMessage(data);
      }
    }, Math.random() * 50 + 10); // 10-60ms delay
  }

  _handleMessage(message) {
    const { type, messageId } = message;
    
    try {
      switch (type) {
        case 'initialize':
          this._handleInitialize(message);
          break;
          
        case 'process_query':
          this._handleProcessQuery(message);
          break;
          
        case 'get_metrics':
          this._handleGetMetrics(message);
          break;
          
        case 'cleanup':
          this._handleCleanup(message);
          break;
          
        default:
          this._sendError(messageId, `Unknown message type: ${type}`);
      }
    } catch (error) {
      this._sendError(messageId, error.message);
    }
  }

  _handleInitialize(message) {
    const { messageId, cvData, config } = message;
    
    // Simulate initialization validation
    if (!cvData || !cvData.sections) {
      this._sendError(messageId, 'Invalid CV data provided');
      return;
    }

    // Simulate model loading time
    setTimeout(() => {
      if (this.terminated) return;
      
      this.initialized = true;
      this.onmessage({
        data: {
          type: 'ready',
          messageId,
          success: true,
          message: 'WebLLM initialized successfully',
          metrics: {
            initTime: 2500,
            modelConfig: config?.model || 'Llama-2-7b-chat-hf-q4f16_1-MLC',
            memoryRequired: 3000
          }
        }
      });
    }, 100);
  }

  _handleProcessQuery(message) {
    const { messageId, message: query, context, style, cvSections } = message;
    
    if (!this.initialized) {
      this._sendError(messageId, 'WebLLM not initialized');
      return;
    }

    // Simulate query processing
    setTimeout(() => {
      if (this.terminated) return;
      
      const response = this._generateResponse(query, style, cvSections);
      
      this.onmessage({
        data: {
          type: 'response',
          messageId,
          ...response
        }
      });
    }, Math.random() * 1000 + 500); // 500-1500ms processing time
  }

  _generateResponse(query, style, cvSections) {
    // Simulate realistic response generation based on input
    const queryLower = query.toLowerCase();
    let confidence = 0.7;
    let answer = '';

    // Simulate confidence based on query characteristics
    if (queryLower.includes('react') || queryLower.includes('javascript')) {
      confidence = 0.9;
      answer = style === 'friend' 
        ? "Oh React! 🚀 I absolutely love working with it. Been using it for 3+ years now and it's definitely one of my go-to frameworks!"
        : "I have extensive experience with React, having worked with it for over 3 years in various production applications.";
    } else if (queryLower.includes('experience') || queryLower.includes('skills')) {
      confidence = 0.8;
      answer = style === 'hr'
        ? "I have 5+ years of professional software development experience with expertise in modern web technologies."
        : "I've been coding for 5+ years, working with everything from frontend frameworks to backend APIs.";
    } else {
      confidence = 0.6;
      answer = style === 'friend'
        ? "That's an interesting question! Let me think about that... 🤔"
        : "I'd be happy to discuss that topic with you.";
    }

    return {
      answer,
      confidence,
      matchedSections: cvSections?.slice(0, 2) || [],
      processingMetrics: {
        processingTime: Math.random() * 1000 + 500,
        cached: false,
        tokensGenerated: Math.floor(answer.length / 4),
        sectionsUsed: cvSections?.length || 0
      }
    };
  }

  _handleGetMetrics(message) {
    const { messageId } = message;
    
    setTimeout(() => {
      if (this.terminated) return;
      
      this.onmessage({
        data: {
          type: 'metrics',
          messageId,
          metrics: {
            queriesProcessed: this.messageQueue.filter(m => m.type === 'process_query').length,
            averageResponseTime: 800,
            errorCount: 0,
            cacheHitRate: 0.2
          }
        }
      });
    }, 50);
  }

  _handleCleanup(message) {
    const { messageId } = message;
    
    setTimeout(() => {
      this.initialized = false;
      if (!this.terminated) {
        this.onmessage({
          data: {
            type: 'cleanup_complete',
            messageId
          }
        });
      }
    }, 50);
  }

  _sendError(messageId, errorMessage) {
    if (this.terminated) return;
    
    this.onmessage({
      data: {
        type: 'error',
        messageId,
        error: errorMessage
      }
    });
  }

  terminate() {
    this.terminated = true;
    this.initialized = false;
  }
}

// Mock Worker constructor
global.Worker = function(scriptURL, options) {
  return new TestWebLLMWorker(scriptURL, options);
};

describe('WebLLMService', () => {
  let webllmService;
  let mockCVData;

  beforeEach(() => {
    webllmService = new WebLLMService();
    mockCVData = {
      metadata: { version: '1.0', totalSections: 2 },
      sections: {
        experience: {
          react: {
            id: 'exp_react',
            keywords: ['react', 'javascript'],
            responses: {
              developer: 'I have 3+ years of React experience'
            },
            details: { years: 3 }
          }
        }
      },
      personality: {
        traits: ['curious'],
        communication_style: {
          developer: 'technical and collaborative'
        }
      }
    };
  });

  afterEach(async () => {
    if (webllmService) {
      try {
        await webllmService.cleanup();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  }, 15000); // Increase timeout for cleanup

  describe('Initialization', () => {
    it('should initialize successfully with valid CV data', async () => {
      const result = await webllmService.initialize(mockCVData);
      
      expect(result).toBe(true);
      expect(webllmService.isReady()).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      // Create service with invalid CV data
      const invalidCVData = { invalid: 'data' };
      
      await expect(webllmService.initialize(invalidCVData))
        .rejects.toThrow('Invalid CV data provided');
    });

    it('should not reinitialize if already initialized', async () => {
      await webllmService.initialize(mockCVData);
      expect(webllmService.isReady()).toBe(true);
      
      // Second initialization should return immediately
      const startTime = Date.now();
      const result = await webllmService.initialize(mockCVData);
      const duration = Date.now() - startTime;
      
      expect(result).toBe(true);
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it('should handle concurrent initialization attempts', async () => {
      const promise1 = webllmService.initialize(mockCVData);
      const promise2 = webllmService.initialize(mockCVData);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('Query Processing', () => {
    beforeEach(async () => {
      await webllmService.initialize(mockCVData);
    });

    it('should process queries successfully', async () => {
      const result = await webllmService.processQuery(
        'Tell me about React experience',
        [],
        'developer',
        [{ section: mockCVData.sections.experience.react }]
      );

      expect(result.answer).toContain('React');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.processingMetrics.cached).toBe(false);
      expect(result.processingMetrics.tokensGenerated).toBeGreaterThan(0);
    });

    it('should handle different conversation styles', async () => {
      const styles = ['hr', 'developer', 'friend'];
      
      for (const style of styles) {
        const result = await webllmService.processQuery(
          'What are your skills?',
          [],
          style,
          []
        );
        
        expect(result.answer).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it('should include conversation context', async () => {
      const context = [
        {
          userMessage: 'Do you know React?',
          botResponse: 'Yes, I have React experience'
        }
      ];

      const result = await webllmService.processQuery(
        'How many years?',
        context,
        'developer',
        []
      );

      expect(result.answer).toBeDefined();
    });

    it('should handle query processing errors', async () => {
      // Try to process query without initialization
      const uninitializedService = new WebLLMService();
      
      await expect(uninitializedService.processQuery('test query'))
        .rejects.toThrow('WebLLM service not initialized');
    });

    it('should handle worker timeout', async () => {
      await webllmService.initialize(mockCVData);
      
      // Set very short timeout
      webllmService.config.workerTimeout = 1;
      
      await expect(webllmService.processQuery('test query'))
        .rejects.toThrow('timeout');
    });
  });

  describe('Metrics and Performance', () => {
    beforeEach(async () => {
      await webllmService.initialize(mockCVData);
    });

    it('should track query metrics', async () => {
      await webllmService.processQuery('test query 1');
      await webllmService.processQuery('test query 2');

      expect(webllmService.metrics.queriesProcessed).toBe(2);
      expect(webllmService.metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should get comprehensive metrics', async () => {
      const metrics = await webllmService.getMetrics();

      expect(metrics.service).toBeDefined();
      expect(metrics.worker).toBeDefined();
      expect(metrics.service.queriesProcessed).toBeDefined();
    });

    it('should handle metrics retrieval errors', async () => {
      // Terminate worker to simulate error condition
      webllmService.worker.terminate();
      webllmService.worker = null;

      const metrics = await webllmService.getMetrics();
      expect(metrics.service).toBeDefined();
      expect(metrics.worker).toBeNull();
    });
  });

  describe('Browser Compatibility', () => {
    it('should detect WebLLM support correctly', () => {
      expect(WebLLMService.isSupported()).toBe(true);
    });

    it('should detect lack of WebAssembly support', () => {
      const originalWebAssembly = global.WebAssembly;
      delete global.WebAssembly;

      expect(WebLLMService.isSupported()).toBe(false);

      global.WebAssembly = originalWebAssembly;
    });

    it('should detect lack of Worker support', () => {
      const originalWorker = global.Worker;
      delete global.Worker;

      expect(WebLLMService.isSupported()).toBe(false);

      global.Worker = originalWorker;
    });

    it('should detect insufficient memory', () => {
      Object.defineProperty(navigator, 'deviceMemory', {
        value: 2,
        writable: true
      });

      expect(WebLLMService.isSupported()).toBe(false);

      // Restore
      Object.defineProperty(navigator, 'deviceMemory', {
        value: 8,
        writable: true
      });
    });

    it('should provide comprehensive compatibility info', () => {
      const info = WebLLMService.getCompatibilityInfo();

      expect(info.webAssembly).toBe(true);
      expect(info.workers).toBe(true);
      expect(info.webGL).toBe(true);
      expect(info.deviceMemory).toBeDefined();
      expect(info.userAgent).toBeDefined();
      expect(info.supported).toBe(true);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await webllmService.initialize(mockCVData);
    });

    it('should handle event listeners correctly', () => {
      const mockCallback = vi.fn();
      
      webllmService.on('test_event', mockCallback);
      webllmService.emit('test_event', { data: 'test' });
      
      expect(mockCallback).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should remove event listeners', () => {
      const mockCallback = vi.fn();
      
      webllmService.on('test_event', mockCallback);
      webllmService.off('test_event', mockCallback);
      webllmService.emit('test_event', { data: 'test' });
      
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle worker status messages', async () => {
      const statusCallback = vi.fn();
      webllmService.on('status', statusCallback);

      // Simulate status message from worker
      webllmService.worker.onmessage({
        data: { type: 'status', message: 'Loading model...' }
      });

      expect(statusCallback).toHaveBeenCalledWith('Loading model...');
    });

    it('should handle worker progress messages', async () => {
      const progressCallback = vi.fn();
      webllmService.on('progress', progressCallback);

      // Simulate progress message from worker
      webllmService.worker.onmessage({
        data: { type: 'progress', progress: 0.5 }
      });

      expect(progressCallback).toHaveBeenCalledWith(0.5);
    });
  });

  describe('Service Management', () => {
    it('should restart service successfully', async () => {
      await webllmService.initialize(mockCVData);
      expect(webllmService.isReady()).toBe(true);

      const result = await webllmService.restart(mockCVData);
      expect(result).toBe(true);
      expect(webllmService.isReady()).toBe(true);
    });

    it('should cleanup resources properly', async () => {
      await webllmService.initialize(mockCVData);
      const worker = webllmService.worker;
      
      await webllmService.cleanup();
      
      expect(webllmService.isReady()).toBe(false);
      expect(webllmService.worker).toBeNull();
      expect(worker.terminated).toBe(true);
    });

    it('should handle cleanup errors gracefully', async () => {
      await webllmService.initialize(mockCVData);
      
      // Mock worker to throw error on cleanup
      webllmService.worker.simulateResponse = (originalMessage) => {
        if (originalMessage.type === 'cleanup') {
          webllmService.worker.onerror(new Error('Cleanup failed'));
        }
      };

      // Should not throw
      await expect(webllmService.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await webllmService.initialize(mockCVData);
    });

    it('should handle worker errors', () => {
      const errorCallback = vi.fn();
      webllmService.on('error', errorCallback);

      // Simulate worker error
      webllmService.worker.onerror(new Error('Worker crashed'));

      expect(errorCallback).toHaveBeenCalled();
      expect(webllmService.metrics.errorCount).toBe(1);
    });

    it('should handle message sending to terminated worker', async () => {
      webllmService.worker.terminate();
      webllmService.worker = null;

      await expect(webllmService.processQuery('test'))
        .rejects.toThrow('WebLLM worker not available');
    });

    it('should handle uninitialized service queries', async () => {
      const uninitializedService = new WebLLMService();

      await expect(uninitializedService.processQuery('test'))
        .rejects.toThrow('WebLLM service not initialized');
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', async () => {
      const customConfig = {
        model: 'custom-model',
        workerTimeout: 60000,
        maxRetries: 5
      };

      await webllmService.initialize(mockCVData, customConfig);

      expect(webllmService.config.model).toBe('custom-model');
      expect(webllmService.config.workerTimeout).toBe(60000);
      expect(webllmService.config.maxRetries).toBe(5);
    });

    it('should use default configuration when not provided', async () => {
      await webllmService.initialize(mockCVData);

      expect(webllmService.config.model).toBe('Llama-2-7b-chat-hf-q4f16_1-MLC');
      expect(webllmService.config.workerTimeout).toBe(30000);
      expect(webllmService.config.maxRetries).toBe(2);
    });
  });
});