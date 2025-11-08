/**
 * Optimized ML Worker for Text Generation
 * Simplified approach focused on better prompting and response quality
 */

// Global variables for transformers
let pipeline, env;

// Load transformers library dynamically
async function loadTransformers() {
  try {
    const transformers = await import(
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers"
    );

    pipeline = transformers.pipeline;
    env = transformers.env;

    // Configure environment
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.simd = true;

    return true;
  } catch (error) {
    console.error("Failed to load transformers:", error);
    return false;
  }
}

class OptimizedMLWorker {
  constructor() {
    this.model = null;
    this.isInitialized = false;
    this.modelConfig = {
      name: "HuggingFaceTB/SmolLM2-135M-Instruct",
      type: "text-generation",
      dtype: "q4",
      device: "webgpu"
    };
  }

  /**
   * Initialize the model
   */
  async initialize() {
    const initStartTime = Date.now();

    try {
      // Load transformers library
      const transformersLoaded = await loadTransformers();
      if (!transformersLoaded) {
        throw new Error("Failed to load transformers library");
      }

      // Check WebGPU availability
      let deviceToUse = this.modelConfig.device;
      if (this.modelConfig.device === 'webgpu') {
        const webgpuAvailable = await this.checkWebGPUAvailability();
        if (!webgpuAvailable) {
          console.warn('WebGPU not available, falling back to WASM');
          deviceToUse = 'wasm';
          this.postMessage({
            type: "status",
            message: "WebGPU not available, using WASM backend",
          });
        }
      }

      this.postMessage({
        type: "status",
        message: `Loading ${this.modelConfig.name} model...`,
      });

      // Load the text generation pipeline
      this.model = await pipeline(
        this.modelConfig.type,
        this.modelConfig.name,
        {
          dtype: this.modelConfig.dtype,
          device: deviceToUse,
        },
        {
          quantized: true,
          progress_callback: (progress) => {
            this.postMessage({
              type: "progress",
              progress: progress,
            });
          },
        }
      );

      this.isInitialized = true;

      const initTime = Date.now() - initStartTime;
      this.postMessage({
        type: "ready",
        success: true,
        message: `${this.modelConfig.name} model loaded successfully`,
        metrics: { initTime }
      });

    } catch (error) {
      console.error("Failed to initialize ML model:", error);
      this.postMessage({
        type: "ready",
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Check WebGPU availability with detailed diagnostics
   */
  async checkWebGPUAvailability() {
    try {
      // Check if WebGPU is supported
      if (!navigator.gpu) {
        console.warn('WebGPU not supported: navigator.gpu not available');
        return false;
      }

      // Check Cross-Origin Isolation (required for WebGPU)
      if (!crossOriginIsolated) {
        console.warn('WebGPU requires Cross-Origin Isolation. Server headers needed.');
        return false;
      }

      // Request adapter
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('WebGPU adapter not available');
        return false;
      }

      // Request device
      const device = await adapter.requestDevice();
      if (!device) {
        console.warn('WebGPU device not available');
        return false;
      }

      console.log('WebGPU successfully initialized');
      return true;
    } catch (error) {
      console.warn('WebGPU initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Generate text response
   */
  async generateText(prompt, options = {}) {
    if (!this.model || !this.isInitialized) {
      throw new Error("Model not initialized");
    }

    try {
      const output = await this.model(prompt, {
        max_new_tokens: Math.min(options.maxTokens || 60, 60), // Cap at 60 tokens for focused responses
        temperature: Math.min(options.temperature || 0.3, 0.3), // Cap at 0.3 for deterministic output
        do_sample: true,
        top_p: 0.8,
        repetition_penalty: 1.2,
        return_full_text: false,
        pad_token_id: 50256,
        eos_token_id: 50256,
        early_stopping: true // Add early stopping for better control
      });

      // Extract generated text
      let generatedText = "";
      if (Array.isArray(output) && output.length > 0) {
        generatedText = output[0].generated_text || "";
      } else if (output.generated_text) {
        generatedText = output.generated_text;
      }

      return this.cleanAndValidateText(generatedText);
    } catch (error) {
      console.error("Failed to generate text:", error);
      throw error;
    }
  }

  /**
   * Clean and validate generated text with strict filtering
   */
  cleanAndValidateText(text) {
    // Clean the text
    let cleaned = text
      .replace(/^(Response:|Answer:)\s*/i, "") // Remove prefixes
      .replace(/\n\s*\n/g, "\n") // Remove extra newlines
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    // Validate the text doesn't contain hallucinated content
    const invalidPatterns = [
      /serdh?ii/i, // Misspelled name variations
      /serlindo/i,
      /serdoubust/i,
      /serdondogs/i,
      /webpack/i, // Random technical terms not in context
      /pylons/i,
      /ejs/i,
      /\d+\s+guys/i, // Random numbers with "guys"
      /work out of here/i, // Nonsensical phrases
      /ain't no joke/i,
      /made my life so much easier/i
    ];

    // Check for invalid patterns
    for (const pattern of invalidPatterns) {
      if (pattern.test(cleaned)) {
        console.warn('Generated text contains hallucinated content:', cleaned);
        return null; // Return null to indicate invalid generation
      }
    }

    // Check if text is too short or too generic
    if (cleaned.length < 10) {
      return null;
    }

    // Check if text starts with "I" (first person) as expected
    if (!cleaned.match(/^(I|Yes|No)/i)) {
      console.warn('Generated text does not start appropriately:', cleaned);
      return null;
    }

    return cleaned;
  }

  /**
   * Validate response format and content
   */
  validateResponseFormat(text) {
    if (!text || typeof text !== 'string') {
      return { valid: false, reason: 'Empty or invalid text' };
    }

    if (text.length < 10) {
      return { valid: false, reason: 'Response too short' };
    }

    if (!text.match(/^(I|Yes|No)/i)) {
      return { valid: false, reason: 'Response does not start with first-person indicator' };
    }

    return { valid: true };
  }

  /**
   * Process generation request with validation
   */
  async processGeneration(data) {
    const { prompt, query, maxTokens, temperature } = data;
    const startTime = Date.now();

    try {
      const generatedText = await this.generateText(prompt, {
        maxTokens: Math.min(maxTokens || 60, 60), // Cap at 60 tokens
        temperature: Math.min(temperature || 0.3, 0.3) // Cap temperature
      });

      const processingTime = Date.now() - startTime;

      // If generation failed validation, return null and error
      if (!generatedText) {
        this.postMessage({
          type: "error",
          error: "Generated response failed validation (likely hallucination)",
          query: query,
          processingMetrics: {
            processingTime,
            promptLength: prompt.length,
            responseLength: 0,
            validationPassed: false
          }
        });
        return;
      }

      // Validate response format
      const formatValidation = this.validateResponseFormat(generatedText);
      
      this.postMessage({
        type: "response",
        answer: generatedText,
        query: query,
        validated: true,
        processingMetrics: {
          processingTime,
          promptLength: prompt.length,
          responseLength: generatedText.length,
          validationPassed: formatValidation.valid,
          validationReason: formatValidation.reason || 'Valid response'
        }
      });

    } catch (error) {
      console.error("Generation failed:", error);
      this.postMessage({
        type: "error",
        error: error.message,
        query: query,
        processingMetrics: {
          processingTime: Date.now() - startTime,
          promptLength: prompt?.length || 0,
          responseLength: 0,
          validationPassed: false
        }
      });
    }
  }

  /**
   * Process chat-bot query (handles process_query message type)
   */
  async processQuery(data) {
    const { message, context = [], style = 'developer', cvData } = data;
    
    console.log('🔍 WORKER: Processing query:', {
      message,
      contextLength: context.length,
      context: context.slice(0, 2), // Log first 2 context items
      style,
      hasCvData: !!cvData
    });
    
    if (!message) {
      this.postMessage({
        type: "error",
        error: "No message provided in query"
      });
      return;
    }

    // Find relevant CV context if CV data is available
    let cvContext = null;
    if (cvData) {
      cvContext = this.findRelevantCVContext(message, cvData);
      console.log('🎯 WORKER: Found CV context:', {
        contextSections: cvContext ? cvContext.length : 0,
        sectionKeys: cvContext ? cvContext.map(s => s.key) : []
      });
    }

    // Build prompt from message, context, and CV data
    const prompt = this.buildChatPrompt(message, context, style, cvContext);
    
    console.log('📝 WORKER: Built prompt:', {
      promptLength: prompt.length,
      prompt: prompt.substring(0, 300) + '...' // Log first 300 chars
    });
    
    // Process using existing generation logic
    await this.processGeneration({
      prompt: prompt,
      query: message,
      maxTokens: 60,
      temperature: 0.3
    });
  }

  /**
   * Find relevant CV context based on the message
   */
  findRelevantCVContext(message, cvData) {
    if (!cvData || !cvData.knowledge_base) {
      return null;
    }

    const messageLower = message.toLowerCase();
    const relevantSections = [];

    // Search through knowledge base for relevant content
    Object.entries(cvData.knowledge_base).forEach(([key, data]) => {
      if (data.keywords && data.content) {
        // Check if any keywords match the message
        const hasMatch = data.keywords.some(keyword => 
          messageLower.includes(keyword.toLowerCase())
        );
        
        if (hasMatch) {
          relevantSections.push({
            key,
            content: data.content,
            keywords: data.keywords
          });
        }
      }
    });

    console.log('🔍 WORKER: CV context search:', {
      searchTerms: messageLower,
      foundSections: relevantSections.map(s => s.key),
      totalSections: Object.keys(cvData.knowledge_base).length
    });

    return relevantSections.length > 0 ? relevantSections : null;
  }

  /**
   * Build chat prompt for the model
   */
  buildChatPrompt(message, context = [], style = 'developer', cvContext = null) {
    console.log('🏗️ WORKER: Building prompt with:', {
      message,
      contextItems: context.length,
      style,
      hasCvContext: !!cvContext,
      cvSections: cvContext ? cvContext.map(s => s.key) : []
    });
    
    // Create a focused prompt for the small model
    let prompt = "You are Serhii, a professional developer. Answer briefly in first person.\n\n";
    
    // Add CV context if available (this is the key part!)
    if (cvContext && cvContext.length > 0) {
      prompt += "Based on this information about Serhii:\n";
      cvContext.forEach(section => {
        prompt += `${section.content}\n\n`;
      });
    }
    
    // Add conversation context if available (keep it minimal for small model)
    if (context.length > 0) {
      const recentContext = context.slice(-2); // Only use last 2 context items
      prompt += "Recent conversation:\n";
      recentContext.forEach(item => {
        prompt += `- ${item}\n`;
      });
      prompt += "\n";
    }
    
    prompt += `Question: ${message}\n`;
    prompt += "Answer: I";
    
    console.log('✅ WORKER: Final prompt built:', {
      length: prompt.length,
      preview: prompt.substring(0, 200) + '...',
      hasCvData: !!cvContext
    });
    
    return prompt;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Clean up model resources if needed
    if (this.model) {
      // Note: Transformers.js doesn't have explicit cleanup methods
      // but we can clear the reference
      this.model = null;
    }
    
    this.isInitialized = false;
    
    this.postMessage({
      type: "cleanup_complete",
      message: "Worker cleanup completed"
    });
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const metrics = {
      isInitialized: this.isInitialized,
      modelName: this.modelConfig.name,
      device: this.modelConfig.device,
      memoryUsage: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null,
      timestamp: Date.now()
    };

    this.postMessage({
      type: "performance_metrics",
      metrics: metrics
    });
  }

  /**
   * Post message to main thread
   */
  postMessage(data) {
    self.postMessage(data);
  }
}

// Initialize worker
const worker = new OptimizedMLWorker();

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, ...data } = event.data;

  switch (type) {
    case 'initialize':
      await worker.initialize();
      break;
    
    case 'generate':
      await worker.processGeneration(data);
      break;
    
    case 'process_query':
      // Handle chat-bot query processing
      await worker.processQuery(data);
      break;
    
    case 'cleanup':
      // Handle cleanup request
      worker.cleanup();
      break;
    
    case 'get_performance_metrics':
      // Handle performance metrics request
      worker.getPerformanceMetrics();
      break;
    
    default:
      console.warn('Unknown message type:', type);
  }
});

// Handle errors
self.addEventListener('error', (error) => {
  console.error('Worker error:', error);
  self.postMessage({
    type: 'error',
    error: error.message || 'Unknown worker error'
  });
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in worker:', event.reason);
  self.postMessage({
    type: 'error',
    error: event.reason?.message || 'Unhandled promise rejection'
  });
});