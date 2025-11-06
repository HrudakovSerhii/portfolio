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
   * Check WebGPU availability
   */
  async checkWebGPUAvailability() {
    try {
      if (!navigator.gpu) return false;
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return false;
      const device = await adapter.requestDevice();
      return !!device;
    } catch (error) {
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
        max_new_tokens: options.maxTokens || 120,
        temperature: options.temperature || 0.7,
        do_sample: true,
        top_p: 0.9,
        repetition_penalty: 1.1,
        return_full_text: false,
        pad_token_id: 50256, // Add explicit pad token
      });

      // Extract generated text
      let generatedText = "";
      if (Array.isArray(output) && output.length > 0) {
        generatedText = output[0].generated_text || "";
      } else if (output.generated_text) {
        generatedText = output.generated_text;
      }

      return this.cleanGeneratedText(generatedText);
    } catch (error) {
      console.error("Failed to generate text:", error);
      throw error;
    }
  }

  /**
   * Clean and post-process generated text
   */
  cleanGeneratedText(text) {
    return text
      .replace(/^(Response:|Answer:)\s*/i, "") // Remove prefixes
      .replace(/\n\s*\n/g, "\n") // Remove extra newlines
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Process generation request
   */
  async processGeneration(data) {
    const { prompt, query, maxTokens, temperature } = data;
    const startTime = Date.now();

    try {
      const generatedText = await this.generateText(prompt, {
        maxTokens,
        temperature
      });

      const processingTime = Date.now() - startTime;

      this.postMessage({
        type: "response",
        answer: generatedText,
        query: query,
        processingMetrics: {
          processingTime,
          promptLength: prompt.length,
          responseLength: generatedText.length
        }
      });

    } catch (error) {
      console.error("Generation failed:", error);
      this.postMessage({
        type: "error",
        error: error.message,
        query: query
      });
    }
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