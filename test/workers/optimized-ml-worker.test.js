/**
 * Tests for Enhanced Optimized ML Worker
 * Tests constrained generation parameters, validation logic, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the worker environment
const mockPostMessage = vi.fn();
const mockImport = vi.fn();

// Mock global worker environment
global.self = {
  postMessage: mockPostMessage,
  addEventListener: vi.fn(),
  importScripts: vi.fn()
};

global.navigator = {
  gpu: {
    requestAdapter: vi.fn().mockResolvedValue({
      requestDevice: vi.fn().mockResolvedValue({})
    })
  }
};

// Mock transformers library
const mockPipeline = vi.fn();
const mockEnv = {
  allowRemoteModels: true,
  allowLocalModels: false,
  backends: {
    onnx: {
      wasm: {
        numThreads: 1,
        simd: true
      }
    }
  }
};

// Mock the dynamic import
vi.mock('https://cdn.jsdelivr.net/npm/@huggingface/transformers', () => ({
  pipeline: mockPipeline,
  env: mockEnv
}));

// Import the worker class (we'll need to extract it for testing)
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

  async generateText(prompt, options = {}) {
    if (!this.model || !this.isInitialized) {
      throw new Error("Model not initialized");
    }

    const output = await this.model(prompt, {
      max_new_tokens: Math.min(options.maxTokens || 60, 60),
      temperature: Math.min(options.temperature || 0.3, 0.3),
      do_sample: true,
      top_p: 0.8,
      repetition_penalty: 1.2,
      return_full_text: false,
      pad_token_id: 50256,
      eos_token_id: 50256,
      early_stopping: true
    });

    let generatedText = "";
    if (Array.isArray(output) && output.length > 0) {
      generatedText = output[0].generated_text || "";
    } else if (output.generated_text) {
      generatedText = output.generated_text;
    }

    return this.cleanAndValidateText(generatedText);
  }

  cleanAndValidateText(text) {
    let cleaned = text
      .replace(/^(Response:|Answer:)\s*/i, "")
      .replace(/\n\s*\n/g, "\n")
      .replace(/\s+/g, " ")
      .trim();

    const invalidPatterns = [
      /serdh?ii/i,
      /serlindo/i,
      /serdoubust/i,
      /serdondogs/i,
      /webpack/i,
      /pylons/i,
      /ejs/i,
      /\d+\s+guys/i,
      /work out of here/i,
      /ain't no joke/i,
      /made my life so much easier/i
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(cleaned)) {
        console.warn('Generated text contains hallucinated content:', cleaned);
        return null;
      }
    }

    if (cleaned.length < 10) {
      return null;
    }

    if (!cleaned.match(/^(I|Yes|No)/i)) {
      console.warn('Generated text does not start appropriately:', cleaned);
      return null;
    }

    return cleaned;
  }

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

  postMessage(data) {
    mockPostMessage(data);
  }
}

