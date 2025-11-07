/**
 * Cache Manager Utility Module
 * Handles caching operations for embeddings and query results
 * Extracted from chat-ml-worker.js for modular architecture
 */

// Cache storage - using Maps for better performance
const embeddingCache = new Map();
const queryResultCache = new Map();

// Cache configuration
const CACHE_CONFIG = {
  maxEmbeddingCacheSize: 200,
  maxQueryCacheSize: 50,
  queryResultTTL: 300000, // 5 minutes in milliseconds
};

/**
 * Cache an embedding with its associated text
 * @param {string} text - The text that was embedded
 * @param {Array<number>} embedding - The embedding vector
 * @returns {boolean} - True if cached successfully
 */
export function cacheEmbedding(text, embedding) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  if (!Array.isArray(embedding)) {
    throw new Error('Embedding must be an array');
  }

  const key = generateCacheKey(text);
  
  // Implement LRU eviction if cache is full
  if (embeddingCache.size >= CACHE_CONFIG.maxEmbeddingCacheSize) {
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }

  embeddingCache.set(key, {
    embedding: [...embedding], // Create a copy to avoid reference issues
    timestamp: Date.now(),
    text: text
  });

  return true;
}

/**
 * Get cached embedding for text
 * @param {string} text - The text to look up
 * @returns {Array<number>|null} - The cached embedding or null if not found
 */
export function getCachedEmbedding(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const key = generateCacheKey(text);
  const cached = embeddingCache.get(key);
  
  if (cached) {
    return [...cached.embedding]; // Return a copy to avoid reference issues
  }
  
  return null;
}

/**
 * Cache a query result
 * @param {string} query - The query that was processed
 * @param {Object} result - The result object to cache
 * @returns {boolean} - True if cached successfully
 */
export function cacheQueryResult(query, result) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  if (!result || typeof result !== 'object') {
    throw new Error('Result must be an object');
  }

  const key = generateCacheKey(query);
  
  // Implement LRU eviction if cache is full
  if (queryResultCache.size >= CACHE_CONFIG.maxQueryCacheSize) {
    const firstKey = queryResultCache.keys().next().value;
    queryResultCache.delete(firstKey);
  }

  queryResultCache.set(key, {
    result: JSON.parse(JSON.stringify(result)), // Deep copy to avoid reference issues
    timestamp: Date.now(),
    query: query
  });

  return true;
}

/**
 * Get cached query result
 * @param {string} query - The query to look up
 * @returns {Object|null} - The cached result or null if not found/expired
 */
export function getCachedQueryResult(query) {
  if (!query || typeof query !== 'string') {
    return null;
  }

  const key = generateCacheKey(query);
  const cached = queryResultCache.get(key);
  
  if (cached) {
    // Check if result has expired
    if (Date.now() - cached.timestamp < CACHE_CONFIG.queryResultTTL) {
      return JSON.parse(JSON.stringify(cached.result)); // Return deep copy
    } else {
      // Remove expired entry
      queryResultCache.delete(key);
    }
  }
  
  return null;
}

/**
 * Generate a cache key from text using a simple hash function
 * @param {string} text - The text to generate a key for
 * @returns {string} - The generated cache key
 */
export function generateCacheKey(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Clear all caches
 * @returns {Object} - Statistics about cleared items
 */
export function clearCache() {
  const stats = {
    embeddingsCacheSize: embeddingCache.size,
    queryResultsCacheSize: queryResultCache.size,
    totalCleared: embeddingCache.size + queryResultCache.size
  };

  embeddingCache.clear();
  queryResultCache.clear();

  return stats;
}

/**
 * Get cache statistics
 * @returns {Object} - Cache statistics
 */
export function getCacheStats() {
  return {
    embeddings: {
      size: embeddingCache.size,
      maxSize: CACHE_CONFIG.maxEmbeddingCacheSize,
      utilization: embeddingCache.size / CACHE_CONFIG.maxEmbeddingCacheSize
    },
    queryResults: {
      size: queryResultCache.size,
      maxSize: CACHE_CONFIG.maxQueryCacheSize,
      utilization: queryResultCache.size / CACHE_CONFIG.maxQueryCacheSize
    },
    config: { ...CACHE_CONFIG }
  };
}

/**
 * Clean expired entries from query result cache
 * @returns {number} - Number of expired entries removed
 */
export function cleanExpiredEntries() {
  const now = Date.now();
  let removedCount = 0;

  for (const [key, cached] of queryResultCache.entries()) {
    if (now - cached.timestamp >= CACHE_CONFIG.queryResultTTL) {
      queryResultCache.delete(key);
      removedCount++;
    }
  }

  return removedCount;
}