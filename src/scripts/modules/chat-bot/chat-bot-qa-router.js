/**
 * Chat Bot QA Router
 *
 * Orchestrates intent-based routing for question-answering.
 * Routes queries to specialized workers based on intent classification.
 */

import { WorkerCommunicator } from './utils/worker-communicator.js';
import { preprocessQuery, getAdaptiveThreshold } from '../semantic-qa/utils/query-processor.js';
import { findSimilarChunks, applySimilarityThreshold } from '../semantic-qa/utils/similarity-calculator.js';
import { classifyIntent } from './utils/intent-classifier.js';
import { buildCVContext } from '../semantic-qa/utils/cv-context-builder.js';
import { createPrompt } from '../semantic-qa/utils/prompt-builder.js';
import { validateResponseQuality } from '../semantic-qa/utils/response-validator.js';

export class ChatBotQARouter {
  constructor(options = {}) {
    // Configuration with defaults
    this.config = {
      embeddingWorkerPath: options.embeddingWorkerPath || './scripts/workers/embedding-worker.js',
      textGenWorkerPath: options.textGenWorkerPath || './scripts/workers/optimized-ml-worker.js',
      eqaWorkerPath: options.eqaWorkerPath || './scripts/workers/eqa-worker.js',
      maxContextChunks: options.maxContextChunks || 5,
      similarityThreshold: options.similarityThreshold || 0.3,
      eqaConfidenceThreshold: options.eqaConfidenceThreshold || 0.3,
      timeout: options.timeout || 5000,
      onProgress: options.onProgress || null
    };

    // Worker instances
    this.embeddingWorker = null;
    this.textGenWorker = null;
    this.eqaWorker = null;

    // Worker communicators
    this.embeddingCommunicator = null;
    this.textGenCommunicator = null;
    this.eqaCommunicator = null;

    // State management
    this.isInitialized = false;
    this.cvChunks = [];
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;

    // Progress tracking
    this.progressCallback = this.config.onProgress;

    console.log('[ChatBotQARouter] Router initialized with config:', this.config);
  }

