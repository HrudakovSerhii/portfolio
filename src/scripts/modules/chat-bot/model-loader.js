/**
 * ModelLoader - Handles optimized model loading with caching and progressive loading
 * Implements performance optimizations for DistilBERT model loading
 */

class ModelLoader {
  constructor(performanceManager) {
    this.performanceManager = performanceManager;
    this.loadingState = {
      isLoading: false,
      progress: 0,
      stage: 'idle',
      error: null
    };
    
    this.modelConfig = {
      modelId: 'Xenova/distilbert-base-uncased',
      quantized: true,
      progressiveLoading: true,
      cacheEnabled: true,
      maxRetries: 3,
      retryDelay: 2000
    };
    
    this.loadedModel = null;
    this.loadingPromise = null;
    this.progressCallbacks = new Set();
  }

  /**
   * Load model with progressive loading and caching
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Loaded model
   */
  async loadModel(options = {}) {
    const config = { ...this.modelConfig, ...options };
    
    // Return existing loading promise if already loading
    if (this.loadingPromise) {
      return this.loadingPromise;
    }
    
    // Check cache first
    const cachedModel = this.performanceManager.getCachedModel(config.modelId);

    if (cachedModel && config.cacheEnabled) {
      this.loadedModel = cachedModel;
      this.notifyProgress(100, 'cached');

      return cachedModel;
    }
    
    // Start new loading process
    this.loadingPromise = this._performModelLoading(config);
    
    try {
      const model = await this.loadingPromise;
      this.loadedModel = model;
      
      // Cache the loaded model
      if (config.cacheEnabled) {
        this.performanceManager.cacheModel(model, config.modelId);
      }
      
      return model;
    } catch (error) {
      this.loadingPromise = null;
      throw error;
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * Perform the actual model loading with retries and progress tracking
   * @param {Object} config - Model configuration
   * @returns {Promise<Object>} Loaded model
   */
  async _performModelLoading(config) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        this.performanceManager.logPerformanceEvent('model_load_attempt', {
          attempt,
          modelId: config.modelId
        });
        
        const startTime = Date.now();
        const model = await this._loadModelWithProgress(config);
        const loadTime = Date.now() - startTime;
        
        this.performanceManager.metrics.modelLoadTime = loadTime;
        this.performanceManager.logPerformanceEvent('model_load_success', {
          attempt,
          loadTime,
          modelId: config.modelId
        });
        
        return model;
        
      } catch (error) {
        lastError = error;
        
        this.performanceManager.logPerformanceEvent('model_load_failed', {
          attempt,
          error: error.message,
          modelId: config.modelId
        });
        
        if (attempt < config.maxRetries) {
          this.notifyProgress(0, `retry_${attempt}`);
          await this._delay(config.retryDelay * attempt);
        }
      }
    }
    
