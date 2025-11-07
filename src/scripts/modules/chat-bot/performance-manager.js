import PerformanceMonitor from './performance-monitor.js';
import CacheManager from './cache-manager.js';

/**
 * PerformanceManager - Coordinates performance monitoring and caching functionality
 * Acts as a unified interface for both performance tracking and cache management
 */

class PerformanceManager {
  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.cacheManager = new CacheManager();

    // Listen for cache events to update performance metrics
    window.addEventListener('cacheEvent', (event) => {
      this.handleCacheEvent(event.detail);
    });
  }

  /**
   * Initialize performance monitoring and caching
   */
  initialize() {
    this.performanceMonitor.initialize();
    this.logPerformanceEvent('performance_manager_initialized');
  }

  /**
   * Handle cache events from CacheManager
   * @param {Object} eventDetail - Cache event details
   */
  handleCacheEvent(eventDetail) {
    // Update performance metrics based on cache events
    this.performanceMonitor.logPerformanceEvent('cache_event', eventDetail);
  }

  // Cache Management Methods (delegated to CacheManager)
  
  /**
   * Cache model for reuse
   * @param {Object} model - The loaded ML model
   * @param {string} modelId - Unique identifier for the model
   */
  cacheModel(model, modelId = 'distilbert') {
    return this.cacheManager.cacheModel(model, modelId);
  }

  /**
   * Get cached model if available
   * @param {string} modelId - Model identifier
   * @returns {Object|null} Cached model or null
   */
  getCachedModel(modelId = 'distilbert') {
    return this.cacheManager.getCachedModel(modelId);
  }

  /**
   * Cache embedding for reuse
   * @param {string} text - Original text
   * @param {Array} embedding - Computed embedding
   */
  cacheEmbedding(text, embedding) {
    return this.cacheManager.cacheEmbedding(text, embedding);
  }

  /**
   * Get cached embedding if available
   * @param {string} text - Text to get embedding for
   * @returns {Array|null} Cached embedding or null
   */
  getCachedEmbedding(text) {
    return this.cacheManager.getCachedEmbedding(text);
  }

  /**
   * Cache query result for reuse
   * @param {string} query - Original query
   * @param {Object} result - Query processing result
   */
  cacheQueryResult(query, result) {
    return this.cacheManager.cacheQueryResult(query, result);
  }

  /**
   * Get cached query result if available
   * @param {string} query - Query to get result for
   * @returns {Object|null} Cached result or null
   */
  getCachedQueryResult(query) {
    return this.cacheManager.getCachedQueryResult(query);
  }

  // Performance Monitoring Methods (delegated to PerformanceMonitor)
  
  /**
   * Start timing a query processing operation
   * @param {string} queryId - Unique identifier for the query
   * @returns {string} Timer ID for stopping the timer
   */
  startQueryTimer(queryId) {
    return this.performanceMonitor.startQueryTimer(queryId);
  }

  /**
   * Stop timing a query processing operation
   * @param {string} timerId - Timer ID from startQueryTimer
   * @param {Object} metadata - Additional metadata about the query
   */
  stopQueryTimer(timerId, metadata = {}) {
    return this.performanceMonitor.stopQueryTimer(timerId, metadata);
  }

  /**
   * Get average query processing time
   * @returns {number} Average processing time in milliseconds
   */
  getAverageQueryTime() {
    return this.performanceMonitor.getAverageQueryTime();
  }

  /**
   * Check if query processing is meeting performance targets
   * @returns {Object} Performance status
   */
  getPerformanceStatus() {
    const performanceStatus = this.performanceMonitor.getPerformanceStatus();
    const cacheStats = this.cacheManager.getCacheStats();
    
    return {
      ...performanceStatus,
      cacheHitRate: cacheStats.hitRate,
      cacheStats
    };
  }

  /**
   * Log performance event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  logPerformanceEvent(event, data = {}) {
    return this.performanceMonitor.logPerformanceEvent(event, data);
  }

  /**
   * Get performance metrics summary
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    const performanceMetrics = this.performanceMonitor.getMetrics();
    const cacheStats = this.cacheManager.getCacheStats();
    
    return {
      ...performanceMetrics,
      cacheStats,
      performanceStatus: this.getPerformanceStatus()
    };
  }

  /**
   * Get memory usage status
   * @returns {Object} Memory status information
   */
  getMemoryStatus() {
    return this.performanceMonitor.getMemoryStatus();
  }

  /**
   * Export performance data for analysis
   * @returns {Object} Exportable performance data
   */
  exportPerformanceData() {
    return this.performanceMonitor.exportPerformanceData();
  }

  /**
   * Optimize bundle loading strategy
   * @param {Object} options - Loading options
   */
  optimizeBundleLoading(options = {}) {
    return this.cacheManager.optimizeBundleLoading(options);
  }

  /**
   * Preload critical resources
   * @param {Array} resources - List of resources to preload
   */
  async preloadResources(resources = []) {
    return this.cacheManager.preloadResources(resources);
  }

  /**
   * Clear specific cache type
   * @param {string} cacheType - Type of cache to clear
   */
  clearCache(cacheType) {
    return this.cacheManager.clearCache(cacheType);
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    return this.cacheManager.clearAllCaches();
  }

  /**
   * Clean up resources and stop monitoring
   */
  cleanup() {
    this.performanceMonitor.cleanup();
    this.cacheManager.cleanup();
    this.logPerformanceEvent('performance_manager_cleanup');
  }
}

export default PerformanceManager;