  /**
   * Initialize router and all workers with optimized loading sequence
   * @param {Array} cvChunks - CV data chunks for context
   * @returns {Promise} Promise that resolves when initialization is complete
   */
  async initializeRouter(cvChunks = []) {
    const startTime = Date.now();
    console.log('[ChatBotQARouter] Starting initialization with', cvChunks.length, 'chunks');

    try {
      // Step 1: Load embedding worker first (priority - needed for step 4)
      console.log('[ChatBotQARouter] Step 1: Loading embedding worker...');
      const step1Start = Date.now();
      await this.initializeEmbeddingWorker();
      console.log('[ChatBotQARouter] Step 1 complete:', Date.now() - step1Start, 'ms');

      // Steps 2-3: Parallel execution
      console.log('[ChatBotQARouter] Steps 2-3: Parallel context preparation and worker loading...');
      const step23Start = Date.now();
      await Promise.all([
        // Step 2: Index and chunk CV data
        this.prepareContext(cvChunks),

        // Step 3: Load remaining workers
        Promise.all([
          this.initializeTextGenWorker(),
          this.initializeEQAWorker()
        ])
      ]);
      console.log('[ChatBotQARouter] Steps 2-3 complete:', Date.now() - step23Start, 'ms');

      // Step 4: Pre-compute chunk embeddings
      console.log('[ChatBotQARouter] Step 4: Pre-computing chunk embeddings...');
      const step4Start = Date.now();
      await this.precomputeChunkEmbeddings();
      console.log('[ChatBotQARouter] Step 4 complete:', Date.now() - step4Start, 'ms');

      this.isInitialized = true;
      const totalTime = Date.now() - startTime;
      console.log('[ChatBotQARouter] Initialization complete:', totalTime, 'ms');
      console.log('[ChatBotQARouter] Worker ready states:', this.getStatus().workersReady);

    } catch (error) {
      console.error('[ChatBotQARouter] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize embedding worker
   * @returns {Promise} Promise that resolves when worker is ready
   */
  async initializeEmbeddingWorker() {
    console.log('[ChatBotQARouter] Initializing embedding worker...');

    try {
      this.embeddingWorker = new Worker(this.config.embeddingWorkerPath, { type: 'module' });
      console.log('[ChatBotQARouter] Embedding worker created');

      this.embeddingCommunicator = new WorkerCommunicator(
        this.embeddingWorker,
        'embedding',
        this.config.timeout
      );
      console.log('[ChatBotQARouter] Embedding worker communicator created with timeout:', this.config.timeout, 'ms');

      // Listen for download progress
      this.embeddingWorker.addEventListener('message', (event) => {
        if (event.data.type === 'downloadProgress' && this.progressCallback) {
          console.log('[ChatBotQARouter] Embedding download progress:', event.data.progress);
          this.progressCallback('embedding', event.data.progress || 0);
        }
      });

      // Wait for worker ready signal
      console.log('[ChatBotQARouter] Waiting for embedding worker initialization...');
      await this.waitForWorkerReady(this.embeddingWorker, 'embedding');

      // Report 100% when ready
      if (this.progressCallback) {
        this.progressCallback('embedding', 100);
      }

      console.log('[ChatBotQARouter] Embedding worker ready and initialized');
    } catch (error) {
      console.error('[ChatBotQARouter] Embedding worker initialization error:', error);
      throw error;
    }
  }

  /**
   * Initialize text generation worker
   * @returns {Promise} Promise that resolves when worker is ready
   */
  async initializeTextGenWorker() {
    console.log('[ChatBotQARouter] Initializing text generation worker...');

    try {
      this.textGenWorker = new Worker(this.config.textGenWorkerPath, { type: 'module' });
      console.log('[ChatBotQARouter] Text generation worker created');

      this.textGenCommunicator = new WorkerCommunicator(
        this.textGenWorker,
        'textGen',
        this.config.timeout
      );
      console.log('[ChatBotQARouter] Text generation worker communicator created');

      // Listen for download progress
      this.textGenWorker.addEventListener('message', (event) => {
        if (event.data.type === 'progress' && this.progressCallback) {
          // Extract progress from the progress object
          const progressData = event.data.progress;
          if (progressData && progressData.progress !== undefined) {
            console.log('[ChatBotQARouter] Text generation download progress:', progressData.progress);
            this.progressCallback('textGen', progressData.progress);
          }
        }
      });

      // Wait for worker ready signal
      console.log('[ChatBotQARouter] Waiting for text generation worker initialization...');
      await this.waitForWorkerReady(this.textGenWorker, 'textGen');

      // Report 100% when ready
      if (this.progressCallback) {
        this.progressCallback('textGen', 100);
      }

      console.log('[ChatBotQARouter] Text generation worker ready and initialized');
    } catch (error) {
      console.error('[ChatBotQARouter] Text generation worker initialization error:', error);
      throw error;
    }
  }

  /**
   * Initialize EQA worker
   * @returns {Promise} Promise that resolves when worker is ready
   */
  async initializeEQAWorker() {
    console.log('[ChatBotQARouter] Initializing EQA worker...');

    try {
      this.eqaWorker = new Worker(this.config.eqaWorkerPath, { type: 'module' });
      console.log('[ChatBotQARouter] EQA worker created');

      this.eqaCommunicator = new WorkerCommunicator(
        this.eqaWorker,
        'eqa',
        this.config.timeout
      );
      console.log('[ChatBotQARouter] EQA worker communicator created');

      // Listen for download progress
      this.eqaWorker.addEventListener('message', (event) => {
        if (event.data.type === 'downloadProgress' && this.progressCallback) {
          console.log('[ChatBotQARouter] EQA download progress:', event.data.progress);
          this.progressCallback('eqa', event.data.progress || 0);
        }
      });

      // Wait for worker ready signal
      console.log('[ChatBotQARouter] Waiting for EQA worker initialization...');
      await this.waitForWorkerReady(this.eqaWorker, 'eqa');

      // Report 100% when ready
      if (this.progressCallback) {
        this.progressCallback('eqa', 100);
      }

      console.log('[ChatBotQARouter] EQA worker ready and initialized');
    } catch (error) {
      console.error('[ChatBotQARouter] EQA worker initialization error:', error);
      throw error;
    }
  }

  /**
   * Wait for worker to signal ready state
   * @param {Worker} worker - Worker instance
   * @param {string} workerType - Type of worker for logging
   * @returns {Promise} Promise that resolves when worker is ready
   */
  waitForWorkerReady(worker, workerType) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`[ChatBotQARouter] ${workerType} worker initialization timeout after 30s`);
        reject(new Error(`${workerType} worker initialization timeout`));
      }, 30000); // 30 second timeout for model loading

