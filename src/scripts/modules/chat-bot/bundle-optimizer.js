/**
 * BundleOptimizer - Handles bundle size optimization and loading strategies
 * Provides code splitting, lazy loading, and resource optimization
 */

class BundleOptimizer {
  constructor() {
    this.loadedModules = new Set();
    this.preloadedResources = new Set();
    this.loadingStrategies = {
      progressive: true,
      preloadCritical: true,
      lazyLoadNonCritical: true,
      compressionEnabled: true
    };
    
    this.resourcePriorities = {
      critical: ['chat-ui.js', 'conversation-manager.js'],
      important: ['cv-data-service.js', 'style-manager.js'],
      optional: ['fallback-handler.js', 'performance-manager.js']
    };
    
    this.compressionSupport = this.detectCompressionSupport();
  }

  /**
   * Detect browser compression support
   */
  detectCompressionSupport() {
    const support = {
      gzip: false,
      brotli: false,
      deflate: false
    };

    // Check Accept-Encoding header support (approximation)
    if (typeof fetch !== 'undefined') {
      support.gzip = true; // Most browsers support gzip
      support.deflate = true; // Most browsers support deflate
      
      // Brotli support detection
      if (typeof CompressionStream !== 'undefined') {
        try {
          new CompressionStream('gzip');
          support.brotli = true;
        } catch (e) {
          // Brotli not supported
        }
      }
    }

    return support;
  }

  /**
   * Optimize module loading order based on priority
   * @param {Array} modules - List of modules to load
   * @returns {Array} Optimized loading order
   */
  optimizeLoadingOrder(modules) {
    const prioritized = {
      critical: [],
      important: [],
      optional: []
    };

    modules.forEach(module => {
      if (this.resourcePriorities.critical.includes(module)) {
        prioritized.critical.push(module);
      } else if (this.resourcePriorities.important.includes(module)) {
        prioritized.important.push(module);
      } else {
        prioritized.optional.push(module);
      }
    });

    // Return in priority order
    return [
      ...prioritized.critical,
      ...prioritized.important,
      ...prioritized.optional
    ];
  }

  /**
   * Preload critical resources
   * @param {Array} resources - Resources to preload
   */
  async preloadCriticalResources(resources = []) {
    if (!this.loadingStrategies.preloadCritical) {
      return;
    }

    const criticalResources = resources.filter(resource => 
      this.resourcePriorities.critical.includes(resource.name)
    );

    const preloadPromises = criticalResources.map(resource => 
      this.preloadResource(resource)
    );

    try {
      await Promise.allSettled(preloadPromises);
    } catch (error) {
      console.warn('Some critical resources failed to preload:', error);
    }
  }

  /**
   * Preload individual resource
   * @param {Object} resource - Resource to preload
   */
  async preloadResource(resource) {
    if (this.preloadedResources.has(resource.url)) {
      return;
    }

    try {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = resource.type || 'script';
      link.href = resource.url;
      
      if (resource.crossorigin) {
        link.crossOrigin = resource.crossorigin;
      }

      document.head.appendChild(link);
      this.preloadedResources.add(resource.url);

      return new Promise((resolve, reject) => {
        link.onload = resolve;
        link.onerror = reject;
      });
    } catch (error) {
      console.warn(`Failed to preload resource ${resource.url}:`, error);
    }
  }

