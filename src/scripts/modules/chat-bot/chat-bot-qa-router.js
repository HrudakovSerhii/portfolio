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
  async initialize(cvChunks = []) {
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
    
    this.embeddingWorker = new Worker(this.config.embeddingWorkerPath, { type: 'module' });
    this.embeddingCommunicator = new WorkerCommunicator(
      this.embeddingWorker,
      'embedding',
      this.config.timeout
    );

    // Listen for download progress
    this.embeddingWorker.addEventListener('message', (event) => {
      if (event.data.type === 'downloadProgress' && this.progressCallback) {
        this.progressCallback('embedding', event.data.progress || 0);
      }
    });

    // Wait for worker ready signal
    await this.waitForWorkerReady(this.embeddingWorker, 'embedding');
    
    // Report 100% when ready
    if (this.progressCallback) {
      this.progressCallback('embedding', 100);
    }
    
    console.log('[ChatBotQARouter] Embedding worker ready');
  }

  /**
   * Initialize text generation worker
   * @returns {Promise} Promise that resolves when worker is ready
   */
  async initializeTextGenWorker() {
    console.log('[ChatBotQARouter] Initializing text generation worker...');
    
    this.textGenWorker = new Worker(this.config.textGenWorkerPath, { type: 'module' });
    this.textGenCommunicator = new WorkerCommunicator(
      this.textGenWorker,
      'textGen',
      this.config.timeout
    );

    // Listen for download progress
    this.textGenWorker.addEventListener('message', (event) => {
      if (event.data.type === 'progress' && this.progressCallback) {
        // Extract progress from the progress object
        const progressData = event.data.progress;
        if (progressData && progressData.progress !== undefined) {
          this.progressCallback('textGen', progressData.progress);
        }
      }
    });

    // Wait for worker ready signal
    await this.waitForWorkerReady(this.textGenWorker, 'textGen');
    
    // Report 100% when ready
    if (this.progressCallback) {
      this.progressCallback('textGen', 100);
    }
    
    console.log('[ChatBotQARouter] Text generation worker ready');
  }

  /**
   * Initialize EQA worker
   * @returns {Promise} Promise that resolves when worker is ready
   */
  async initializeEQAWorker() {
    console.log('[ChatBotQARouter] Initializing EQA worker...');
    
    this.eqaWorker = new Worker(this.config.eqaWorkerPath, { type: 'module' });
    this.eqaCommunicator = new WorkerCommunicator(
      this.eqaWorker,
      'eqa',
      this.config.timeout
    );

    // Listen for download progress
    this.eqaWorker.addEventListener('message', (event) => {
      if (event.data.type === 'downloadProgress' && this.progressCallback) {
        this.progressCallback('eqa', event.data.progress || 0);
      }
    });

    // Wait for worker ready signal
    await this.waitForWorkerReady(this.eqaWorker, 'eqa');
    
    // Report 100% when ready
    if (this.progressCallback) {
      this.progressCallback('eqa', 100);
    }
    
    console.log('[ChatBotQARouter] EQA worker ready');
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
        reject(new Error(`${workerType} worker initialization timeout`));
      }, 30000); // 30 second timeout for model loading

      const messageHandler = (event) => {
        if (event.data.type === 'ready') {
          clearTimeout(timeout);
          worker.removeEventListener('message', messageHandler);
          console.log(`[ChatBotQARouter] ${workerType} worker signaled ready`);
          resolve();
        }
      };

      worker.addEventListener('message', messageHandler);
    });
  }

  /**
   * Prepare context chunks
   * @param {Array} cvChunks - CV data chunks
   */
  async prepareContext(cvChunks) {
    console.log('[ChatBotQARouter] Preparing context with', cvChunks.length, 'chunks');
    this.cvChunks = cvChunks;
  }

  /**
   * Pre-compute embeddings for all chunks
   * @returns {Promise} Promise that resolves when embeddings are computed
   */
  async precomputeChunkEmbeddings() {
    console.log('[ChatBotQARouter] Pre-computing embeddings for', this.cvChunks.length, 'chunks');
    
    // Check if chunks already have embeddings
    const chunksNeedingEmbeddings = this.cvChunks.filter(chunk => !chunk.embedding);
    
    if (chunksNeedingEmbeddings.length === 0) {
      console.log('[ChatBotQARouter] All chunks already have embeddings');
      return;
    }

    console.log('[ChatBotQARouter] Computing embeddings for', chunksNeedingEmbeddings.length, 'chunks');
    
    // Batch embed chunks
    const texts = chunksNeedingEmbeddings.map(chunk => chunk.text);
    const response = await this.embeddingCommunicator.sendMessage('embed', { texts });
    
    if (response.embeddings) {
      // Assign embeddings to chunks
      chunksNeedingEmbeddings.forEach((chunk, index) => {
        chunk.embedding = response.embeddings[index];
      });
      console.log('[ChatBotQARouter] Chunk embeddings computed successfully');
    }
  }

  /**
   * Generate embedding for query using embedding worker
   * @param {string} text - Text to embed
   * @returns {Promise<Float32Array>} Query embedding
   */
  async generateEmbedding(text) {
    console.log('[ChatBotQARouter] Generating embedding for query');
    
    try {
      const response = await this.embeddingCommunicator.sendMessage('embed', { 
        texts: [text] 
      });
      
      if (response.success && response.embeddings && response.embeddings.length > 0) {
        console.log('[ChatBotQARouter] Embedding generated successfully, dimensions:', response.embeddings[0].length);
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
    console.log('[ChatBotQARouter] Extracting answer from EQA worker');
    console.log('[ChatBotQARouter] Context length:', context.length);
    
    try {
      const response = await this.eqaCommunicator.sendMessage('extractAnswer', {
        question,
        context
      });
      
      console.log('[ChatBotQARouter] EQA response:', {
        answer: response.answer,
        confidence: response.confidence
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
    console.log('[ChatBotQARouter] Generating response from text generation worker');
    console.log('[ChatBotQARouter] Prompt length:', prompt.length);
    
    try {
      const response = await this.textGenCommunicator.sendMessage('generate', {
        prompt
      });
      
      console.log('[ChatBotQARouter] Text generation response received');
      
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
    console.log('[ChatBotQARouter] Starting query processing pipeline');
    console.log('[ChatBotQARouter] Original query:', question);

    // Step 5: Query preprocessing
    const step5Start = Date.now();
    const enhancedQuery = preprocessQuery(question, conversationContext);
    const step5Time = Date.now() - step5Start;
    console.log('[ChatBotQARouter] Step 5 - Enhanced query:', enhancedQuery);
    console.log('[ChatBotQARouter] Step 5 timing:', step5Time, 'ms');

    // Step 6: Generate query embedding
    const step6Start = Date.now();
    const queryEmbedding = await this.generateEmbedding(enhancedQuery);
    const step6Time = Date.now() - step6Start;
    console.log('[ChatBotQARouter] Step 6 - Embedding dimensions:', queryEmbedding.length);
    console.log('[ChatBotQARouter] Step 6 timing:', step6Time, 'ms');

    // Step 7: Find similar chunks
    const step7Start = Date.now();
    const similarChunks = findSimilarChunks(
      queryEmbedding,
      this.cvChunks,
      this.config.maxContextChunks
    );
    const step7Time = Date.now() - step7Start;
    console.log('[ChatBotQARouter] Step 7 - Similar chunks found:', similarChunks.length);
    similarChunks.forEach((chunk, idx) => {
      console.log(`[ChatBotQARouter] Chunk ${idx + 1}:`, {
        id: chunk.id,
        similarity: chunk.similarity.toFixed(4),
        weightedSimilarity: chunk.weightedSimilarity.toFixed(4)
      });
    });
    console.log('[ChatBotQARouter] Step 7 timing:', step7Time, 'ms');

    const totalTime = Date.now() - startTime;
    console.log('[ChatBotQARouter] Query pipeline complete:', totalTime, 'ms');

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
    console.log('[ChatBotQARouter] Step 8: Intent-based routing');

    // Classify intent
    const intent = classifyIntent(enhancedQuery);
    console.log('[ChatBotQARouter] Intent classification result:', intent);
    console.log('[ChatBotQARouter] Routing decision: Route to', intent === 'fact_retrieval' ? 'fact retrieval path' : 'conversational synthesis path');

    // Route based on intent
    if (intent === 'fact_retrieval') {
      console.log('[ChatBotQARouter] Path taken: Fact Retrieval (Step 9a)');
      return await this.processFactRetrievalPath(enhancedQuery, similarChunks, options);
    } else {
      console.log('[ChatBotQARouter] Path taken: Conversational Synthesis (Step 9b)');
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
    console.log('[ChatBotQARouter] Step 9a: Fact Retrieval Path');

    // Combine similar chunks into single context string
    const context = similarChunks
      .map(chunk => chunk.text)
      .join(' ');
    
    console.log('[ChatBotQARouter] Context length:', context.length, 'characters');
    console.log('[ChatBotQARouter] Context chunks used:', similarChunks.length);

    try {
      // Call EQA worker
      const eqaResponse = await this.extractAnswer(question, context);
      const eqaTime = Date.now() - startTime;
      
      console.log('[ChatBotQARouter] EQA answer:', eqaResponse.answer);
      console.log('[ChatBotQARouter] EQA confidence:', eqaResponse.confidence);
      console.log('[ChatBotQARouter] EQA timing:', eqaTime, 'ms');

      // Check for empty answer
      if (!eqaResponse.answer || eqaResponse.answer.trim().length === 0) {
        console.log('[ChatBotQARouter] Fallback trigger: EQA returned empty answer');
        console.log('[ChatBotQARouter] Falling back to conversational path');
        return await this.processConversationalPath(question, similarChunks, options);
      }

      // Check confidence threshold
      if (eqaResponse.confidence < this.config.eqaConfidenceThreshold) {
        console.log('[ChatBotQARouter] Fallback trigger: EQA confidence', eqaResponse.confidence, 'below threshold', this.config.eqaConfidenceThreshold);
        console.log('[ChatBotQARouter] Falling back to conversational path');
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
      console.log('[ChatBotQARouter] Fallback trigger: EQA worker error');
      console.log('[ChatBotQARouter] Falling back to conversational path');
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
    console.log('[ChatBotQARouter] Step 9b: Conversational Synthesis Path');

    const style = options.style || 'developer';
    const conversationContext = options.context || [];

    // Apply similarity threshold filtering
    const threshold = getAdaptiveThreshold(question);
    const filteredChunks = applySimilarityThreshold(similarChunks, {
      baseThreshold: threshold,
      maxResults: this.config.maxContextChunks
    });
    
    console.log('[ChatBotQARouter] Filtered chunks count:', filteredChunks.length);
    console.log('[ChatBotQARouter] Similarity threshold used:', threshold);

    // Check if we have any relevant context
    if (filteredChunks.length === 0) {
      console.log('[ChatBotQARouter] No relevant context found above threshold');
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
    console.log('[ChatBotQARouter] CV context length:', cvContext ? cvContext.length : 0, 'characters');

    if (!cvContext) {
      console.log('[ChatBotQARouter] Failed to build CV context');
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
    console.log('[ChatBotQARouter] Prompt length:', prompt.length, 'characters');

    try {
      // Generate response
      const response = await this.generateResponse(prompt);
      const generationTime = Date.now() - startTime;
      
      console.log('[ChatBotQARouter] Generated response length:', response.text?.length || 0);
      console.log('[ChatBotQARouter] Generation timing:', generationTime, 'ms');

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
    console.log('[ChatBotQARouter] Step 10: Response formatting and validation');

    // Validate response quality
    const validated = validateResponseQuality(
      {
        answer: response.answer,
        confidence: response.confidence,
        matchedSections: response.matchedChunks,
        metrics: response.metrics || {}
      },
      originalQuery
    );

    console.log('[ChatBotQARouter] Validation result:', {
      originalConfidence: response.confidence,
      validatedConfidence: validated.confidence,
      qualityScore: validated.metrics.qualityScore,
      qualityFlags: validated.metrics.qualityFlags
    });

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

    console.log('[ChatBotQARouter] Final response format:', {
      answerLength: formattedResponse.answer.length,
      confidence: formattedResponse.confidence,
      intent: formattedResponse.intent,
      method: formattedResponse.method,
      totalTime: formattedResponse.processingTime
    });

    console.log('[ChatBotQARouter] All metrics:', formattedResponse.metrics);

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
    console.log('[ChatBotQARouter] ========================================');
    console.log('[ChatBotQARouter] Processing query:', question);
    console.log('[ChatBotQARouter] Options:', options);

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

      const totalTime = Date.now() - startTime;
      console.log('[ChatBotQARouter] Query processing complete:', totalTime, 'ms');
      console.log('[ChatBotQARouter] ========================================');

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
    console.log('[ChatBotQARouter] Cleanup initiated');

    // Clear pending requests
    if (this.pendingRequests.size > 0) {
      console.log('[ChatBotQARouter] Clearing', this.pendingRequests.size, 'pending requests');
      this.pendingRequests.clear();
    }

    // Terminate workers using communicators
    if (this.embeddingCommunicator) {
      console.log('[ChatBotQARouter] Terminating embedding worker');
      this.embeddingCommunicator.terminate();
      this.embeddingCommunicator = null;
      this.embeddingWorker = null;
    }

    if (this.textGenCommunicator) {
      console.log('[ChatBotQARouter] Terminating text generation worker');
      this.textGenCommunicator.terminate();
      this.textGenCommunicator = null;
      this.textGenWorker = null;
    }

    if (this.eqaCommunicator) {
      console.log('[ChatBotQARouter] Terminating EQA worker');
      this.eqaCommunicator.terminate();
      this.eqaCommunicator = null;
      this.eqaWorker = null;
    }

    // Reset state
    this.isInitialized = false;
    this.cvChunks = [];

    console.log('[ChatBotQARouter] Cleanup complete - all workers terminated, state reset');
  }
}