      const messageHandler = (event) => {
        console.log(`[ChatBotQARouter] ${workerType} worker message:`, event.data.type, event.data);

        // Workers send different ready signals:
        // - 'ready' (textGen worker)
        // - 'initialized' (embedding/eqa workers)
        // - 'workerReady' (all workers on script load, but not model ready)
        if (event.data.type === 'ready' || event.data.type === 'initialized') {
          if (event.data.success) {
            clearTimeout(timeout);
            worker.removeEventListener('message', messageHandler);
            console.log(`[ChatBotQARouter] ${workerType} worker signaled ready successfully`);
            resolve();
          } else {
            clearTimeout(timeout);
            worker.removeEventListener('message', messageHandler);
            console.error(`[ChatBotQARouter] ${workerType} worker initialization failed:`, event.data.error);
            reject(new Error(`${workerType} worker initialization failed: ${event.data.error}`));
          }
        }
      };

      worker.addEventListener('message', messageHandler);
      console.log(`[ChatBotQARouter] Waiting for ${workerType} worker to be ready...`);
    });
  }

  /**
   * Prepare context chunks
   * @param {Array} cvChunks - CV data chunks
   */
  async prepareContext(cvChunks) {
    console.log('[ChatBotQARouter] Preparing context with', cvChunks.length, 'chunks');
    console.log('[ChatBotQARouter] prepareContext - First 3 chunks embedding status:',
      cvChunks.slice(0, 3).map(c => ({
        id: c.id,
        hasEmbedding: !!c.embedding,
        embeddingType: typeof c.embedding,
        isArray: Array.isArray(c.embedding)
      }))
    );
    this.cvChunks = cvChunks;
    console.log('[ChatBotQARouter] prepareContext - Stored chunks, verifying first 3:',
      this.cvChunks.slice(0, 3).map(c => ({
        id: c.id,
        hasEmbedding: !!c.embedding,
        embeddingType: typeof c.embedding,
        isArray: Array.isArray(c.embedding)
      }))
    );
  }

  /**
   * Pre-compute embeddings for all chunks
   * @returns {Promise} Promise that resolves when embeddings are computed
   */
  async precomputeChunkEmbeddings() {
    console.log('[ChatBotQARouter] Pre-computing embeddings for', this.cvChunks.length, 'chunks');
    console.log('[ChatBotQARouter] precomputeChunkEmbeddings - BEFORE filter, first 3 chunks:',
      this.cvChunks.slice(0, 3).map(c => ({
        id: c.id,
        hasEmbedding: !!c.embedding,
        embeddingType: typeof c.embedding,
        isArray: Array.isArray(c.embedding),
        embeddingValue: c.embedding
      }))
    );

    // Check if chunks already have embeddings
    const chunksNeedingEmbeddings = this.cvChunks.filter(chunk => !chunk.embedding);

    // Batch embed chunks
    const texts = chunksNeedingEmbeddings.map(chunk => chunk.text);
    const response = await this.embeddingCommunicator.sendMessage('generateBatchEmbeddings', { texts });

    if (response.embeddings) {
      // Assign embeddings to chunks
      chunksNeedingEmbeddings.forEach((chunk, index) => {
        chunk.embedding = response.embeddings[index];
      });

      this.cvChunks.slice(0, 3).map(c => ({
        id: c.id,
        hasEmbedding: !!c.embedding,
        embeddingType: typeof c.embedding,
        isArray: Array.isArray(c.embedding),
        embeddingLength: c.embedding?.length
      }));
    }
  }

  /**
   * Generate embedding for query using embedding worker
   * @param {string} text - Text to embed
   * @returns {Promise<Float32Array>} Query embedding
   */
  async generateEmbedding(text) {
    try {
      const response = await this.embeddingCommunicator.sendMessage('generateBatchEmbeddings', {
        texts: [text]
      });

      if (response.success && response.embeddings && response.embeddings.length > 0) {
        return response.embeddings[0];
      } else {
        throw new Error('Failed to generate embedding');
      }
    } catch (error) {
      console.error('[ChatBotQARouter] Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Extract answer using EQA worker
   * @param {string} question - Question to answer
   * @param {string} context - Context for answer extraction
   * @returns {Promise<Object>} EQA response with answer and confidence
   */
  async extractAnswer(question, context) {
    try {
      const response = await this.eqaCommunicator.sendMessage('extractAnswer', {
        question,
        context
      });

      return response;
    } catch (error) {
      console.error('[ChatBotQARouter] EQA extraction failed:', error);
      throw error;
    }
  }

  /**
   * Generate response using text generation worker
   * @param {string} prompt - Prompt for text generation
   * @returns {Promise<Object>} Generated response
   */
  async generateResponse(prompt) {
    try {
      const response = await this.textGenCommunicator.sendMessage('generate', {
        prompt
      });

      return response;
    } catch (error) {
      console.error('[ChatBotQARouter] Text generation failed:', error);
      throw error;
    }
  }

  /**
   * Process query through pipeline (Steps 5-7)
   * @param {string} question - User question
   * @param {Array} conversationContext - Conversation context
   * @returns {Promise<Object>} Processing result with enhanced query and similar chunks
   */
  async processQueryPipeline(question, conversationContext = []) {
    const startTime = Date.now();

    // Step 5: Query preprocessing
    const step5Start = Date.now();
    const enhancedQuery = preprocessQuery(question, conversationContext);
    const step5Time = Date.now() - step5Start;

    // Step 6: Generate query embedding
    const step6Start = Date.now();

    const queryEmbedding = await this.generateEmbedding(enhancedQuery);
    const step6Time = Date.now() - step6Start;

    // Step 7: Find similar chunks
    const step7Start = Date.now();
    const similarChunks = findSimilarChunks(
      queryEmbedding,
      this.cvChunks,
      this.config.maxContextChunks
    );

    const step7Time = Date.now() - step7Start;
    const totalTime = Date.now() - startTime;

    return {
      originalQuery: question,
      enhancedQuery,
      queryEmbedding,
      similarChunks,
      metrics: {
        preprocessingTime: step5Time,
        embeddingTime: step6Time,
        retrievalTime: step7Time,
        totalPipelineTime: totalTime
      }
    };
  }

  /**
   * Route query based on intent classification (Step 8)
   * @param {string} enhancedQuery - Enhanced query from preprocessing
   * @param {Array} similarChunks - Similar chunks from retrieval
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Response from appropriate path
   */
  async routeByIntent(enhancedQuery, similarChunks, options = {}) {
    // Classify intent
    const intent = classifyIntent(enhancedQuery);

    // Route based on intent
    if (intent === 'fact_retrieval') {
      return await this.processFactRetrievalPath(enhancedQuery, similarChunks, options);
    } else {
      return await this.processConversationalPath(enhancedQuery, similarChunks, options);
    }
  }

  /**
   * Process fact retrieval path (Step 9a)
   * @param {string} question - User question
   * @param {Array} similarChunks - Similar chunks from retrieval
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Fact retrieval response
   */
  async processFactRetrievalPath(question, similarChunks, options = {}) {
    const startTime = Date.now();

    // Combine similar chunks into single context string
    const context = similarChunks
      .map(chunk => chunk.text)
      .join(' ');

    try {
      // Call EQA worker
      const eqaResponse = await this.extractAnswer(question, context);
      const eqaTime = Date.now() - startTime;

      // Check for empty answer
      if (!eqaResponse.answer || eqaResponse.answer.trim().length === 0) {
        return await this.processConversationalPath(question, similarChunks, options);
      }

      // Check answer quality - reject very short or suspicious answers
      const answerLength = eqaResponse.answer.trim().length;

      if (answerLength < 2) {
        return await this.processConversationalPath(question, similarChunks, options);
      }

      // Check confidence threshold (lowered to 0.05 as EQA models often have low confidence)
      if (eqaResponse.confidence < this.config.eqaConfidenceThreshold) {
        return await this.processConversationalPath(question, similarChunks, options);
      }

      // Return successful EQA response
      return {
        answer: eqaResponse.answer,
        confidence: eqaResponse.confidence,
        intent: 'fact_retrieval',
        method: 'eqa',
        matchedChunks: similarChunks,
        processingTime: eqaTime
      };

    } catch (error) {
      console.error('[ChatBotQARouter] EQA error:', error);

      return await this.processConversationalPath(question, similarChunks, options);
    }
  }

  /**
   * Process conversational synthesis path (Step 9b)
   * @param {string} question - User question
   * @param {Array} similarChunks - Similar chunks from retrieval
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Conversational response
   */
  async processConversationalPath(question, similarChunks, options = {}) {
    const startTime = Date.now();
    const style = options.style || 'developer';
    const conversationContext = options.context || [];

    // Apply similarity threshold filtering
    const threshold = getAdaptiveThreshold(question);
    const filteredChunks = applySimilarityThreshold(similarChunks, {
      baseThreshold: threshold,
      maxResults: this.config.maxContextChunks
    });

    // Check if we have any relevant context
    if (filteredChunks.length === 0) {
      return {
        answer: "I don't have enough information to answer that question.",
        confidence: 0,
        intent: 'conversational_synthesis',
        method: 'fallback',
        matchedChunks: [],
        processingTime: Date.now() - startTime
      };
    }

    // Build CV context
    const cvContext = buildCVContext(filteredChunks, style);

    if (!cvContext) {
      return {
        answer: "I don't have enough information to answer that question.",
        confidence: 0,
        intent: 'conversational_synthesis',
        method: 'fallback',
        matchedChunks: filteredChunks,
        processingTime: Date.now() - startTime
      };
    }

    // Create prompt
    const prompt = createPrompt(question, cvContext, style, conversationContext);

    try {
      // Generate response
      const response = await this.generateResponse(prompt);
      const generationTime = Date.now() - startTime;

      return {
        answer: response.text || response.answer || '',
        confidence: response.confidence || 0.8,
        intent: 'conversational_synthesis',
        method: 'generation',
        matchedChunks: filteredChunks,
        processingTime: generationTime
      };

    } catch (error) {
      console.error('[ChatBotQARouter] Text generation error:', error);
      return {
        answer: "I encountered an error generating a response. Please try again.",
        confidence: 0,
        intent: 'conversational_synthesis',
        method: 'error',
        matchedChunks: filteredChunks,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Format and validate response (Step 10)
   * @param {Object} response - Raw response from processing path
   * @param {string} originalQuery - Original user query
   * @param {Object} metrics - Processing metrics
   * @returns {Object} Formatted and validated response
   */
  formatAndValidateResponse(response, originalQuery, metrics = {}) {
    // Skip validation for EQA responses - they are naturally short and direct
    // EQA extracts exact answers from context, so short responses are expected and valid
    const skipValidation = response.method === 'eqa';

    let validated;
    if (skipValidation) {
      validated = {
        answer: response.answer,
        confidence: response.confidence,
        matchedSections: response.matchedChunks,
        metrics: {
          qualityScore: response.confidence,
          qualityFlags: []
        }
      };
    } else {
      // Validate response quality for conversational responses
      validated = validateResponseQuality(
        {
          answer: response.answer,
          confidence: response.confidence,
          matchedSections: response.matchedChunks,
          metrics: response.metrics || {}
        },
        originalQuery
      );
    }

    // Calculate total processing time
    const totalTime = metrics.totalPipelineTime + (response.processingTime || 0);

    // Format final response
    const formattedResponse = {
      answer: validated.answer,
      confidence: validated.confidence,
      intent: response.intent,
      method: response.method,
      matchedChunks: response.matchedChunks || [],
      processingTime: totalTime,
      metrics: {
        preprocessingTime: metrics.preprocessingTime || 0,
        embeddingTime: metrics.embeddingTime || 0,
        retrievalTime: metrics.retrievalTime || 0,
        generationTime: response.processingTime || 0,
        totalTime: totalTime,
        qualityScore: validated.metrics.qualityScore,
        qualityFlags: validated.metrics.qualityFlags || []
      }
    };

    return formattedResponse;
  }

  /**
   * Format error response
   * @param {Error} error - Error object
   * @param {string} originalQuery - Original user query
   * @returns {Object} Formatted error response
   */
  formatErrorResponse(error, originalQuery) {
    console.error('[ChatBotQARouter] Formatting error response:', error);

    return {
      answer: "I encountered an error processing your question. Please try again.",
      confidence: 0,
      intent: 'unknown',
      method: 'error',
      matchedChunks: [],
      processingTime: 0,
      metrics: {
        error: error.message,
        totalTime: 0
      }
    };
  }

  /**
   * Process user query (main entry point)
   * @param {string} question - User question
   * @param {Object} options - Processing options (style, context)
   * @returns {Promise<Object>} Processed response
   */
  async processQuery(question, options = {}) {
    const startTime = Date.now();

    if (!this.isInitialized) {
      console.error('[ChatBotQARouter] Router not initialized');

      return this.formatErrorResponse(
        new Error('Router not initialized'),
        question
      );
    }

    try {
      // Steps 5-7: Query processing pipeline
      const pipelineResult = await this.processQueryPipeline(
        question,
        options.context || []
      );

      // Step 8: Intent-based routing (includes Steps 9a/9b)
      const response = await this.routeByIntent(
        pipelineResult.enhancedQuery,
        pipelineResult.similarChunks,
        options
      );

      // Step 10: Format and validate response
      const finalResponse = this.formatAndValidateResponse(
        response,
        question,
        pipelineResult.metrics
      );

      return finalResponse;

    } catch (error) {
      console.error('[ChatBotQARouter] Query processing error:', error);
      return this.formatErrorResponse(error, question);
    }
  }

  /**
   * Generate unique request ID
   * @returns {string} Unique request identifier
   */
  generateRequestId() {
    return `req_${Date.now()}_${++this.requestIdCounter}`;
  }

  /**
   * Get router status
   * @returns {Object} Current router status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      workersReady: {
        embedding: this.embeddingWorker !== null,
        textGen: this.textGenWorker !== null,
        eqa: this.eqaWorker !== null
      },
      chunksLoaded: this.cvChunks.length,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Cleanup and terminate all workers
   */
  cleanup() {
    // Clear pending requests
    if (this.pendingRequests.size > 0) {
      this.pendingRequests.clear();
    }

    // Terminate workers using communicators
    if (this.embeddingCommunicator) {
      this.embeddingCommunicator.terminate();
      this.embeddingCommunicator = null;
      this.embeddingWorker = null;
    }

    if (this.textGenCommunicator) {
      this.textGenCommunicator.terminate();
      this.textGenCommunicator = null;
      this.textGenWorker = null;
    }

    if (this.eqaCommunicator) {
      this.eqaCommunicator.terminate();
      this.eqaCommunicator = null;
      this.eqaWorker = null;
    }

    // Reset state
    this.isInitialized = false;
    this.cvChunks = [];
  }
}