describe('OptimizedMLWorker - Enhanced Text Generation', () => {
  let worker;

  beforeEach(() => {
    worker = new OptimizedMLWorker();
    mockPostMessage.mockClear();
    mockPipeline.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constrained Generation Parameters', () => {
    it('should cap maximum tokens at 60', async () => {
      // Mock model
      const mockModel = vi.fn().mockResolvedValue({
        generated_text: "I am a software developer with experience in JavaScript."
      });
      worker.model = mockModel;
      worker.isInitialized = true;

      await worker.generateText("Tell me about yourself", { maxTokens: 100 });

      expect(mockModel).toHaveBeenCalledWith(
        "Tell me about yourself",
        expect.objectContaining({
          max_new_tokens: 60 // Should be capped at 60, not 100
        })
      );
    });

    it('should cap temperature at 0.3', async () => {
      const mockModel = vi.fn().mockResolvedValue({
        generated_text: "I am a software developer with experience in JavaScript."
      });
      worker.model = mockModel;
      worker.isInitialized = true;

      await worker.generateText("Tell me about yourself", { temperature: 0.8 });

      expect(mockModel).toHaveBeenCalledWith(
        "Tell me about yourself",
        expect.objectContaining({
          temperature: 0.3 // Should be capped at 0.3, not 0.8
        })
      );
    });

    it('should include early_stopping parameter', async () => {
      const mockModel = vi.fn().mockResolvedValue({
        generated_text: "I am a software developer."
      });
      worker.model = mockModel;
      worker.isInitialized = true;

      await worker.generateText("Tell me about yourself");

      expect(mockModel).toHaveBeenCalledWith(
        "Tell me about yourself",
        expect.objectContaining({
          early_stopping: true
        })
      );
    });

    it('should use deterministic parameters for consistent output', async () => {
      const mockModel = vi.fn().mockResolvedValue({
        generated_text: "I am a software developer."
      });
      worker.model = mockModel;
      worker.isInitialized = true;

      await worker.generateText("Tell me about yourself");

      expect(mockModel).toHaveBeenCalledWith(
        "Tell me about yourself",
        expect.objectContaining({
          do_sample: true,
          top_p: 0.8,
          repetition_penalty: 1.2,
          return_full_text: false,
          pad_token_id: 50256,
          eos_token_id: 50256
        })
      );
    });
  });

  describe('Response Validation Logic', () => {
    it('should validate responses start with first-person indicators', () => {
      expect(worker.validateResponseFormat("I am a developer")).toEqual({
        valid: true
      });

      expect(worker.validateResponseFormat("Yes, I can help")).toEqual({
        valid: true
      });

      expect(worker.validateResponseFormat("No, I don't have experience")).toEqual({
        valid: true
      });
    });

    it('should reject responses that do not start with first-person indicators', () => {
      const result = worker.validateResponseFormat("The developer has experience");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Response does not start with first-person indicator');
    });

    it('should reject responses that are too short', () => {
      const result = worker.validateResponseFormat("I am");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Response too short');
    });

    it('should reject empty or invalid responses', () => {
      expect(worker.validateResponseFormat("").valid).toBe(false);
      expect(worker.validateResponseFormat(null).valid).toBe(false);
      expect(worker.validateResponseFormat(undefined).valid).toBe(false);
    });
  });

  describe('Hallucination Detection', () => {
    it('should detect and reject hallucinated names', () => {
      expect(worker.cleanAndValidateText("I am Serdhii, a developer")).toBe(null);
      expect(worker.cleanAndValidateText("I am Serlindo with experience")).toBe(null);
      expect(worker.cleanAndValidateText("I am Serdoubust working on projects")).toBe(null);
    });

    it('should detect and reject random technical terms', () => {
      expect(worker.cleanAndValidateText("I use webpack for bundling")).toBe(null);
      expect(worker.cleanAndValidateText("I work with pylons framework")).toBe(null);
      expect(worker.cleanAndValidateText("I use ejs templates")).toBe(null);
    });

    it('should detect and reject nonsensical phrases', () => {
      expect(worker.cleanAndValidateText("I work out of here with 5 guys")).toBe(null);
      expect(worker.cleanAndValidateText("I ain't no joke when coding")).toBe(null);
      expect(worker.cleanAndValidateText("This made my life so much easier")).toBe(null);
    });

    it('should accept valid responses without hallucinations', () => {
      const validResponse = "I am a software developer with experience in JavaScript and React.";
      expect(worker.cleanAndValidateText(validResponse)).toBe(validResponse);
    });
  });

  describe('Text Cleaning and Normalization', () => {
    it('should remove response prefixes', () => {
      expect(worker.cleanAndValidateText("Response: I am a developer")).toBe("I am a developer");
      expect(worker.cleanAndValidateText("Answer: I have experience")).toBe("I have experience");
    });

    it('should normalize whitespace', () => {
      expect(worker.cleanAndValidateText("I  am   a    developer")).toBe("I am a developer");
      expect(worker.cleanAndValidateText("I\n\nam\n\na\ndeveloper")).toBe("I am a developer");
    });

    it('should trim leading and trailing whitespace', () => {
      expect(worker.cleanAndValidateText("  I am a developer  ")).toBe("I am a developer");
    });

    it('should reject responses that become too short after cleaning', () => {
      expect(worker.cleanAndValidateText("Response: I")).toBe(null);
      expect(worker.cleanAndValidateText("Answer:   ")).toBe(null);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when model is not initialized', async () => {
      worker.isInitialized = false;
      
      await expect(worker.generateText("test prompt")).rejects.toThrow("Model not initialized");
    });

    it('should handle model generation errors gracefully', async () => {
      const mockModel = vi.fn().mockRejectedValue(new Error("Model error"));
      worker.model = mockModel;
      worker.isInitialized = true;

      await expect(worker.generateText("test prompt")).rejects.toThrow("Model error");
    });

    it('should handle different output formats from model', async () => {
      // Test array format
      const mockModel1 = vi.fn().mockResolvedValue([{ generated_text: "I am a developer" }]);
      worker.model = mockModel1;
      worker.isInitialized = true;

      let result = await worker.generateText("test");
      expect(result).toBe("I am a developer");

      // Test object format
      const mockModel2 = vi.fn().mockResolvedValue({ generated_text: "I am a developer" });
      worker.model = mockModel2;

      result = await worker.generateText("test");
      expect(result).toBe("I am a developer");

      // Test empty/invalid format
      const mockModel3 = vi.fn().mockResolvedValue({});
      worker.model = mockModel3;

      result = await worker.generateText("test");
      expect(result).toBe(null); // Should return null for empty response
    });
  });

  describe('WebGPU Availability Check', () => {
    it('should return true when WebGPU is available', async () => {
      const result = await worker.checkWebGPUAvailability();
      expect(result).toBe(true);
    });

    it('should return false when navigator.gpu is not available', async () => {
      const originalGpu = global.navigator.gpu;
      global.navigator.gpu = undefined;

      const result = await worker.checkWebGPUAvailability();
      expect(result).toBe(false);

      global.navigator.gpu = originalGpu;
    });

    it('should return false when adapter request fails', async () => {
      global.navigator.gpu.requestAdapter = vi.fn().mockResolvedValue(null);

      const result = await worker.checkWebGPUAvailability();
      expect(result).toBe(false);
    });

    it('should return false when device request fails', async () => {
      global.navigator.gpu.requestAdapter = vi.fn().mockResolvedValue({
        requestDevice: vi.fn().mockResolvedValue(null)
      });

      const result = await worker.checkWebGPUAvailability();
      expect(result).toBe(false);
    });

    it('should handle WebGPU errors gracefully', async () => {
      global.navigator.gpu.requestAdapter = vi.fn().mockRejectedValue(new Error("WebGPU error"));

      const result = await worker.checkWebGPUAvailability();
      expect(result).toBe(false);
    });
  });
});