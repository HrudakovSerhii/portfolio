/**
 * Dual Worker Coordinator - Orchestrates embedding and text generation workers
 * for enhanced semantic Q&A with context-aware responses
 */

import * as queryProcessor from './utils/query-processor.js';
import * as cvContextBuilder from './utils/cv-context-builder.js';
import * as responseValidator from './utils/response-validator.js';
import * as similarityCalculator from './utils/similarity-calculator.js';
import * as promptBuilder from './utils/prompt-builder.js';
import * as cacheManager from './utils/cache-manager.js';
import * as textChunker from './utils/text-chunker.js';

class DualWorkerCoordinator {
    constructor(options = {}) {
        this.embeddingWorker = null;
        this.textGenWorker = null;

        this.isInitialized = false;
        this.requestCounter = 0;
        this.pendingRequests = new Map();
        this.indexedContext = null;

        // Performance metrics from SemanticQAManager
        this.performanceMetrics = {
            totalQueries: 0,
            avgResponseTime: 0,
            cacheHits: 0
        };

        // Configuration
        this.config = {
            embeddingWorkerPath: options.embeddingWorkerPath || '/src/scripts/workers/embedding-worker.js',
            textGenWorkerPath: options.textGenWorkerPath || '/src/scripts/workers/optimized-ml-worker.js',
            maxContextChunks: options.maxContextChunks || 3,
            similarityThreshold: options.similarityThreshold || 0.7,
            chunker: {
                maxChunkSize: options.maxChunkSize || 200,
                overlapSize: options.overlapSize || 20,
                ...options.chunker
            },
            ...options
        };
    }

    /**
     * Initialize both workers
     */
    async initialize(cvChunks = []) {
        debugger
        if (this.isInitialized) return;

        try {
            // Initialize embedding worker
            this.embeddingWorker = new Worker(this.config.embeddingWorkerPath);
            this.setupEmbeddingWorkerHandlers();

            // Initialize text generation worker
            this.textGenWorker = new Worker(this.config.textGenWorkerPath);
            this.setupTextGenWorkerHandlers();

            // Wait for both workers to be ready
            await Promise.all([
                this.waitForWorkerReady(this.embeddingWorker, 'embedding'),
                this.waitForWorkerReady(this.textGenWorker, 'textgen')
            ]);

            // Pre-compute embeddings for CV chunks if provided
            if (cvChunks.length > 0) {
                await this.precomputeChunkEmbeddings(cvChunks);
            }

            this.isInitialized = true;
            console.log('Dual worker coordinator initialized successfully');

        } catch (error) {
            console.error('Failed to initialize dual worker coordinator:', error);
            throw error;
        }
    }

