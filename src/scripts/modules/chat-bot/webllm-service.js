/**
 * WebLLM Service Wrapper
 * Provides a clean interface for WebLLM worker communication and management
 */

class WebLLMService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.initializationPromise = null;
    this.messageId = 0;
    this.pendingMessages = new Map();
    this.eventListeners = new Map();
    
    // Configuration
    this.config = {
      model: "Llama-2-7b-chat-hf-q4f16_1-MLC",
      workerTimeout: 30000, // 30 seconds
      maxRetries: 2,
      retryDelay: 1000
    };
    
    // Performance tracking
    this.metrics = {
      queriesProcessed: 0,
      averageResponseTime: 0,
      errorCount: 0,
      cacheHitRate: 0
    };
  }

  /**
   * Initialize WebLLM service with CV data
   * @param {Object} cvData - CV data for context
   * @param {Object} config - Optional configuration overrides
   * @returns {Promise<boolean>} Success status
   */
  async initialize(cvData, config = {}) {
    if (this.isInitialized) {
      return true;
    }

    if (this.isInitializing) {
      return this.initializationPromise;
    }

    this.isInitializing = true;
    this.config = { ...this.config, ...config };

    this.initializationPromise = this._performInitialization(cvData);
    
    try {
      const result = await this.initializationPromise;
      this.isInitializing = false;
      return result;
    } catch (error) {
      this.isInitializing = false;
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Perform the actual initialization
   */
  async _performInitialization(cvData) {
    try {
      // Create WebLLM worker
      this.worker = new Worker('/scripts/workers/webllm-worker.js', { type: 'module' });
      
      // Setup message handling
      this.setupWorkerMessageHandling();
      
      // Initialize worker with CV data
      const initResult = await this.sendMessage('initialize', {
        cvData,
        config: this.config
      });

      if (initResult.success) {
        this.isInitialized = true;
        this.emit('initialized', initResult);
        return true;
      } else {
        throw new Error(initResult.error || 'WebLLM initialization failed');
      }
    } catch (error) {
      this.cleanup();
      throw new Error(`WebLLM service initialization failed: ${error.message}`);
    }
  }

  /**
   * Setup worker message handling
   */
  setupWorkerMessageHandling() {
    this.worker.onmessage = (event) => {
      const { type, messageId, ...data } = event.data;

      // Handle responses to specific messages
      if (messageId && this.pendingMessages.has(messageId)) {
        const { resolve, reject } = this.pendingMessages.get(messageId);
        this.pendingMessages.delete(messageId);

        if (type === 'error') {
          reject(new Error(data.error));
        } else {
          resolve(data);
        }
        return;
      }

      // Handle broadcast messages
      switch (type) {
        case 'status':
          this.emit('status', data.message);
          break;
          
        case 'progress':
          this.emit('progress', data.progress);
          break;
          
        case 'response':
          this.emit('response', data);
          this.updateMetrics(data);
          break;
          
        case 'error':
          this.emit('error', data.error);
          this.metrics.errorCount++;
          break;
          
        case 'metrics':
          this.emit('metrics', data.metrics);
          break;
          
        default:
          console.warn('Unknown WebLLM worker message type:', type);
      }
    };

    this.worker.onerror = (error) => {
      console.error('WebLLM worker error:', error);
      this.emit('error', `Worker error: ${error.message}`);
      this.metrics.errorCount++;
    };
  }

  /**
   * Process a query using WebLLM
   * @param {string} message - User query
   * @param {Array} context - Conversation context
   * @param {string} style - Conversation style
   * @param {Array} cvSections - Relevant CV sections
   * @returns {Promise<Object>} Response data
   */
  async processQuery(message, context = [], style = 'developer', cvSections = []) {
    if (!this.isInitialized) {
      throw new Error('WebLLM service not initialized');
    }

    const startTime = Date.now();
    
    try {
      const result = await this.sendMessage('process_query', {
        message,
        context,
        style,
        cvSections
      });

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateQueryMetrics(processingTime, result);

      return result;
    } catch (error) {
      this.metrics.errorCount++;
      throw new Error(`WebLLM query processing failed: ${error.message}`);
    }
  }

  /**
   * Send message to worker with timeout and retry logic
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {Promise<Object>} Response from worker
   */
  async sendMessage(type, data = {}) {
    if (!this.worker) {
      throw new Error('WebLLM worker not available');
    }

    const messageId = ++this.messageId;
    
    return new Promise((resolve, reject) => {
      // Setup timeout
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error(`WebLLM worker timeout for message type: ${type}`));
      }, this.config.workerTimeout);

      // Store promise handlers
      this.pendingMessages.set(messageId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Send message to worker
      this.worker.postMessage({
        type,
        messageId,
        ...data
      });
    });
  }

  /**
   * Update query processing metrics
   */
  updateQueryMetrics(processingTime, result) {
    this.metrics.queriesProcessed++;
    
    // Update average response time
    const currentAvg = this.metrics.averageResponseTime;
    const count = this.metrics.queriesProcessed;
    this.metrics.averageResponseTime = ((currentAvg * (count - 1)) + processingTime) / count;
    
    // Update cache hit rate if available
    if (result.processingMetrics && result.processingMetrics.cached !== undefined) {
      // Simple cache hit rate calculation
      this.metrics.cacheHitRate = result.processingMetrics.cached ? 
        Math.min(1, this.metrics.cacheHitRate + 0.1) : 
        Math.max(0, this.metrics.cacheHitRate - 0.05);
    }
  }

  /**
   * Update general metrics from worker responses
   */
  updateMetrics(data) {
    if (data.processingMetrics) {
      // Additional metric updates can be added here
    }
  }

  /**
   * Get current performance metrics
   * @returns {Promise<Object>} Performance metrics
   */
  async getMetrics() {
    try {
      const workerMetrics = await this.sendMessage('get_metrics');
      return {
        service: this.metrics,
        worker: workerMetrics.metrics
      };
    } catch (error) {
      console.warn('Failed to get WebLLM worker metrics:', error);
      return { service: this.metrics, worker: null };
    }
  }

  /**
   * Check if WebLLM is supported in current environment
   * @returns {boolean} Support status
   */
  static isSupported() {
    // Check for WebAssembly support
    if (typeof WebAssembly === 'undefined') {
      return false;
    }

    // Check for Worker support
    if (typeof Worker === 'undefined') {
      return false;
    }

    // Check for WebGL support (required for WebLLM)
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        return false;
      }
    } catch (e) {
      return false;
    }

    // Check for sufficient memory (rough estimate)
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
      return false;
    }

    return true;
  }

  /**
   * Get browser compatibility info
   * @returns {Object} Compatibility information
   */
  static getCompatibilityInfo() {
    return {
      webAssembly: typeof WebAssembly !== 'undefined',
      workers: typeof Worker !== 'undefined',
      webGL: (() => {
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          return !!gl;
        } catch (e) {
          return false;
        }
      })(),
      deviceMemory: navigator.deviceMemory || 'unknown',
      userAgent: navigator.userAgent,
      supported: WebLLMService.isSupported()
    };
  }

  /**
   * Event listener management
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebLLM event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Check initialization status
   * @returns {boolean} Initialization status
   */
  isReady() {
    return this.isInitialized && !!this.worker;
  }

  /**
   * Restart the WebLLM service
   * @param {Object} cvData - CV data for reinitialization
   * @returns {Promise<boolean>} Success status
   */
  async restart(cvData) {
    await this.cleanup();
    return this.initialize(cvData);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Clear pending messages
      this.pendingMessages.forEach(({ reject }) => {
        reject(new Error('WebLLM service shutting down'));
      });
      this.pendingMessages.clear();

      // Cleanup worker
      if (this.worker) {
        try {
          await this.sendMessage('cleanup');
        } catch (error) {
          console.warn('WebLLM worker cleanup warning:', error);
        }
        
        this.worker.terminate();
        this.worker = null;
      }

      // Reset state
      this.isInitialized = false;
      this.isInitializing = false;
      this.initializationPromise = null;
      this.eventListeners.clear();

      // Reset metrics
      this.metrics = {
        queriesProcessed: 0,
        averageResponseTime: 0,
        errorCount: 0,
        cacheHitRate: 0
      };

    } catch (error) {
      console.error('WebLLM service cleanup error:', error);
    }
  }
}

export default WebLLMService;