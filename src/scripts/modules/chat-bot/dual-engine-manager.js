/**
 * Dual Engine Manager
 * Manages A/B testing and comparison between DistilBERT and WebLLM engines
 * Provides performance monitoring, graceful fallback, and engine selection
 */

import WebLLMService from './webllm-service.js';

class DualEngineManager {
  constructor() {
    this.distilbertWorker = null;
    this.webllmService = null;
    this.cvDataService = null;
    
    // Engine configuration
    this.config = {
      primaryEngine: 'distilbert', // 'distilbert' or 'webllm'
      fallbackEnabled: true,
      abTestingEnabled: false,
      abTestingRatio: 0.5, // 50% split for A/B testing
      performanceThreshold: 5000, // 5 seconds max response time
      confidenceThreshold: 0.6, // Minimum confidence for responses
      maxRetries: 2
    };
    
    // Performance tracking
    this.metrics = {
      distilbert: {
        queries: 0,
        averageResponseTime: 0,
        averageConfidence: 0,
        errorCount: 0,
        successRate: 0
      },
      webllm: {
        queries: 0,
        averageResponseTime: 0,
        averageConfidence: 0,
        errorCount: 0,
        successRate: 0
      },
      fallbacks: 0,
      abTestResults: []
    };
    
    // State management
    this.isInitialized = false;
    this.availableEngines = new Set();
    this.eventListeners = new Map();
    
    // A/B testing session management
    this.abTestSession = {
      userId: this.generateSessionId(),
      engineAssignment: null,
      queries: []
    };
  }

  /**
   * Initialize both engines
   * @param {Object} distilbertWorker - DistilBERT worker instance
   * @param {Object} cvDataService - CV data service instance
   * @param {Object} config - Configuration overrides
   */
  async initialize(distilbertWorker, cvDataService, config = {}) {
    this.config = { ...this.config, ...config };
    this.distilbertWorker = distilbertWorker;
    this.cvDataService = cvDataService;
    
    const initResults = {
      distilbert: false,
      webllm: false,
      errors: []
    };

    // Initialize DistilBERT (should already be initialized)
    try {
      if (distilbertWorker && distilbertWorker.isInitialized) {
        this.availableEngines.add('distilbert');
        initResults.distilbert = true;
        this.emit('engine_ready', { engine: 'distilbert' });
      }
    } catch (error) {
      console.error('DistilBERT initialization check failed:', error);
      initResults.errors.push({ engine: 'distilbert', error: error.message });
    }

    // Initialize WebLLM if supported
    try {
      if (WebLLMService.isSupported()) {
        this.webllmService = new WebLLMService();
        
        // Setup WebLLM event listeners
        this.setupWebLLMEventListeners();
        
        const cvData = await cvDataService.loadCVData();
        const webllmInitialized = await this.webllmService.initialize(cvData, {
          model: this.config.webllmModel || "Llama-2-7b-chat-hf-q4f16_1-MLC"
        });
        
        if (webllmInitialized) {
          this.availableEngines.add('webllm');
          initResults.webllm = true;
          this.emit('engine_ready', { engine: 'webllm' });
        }
      } else {
        initResults.errors.push({ 
          engine: 'webllm', 
          error: 'WebLLM not supported in this environment' 
        });
      }
    } catch (error) {
      console.error('WebLLM initialization failed:', error);
      initResults.errors.push({ engine: 'webllm', error: error.message });
    }

    // Determine A/B testing assignment if enabled
    if (this.config.abTestingEnabled && this.availableEngines.size > 1) {
      this.abTestSession.engineAssignment = Math.random() < this.config.abTestingRatio ? 
        'webllm' : 'distilbert';
      this.emit('ab_test_assigned', { 
        engine: this.abTestSession.engineAssignment,
        userId: this.abTestSession.userId 
      });
    }

    this.isInitialized = initResults.distilbert || initResults.webllm;
    
    this.emit('initialization_complete', {
      success: this.isInitialized,
      availableEngines: Array.from(this.availableEngines),
      results: initResults
    });

    return {
      success: this.isInitialized,
      availableEngines: Array.from(this.availableEngines),
      errors: initResults.errors
    };
  }

  /**
   * Setup WebLLM service event listeners
   */
  setupWebLLMEventListeners() {
    this.webllmService.on('status', (message) => {
      this.emit('webllm_status', message);
    });

    this.webllmService.on('progress', (progress) => {
      this.emit('webllm_progress', progress);
    });

    this.webllmService.on('error', (error) => {
      this.emit('webllm_error', error);
      this.metrics.webllm.errorCount++;
    });
  }

