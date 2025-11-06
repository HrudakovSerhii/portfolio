/**
 * PerformanceManager - Handles performance optimization, monitoring, and resource management
 * Provides model caching, progressive loading, and performance metrics
 */

class PerformanceManager {
  constructor() {
    this.metrics = {
      modelLoadTime: 0,
      queryProcessingTimes: [],
      memoryUsage: [],
      cacheHits: 0,
      cacheMisses: 0,
      sessionStartTime: Date.now()
    };
    
    this.cache = {
      model: null,
      embeddings: new Map(),
      queryResults: new Map(),
      maxCacheSize: 100, // Maximum cached query results
      maxEmbeddingCacheSize: 500 // Maximum cached embeddings
    };
    
    this.resourceMonitor = {
      interval: null,
      memoryThreshold: 200 * 1024 * 1024, // 200MB threshold
      performanceObserver: null
    };
    
    this.loadingStrategy = {
      progressive: true,
      chunkSize: 1024 * 1024, // 1MB chunks for progressive loading
      preloadEmbeddings: true,
      lazyLoadSections: true
    };
    
    this.isMonitoring = false;
    this.performanceLog = [];
  }

  /**
   * Initialize performance monitoring and optimization
   */
  initialize() {
    this.startResourceMonitoring();
    this.setupPerformanceObserver();
    this.logPerformanceEvent('performance_manager_initialized');
  }