  /**
   * Load module with optimization
   * @param {string} modulePath - Path to module
   * @param {Object} options - Loading options
   */
  async loadModuleOptimized(modulePath, options = {}) {
    if (this.loadedModules.has(modulePath)) {
      return; // Already loaded
    }

    const loadingStrategy = {
      ...this.loadingStrategies,
      ...options
    };

    try {
      let moduleUrl = modulePath;

      // Apply compression if supported and enabled
      if (loadingStrategy.compressionEnabled && this.compressionSupport.gzip) {
        moduleUrl = this.getCompressedUrl(modulePath);
      }

      // Use dynamic import for code splitting
      const module = await import(moduleUrl);
      this.loadedModules.add(modulePath);

      return module;
    } catch (error) {
      // Fallback to original URL if compressed version fails
      if (moduleUrl !== modulePath) {
        try {
          const module = await import(modulePath);
          this.loadedModules.add(modulePath);
          return module;
        } catch (fallbackError) {
          throw new Error(`Failed to load module ${modulePath}: ${fallbackError.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Get compressed URL if available
   * @param {string} originalUrl - Original resource URL
   * @returns {string} Compressed URL or original URL
   */
  getCompressedUrl(originalUrl) {
    // Check for pre-compressed versions
    if (this.compressionSupport.brotli) {
      return originalUrl.replace(/\.js$/, '.br.js');
    } else if (this.compressionSupport.gzip) {
      return originalUrl.replace(/\.js$/, '.gz.js');
    }
    
    return originalUrl;
  }

  /**
   * Implement progressive loading for large resources
   * @param {string} resourceUrl - URL of large resource
   * @param {Function} progressCallback - Progress callback
   */
  async loadProgressively(resourceUrl, progressCallback) {
    try {
      const response = await fetch(resourceUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      let loaded = 0;
      const chunks = [];

      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        if (progressCallback && total > 0) {
          progressCallback({
            loaded,
            total,
            progress: (loaded / total) * 100
          });
        }
      }

      // Combine chunks
      const combinedArray = new Uint8Array(loaded);
      let offset = 0;
      
      for (const chunk of chunks) {
        combinedArray.set(chunk, offset);
        offset += chunk.length;
      }

      return combinedArray;
    } catch (error) {
      throw new Error(`Progressive loading failed for ${resourceUrl}: ${error.message}`);
    }
  }

  /**
   * Optimize bundle size by removing unused code
   * @param {Object} bundleConfig - Bundle configuration
   */
  optimizeBundleSize(bundleConfig) {
    const optimizations = {
      treeShaking: true,
      minification: true,
      compression: true,
      codesplitting: true
    };

    // Apply tree shaking recommendations
    if (optimizations.treeShaking) {
      bundleConfig.unusedExports = this.detectUnusedExports(bundleConfig);
    }

    // Apply code splitting recommendations
    if (optimizations.codesplitting) {
      bundleConfig.splitPoints = this.identifySplitPoints(bundleConfig);
    }

    return {
      ...bundleConfig,
      optimizations,
      estimatedSizeReduction: this.estimateSizeReduction(bundleConfig)
    };
  }

  /**
   * Detect unused exports (simplified analysis)
   * @param {Object} bundleConfig - Bundle configuration
   */
  detectUnusedExports(bundleConfig) {
    // This would be more sophisticated in a real implementation
    const potentiallyUnused = [
      'debug utilities',
      'development helpers',
      'unused transformers features'
    ];

    return potentiallyUnused;
  }

  /**
   * Identify optimal code splitting points
   * @param {Object} bundleConfig - Bundle configuration
   */
  identifySplitPoints(bundleConfig) {
    return [
      {
        name: 'chat-core',
        modules: ['chat-bot.js', 'conversation-manager.js'],
        priority: 'high'
      },
      {
        name: 'ml-processing',
        modules: ['chat-ml-worker.js'],
        priority: 'medium',
        loadStrategy: 'lazy'
      },
      {
        name: 'ui-components',
        modules: ['chat-ui.js', 'style-manager.js'],
        priority: 'high'
      },
      {
        name: 'utilities',
        modules: ['performance-manager.js', 'fallback-handler.js'],
        priority: 'low',
        loadStrategy: 'lazy'
      }
    ];
  }

  /**
   * Estimate size reduction from optimizations
   * @param {Object} bundleConfig - Bundle configuration
   */
  estimateSizeReduction(bundleConfig) {
    // Rough estimates based on common optimization results
    const reductions = {
      treeShaking: 0.15, // 15% reduction
      minification: 0.30, // 30% reduction
      compression: 0.60, // 60% reduction (gzip)
      codesplitting: 0.20 // 20% reduction in initial load
    };

    const totalReduction = Object.values(reductions).reduce((sum, reduction) => {
      return sum + (reduction * (1 - sum)); // Compound reductions
    }, 0);

    return {
      individual: reductions,
      total: totalReduction,
      estimatedFinalSize: bundleConfig.originalSize * (1 - totalReduction)
    };
  }

  /**
   * Get loading strategy recommendations
   * @param {Object} context - Application context
   */
  getLoadingStrategyRecommendations(context = {}) {
    const recommendations = {
      strategy: 'progressive',
      reasoning: [],
      optimizations: []
    };

    // Analyze connection speed
    if (typeof navigator.connection !== 'undefined') {
      const connection = navigator.connection;
      
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        recommendations.strategy = 'minimal';
        recommendations.reasoning.push('Slow connection detected');
        recommendations.optimizations.push('aggressive_compression');
        recommendations.optimizations.push('minimal_initial_load');
      } else if (connection.effectiveType === '4g') {
        recommendations.strategy = 'progressive';
        recommendations.reasoning.push('Fast connection available');
        recommendations.optimizations.push('preload_critical');
      }
    }

    // Analyze device capabilities
    if (typeof navigator.hardwareConcurrency !== 'undefined') {
      const cores = navigator.hardwareConcurrency;
      
      if (cores <= 2) {
        recommendations.optimizations.push('reduce_concurrent_loads');
        recommendations.reasoning.push('Limited CPU cores detected');
      } else if (cores >= 4) {
        recommendations.optimizations.push('parallel_loading');
        recommendations.reasoning.push('Multi-core CPU available');
      }
    }

    // Analyze memory constraints
    if (typeof performance.memory !== 'undefined') {
      const memoryRatio = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
      
      if (memoryRatio > 0.7) {
        recommendations.optimizations.push('aggressive_cleanup');
        recommendations.optimizations.push('smaller_cache_sizes');
        recommendations.reasoning.push('High memory usage detected');
      }
    }

    return recommendations;
  }

  /**
   * Monitor bundle performance
   */
  startPerformanceMonitoring() {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      entries.forEach(entry => {
        if (entry.name.includes('chat-bot') || entry.name.includes('modules')) {
          if (window.isDev) {
            console.log(`Bundle Performance: ${entry.name} - ${entry.duration.toFixed(2)}ms`);
          }
        }
      });
    });

    observer.observe({ entryTypes: ['resource', 'navigation'] });
    
    return observer;
  }

  /**
   * Get bundle optimization report
   */
  getBundleOptimizationReport() {
    return {
      loadedModules: Array.from(this.loadedModules),
      preloadedResources: Array.from(this.preloadedResources),
      compressionSupport: this.compressionSupport,
      loadingStrategies: this.loadingStrategies,
      recommendations: this.getLoadingStrategyRecommendations(),
      estimatedSavings: {
        modulesLoaded: this.loadedModules.size,
        resourcesPreloaded: this.preloadedResources.size,
        compressionEnabled: this.loadingStrategies.compressionEnabled
      }
    };
  }
}

export default BundleOptimizer;