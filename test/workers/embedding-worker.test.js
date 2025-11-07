/**
 * Tests for Enhanced Embedding Worker
 * Tests CV data processing, batch embedding generation, and similarity threshold filtering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the worker environment
const mockPostMessage = vi.fn();

// Mock global worker environment
global.self = {
  postMessage: mockPostMessage,
  onmessage: null,
  onerror: null,
  onunhandledrejection: null
};

// Mock transformers library
const mockPipeline = vi.fn();

vi.mock('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js', () => ({
  pipeline: mockPipeline
}));

// Mock embedding service functions (extracted from worker for testing)
class EmbeddingWorkerService {
  constructor() {
    this.embeddingService = null;
    this.isInitialized = false;
    this.DEFAULT_CONFIG = {
      modelName: 'Xenova/distilbert-base-uncased',
      quantized: true,
      device: 'auto',
      dtype: 'fp32',
      pooling: 'mean',
      normalize: true
    };
  }

  async initializeEmbeddingService(config = {}) {
    if (this.isInitialized) return;

    const initializationConfig = { ...this.DEFAULT_CONFIG, ...config };

    try {
      const mockModel = vi.fn().mockResolvedValue({
        data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
      });

      this.embeddingService = {
        model: mockModel,
        cache: new Map(),
        config: initializationConfig
      };

      this.isInitialized = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  sanitizeText(text) {
    if (typeof text !== 'string') {
      throw new Error('Text must be a string');
    }

    text = text.trim();

    if (text.length === 0) {
      throw new Error('Text cannot be empty');
    }

    if (text.length > 10000) {
      text = text.substring(0, 10000);
    }

    return text;
  }

  async generateEmbedding(text, requestId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input');
    }

    const cacheKey = this.hashText(text);
    if (this.embeddingService.cache.has(cacheKey)) {
      const cachedEmbedding = this.embeddingService.cache.get(cacheKey);
      return {
        type: 'embedding',
        requestId,
        success: true,
        embedding: Array.from(cachedEmbedding),
        cached: true
      };
    }

    const output = await this.embeddingService.model(text, {
      pooling: 'mean',
      normalize: true
    });

    let embedding;
    if (output.data) {
      embedding = new Float32Array(output.data);
    } else if (Array.isArray(output)) {
      embedding = new Float32Array(output);
    } else {
      embedding = new Float32Array(output);
    }

    this.embeddingService.cache.set(cacheKey, embedding);

    return {
      type: 'embedding',
      requestId,
      success: true,
      embedding: Array.from(embedding),
      cached: false
    };
  }

  async processCVSections(cvSections, requestId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    if (!Array.isArray(cvSections) || cvSections.length === 0) {
      throw new Error('Invalid CV sections input - must be non-empty array');
    }

    const processedSections = [];

    for (let i = 0; i < cvSections.length; i++) {
      const section = cvSections[i];

      if (!section || typeof section !== 'object') {
        continue;
      }

      let textContent = '';

      if (section.keywords && Array.isArray(section.keywords)) {
        textContent += section.keywords.join(' ') + ' ';
      }

      if (section.responses) {
        const response = section.responses.developer ||
                        section.responses.hr ||
                        section.responses.friend || '';
        textContent += response;
      }

      if (section.details && typeof section.details === 'object') {
        const detailsText = Object.values(section.details)
          .filter(value => typeof value === 'string')
          .join(' ');
        textContent += ' ' + detailsText;
      }

      if (!textContent.trim()) {
        continue;
      }

      const sanitizedText = this.sanitizeText(textContent);
      const cacheKey = this.hashText(sanitizedText);

      let embedding;
      let cached = false;

      if (this.embeddingService.cache.has(cacheKey)) {
        embedding = Array.from(this.embeddingService.cache.get(cacheKey));
        cached = true;
      } else {
        const output = await this.embeddingService.model(sanitizedText, {
          pooling: 'mean',
          normalize: true
        });

        let embeddingArray;
        if (output.data) {
          embeddingArray = new Float32Array(output.data);
        } else if (Array.isArray(output)) {
          embeddingArray = new Float32Array(output);
        } else {
          embeddingArray = new Float32Array(output);
        }

        this.embeddingService.cache.set(cacheKey, embeddingArray);
        embedding = Array.from(embeddingArray);
        cached = false;
      }

      processedSections.push({
        id: section.id || `section_${i}`,
        embedding,
        cached,
        textLength: sanitizedText.length,
        originalSection: section
      });
    }

    return {
      type: 'cvSectionsProcessed',
      requestId,
      success: true,
      processedSections,
      totalProcessed: processedSections.length,
      totalInput: cvSections.length
    };
  }

  filterBySimilarityThreshold(similarities, threshold, requestId) {
    if (!Array.isArray(similarities)) {
      throw new Error('Similarities must be an array');
    }

    if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be a number between 0 and 1');
    }

    const filteredSimilarities = similarities.filter(item => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }

      const score = item.similarity || item.score || item.similarityScore;

      if (typeof score !== 'number') {
        return false;
      }

      return score >= threshold;
    });

    filteredSimilarities.sort((a, b) => {
      const scoreA = a.similarity || a.score || a.similarityScore || 0;
      const scoreB = b.similarity || b.score || b.similarityScore || 0;
      return scoreB - scoreA;
    });

    return {
      type: 'similaritiesFiltered',
      requestId,
      success: true,
      filteredSimilarities,
      originalCount: similarities.length,
      filteredCount: filteredSimilarities.length,
      threshold
    };
  }

  calculateSimilarity(embedding1, embedding2, requestId) {
    if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
      throw new Error('Embeddings must be arrays');
    }

    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    if (embedding1.length === 0) {
      throw new Error('Embeddings cannot be empty');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    const similarity = magnitude === 0 ? 0 : dotProduct / magnitude;

    return {
      type: 'similarity',
      requestId,
      success: true,
      similarity,
      dimensions: embedding1.length
    };
  }
}

describe('EmbeddingWorker - Enhanced CV Integration', () => {
  let worker;

  beforeEach(async () => {
    worker = new EmbeddingWorkerService();
    await worker.initializeEmbeddingService();
    mockPostMessage.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CV Data Processing', () => {
    it('should process CV sections and generate embeddings', async () => {
      const cvSections = [
        {
          id: 'experience_1',
          keywords: ['JavaScript', 'React', 'Node.js'],
          responses: {
            developer: 'I have 5 years of experience with JavaScript and React.',
            hr: 'Experienced in modern web development.'
          },
          details: {
            company: 'Tech Corp',
            duration: '2019-2024'
          }
        },
        {
          id: 'skills_1',
          keywords: ['Python', 'Machine Learning'],
          responses: {
            developer: 'I work with Python for data science and ML projects.'
          }
        }
      ];

      const result = await worker.processCVSections(cvSections, 'test-request');

      expect(result.success).toBe(true);
      expect(result.processedSections).toHaveLength(2);
      expect(result.totalProcessed).toBe(2);
      expect(result.totalInput).toBe(2);

      // Check first processed section
      const firstSection = result.processedSections[0];
      expect(firstSection.id).toBe('experience_1');
      expect(firstSection.embedding).toBeInstanceOf(Array);
      expect(firstSection.embedding.length).toBeGreaterThan(0);
      expect(firstSection.textLength).toBeGreaterThan(0);
      expect(firstSection.originalSection).toEqual(cvSections[0]);
    });

    it('should handle sections with different response styles', async () => {
      const cvSections = [
        {
          id: 'test_1',
          responses: {
            developer: 'Developer response'
          }
        },
        {
          id: 'test_2',
          responses: {
            hr: 'HR response'
          }
        },
        {
          id: 'test_3',
          responses: {
            friend: 'Friend response'
          }
        }
      ];

      const result = await worker.processCVSections(cvSections, 'test-request');

      expect(result.success).toBe(true);
      expect(result.processedSections).toHaveLength(3);
    });

    it('should skip sections without valid text content', async () => {
      const cvSections = [
        {
          id: 'valid_section',
          keywords: ['JavaScript'],
          responses: {
            developer: 'Valid response'
          }
        },
        {
          id: 'empty_section',
          keywords: [],
          responses: {}
        },
        {
          id: 'invalid_section'
          // Missing required fields
        }
      ];

      const result = await worker.processCVSections(cvSections, 'test-request');

      expect(result.success).toBe(true);
      expect(result.processedSections).toHaveLength(1);
      expect(result.totalProcessed).toBe(1);
      expect(result.totalInput).toBe(3);
    });

    it('should use caching for duplicate text content', async () => {
      const cvSections = [
        {
          id: 'section_1',
          keywords: ['JavaScript'],
          responses: { developer: 'Same content' }
        },
        {
          id: 'section_2',
          keywords: ['JavaScript'],
          responses: { developer: 'Same content' }
        }
      ];

      const result = await worker.processCVSections(cvSections, 'test-request');

      expect(result.success).toBe(true);
      expect(result.processedSections).toHaveLength(2);
      expect(result.processedSections[0].cached).toBe(false);
      expect(result.processedSections[1].cached).toBe(true);
    });

    it('should handle errors for invalid input', async () => {
      await expect(worker.processCVSections(null, 'test-request'))
        .rejects.toThrow('Invalid CV sections input - must be non-empty array');

      await expect(worker.processCVSections([], 'test-request'))
        .rejects.toThrow('Invalid CV sections input - must be non-empty array');

      await expect(worker.processCVSections('not-array', 'test-request'))
        .rejects.toThrow('Invalid CV sections input - must be non-empty array');
    });
  });

  describe('Similarity Threshold Filtering', () => {
    it('should filter similarities by threshold', () => {
      const similarities = [
        { id: 'item1', similarity: 0.9 },
        { id: 'item2', similarity: 0.7 },
        { id: 'item3', similarity: 0.5 },
        { id: 'item4', similarity: 0.3 }
      ];

      const result = worker.filterBySimilarityThreshold(similarities, 0.6, 'test-request');

      expect(result.success).toBe(true);
      expect(result.filteredSimilarities).toHaveLength(2);
      expect(result.filteredSimilarities[0].similarity).toBe(0.9);
      expect(result.filteredSimilarities[1].similarity).toBe(0.7);
      expect(result.originalCount).toBe(4);
      expect(result.filteredCount).toBe(2);
      expect(result.threshold).toBe(0.6);
    });

    it('should sort filtered results by similarity score descending', () => {
      const similarities = [
        { id: 'item1', similarity: 0.5 },
        { id: 'item2', similarity: 0.9 },
        { id: 'item3', similarity: 0.7 }
      ];

      const result = worker.filterBySimilarityThreshold(similarities, 0.4, 'test-request');

      expect(result.filteredSimilarities).toHaveLength(3);
      expect(result.filteredSimilarities[0].similarity).toBe(0.9);
      expect(result.filteredSimilarities[1].similarity).toBe(0.7);
      expect(result.filteredSimilarities[2].similarity).toBe(0.5);
    });

    it('should handle different similarity property names', () => {
      const similarities = [
        { id: 'item1', score: 0.8 },
        { id: 'item2', similarityScore: 0.6 },
        { id: 'item3', similarity: 0.4 }
      ];

      const result = worker.filterBySimilarityThreshold(similarities, 0.5, 'test-request');

      expect(result.filteredSimilarities).toHaveLength(2);
      expect(result.filteredSimilarities[0].score).toBe(0.8);
      expect(result.filteredSimilarities[1].similarityScore).toBe(0.6);
    });

    it('should filter out invalid similarity objects', () => {
      const similarities = [
        { id: 'valid1', similarity: 0.8 },
        null,
        { id: 'invalid1' }, // No similarity score
        { id: 'invalid2', similarity: 'not-a-number' },
        { id: 'valid2', similarity: 0.6 }
      ];

      const result = worker.filterBySimilarityThreshold(similarities, 0.5, 'test-request');

      expect(result.filteredSimilarities).toHaveLength(2);
      expect(result.filteredSimilarities[0].similarity).toBe(0.8);
      expect(result.filteredSimilarities[1].similarity).toBe(0.6);
    });

    it('should handle threshold validation errors', () => {
      const similarities = [{ id: 'item1', similarity: 0.8 }];

      expect(() => worker.filterBySimilarityThreshold(similarities, -0.1, 'test-request'))
        .toThrow('Threshold must be a number between 0 and 1');

      expect(() => worker.filterBySimilarityThreshold(similarities, 1.1, 'test-request'))
        .toThrow('Threshold must be a number between 0 and 1');

      expect(() => worker.filterBySimilarityThreshold(similarities, 'not-a-number', 'test-request'))
        .toThrow('Threshold must be a number between 0 and 1');
    });

    it('should handle invalid similarities input', () => {
      expect(() => worker.filterBySimilarityThreshold(null, 0.5, 'test-request'))
        .toThrow('Similarities must be an array');

      expect(() => worker.filterBySimilarityThreshold('not-array', 0.5, 'test-request'))
        .toThrow('Similarities must be an array');
    });
  });

  describe('Existing Embedding Operations Compatibility', () => {
    it('should generate single embeddings', async () => {
      const result = await worker.generateEmbedding('Test text for embedding', 'test-request');

      expect(result.success).toBe(true);
      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding.length).toBeGreaterThan(0);
      expect(result.cached).toBe(false);
    });

    it('should use caching for repeated embeddings', async () => {
      const text = 'Test text for caching';

      const result1 = await worker.generateEmbedding(text, 'test-request-1');
      expect(result1.cached).toBe(false);

      const result2 = await worker.generateEmbedding(text, 'test-request-2');
      expect(result2.cached).toBe(true);
      expect(result2.embedding).toEqual(result1.embedding);
    });

    it('should calculate cosine similarity between embeddings', () => {
      const embedding1 = [0.1, 0.2, 0.3, 0.4];
      const embedding2 = [0.2, 0.3, 0.4, 0.5];

      const result = worker.calculateSimilarity(embedding1, embedding2, 'test-request');

      expect(result.success).toBe(true);
      expect(typeof result.similarity).toBe('number');
      expect(result.similarity).toBeGreaterThanOrEqual(-1);
      expect(result.similarity).toBeLessThanOrEqual(1);
      expect(result.dimensions).toBe(4);
    });

    it('should handle similarity calculation errors', () => {
      expect(() => worker.calculateSimilarity(null, [1, 2, 3], 'test-request'))
        .toThrow('Embeddings must be arrays');

      expect(() => worker.calculateSimilarity([1, 2, 3], [1, 2], 'test-request'))
        .toThrow('Embeddings must have the same dimension');

      expect(() => worker.calculateSimilarity([], [], 'test-request'))
        .toThrow('Embeddings cannot be empty');
    });
  });

  describe('Text Sanitization and Validation', () => {
    it('should sanitize text input correctly', () => {
      expect(worker.sanitizeText('  test text  ')).toBe('test text');
      expect(worker.sanitizeText('test')).toBe('test');
    });

    it('should handle text length limits', () => {
      const longText = 'a'.repeat(15000);
      const sanitized = worker.sanitizeText(longText);
      expect(sanitized.length).toBe(10000);
    });

    it('should reject invalid text input', () => {
      expect(() => worker.sanitizeText('')).toThrow('Text cannot be empty');
      expect(() => worker.sanitizeText('   ')).toThrow('Text cannot be empty');
      expect(() => worker.sanitizeText(null)).toThrow('Text must be a string');
      expect(() => worker.sanitizeText(123)).toThrow('Text must be a string');
    });
  });

  describe('Hash Function', () => {
    it('should generate consistent hashes for same text', () => {
      const text = 'test text for hashing';
      const hash1 = worker.hashText(text);
      const hash2 = worker.hashText(text);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different text', () => {
      const hash1 = worker.hashText('text one');
      const hash2 = worker.hashText('text two');
      expect(hash1).not.toBe(hash2);
    });

    it('should return string hash', () => {
      const hash = worker.hashText('test');
      expect(typeof hash).toBe('string');
    });
  });
});