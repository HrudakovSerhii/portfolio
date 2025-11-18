/**
 * Optimized ML Worker for Text Generation
 * Simplified approach focused on better prompting and response quality
 *
 * Note: Uses @huggingface/transformers (not @xenova/transformers) because
 * SmolLM2 models are only available in the HuggingFace package
 */

// Global variables for transformers
let pipeline, env;

const MAX_TOKENS = 200;

// TODO: Check why we do this.
// Load transformers library dynamically
async function loadTransformers() {
  try {
    const transformers = await import(
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers"
    );

    pipeline = transformers.pipeline;
    env = transformers.env;

    // Allow remote models (required for initial download)
    env.allowRemoteModels = true;

    // Transformers.js will automatically use browser's Cache API
    env.allowLocalModels = false;

    // Allow remote models (required for initial download)
    env.allowRemoteModels = true;

    // Transformers.js will automatically use browser's Cache API
    env.allowLocalModels = false;

    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.simd = true;

    return true;
  } catch (error) {
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
      // Step 1: Load transformers library
      const transformersLoadStart = Date.now();
      const transformersLoaded = await loadTransformers();
      const transformersLoadTime = Date.now() - transformersLoadStart;

      if (!transformersLoaded) {
        throw new Error("Failed to load transformers library");
      }

      // Step 2: Check WebGPU availability
      const webgpuCheckStart = Date.now();

      let deviceToUse = this.modelConfig.device;

      if (this.modelConfig.device === 'webgpu') {
        const webgpuAvailable = await this.checkWebGPUAvailability();

        if (!webgpuAvailable) {
          deviceToUse = 'wasm';

          this.postMessage({
            type: "status",
            message: "WebGPU not available, using WASM backend",
          });
        }
      }

      // Step 3: Load the model
      this.postMessage({
        type: "status",
        message: `Loading ${this.modelConfig.name} model...`,
      });

      const modelLoadStart = Date.now();

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

      const modelLoadTime = Date.now() - modelLoadStart;

      this.isInitialized = true;

      const totalInitTime = Date.now() - initStartTime;

      this.postMessage({
        type: "ready",
        success: true,
        message: `${this.modelConfig.name} model loaded successfully`,
        metrics: {
          initTime: totalInitTime,
          transformersLoadTime,
          webgpuCheckTime: Date.now() - webgpuCheckStart,
          modelLoadTime,
          device: deviceToUse
        }
      });

    } catch (error) {
      const totalInitTime = Date.now() - initStartTime;

      this.postMessage({
        type: "ready",
        success: false,
        error: error.message,
        metrics: {
          failedAfter: totalInitTime,
          device: this.modelConfig.device
        }
      });
    }
  }

  /**
   * Check WebGPU availability with detailed dagnostics
   */
  async checkWebGPUAvailability() {
    try {
      // Check if WebGPU is supported
      if (!navigator.gpu) {
        console.warn('[OptimizedMLWorker] WebGPU not supported: navigator.gpu not available');

        return false;
      }

      // Check Cross-Origin Isolation (required for WebGPU)
      if (!crossOriginIsolated) {
        console.warn('[OptimizedMLWorker] WebGPU requires Cross-Origin Isolation. Server headers needed.');

        return false;
      }

      // Request adapter
      const adapter = await navigator.gpu.requestAdapter();

      if (!adapter) {
        console.warn('[OptimizedMLWorker] WebGPU adapter not available');

        return false;
      }

      // Request device
      const device = await adapter.requestDevice();

      if (!device) {
        console.warn('[OptimizedMLWorker] WebGPU device not available');

        return false;
      }

      return true;
    } catch (error) {
      console.warn('[OptimizedMLWorker] WebGPU initialization failed:', error.message);

      return false;
    }
  }

  /**
   * Generate text response
   */
  async generateText(prompt, options = {}) {
    if (!this.model || !this.isInitialized) {
      console.error('[OptimizedMLWorker] Model not initialized! isInitialized:', this.isInitialized, 'model:', !!this.model);

      throw new Error("Model not initialized");
    }

    try {
      const modelOptions = {
        max_new_tokens: Math.min(options.maxTokens || 60, 60), // Cap at 60 tokens for focused responses
        temperature: Math.min(options.temperature || 0.3, 0.3), // Cap at 0.3 for deterministic output
        do_sample: true,
        top_p: 0.8,
        repetition_penalty: 1.2,
        return_full_text: false,
        pad_token_id: 50256,
        eos_token_id: 50256,
        early_stopping: true // Add early stopping for better control
      };

      const output = await this.model(prompt, modelOptions);

      // Extract generated text
      let generatedText = "";
      if (Array.isArray(output) && output.length > 0) {
        generatedText = output[0].generated_text || "";
      } else if (output.generated_text) {
        generatedText = output.generated_text;
      } else {
        console.warn('[OptimizedMLWorker] ⚠️ Unexpected output format:', output);
      }

      const cleanedText = this.cleanAndValidateText(generatedText);

      return cleanedText;
    } catch (error) {
      console.error('[OptimizedMLWorker] ❌ Failed to generate text:', error, error.stack);

      throw error;
    }
  }

  /**
   * Clean and validate generated text with strict filtering
   */
  cleanAndValidateText(text) {
    if (!text || typeof text !== 'string') {
      console.warn('[OptimizedMLWorker] ❌ VALIDATION FAILED: Invalid input text');
      console.warn('[OptimizedMLWorker] Type:', typeof text, 'Value:', text);

      return null;
    }

    // Clean the text
    let cleaned = text
      .replace(/^(Response:|Answer:)\s*/i, "") // Remove prefixes
      .replace(/\n\s*\n/g, "\n") // Remove extra newlines
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    // Validate the text doesn't contain hallucinated content
    const invalidPatterns = [
      { pattern: /serdh?ii/i, name: 'misspelled_name_serdii' },
      { pattern: /serlindo/i, name: 'misspelled_name_serlindo' },
      { pattern: /serdoubust/i, name: 'misspelled_name_serdoubust' },
      { pattern: /serdondogs/i, name: 'misspelled_name_serdondogs' },
      { pattern: /webpack/i, name: 'random_tech_webpack' },
      { pattern: /pylons/i, name: 'random_tech_pylons' },
      { pattern: /ejs/i, name: 'random_tech_ejs' },
      { pattern: /\d+\s+guys/i, name: 'random_numbers_guys' },
      { pattern: /work out of here/i, name: 'nonsensical_phrase_1' },
      { pattern: /ain't no joke/i, name: 'nonsensical_phrase_2' },
      { pattern: /made my life so much easier/i, name: 'nonsensical_phrase_3' }
    ];

    // Check for invalid patterns
    for (const { pattern, name } of invalidPatterns) {
      if (pattern.test(cleaned)) {
        console.warn('[OptimizedMLWorker] ❌ VALIDATION FAILED: Hallucinated content detected');
        console.warn('[OptimizedMLWorker] Pattern matched:', name);
        console.warn('[OptimizedMLWorker] Pattern:', pattern);
        console.warn('[OptimizedMLWorker] Text:', cleaned);

        return null; // Return null to indicate invalid generation
      }
    }

    // Check if text is too short or too generic
    if (cleaned.length < 10) {
      console.warn('[OptimizedMLWorker] ❌ VALIDATION FAILED: Text too short');
      console.warn('[OptimizedMLWorker] Length:', cleaned.length, 'chars (minimum: 10)', '[OptimizedMLWorker]: Text', cleaned);

      return null;
    }

    // Check if text starts with first person or contains relevant content
    const startsWithFirstPerson = /^(I|Yes|No|Based|According|From|With|Having|As|My)/i.test(cleaned);
    const containsYears = cleaned.includes('years');
    const containsExperience = cleaned.includes('experience');

    if (!startsWithFirstPerson && !containsYears && !containsExperience) {
      console.warn('[OptimizedMLWorker] ❌ VALIDATION FAILED: Text does not appear relevant', '[OptimizedMLWorker] Text:', cleaned);

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
  async processGeneration(data, requestId) {
    const { prompt, query, maxTokens, temperature } = data || {};

    const startTime = Date.now();

    try {
      const generatedText = await this.generateText(prompt, {
        maxTokens: Math.min(maxTokens || MAX_TOKENS, MAX_TOKENS), // Cap at 60 tokens
        temperature: Math.min(temperature || 0.3, 0.3) // Cap temperature
      });

      const processingTime = Date.now() - startTime;

      // If generation failed validation, return null and error
      if (!generatedText) {
        this.postMessage({
          type: "error",
          requestId: requestId,
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
        requestId: requestId,
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
      this.postMessage({
        type: "error",
        requestId: requestId,
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
   * Process chatbot query (handles process_query message type)
   */
  async processQuery(data, requestId) {
    const { message, context = [], style = 'developer', cvData } = data || {};

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
    }

    // Build prompt from message, context, and CV data
    const prompt = this.buildChatPrompt(message, context, style, cvContext);

    // Process using existing generation logic
    await this.processGeneration({
      prompt: prompt,
      query: message,
      maxTokens: 60,
      temperature: 0.3
    }, requestId);
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

    return relevantSections.length > 0 ? relevantSections : null;
  }

  /**
   * Build chat prompt for the model
   */
  buildChatPrompt(message, context = [], style = 'developer', cvContext = null) {
    // Create a focused prompt for the small model
    let prompt = "You are Serhii, a professional developer. Answer briefly in first person.\n\n";

    // Add CV context if available (this is the key part!)
    if (cvContext && cvContext.length > 0) {
      prompt += "Based on this information about Serhii:\n";
      cvContext.forEach((section, idx) => {
        prompt += `${section.content}\n\n`;
      });
    }

    // Add conversation context if available (keep it minimal for small model)
    if (context.length > 0) {
      const recentContext = context.slice(-2); // Only use last 2 context items

      prompt += "Recent conversation:\n";
      recentContext.forEach((item, idx) => {

        prompt += `- ${item}\n`;
      });
      prompt += "\n";
    }

    prompt += `Question: ${message}\n`;
    prompt += "Answer: I";

    return prompt;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.model) {
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
  getPerformanceMetrics(requestId) {
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
      requestId: requestId,
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
  const { type, data, requestId } = event.data;

  switch (type) {
    case 'initialize':
      await worker.initialize();
      break;

    case 'generate':
      await worker.processGeneration(data, requestId);
      break;

    case 'process_query':
      await worker.processQuery(data, requestId);
      break;

    case 'cleanup':
      worker.cleanup();
      break;

    case 'get_performance_metrics':
      worker.getPerformanceMetrics(requestId);
      break;

    default:
      console.warn('[OptimizedMLWorker] Unknown message type:', type);
  }
});

// Handle errors
self.addEventListener('error', (error) => {
  self.postMessage({
    type: 'error',
    error: error.message || 'Unknown worker error'
  });
});

self.addEventListener('unhandledrejection', (event) => {
  self.postMessage({
    type: 'error',
    error: event.reason?.message || 'Unhandled promise rejection'
  });
});

self.postMessage({
  type: 'workerReady',
  success: true,
  message: 'OptimizedMLWorker script loaded and ready to receive messages',
  timestamp: Date.now()
});

worker.initialize().catch(error => {
  self.postMessage({
    type: 'ready',
    success: false,
    error: error.message,
    stack: error.stack
  });
});