    /**
     * Index context for semantic search (from SemanticQAManager)
     * @param {string} context - Large context text to index
     * @param {object} metadata - Optional metadata
     * @returns {Promise<object>} - Indexing results
     */
    async indexContext(context, metadata = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            console.log('Indexing context for semantic search...');
            const startTime = Date.now();

            // Chunk the context using utility
            const chunks = textChunker.chunkText(context, metadata, this.config.chunker);
            console.log(`Created ${chunks.length} chunks`);

            // Pre-compute embeddings for chunks
            await this.precomputeChunkEmbeddings(chunks);

            // Store indexed context info
            this.indexedContext = {
                originalText: context,
                chunks,
                metadata,
                indexedAt: Date.now()
            };

            const indexingTime = Date.now() - startTime;
            console.log(`Context indexed in ${indexingTime}ms`);

            return {
                success: true,
                chunkCount: chunks.length,
                indexingTime,
                metadata
            };

        } catch (error) {
            console.error('Failed to index context:', error);
            throw error;
        }
    }

    /**
     * Ask a question using semantic search (from SemanticQAManager)
     * @param {string} question - User question
     * @param {string} context - Optional context (if not pre-indexed)
     * @param {object} options - Additional options
     * @returns {Promise<object>} - Answer object
     */
    async askQuestion(question, context = null, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Index context if provided and not already indexed
        if (context && (!this.indexedContext || this.indexedContext.originalText !== context)) {
            await this.indexContext(context);
        }

        // Use indexed context chunks or provided cvChunks
        const cvChunks = this.indexedContext?.chunks || options.cvChunks || [];

        if (cvChunks.length === 0) {
            throw new Error('No context available. Please index context first or provide cvChunks.');
        }

        return this.processQuestion(question, cvChunks, options);
    }

    /**
     * Process a question using both workers with utility modules
     */
    async processQuestion(question, cvChunks = [], options = {}) {
        if (!this.isInitialized) {
            throw new Error('Coordinator not initialized');
        }

        const startTime = Date.now();
        this.performanceMetrics.totalQueries++;

        try {
            // Step 1: Enhance query using query-processor
            const enhancedQuery = queryProcessor.preprocessQuery(question, options.context || []);

            // Step 2: Check cache for existing result
            const cachedResult = cacheManager.getCachedQueryResult(enhancedQuery);
            if (cachedResult) {
                return cachedResult;
            }

            // Step 3: Generate embedding for the enhanced question
            const questionEmbedding = await this.generateEmbedding(enhancedQuery);

            // Step 4: Find similar chunks using similarity-calculator
            const similarChunks = similarityCalculator.findSimilarChunks(
                questionEmbedding,
                cvChunks,
                options.maxChunks || this.config.maxContextChunks
            );

            // Step 5: Apply similarity threshold filtering
            const threshold = queryProcessor.getAdaptiveThreshold(enhancedQuery);
            const filteredChunks = similarityCalculator.applySimilarityThreshold(similarChunks, threshold);

            // Step 6: Build context using cv-context-builder
            const cvContext = cvContextBuilder.buildCVContext(filteredChunks);

            // Step 7: Create prompt using prompt-builder
            const prompt = promptBuilder.createPrompt(
                question,
                cvContext,
                options.style || 'developer',
                options.context || []
            );

            // Step 8: Generate response using text generation worker
            const response = await this.generateContextualResponse(
                question,
                prompt,
                options
            );

            // Step 9: Validate response using response-validator
            const validatedResponse = responseValidator.validateResponseQuality(
                {
                    answer: response.answer,
                    confidence: response.confidence || 0.7,
                    matchedSections: filteredChunks.map(chunk => chunk.sectionId || chunk.id),
                    metrics: response.metrics || {}
                },
                question
            );

            const processingTime = Date.now() - startTime;
            this.updatePerformanceMetrics(processingTime);

            const result = {
                answer: validatedResponse.answer,
                confidence: validatedResponse.confidence,
                context: cvContext,
                similarChunks: filteredChunks.slice(0, 3),
                question,
                responseTime: processingTime,
                timestamp: Date.now(),
                metrics: {
                    processingTime,
                    embeddingTime: response.embeddingTime || 0,
                    generationTime: response.generationTime || 0,
                    chunksAnalyzed: similarChunks.length,
                    qualityScore: validatedResponse.metrics.qualityScore || 0,
                    ...validatedResponse.metrics
                }
            };

            // Step 10: Cache the result
            cacheManager.cacheQueryResult(enhancedQuery, result);

            return result;

        } catch (error) {
            console.error('Failed to process question:', error);
            return {
                answer: "I encountered an error processing your question.",
                confidence: 0,
                method: 'error',
                error: error.message,
                responseTime: Date.now() - startTime
            };
        }
    }

    /**
     * Generate embedding for text with caching
     */
    async generateEmbedding(text) {
        console.log('[DualWorkerCoordinator] generateEmbedding called with text:', text?.substring(0, 100) + '...');

        // Check cache first
        const cachedEmbedding = cacheManager.getCachedEmbedding(text);
        console.log('[DualWorkerCoordinator] Cache check result:', cachedEmbedding ? 'HIT' : 'MISS');

        if (cachedEmbedding) {
            console.log('[DualWorkerCoordinator] Returning cached embedding, length:', cachedEmbedding.length);
            return cachedEmbedding;
        }

        console.log('[DualWorkerCoordinator] Requesting embedding from worker, requestId will be generated...');

        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();
            console.log('[DualWorkerCoordinator] Generated requestId:', requestId);

            this.pendingRequests.set(requestId, {
                resolve: (embedding) => {
                    console.log('[DualWorkerCoordinator] Received embedding from worker, length:', embedding?.length);

                    // Cache the result before resolving
                    try {
                        const cacheResult = cacheManager.cacheEmbedding(text, embedding);
                        console.log('[DualWorkerCoordinator] Cache storage result:', cacheResult);
                    } catch (cacheError) {
                        console.error('[DualWorkerCoordinator] Failed to cache embedding:', cacheError);
                    }

                    console.log('[DualWorkerCoordinator] Resolving with embedding');
                    resolve(embedding);
                },
                reject: (error) => {
                    console.error('[DualWorkerCoordinator] Worker request failed:', error);
                    reject(error);
                },
                type: 'embedding'
            });

            console.log('[DualWorkerCoordinator] Sending message to worker...');
            this.embeddingWorker.postMessage({
                type: 'generateEmbedding',
                data: { text },
                requestId
            });
        });
    }



    /**
     * Calculate similarity between embeddings
     */
    async calculateSimilarity(embedding1, embedding2) {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();

            this.pendingRequests.set(requestId, { resolve, reject, type: 'similarity' });

            this.embeddingWorker.postMessage({
                type: 'calculateSimilarity',
                data: { embedding1, embedding2 },
                requestId
            });
        });
    }

    /**
     * Generate contextual response using text generation worker
     */
    async generateContextualResponse(question, prompt, options = {}) {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();
            const startTime = Date.now();

            this.pendingRequests.set(requestId, {
                resolve: (result) => {
                    result.generationTime = Date.now() - startTime;
                    resolve(result);
                },
                reject,
                type: 'generation'
            });

            this.textGenWorker.postMessage({
                type: 'generate',
                prompt,
                query: question,
                maxTokens: options.maxTokens || 60, // Use constrained generation
                temperature: options.temperature || 0.3, // Use constrained generation
                requestId
            });
        });
    }



    /**
     * Pre-compute embeddings for CV chunks with caching
     */
    async precomputeChunkEmbeddings(cvChunks) {
        const chunksNeedingEmbeddings = cvChunks.filter(chunk => !chunk.embedding);

        if (chunksNeedingEmbeddings.length === 0) return;

        console.log(`Pre-computing embeddings for ${chunksNeedingEmbeddings.length} chunks...`);

        const textsToEmbed = chunksNeedingEmbeddings.map(chunk => chunk.text);
        const embeddings = await this.generateBatchEmbeddings(textsToEmbed);

        // Assign embeddings to chunks
        chunksNeedingEmbeddings.forEach((chunk, index) => {
            chunk.embedding = embeddings[index];
        });

        console.log('Chunk embeddings pre-computed successfully');
    }

    /**
     * Generate batch embeddings with caching
     */
    async generateBatchEmbeddings(texts) {
        const uncachedTexts = [];
        const results = [];
        const textIndexMap = new Map();

        // Check cache for each text
        texts.forEach((text, index) => {
            const cachedEmbedding = cacheManager.getCachedEmbedding(text);
            if (cachedEmbedding) {
                results[index] = cachedEmbedding;
            } else {
                const uncachedIndex = uncachedTexts.length;
                uncachedTexts.push(text);
                textIndexMap.set(uncachedIndex, index);
            }
        });

        // If all texts are cached, return immediately
        if (uncachedTexts.length === 0) {
            return results;
        }

        // Generate embeddings for uncached texts
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();

            this.pendingRequests.set(requestId, {
                resolve: (embeddings) => {
                    // Cache and place results in correct positions
                    embeddings.forEach((embedding, uncachedIndex) => {
                        const originalIndex = textIndexMap.get(uncachedIndex);
                        const text = uncachedTexts[uncachedIndex];
                        cacheManager.cacheEmbedding(text, embedding);
                        results[originalIndex] = embedding;
                    });
                    resolve(results);
                },
                reject,
                type: 'batchEmbedding'
            });

            this.embeddingWorker.postMessage({
                type: 'generateBatchEmbeddings',
                data: { texts: uncachedTexts },
                requestId
            });
        });
    }



    /**
     * Setup embedding worker message handlers
     */
    setupEmbeddingWorkerHandlers() {
        this.embeddingWorker.onmessage = (event) => {
            console.log('[DualWorkerCoordinator] Received message from worker:', event.data.type, 'requestId:', event.data.requestId);

            const { type, requestId, success, embedding, embeddings, similarity, error } = event.data;

            // Handle messages that don't require pending requests
            switch (type) {
                case 'workerReady':
                case 'initialized':
                    console.log('[DualWorkerCoordinator] Worker initialization message:', type, success ? 'SUCCESS' : 'FAILED');
                    if (!success && error) {
                        console.error('[DualWorkerCoordinator] Worker initialization failed:', error);
                    }
                    return;

                case 'batchProgress':
                case 'cvProcessingProgress':
                case 'downloadProgress':
                    console.log('[DualWorkerCoordinator] Progress update:', type, event.data);
                    return;

                case 'error':
                case 'workerError':
                    console.error('[DualWorkerCoordinator] Worker error message:', error);
                    return;
            }

            // Handle messages that require pending requests
            const request = this.pendingRequests.get(requestId);
            if (!request) {
                console.warn('[DualWorkerCoordinator] No pending request found for requestId:', requestId, 'type:', type);
                return;
            }

            console.log('[DualWorkerCoordinator] Found pending request, type:', request.type);
            this.pendingRequests.delete(requestId);

            if (success === false) {
                console.error('[DualWorkerCoordinator] Worker reported failure:', error || 'Unknown error');
                request.reject(new Error(error || 'Unknown worker error'));
                return;
            }

            switch (type) {
                case 'embedding':
                    console.log('[DualWorkerCoordinator] Resolving embedding request with data length:', embedding?.length);
                    request.resolve(embedding);
                    break;
                case 'batchEmbedding':
                    console.log('[DualWorkerCoordinator] Resolving batch embedding request with', embeddings?.length, 'embeddings');
                    request.resolve(embeddings);
                    break;
                case 'similarity':
                    console.log('[DualWorkerCoordinator] Resolving similarity request with score:', similarity);
                    request.resolve(similarity);
                    break;
                default:
                    console.warn('[DualWorkerCoordinator] Unknown message type for pending request:', type);
                    request.reject(new Error(`Unknown message type: ${type}`));
            }
        };

        this.embeddingWorker.onerror = (error) => {
            console.error('[DualWorkerCoordinator] Embedding worker error:', error);
        };
    }

    /**
     * Setup text generation worker message handlers
     */
    setupTextGenWorkerHandlers() {
        this.textGenWorker.onmessage = (event) => {
            const { type, requestId, answer, error } = event.data;

            const request = this.pendingRequests.get(requestId);
            if (!request) return;

            this.pendingRequests.delete(requestId);

            if (error) {
                request.reject(new Error(error));
                return;
            }

            if (type === 'response') {
                request.resolve({
                    answer,
                    confidence: 0.7 // Base confidence for generated responses
                });
            }
        };

        this.textGenWorker.onerror = (error) => {
            console.error('Text generation worker error:', error);
        };
    }

    /**
     * Wait for worker to be ready
     */
    async waitForWorkerReady(worker, workerType) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`${workerType} worker initialization timeout`));
            }, 50000);

            const handler = (event) => {
                if (event.data.type === 'workerReady' || event.data.type === 'ready') {
                    clearTimeout(timeout);
                    worker.removeEventListener('message', handler);
                    resolve();
                }
            };

            worker.addEventListener('message', handler);
        });
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${++this.requestCounter}_${Date.now()}`;
    }

    /**
     * Get cache statistics for monitoring
     */
    getCacheStats() {
        return cacheManager.getCacheStats();
    }

    /**
     * Ask multiple questions in batch (from SemanticQAManager)
     * @param {string[]} questions - Array of questions
     * @param {Array} cvChunks - CV chunks for context
     * @returns {Promise<Array>} - Array of answers
     */
    async askQuestions(questions, cvChunks = []) {
        const answers = [];

        // Process questions sequentially to avoid overwhelming the system
        for (const question of questions) {
            const answer = await this.processQuestion(question, cvChunks);
            answers.push(answer);
        }

        return answers;
    }

    /**
     * Get semantic search results without generating an answer (from SemanticQAManager)
     * @param {string} query - Search query
     * @param {Array} cvChunks - CV chunks to search
     * @param {number} topK - Number of results to return
     * @returns {Promise<Array>} - Similar chunks
     */
    async semanticSearch(query, cvChunks = [], topK = 3) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Generate embedding for the query
        const queryEmbedding = await this.generateEmbedding(query);

        // Find similar chunks using similarity-calculator
        const similarChunks = similarityCalculator.findSimilarChunks(
            queryEmbedding,
            cvChunks,
            topK
        );

        return similarChunks;
    }

    /**
     * Update performance metrics (from SemanticQAManager)
     * @param {number} responseTime - Response time in ms
     */
    updatePerformanceMetrics(responseTime) {
        const totalQueries = this.performanceMetrics.totalQueries;
        const currentAvg = this.performanceMetrics.avgResponseTime;

        // Calculate new average response time
        this.performanceMetrics.avgResponseTime =
            ((currentAvg * (totalQueries - 1)) + responseTime) / totalQueries;
    }

    /**
     * Get system status and statistics (from SemanticQAManager)
     * @returns {object} - System status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            hasIndexedContext: !!this.indexedContext,
            contextInfo: this.indexedContext ? {
                chunkCount: this.indexedContext.chunks?.length || 0,
                indexedAt: this.indexedContext.indexedAt,
                metadata: this.indexedContext.metadata
            } : null,
            cacheStats: this.getCacheStats(),
            performanceMetrics: { ...this.performanceMetrics }
        };
    }

    /**
     * Reset system and clear all data (from SemanticQAManager)
     */
    reset() {
        this.clearCache();
        this.indexedContext = null;
        this.performanceMetrics = {
            totalQueries: 0,
            avgResponseTime: 0,
            cacheHits: 0
        };
        console.log('Dual Worker Coordinator reset');
    }

    /**
     * Export current context and embeddings (from SemanticQAManager)
     * @returns {object} - Exportable data
     */
    exportData() {
        if (!this.indexedContext) {
            return null;
        }

        return {
            context: this.indexedContext.originalText,
            chunks: this.indexedContext.chunks,
            metadata: this.indexedContext.metadata,
            exportedAt: Date.now()
        };
    }

    /**
     * Import previously exported data (from SemanticQAManager)
     * @param {object} data - Exported data
     * @returns {Promise<void>}
     */
    async importData(data) {
        if (!data || !data.context || !data.chunks) {
            throw new Error('Invalid import data');
        }

        this.indexedContext = {
            originalText: data.context,
            chunks: data.chunks,
            metadata: data.metadata || {},
            indexedAt: Date.now()
        };

        // Pre-compute embeddings for imported chunks if needed
        if (data.chunks.length > 0) {
            await this.precomputeChunkEmbeddings(data.chunks);
        }

        console.log('Data imported successfully');
    }

    /**
     * Clear all caches
     */
    clearCache() {
        return cacheManager.clearCache();
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.embeddingWorker) {
            this.embeddingWorker.terminate();
            this.embeddingWorker = null;
        }

        if (this.textGenWorker) {
            this.textGenWorker.terminate();
            this.textGenWorker = null;
        }

        this.pendingRequests.clear();
        this.isInitialized = false;
    }
}

export default DualWorkerCoordinator;