    throw new Error(`Failed to load model after ${config.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Load model with detailed progress tracking
   * @param {Object} config - Model configuration
   * @returns {Promise<Object>} Loaded model
   */
  async _loadModelWithProgress(config) {
    this.loadingState.isLoading = true;
    this.loadingState.error = null;
    
    try {
      // Dynamic import of transformers library
      this.notifyProgress(5, 'loading_library');
      const transformers = await this._loadTransformersLibrary();
      
      // Configure environment
      this.notifyProgress(10, 'configuring_environment');
      this._configureTransformersEnvironment(transformers.env);
      
      // Load model with progressive callbacks
      this.notifyProgress(15, 'loading_model');
      const model = await transformers.pipeline('feature-extraction', config.modelId, {
        quantized: config.quantized,
        progress_callback: (progress) => {
          // Map progress from 15% to 95% (leaving 5% for finalization)
          const mappedProgress = 15 + (progress.progress || 0) * 0.8;
          this.notifyProgress(mappedProgress, 'downloading_model', progress);
        }
      });
      
      // Finalization
      this.notifyProgress(95, 'finalizing');
      await this._validateModel(model);
      
      this.notifyProgress(100, 'complete');
      this.loadingState.isLoading = false;
      
      return model;
      
    } catch (error) {
      this.loadingState.isLoading = false;
      this.loadingState.error = error;
      throw error;
    }
  }

  /**
   * Load transformers library with optimization
   * @returns {Promise<Object>} Transformers library
   */
  async _loadTransformersLibrary() {
    try {
      // Try to load from CDN with fallback
      const transformers = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6');

      return transformers;
    } catch (error) {
      // Fallback to local installation if available
      try {
        const transformers = await import('@huggingface/transformers');

        return transformers;
      } catch (fallbackError) {
        throw new Error(`Failed to load transformers library: ${error.message}`);
      }
    }
  }

  /**
   * Configure transformers environment for optimal performance
   * @param {Object} env - Transformers environment object
   */
  _configureTransformersEnvironment(env) {
    // Configure for web worker environment
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    
    // Set cache directory if supported
    if (env.cacheDir) {
      env.cacheDir = './.cache/transformers';
    }
    
    // Configure for better performance
    if (env.backends) {
      env.backends.onnx = {
        wasm: {
          numThreads: Math.min(4, navigator.hardwareConcurrency || 2)
        }
      };
    }
    
    this.performanceManager.logPerformanceEvent('transformers_environment_configured', {
      allowRemoteModels: env.allowRemoteModels,
      allowLocalModels: env.allowLocalModels,
      numThreads: navigator.hardwareConcurrency || 2
    });
  }

  /**
   * Validate loaded model
   * @param {Object} model - Loaded model
   */
  async _validateModel(model) {
    if (!model) {
      throw new Error('Model is null or undefined');
    }
    
    // Test model with a simple input
    try {
      const testInput = 'test validation';
      const testOutput = await model(testInput, { 
        pooling: 'mean', 
        normalize: true 
      });
      
      if (!testOutput || !testOutput.data) {
        throw new Error('Model validation failed: invalid output format');
      }
      
      this.performanceManager.logPerformanceEvent('model_validation_success', {
        testInputLength: testInput.length,
        outputSize: testOutput.data.length
      });
      
    } catch (error) {
      throw new Error(`Model validation failed: ${error.message}`);
    }
  }

  /**
   * Notify progress to all registered callbacks
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} stage - Current loading stage
   * @param {Object} details - Additional details
   */
  notifyProgress(progress, stage, details = {}) {
    this.loadingState.progress = Math.min(100, Math.max(0, progress));
    this.loadingState.stage = stage;
    
    const progressData = {
      progress: this.loadingState.progress,
      stage,
      details,
      timestamp: Date.now()
    };
    
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progressData);
      } catch (error) {
        console.error('Progress callback error:', error);
      }
    });
    
    this.performanceManager.logPerformanceEvent('model_load_progress', progressData);
  }

  /**
   * Add progress callback
   * @param {Function} callback - Progress callback function
   */
  onProgress(callback) {
    if (typeof callback === 'function') {
      this.progressCallbacks.add(callback);
    }
  }

  /**
   * Remove progress callback
   * @param {Function} callback - Progress callback function
   */
  offProgress(callback) {
    this.progressCallbacks.delete(callback);
  }

  /**
   * Get current loading state
   * @returns {Object} Current loading state
   */
  getLoadingState() {
    return { ...this.loadingState };
  }

  /**
   * Check if model is loaded and ready
   * @returns {boolean} True if model is ready
   */
  isModelReady() {
    return !!this.loadedModel && !this.loadingState.isLoading;
  }

  /**
   * Get loaded model
   * @returns {Object|null} Loaded model or null
   */
  getModel() {
    return this.loadedModel;
  }

  /**
   * Preload model in background
   * @param {Object} options - Loading options
   * @returns {Promise<void>} Preload promise
   */
  async preloadModel(options = {}) {
    if (this.isModelReady() || this.loadingState.isLoading) {
      return;
    }
    
    try {
      await this.loadModel({ ...options, background: true });
      this.performanceManager.logPerformanceEvent('model_preload_success');
    } catch (error) {
      this.performanceManager.logPerformanceEvent('model_preload_failed', {
        error: error.message
      });
      // Don't throw error for background preloading
    }
  }

  /**
   * Estimate model download size
   * @param {string} modelId - Model identifier
   * @returns {Promise<number>} Estimated size in bytes
   */
  async estimateModelSize(modelId = this.modelConfig.modelId) {
    try {
      // Try to get model info from Hugging Face API
      const response = await fetch(`https://huggingface.co/api/models/${modelId}`);
      if (response.ok) {
        const modelInfo = await response.json();
        // Estimate based on model info (this is a rough estimate)
        return modelInfo.safetensors?.total || 50 * 1024 * 1024; // Default to 50MB
      }
    } catch (error) {
      this.performanceManager.logPerformanceEvent('model_size_estimation_failed', {
        modelId,
        error: error.message
      });
    }
    
    // Default estimate for DistilBERT
    return 50 * 1024 * 1024; // 50MB
  }

  /**
   * Check if model can be loaded (browser compatibility)
   * @returns {Object} Compatibility check result
   */
  checkCompatibility() {
    const compatibility = {
      supported: true,
      issues: [],
      recommendations: []
    };
    
    // Check WebAssembly support
    if (typeof WebAssembly === 'undefined') {
      compatibility.supported = false;
      compatibility.issues.push('WebAssembly not supported');
    }
    
    // Check Worker support
    if (typeof Worker === 'undefined') {
      compatibility.supported = false;
      compatibility.issues.push('Web Workers not supported');
    }
    
    // Check memory availability
    if (typeof performance.memory !== 'undefined') {
      const availableMemory = performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize;
      const requiredMemory = 100 * 1024 * 1024; // 100MB minimum
      
      if (availableMemory < requiredMemory) {
        compatibility.issues.push('Insufficient memory available');
        compatibility.recommendations.push('Close other browser tabs to free memory');
      }
    }
    
    // Check network connection
    if (typeof navigator.connection !== 'undefined') {
      const connection = navigator.connection;
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        compatibility.recommendations.push('Slow network detected - model loading may take longer');
      }
    }
    
    this.performanceManager.logPerformanceEvent('compatibility_check', compatibility);
    
    return compatibility;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.loadedModel = null;
    this.loadingPromise = null;
    this.progressCallbacks.clear();
    
    this.loadingState = {
      isLoading: false,
      progress: 0,
      stage: 'idle',
      error: null
    };
    
    this.performanceManager.logPerformanceEvent('model_loader_cleanup');
  }

  /**
   * Utility method to delay execution
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise<void>} Delay promise
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ModelLoader;