  /**
   * Process query using the appropriate engine(s)
   * @param {string} message - User query
   * @param {Array} context - Conversation context
   * @param {string} style - Conversation style
   * @returns {Promise<Object>} Response with engine information
   */
  async processQuery(message, context = [], style = 'developer') {
    if (!this.isInitialized) {
      throw new Error('Dual engine manager not initialized');
    }

    const queryId = this.generateQueryId();
    const startTime = Date.now();
    
    try {
      // Determine which engine to use
      const selectedEngine = this.selectEngine();
      
      this.emit('query_started', { 
        queryId, 
        engine: selectedEngine, 
        message: message.substring(0, 50) + '...' 
      });

      // Process with selected engine
      const result = await this.processWithEngine(
        selectedEngine, 
        message, 
        context, 
        style, 
        queryId
      );

      // Update metrics
      this.updateEngineMetrics(selectedEngine, result, Date.now() - startTime);
      
      // Record A/B test data if applicable
      if (this.config.abTestingEnabled) {
        this.recordABTestResult(queryId, selectedEngine, result, message);
      }

      this.emit('query_completed', { 
        queryId, 
        engine: selectedEngine, 
        confidence: result.confidence,
        processingTime: Date.now() - startTime
      });

      return {
        ...result,
        engineUsed: selectedEngine,
        queryId,
        processingTime: Date.now() - startTime,
        fallbackAvailable: this.availableEngines.size > 1
      };

    } catch (error) {
      // Attempt fallback if enabled and another engine is available
      if (this.config.fallbackEnabled && this.availableEngines.size > 1) {
        return this.handleFallback(message, context, style, queryId, error);
      }
      
      throw error;
    }
  }

  /**
   * Select engine based on configuration and A/B testing
   */
  selectEngine() {
    // A/B testing takes priority
    if (this.config.abTestingEnabled && this.abTestSession.engineAssignment) {
      if (this.availableEngines.has(this.abTestSession.engineAssignment)) {
        return this.abTestSession.engineAssignment;
      }
    }

    // Use primary engine if available
    if (this.availableEngines.has(this.config.primaryEngine)) {
      return this.config.primaryEngine;
    }

    // Fallback to any available engine
    return Array.from(this.availableEngines)[0];
  }

  /**
   * Process query with specific engine
   */
  async processWithEngine(engine, message, context, style, queryId) {
    switch (engine) {
      case 'distilbert':
        return this.processWithDistilBERT(message, context, style);
        
      case 'webllm':
        return this.processWithWebLLM(message, context, style);
        
      default:
        throw new Error(`Unknown engine: ${engine}`);
    }
  }