  /**
   * Start monitoring system resources
   */
  startResourceMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Monitor memory usage every 10 seconds
    this.resourceMonitor.interval = setInterval(() => {
      this.recordMemoryUsage();
      this.checkMemoryThreshold();
    }, 10000);
  }

  /**
   * Setup Performance Observer for detailed metrics
   */
  setupPerformanceObserver() {
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('PerformanceObserver not supported');
      return;
    }

    try {
      this.resourceMonitor.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name.includes('chat-bot')) {
            this.logPerformanceEvent('performance_entry', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        });
      });
      
      this.resourceMonitor.performanceObserver.observe({ 
        entryTypes: ['measure', 'navigation', 'resource'] 
      });
    } catch (error) {
      console.warn('Failed to setup PerformanceObserver:', error);
    }
  }

  /**
   * Record current memory usage
   */
  recordMemoryUsage() {
    if (typeof performance.memory !== 'undefined') {
      const memoryInfo = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        timestamp: Date.now()
      };
      
      this.metrics.memoryUsage.push(memoryInfo);
      
      // Keep only last 50 memory readings
      if (this.metrics.memoryUsage.length > 50) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-50);
      }
      
      return memoryInfo;
    }
    return null;
  }

  /**
   * Check if memory usage exceeds threshold and trigger cleanup
   */
  checkMemoryThreshold() {
    const currentMemory = this.recordMemoryUsage();
    if (currentMemory && currentMemory.used > this.resourceMonitor.memoryThreshold) {
      this.logPerformanceEvent('memory_threshold_exceeded', {
        used: currentMemory.used,
        threshold: this.resourceMonitor.memoryThreshold
      });
      
      this.performMemoryCleanup();
    }
  }

  /**
   * Perform memory cleanup operations
   */
  performMemoryCleanup() {
    const beforeCleanup = this.recordMemoryUsage();
    
    // Clear old query cache entries
    this.clearOldCacheEntries();
    
    // Clear old performance logs
    this.clearOldPerformanceLogs();
    
    // Force garbage collection if available
    if (typeof window.gc === 'function') {
      window.gc();
    }
    
    const afterCleanup = this.recordMemoryUsage();
    
    this.logPerformanceEvent('memory_cleanup_performed', {
      beforeUsed: beforeCleanup?.used || 0,
      afterUsed: afterCleanup?.used || 0,
      freed: (beforeCleanup?.used || 0) - (afterCleanup?.used || 0)
    });
  }

  /**
   * Clear old cache entries to free memory
   */
  clearOldCacheEntries() {
    // Clear query results cache if it's too large
    if (this.cache.queryResults.size > this.cache.maxCacheSize) {
      const entries = Array.from(this.cache.queryResults.entries());
      const toDelete = entries.slice(0, Math.floor(this.cache.maxCacheSize * 0.3));
      
      toDelete.forEach(([key]) => {
        this.cache.queryResults.delete(key);
      });
    }
    
    // Clear embedding cache if it's too large
    if (this.cache.embeddings.size > this.cache.maxEmbeddingCacheSize) {
      const entries = Array.from(this.cache.embeddings.entries());
      const toDelete = entries.slice(0, Math.floor(this.cache.maxEmbeddingCacheSize * 0.3));
      
      toDelete.forEach(([key]) => {
        this.cache.embeddings.delete(key);
      });
    }
  }

  /**
   * Clear old performance logs to free memory
   */
  clearOldPerformanceLogs() {
    if (this.performanceLog.length > 1000) {
      this.performanceLog = this.performanceLog.slice(-500);
    }
  }

  /**
   * Cache model for reuse
   * @param {Object} model - The loaded ML model
   * @param {string} modelId - Unique identifier for the model
   */
  cacheModel(model, modelId = 'distilbert') {
    this.cache.model = {
      instance: model,
      id: modelId,
      loadTime: Date.now(),
      size: this.estimateModelSize(model)
    };
    
    this.logPerformanceEvent('model_cached', {
      modelId,
      estimatedSize: this.cache.model.size
    });
  }

  /**
   * Get cached model if available
   * @param {string} modelId - Model identifier
   * @returns {Object|null} Cached model or null
   */
  getCachedModel(modelId = 'distilbert') {
    if (this.cache.model && this.cache.model.id === modelId) {
      this.metrics.cacheHits++;
      this.logPerformanceEvent('model_cache_hit', { modelId });
      return this.cache.model.instance;
    }
    
    this.metrics.cacheMisses++;
    this.logPerformanceEvent('model_cache_miss', { modelId });
    return null;
  }

  /**
   * Estimate model size for memory tracking
   * @param {Object} model - ML model instance
   * @returns {number} Estimated size in bytes
   */
  estimateModelSize(model) {
    // Rough estimation - actual implementation would depend on model structure
    return 50 * 1024 * 1024; // Estimate 50MB for DistilBERT
  }

  /**
   * Cache embedding for reuse
   * @param {string} text - Original text
   * @param {Array} embedding - Computed embedding
   */
  cacheEmbedding(text, embedding) {
    const key = this.generateCacheKey(text);
    
    if (this.cache.embeddings.size >= this.cache.maxEmbeddingCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.embeddings.keys().next().value;
      this.cache.embeddings.delete(firstKey);
    }
    
    this.cache.embeddings.set(key, {
      embedding,
      timestamp: Date.now(),
      accessCount: 0
    });
    
    this.logPerformanceEvent('embedding_cached', {
      textLength: text.length,
      embeddingSize: embedding.length
    });
  }

  /**
   * Get cached embedding if available
   * @param {string} text - Text to get embedding for
   * @returns {Array|null} Cached embedding or null
   */
  getCachedEmbedding(text) {
    const key = this.generateCacheKey(text);
    const cached = this.cache.embeddings.get(key);
    
    if (cached) {
      cached.accessCount++;
      this.metrics.cacheHits++;
      this.logPerformanceEvent('embedding_cache_hit', {
        textLength: text.length,
        accessCount: cached.accessCount
      });
      return cached.embedding;
    }
    
    this.metrics.cacheMisses++;
    this.logPerformanceEvent('embedding_cache_miss', {
      textLength: text.length
    });
    return null;
  }

  /**
   * Cache query result for reuse
   * @param {string} query - Original query
   * @param {Object} result - Query processing result
   */
  cacheQueryResult(query, result) {
    const key = this.generateCacheKey(query);
    
    if (this.cache.queryResults.size >= this.cache.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.queryResults.keys().next().value;
      this.cache.queryResults.delete(firstKey);
    }
    
    this.cache.queryResults.set(key, {
      result: { ...result }, // Deep copy to avoid mutations
      timestamp: Date.now(),
      accessCount: 0
    });
    
    this.logPerformanceEvent('query_result_cached', {
      queryLength: query.length,
      confidence: result.confidence
    });
  }

  /**
   * Get cached query result if available
   * @param {string} query - Query to get result for
   * @returns {Object|null} Cached result or null
   */
  getCachedQueryResult(query) {
    const key = this.generateCacheKey(query);
    const cached = this.cache.queryResults.get(key);
    
    if (cached) {
      // Check if cache entry is still fresh (5 minutes)
      const maxAge = 5 * 60 * 1000;
      if (Date.now() - cached.timestamp < maxAge) {
        cached.accessCount++;
        this.metrics.cacheHits++;
        this.logPerformanceEvent('query_cache_hit', {
          queryLength: query.length,
          accessCount: cached.accessCount
        });
        return { ...cached.result }; // Return copy to avoid mutations
      } else {
        // Remove stale entry
        this.cache.queryResults.delete(key);
      }
    }
    
    this.metrics.cacheMisses++;
    this.logPerformanceEvent('query_cache_miss', {
      queryLength: query.length
    });
    return null;
  }

  /**
   * Generate cache key from text
   * @param {string} text - Text to generate key for
   * @returns {string} Cache key
   */
  generateCacheKey(text) {
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Start timing a query processing operation
   * @param {string} queryId - Unique identifier for the query
   * @returns {string} Timer ID for stopping the timer
   */
  startQueryTimer(queryId) {
    const timerId = `query_${queryId}_${Date.now()}`;
    performance.mark(`${timerId}_start`);
    
    this.logPerformanceEvent('query_timer_started', {
      queryId,
      timerId
    });
    
    return timerId;
  }

  /**
   * Stop timing a query processing operation
   * @param {string} timerId - Timer ID from startQueryTimer
   * @param {Object} metadata - Additional metadata about the query
   */
  stopQueryTimer(timerId, metadata = {}) {
    performance.mark(`${timerId}_end`);
    performance.measure(timerId, `${timerId}_start`, `${timerId}_end`);
    
    const measure = performance.getEntriesByName(timerId)[0];
    const duration = measure ? measure.duration : 0;
    
    this.metrics.queryProcessingTimes.push({
      duration,
      timestamp: Date.now(),
      metadata
    });
    
    // Keep only last 100 query times
    if (this.metrics.queryProcessingTimes.length > 100) {
      this.metrics.queryProcessingTimes = this.metrics.queryProcessingTimes.slice(-100);
    }
    
    this.logPerformanceEvent('query_timer_stopped', {
      timerId,
      duration,
      metadata
    });
    
    // Clean up performance entries
    performance.clearMarks(`${timerId}_start`);
    performance.clearMarks(`${timerId}_end`);
    performance.clearMeasures(timerId);
    
    return duration;
  }

  /**
   * Get average query processing time
   * @returns {number} Average processing time in milliseconds
   */
  getAverageQueryTime() {
    if (this.metrics.queryProcessingTimes.length === 0) return 0;
    
    const total = this.metrics.queryProcessingTimes.reduce(
      (sum, entry) => sum + entry.duration, 0
    );
    
    return total / this.metrics.queryProcessingTimes.length;
  }

  /**
   * Check if query processing is meeting performance targets
   * @returns {Object} Performance status
   */
  getPerformanceStatus() {
    const avgQueryTime = this.getAverageQueryTime();
    const targetTime = 3000; // 3 seconds target
    
    const currentMemory = this.recordMemoryUsage();
    const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0;
    
    return {
      avgQueryTime,
      targetTime,
      meetingTarget: avgQueryTime <= targetTime,
      memoryUsage: currentMemory,
      cacheHitRate,
      totalQueries: this.metrics.queryProcessingTimes.length,
      sessionDuration: Date.now() - this.metrics.sessionStartTime
    };
  }

  /**
   * Log performance event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  logPerformanceEvent(event, data = {}) {
    const logEntry = {
      timestamp: Date.now(),
      event,
      data,
      sessionTime: Date.now() - this.metrics.sessionStartTime
    };
    
    this.performanceLog.push(logEntry);
    
    // Keep performance log manageable
    if (this.performanceLog.length > 1000) {
      this.performanceLog = this.performanceLog.slice(-500);
    }
    
    // Log to console in development
    if (window.isDev) {
      console.log(`[PerformanceManager] ${event}:`, data);
    }
  }

  /**
   * Get performance metrics summary
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheStats: {
        modelCached: !!this.cache.model,
        embeddingsCacheSize: this.cache.embeddings.size,
        queryResultsCacheSize: this.cache.queryResults.size,
        hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
      },
      performanceStatus: this.getPerformanceStatus(),
      memoryStatus: this.getMemoryStatus()
    };
  }

  /**
   * Get memory usage status
   * @returns {Object} Memory status information
   */
  getMemoryStatus() {
    const currentMemory = this.recordMemoryUsage();
    if (!currentMemory) return { supported: false };
    
    const usagePercent = (currentMemory.used / currentMemory.limit) * 100;
    const thresholdPercent = (this.resourceMonitor.memoryThreshold / currentMemory.limit) * 100;
    
    return {
      supported: true,
      current: currentMemory,
      usagePercent,
      thresholdPercent,
      nearThreshold: usagePercent > (thresholdPercent * 0.8),
      exceedsThreshold: currentMemory.used > this.resourceMonitor.memoryThreshold
    };
  }

  /**
   * Export performance data for analysis
   * @returns {Object} Exportable performance data
   */
  exportPerformanceData() {
    return {
      metrics: this.getMetrics(),
      performanceLog: this.performanceLog.slice(-100), // Last 100 events
      timestamp: Date.now(),
      sessionId: `session_${this.metrics.sessionStartTime}`
    };
  }

  /**
   * Clean up resources and stop monitoring
   */
  cleanup() {
    this.isMonitoring = false;
    
    // Clear monitoring interval
    if (this.resourceMonitor.interval) {
      clearInterval(this.resourceMonitor.interval);
      this.resourceMonitor.interval = null;
    }
    
    // Disconnect performance observer
    if (this.resourceMonitor.performanceObserver) {
      this.resourceMonitor.performanceObserver.disconnect();
      this.resourceMonitor.performanceObserver = null;
    }
    
    // Clear all caches
    this.cache.model = null;
    this.cache.embeddings.clear();
    this.cache.queryResults.clear();
    
    // Clear performance entries
    if (typeof performance.clearMarks === 'function') {
      performance.clearMarks();
    }
    if (typeof performance.clearMeasures === 'function') {
      performance.clearMeasures();
    }
    
    this.logPerformanceEvent('performance_manager_cleanup');
    
    // Clear logs after final event
    setTimeout(() => {
      this.performanceLog = [];
    }, 100);
  }

  /**
   * Optimize bundle loading strategy
   * @param {Object} options - Loading options
   */
  optimizeBundleLoading(options = {}) {
    const strategy = {
      ...this.loadingStrategy,
      ...options
    };
    
    this.loadingStrategy = strategy;
    
    this.logPerformanceEvent('bundle_loading_optimized', {
      strategy
    });
    
    return strategy;
  }

  /**
   * Preload critical resources
   * @param {Array} resources - List of resources to preload
   */
  async preloadResources(resources = []) {
    const preloadPromises = resources.map(async (resource) => {
      try {
        if (resource.type === 'script') {
          return this.preloadScript(resource.url);
        } else if (resource.type === 'data') {
          return this.preloadData(resource.url);
        }
      } catch (error) {
        this.logPerformanceEvent('preload_failed', {
          resource: resource.url,
          error: error.message
        });
      }
    });
    
    const results = await Promise.allSettled(preloadPromises);
    
    this.logPerformanceEvent('resources_preloaded', {
      total: resources.length,
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    });
    
    return results;
  }

  /**
   * Preload script resource
   * @param {string} url - Script URL
   */
  preloadScript(url) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = url;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  /**
   * Preload data resource
   * @param {string} url - Data URL
   */
  async preloadData(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to preload ${url}: ${response.status}`);
    }
    return response;
  }
}

export default PerformanceManager;