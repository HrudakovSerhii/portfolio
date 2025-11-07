/**
 * Dual Worker Coordinator - Orchestrates embedding and text generation workers
 * for enhanced semantic Q&A with context-aware responses
 */

import ContextFencer from './context-fencer.js';

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
     * Process a question using both workers
     */
    async processQuestion(question, cvChunks = [], options = {}) {
        if (!this.isInitialized) {
            throw new Error('Coordinator not initialized');
        }

        const startTime = Date.now();
        
        try {
            // Step 1: Generate embedding for the question
            const questionEmbedding = await this.generateEmbedding(question);

            // Step 2: Find similar chunks using embeddings
            const similarChunks = await this.findSimilarChunks(
                questionEmbedding, 
                cvChunks, 
                options.maxChunks || this.config.maxContextChunks
            );

            // Step 3: Create fenced context using ContextFencer
            const fencedContext = this.contextFencer.createFencedContext(similarChunks, question);

            // Step 4: Generate response using text generation worker
            const response = await this.generateContextualResponse(
                question, 
                fencedContext, 
                options
            );

            const processingTime = Date.now() - startTime;

            return {
                answer: response.answer,
                confidence: this.calculateOverallConfidence(fencedContext.confidence, response.confidence),
                context: fencedContext,
                similarChunks: similarChunks.slice(0, 3),
                metrics: {
                    processingTime,
                    embeddingTime: response.embeddingTime || 0,
                    generationTime: response.generationTime || 0,
                    chunksAnalyzed: similarChunks.length,
                    factsExtracted: fencedContext.facts.length
                }
            };

        } catch (error) {
            console.error('Failed to process question:', error);
            throw error;
        }
    }

    /**
     * Generate embedding for text
     */
    async generateEmbedding(text) {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();
            
            this.pendingRequests.set(requestId, { resolve, reject, type: 'embedding' });
            
            this.embeddingWorker.postMessage({
                type: 'generateEmbedding',
                data: { text },
                requestId
            });
        });
    }

    /**
     * Find similar chunks using cosine similarity
     */
    async findSimilarChunks(questionEmbedding, cvChunks, maxChunks = 3) {
        const similarities = [];

        for (const chunk of cvChunks) {
            if (!chunk.embedding) {
                // Generate embedding for chunk if not available
                chunk.embedding = await this.generateEmbedding(chunk.text);
            }

            const similarity = await this.calculateSimilarity(questionEmbedding, chunk.embedding);
            
            if (similarity >= this.config.similarityThreshold) {
                similarities.push({
                    chunk,
                    similarity,
                    score: similarity
                });
            }
        }

        // Sort by similarity and return top matches
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxChunks);
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
    async generateContextualResponse(question, fencedContext, options = {}) {
        const prompt = this.buildEnhancedPrompt(question, fencedContext, options);
        
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
                maxTokens: options.maxTokens || 150,
                temperature: options.temperature || 0.7,
                requestId
            });
        });
    }

    /**
     * Build enhanced prompt with fenced context
     */
    buildEnhancedPrompt(question, fencedContext, options = {}) {
        const style = options.style || 'developer';
        
        let prompt = `You are Serhii, a software developer. Answer questions based on the provided facts.\n\n`;
        
        if (fencedContext.hasContext) {
            prompt += `Context:\n${fencedContext.context}\n\n`;
        }
        
        prompt += `Instructions:
- Answer as Serhii in first person
- Use only the facts provided above
- Be specific and provide examples when possible
- Keep response under 50 words
- If no relevant facts are provided, say so honestly

Response:`;

        return prompt;
    }

    /**
     * Pre-compute embeddings for CV chunks
     */
    async precomputeChunkEmbeddings(cvChunks) {
        const textsToEmbed = cvChunks
            .filter(chunk => !chunk.embedding)
            .map(chunk => chunk.text);

        if (textsToEmbed.length === 0) return;

        console.log(`Pre-computing embeddings for ${textsToEmbed.length} chunks...`);

        const embeddings = await this.generateBatchEmbeddings(textsToEmbed);
        
        let embeddingIndex = 0;
        for (const chunk of cvChunks) {
            if (!chunk.embedding) {
                chunk.embedding = embeddings[embeddingIndex++];
            }
        }

        console.log('Chunk embeddings pre-computed successfully');
    }

    /**
     * Generate batch embeddings
     */
    async generateBatchEmbeddings(texts) {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();
            
            this.pendingRequests.set(requestId, { resolve, reject, type: 'batchEmbedding' });
            
            this.embeddingWorker.postMessage({
                type: 'generateBatchEmbeddings',
                data: { texts },
                requestId
            });
        });
    }

    /**
     * Calculate overall confidence score
     */
    calculateOverallConfidence(contextConfidence, generationConfidence) {
        // Weight context confidence more heavily as it indicates factual grounding
        return (contextConfidence * 0.6) + (generationConfidence * 0.4);
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