  /**
   * Process query with DistilBERT
   */
  async processWithDistilBERT(message, context, style) {
    if (!this.distilbertWorker) {
      throw new Error('DistilBERT worker not available');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('DistilBERT processing timeout'));
      }, this.config.performanceThreshold);

      // Setup one-time message listener
      const messageHandler = (event) => {
        const { type, ...data } = event.data;
        
        if (type === 'response') {
          clearTimeout(timeout);
          this.distilbertWorker.removeEventListener('message', messageHandler);
          resolve(data);
        } else if (type === 'error') {
          clearTimeout(timeout);
          this.distilbertWorker.removeEventListener('message', messageHandler);
          reject(new Error(data.error));
        }
      };

      this.distilbertWorker.addEventListener('message', messageHandler);
      
      // Send query to DistilBERT worker
      this.distilbertWorker.postMessage({
        type: 'process_query',
        message,
        context,
        style
      });
    });
  }

  /**
   * Process query with WebLLM
   */
  async processWithWebLLM(message, context, style) {
    if (!this.webllmService || !this.webllmService.isReady()) {
      throw new Error('WebLLM service not available');
    }

    // Get relevant CV sections for WebLLM context
    const cvSections = await this.findRelevantCVSections(message);
    
    return this.webllmService.processQuery(message, context, style, cvSections);
  }

  /**
   * Find relevant CV sections for WebLLM context
   */
  async findRelevantCVSections(message) {
    try {
      if (!this.cvDataService) {
        return [];
      }

      // Extract keywords from message for basic matching
      const keywords = this.extractKeywords(message);
      const sections = this.cvDataService.findSectionsByKeywords(keywords);
      
      // Return top 5 most relevant sections
      return sections.slice(0, 5);
    } catch (error) {
      console.warn('Failed to find relevant CV sections:', error);
      return [];
    }
  }

  /**
   * Extract keywords from message for CV section matching
   */
  extractKeywords(message) {
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'what', 'how', 'when', 'where', 'why', 'who', 'which', 'that', 'this',
      'you', 'your', 'i', 'me', 'my'
    ]);

    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word))
      .slice(0, 10); // Limit to 10 keywords
  }

  /**
   * Handle fallback when primary engine fails
   */
  async handleFallback(message, context, style, queryId, originalError) {
    this.metrics.fallbacks++;
    
    // Determine fallback engine
    const primaryEngine = this.selectEngine();
    const fallbackEngine = Array.from(this.availableEngines)
      .find(engine => engine !== primaryEngine);

    if (!fallbackEngine) {
      throw originalError;
    }

    this.emit('fallback_triggered', { 
      queryId, 
      primaryEngine, 
      fallbackEngine, 
      originalError: originalError.message 
    });

    try {
      const result = await this.processWithEngine(
        fallbackEngine, 
        message, 
        context, 
        style, 
        queryId
      );

      // Update fallback engine metrics
      this.updateEngineMetrics(fallbackEngine, result, 0, true);

      return {
        ...result,
        engineUsed: fallbackEngine,
        fallbackUsed: true,
        originalError: originalError.message,
        queryId
      };

    } catch (fallbackError) {
      // Both engines failed
      this.emit('all_engines_failed', { 
        queryId, 
        primaryError: originalError.message,
        fallbackError: fallbackError.message 
      });
      
      throw new Error(`All engines failed. Primary: ${originalError.message}, Fallback: ${fallbackError.message}`);
    }
  }

  /**
   * Update engine performance metrics
   */
  updateEngineMetrics(engine, result, processingTime, isFallback = false) {
    if (!this.metrics[engine]) {
      return;
    }

    const metrics = this.metrics[engine];
    metrics.queries++;

    // Update average response time
    const currentAvg = metrics.averageResponseTime;
    const count = metrics.queries;
    metrics.averageResponseTime = ((currentAvg * (count - 1)) + processingTime) / count;

    // Update average confidence
    if (result.confidence !== undefined) {
      const currentConfidenceAvg = metrics.averageConfidence;
      metrics.averageConfidence = ((currentConfidenceAvg * (count - 1)) + result.confidence) / count;
    }

    // Update success rate
    const successCount = metrics.queries - metrics.errorCount;
    metrics.successRate = successCount / metrics.queries;

    // Emit metrics update
    this.emit('metrics_updated', { 
      engine, 
      metrics: { ...metrics },
      isFallback 
    });
  }

  /**
   * Record A/B test result
   */
  recordABTestResult(queryId, engine, result, originalQuery) {
    const testResult = {
      queryId,
      engine,
      timestamp: Date.now(),
      confidence: result.confidence,
      processingTime: result.processingTime || 0,
      queryLength: originalQuery.length,
      responseLength: result.answer ? result.answer.length : 0,
      matchedSections: result.matchedSections ? result.matchedSections.length : 0
    };

    this.abTestSession.queries.push(testResult);
    this.metrics.abTestResults.push(testResult);

    // Limit stored results to prevent memory issues
    if (this.metrics.abTestResults.length > 100) {
      this.metrics.abTestResults = this.metrics.abTestResults.slice(-50);
    }

    this.emit('ab_test_recorded', testResult);
  }

  /**
   * Get comprehensive performance metrics
   */
  async getMetrics() {
    const baseMetrics = { ...this.metrics };

    // Get detailed metrics from individual engines
    try {
      if (this.webllmService && this.webllmService.isReady()) {
        const webllmMetrics = await this.webllmService.getMetrics();
        baseMetrics.webllmDetailed = webllmMetrics;
      }
    } catch (error) {
      console.warn('Failed to get WebLLM detailed metrics:', error);
    }

    // Add comparison metrics
    baseMetrics.comparison = this.generateComparisonMetrics();
    
    return baseMetrics;
  }

  /**
   * Generate comparison metrics between engines
   */
  generateComparisonMetrics() {
    const { distilbert, webllm } = this.metrics;
    
    if (distilbert.queries === 0 || webllm.queries === 0) {
      return { available: false, reason: 'Insufficient data for comparison' };
    }

    return {
      available: true,
      responseTime: {
        distilbert: distilbert.averageResponseTime,
        webllm: webllm.averageResponseTime,
        winner: distilbert.averageResponseTime < webllm.averageResponseTime ? 'distilbert' : 'webllm'
      },
      confidence: {
        distilbert: distilbert.averageConfidence,
        webllm: webllm.averageConfidence,
        winner: distilbert.averageConfidence > webllm.averageConfidence ? 'distilbert' : 'webllm'
      },
      reliability: {
        distilbert: distilbert.successRate,
        webllm: webllm.successRate,
        winner: distilbert.successRate > webllm.successRate ? 'distilbert' : 'webllm'
      },
      totalQueries: distilbert.queries + webllm.queries,
      fallbackRate: this.metrics.fallbacks / (distilbert.queries + webllm.queries)
    };
  }

  /**
   * Switch primary engine
   */
  switchPrimaryEngine(engine) {
    if (!this.availableEngines.has(engine)) {
      throw new Error(`Engine ${engine} is not available`);
    }
    
    const previousEngine = this.config.primaryEngine;
    this.config.primaryEngine = engine;
    
    this.emit('primary_engine_changed', { 
      previous: previousEngine, 
      current: engine 
    });
  }

  /**
   * Enable/disable A/B testing
   */
  setABTesting(enabled, ratio = 0.5) {
    this.config.abTestingEnabled = enabled;
    this.config.abTestingRatio = ratio;
    
    if (enabled && this.availableEngines.size > 1) {
      // Reassign for new session
      this.abTestSession.engineAssignment = Math.random() < ratio ? 'webllm' : 'distilbert';
      this.abTestSession.userId = this.generateSessionId();
      this.abTestSession.queries = [];
    }
    
    this.emit('ab_testing_changed', { 
      enabled, 
      ratio, 
      assignment: this.abTestSession.engineAssignment 
    });
  }

  /**
   * Get A/B test results summary
   */
  getABTestSummary() {
    if (!this.config.abTestingEnabled || this.metrics.abTestResults.length === 0) {
      return { available: false };
    }

    const results = this.metrics.abTestResults;
    const distilbertResults = results.filter(r => r.engine === 'distilbert');
    const webllmResults = results.filter(r => r.engine === 'webllm');

    const calculateAverage = (arr, field) => 
      arr.length > 0 ? arr.reduce((sum, item) => sum + item[field], 0) / arr.length : 0;

    return {
      available: true,
      totalTests: results.length,
      distilbert: {
        count: distilbertResults.length,
        avgConfidence: calculateAverage(distilbertResults, 'confidence'),
        avgProcessingTime: calculateAverage(distilbertResults, 'processingTime'),
        avgResponseLength: calculateAverage(distilbertResults, 'responseLength')
      },
      webllm: {
        count: webllmResults.length,
        avgConfidence: calculateAverage(webllmResults, 'confidence'),
        avgProcessingTime: calculateAverage(webllmResults, 'processingTime'),
        avgResponseLength: calculateAverage(webllmResults, 'responseLength')
      }
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
          console.error(`Error in dual engine event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Utility methods
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateQueryId() {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get available engines
   */
  getAvailableEngines() {
    return Array.from(this.availableEngines);
  }

  /**
   * Check if specific engine is available
   */
  isEngineAvailable(engine) {
    return this.availableEngines.has(engine);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Cleanup WebLLM service
      if (this.webllmService) {
        await this.webllmService.cleanup();
        this.webllmService = null;
      }

      // Clear references
      this.distilbertWorker = null;
      this.cvDataService = null;

      // Reset state
      this.isInitialized = false;
      this.availableEngines.clear();
      this.eventListeners.clear();

      // Reset metrics
      this.metrics = {
        distilbert: {
          queries: 0,
          averageResponseTime: 0,
          averageConfidence: 0,
          errorCount: 0,
          successRate: 0
        },
        webllm: {
          queries: 0,
          averageResponseTime: 0,
          averageConfidence: 0,
          errorCount: 0,
          successRate: 0
        },
        fallbacks: 0,
        abTestResults: []
      };

    } catch (error) {
      console.error('Dual engine manager cleanup error:', error);
    }
  }
}

export default DualEngineManager;