/**
 * CacheManager - Handles caching of models, embeddings, and query results
 * Focuses on cache operations, storage, and retrieval without performance monitoring
 */

class CacheManager {
  constructor() {
    this.cache = {
      model: null,
      embeddings: new Map(),
      queryResults: new Map(),
      maxCacheSize: 100, // Maximum cached query results
      maxEmbeddingCacheSize: 500 // Maximum cached embeddings
    };

    this.stats = {
      cacheHits: 0,
      cacheMisses: 0
    };

    this.loadingStrategy = {
      progressive: true,
      chunkSize: 1024 * 1024, // 1MB chunks for progressive loading
      preloadEmbeddings: true,
      lazyLoadSections: true
    };

    // Listen for memory pressure events to trigger cleanup
    window.addEventListener('memoryPressure', (event) => {
      this.performMemoryCleanup();
    });
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

    this.logCacheEvent('model_cached', {
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
      this.stats.cacheHits++;
      this.logCacheEvent('model_cache_hit', { modelId });
      return this.cache.model.instance;
    }

    this.stats.cacheMisses++;
    this.logCacheEvent('model_cache_miss', { modelId });
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

    this.logCacheEvent('embedding_cached', {
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
      this.stats.cacheHits++;
      this.logCacheEvent('embedding_cache_hit', {
        textLength: text.length,
        accessCount: cached.accessCount
      });

      return cached.embedding;
    }

    this.stats.cacheMisses++;
    this.logCacheEvent('embedding_cache_miss', {
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

    this.logCacheEvent('query_result_cached', {
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
        this.stats.cacheHits++;
        this.logCacheEvent('query_cache_hit', {
          queryLength: query.length,
          accessCount: cached.accessCount
        });

        return { ...cached.result }; // Return copy to avoid mutations
      } else {
        // Remove stale entry
        this.cache.queryResults.delete(key);
      }
    }

    this.stats.cacheMisses++;
    this.logCacheEvent('query_cache_miss', {
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
   * Perform memory cleanup operations
   */
  performMemoryCleanup() {
    this.logCacheEvent('memory_cleanup_started');

    // Clear old query cache entries
    this.clearOldCacheEntries();

    // Force garbage collection if available
    if (typeof window.gc === 'function') {
      window.gc();
    }

    this.logCacheEvent('memory_cleanup_completed');
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
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const hitRate = this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0;

    return {
      modelCached: !!this.cache.model,
      embeddingsCacheSize: this.cache.embeddings.size,
      queryResultsCacheSize: this.cache.queryResults.size,
      maxEmbeddingCacheSize: this.cache.maxEmbeddingCacheSize,
      maxQueryCacheSize: this.cache.maxCacheSize,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate
    };
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.cache.model = null;
    this.cache.embeddings.clear();
    this.cache.queryResults.clear();

    this.logCacheEvent('all_caches_cleared');
  }

  /**
   * Clear specific cache type
   * @param {string} cacheType - Type of cache to clear ('model', 'embeddings', 'queryResults')
   */
  clearCache(cacheType) {
    switch (cacheType) {
      case 'model':
        this.cache.model = null;
        break;
      case 'embeddings':
        this.cache.embeddings.clear();
        break;
      case 'queryResults':
        this.cache.queryResults.clear();
        break;
      default:
        console.warn(`Unknown cache type: ${cacheType}`);
        return;
    }

    this.logCacheEvent('cache_cleared', { cacheType });
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

    this.logCacheEvent('bundle_loading_optimized', {
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
        this.logCacheEvent('preload_failed', {
          resource: resource.url,
          error: error.message
        });
      }
    });

    const results = await Promise.allSettled(preloadPromises);

    this.logCacheEvent('resources_preloaded', {
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

  /**
   * Log cache event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  logCacheEvent(event, data = {}) {
    // Log to console in development
    if (window.isDev) {
      console.log(`[CacheManager] ${event}:`, data);
    }

    // Emit cache event for performance monitoring
    const cacheEvent = new CustomEvent('cacheEvent', {
      detail: {
        event,
        data,
        timestamp: Date.now(),
        stats: this.getCacheStats()
      }
    });

    window.dispatchEvent(cacheEvent);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.clearAllCaches();
    this.logCacheEvent('cache_manager_cleanup');
  }
}

export default CacheManager;