/**
 * Dual Worker Coordinator - Orchestrates embedding and text generation workers
 * for enhanced semantic Q&A with context-aware responses
 */

import ContextFencer from './context-fencer.js';
import * as queryProcessor from './utils/query-processor.js';
import * as cvContextBuilder from './utils/cv-context-builder.js';
import * as responseValidator from './utils/response-validator.js';
import * as similarityCalculator from './utils/similarity-calculator.js';
import * as promptBuilder from './utils/prompt-builder.js';
import * as cacheManager from './utils/cache-manager.js';

class DualWorkerCoordinator {
    constructor(options = {}) {
        this.embeddingWorker = null;
        this.textGenWorker = null;
        this.contextFencer = new ContextFencer(options.contextFencer);
        
        this.isInitialized = false;
        this.requestCounter = 0;
        this.pendingRequests = new Map();
        
        // Configuration
        this.config = {
            embeddingWorkerPath: options.embeddingWorkerPath || '/src/scripts/workers/embedding-worker.js',
            textGenWorkerPath: options.textGenWorkerPath || '/src/scripts/workers/optimized-ml-worker.js',
            maxContextChunks: options.maxContextChunks || 3,
            similarityThreshold: options.similarityThreshold || 0.7,
            ...options
        };
    }

    /**
     * Initialize both workers
     */
    async initialize(cvChunks = []) {
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
     * Process a question using both workers with utility modules
     */
    async processQuestion(question, cvChunks = [], options = {}) {
        if (!this.isInitialized) {
            throw new Error('Coordinator not initialized');
        }

        const startTime = Date.now();
        
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

            const result = {
                answer: validatedResponse.answer,
                confidence: validatedResponse.confidence,
                context: cvContext,
                similarChunks: filteredChunks.slice(0, 3),
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
            throw error;
        }
    }

    /**
     * Generate embedding for text with caching
     */
    async generateEmbedding(text) {
        // Check cache first
        const cachedEmbedding = cacheManager.getCachedEmbedding(text);
        if (cachedEmbedding) {
            return cachedEmbedding;
        }

        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();
            
            this.pendingRequests.set(requestId, { 
                resolve: (embedding) => {
                    // Cache the result before resolving
                    cacheManager.cacheEmbedding(text, embedding);
                    resolve(embedding);
                }, 
                reject, 
                type: 'embedding' 
            });
            
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
            const { type, requestId, success, embedding, embeddings, similarity } = event.data;
            
            const request = this.pendingRequests.get(requestId);
            if (!request) return;

            this.pendingRequests.delete(requestId);

            if (!success) {
                request.reject(new Error(event.data.error));
                return;
            }

            switch (type) {
                case 'embedding':
                    request.resolve(embedding);
                    break;
                case 'batchEmbedding':
                    request.resolve(embeddings);
                    break;
                case 'similarity':
                    request.resolve(similarity);
                    break;
            }
        };

        this.embeddingWorker.onerror = (error) => {
            console.error('Embedding worker error:', error);
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
            }, 30000);

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
