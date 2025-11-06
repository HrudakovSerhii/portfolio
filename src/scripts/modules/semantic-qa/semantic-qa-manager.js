/**
 * Semantic Q&A Manager - Main orchestrator for semantic question answering
 */

import EmbeddingService from './embedding-service.js';
import ContextChunker from './context-chunker.js';
import SimilarityMatcher from './similarity-matcher.js';
import ContextFencer from './context-fencer.js';
import QAEngine from './qa-engine.js';

class SemanticQAManager {
    constructor(options = {}) {
        this.embeddingService = new EmbeddingService();
        this.contextChunker = new ContextChunker(options.chunker);
        this.similarityMatcher = new SimilarityMatcher(this.embeddingService, options.matcher);
        this.contextFencer = new ContextFencer(options.fencer);
        this.qaEngine = new QAEngine(options.qaEngine);
        
        this.isInitialized = false;
        this.indexedContext = null;
        this.performanceMetrics = {
            totalQueries: 0,
            avgResponseTime: 0,
            cacheHits: 0
        };
    }

    /**
     * Initialize the semantic Q&A system
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            console.log('Initializing Semantic Q&A Manager...');
            
            // Initialize embedding service
            await this.embeddingService.initialize();
            
            this.isInitialized = true;
            console.log('Semantic Q&A Manager initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Semantic Q&A Manager:', error);
            throw error;
        }
    }

    /**
     * Index context for semantic search
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

            // Chunk the context
            const chunks = this.contextChunker.chunkText(context, metadata);
            console.log(`Created ${chunks.length} chunks`);

            // Index chunks with embeddings
            await this.similarityMatcher.indexChunks(chunks);

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
     * Ask a question using semantic search
     * @param {string} question - User question
     * @param {string} context - Optional context (if not pre-indexed)
     * @returns {Promise<object>} - Answer object
     */
    async askQuestion(question, context = null) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        this.performanceMetrics.totalQueries++;

        try {
            // Index context if provided and not already indexed
            if (context && (!this.indexedContext || this.indexedContext.originalText !== context)) {
                await this.indexContext(context);
            }

            // Check if we have indexed context
            if (!this.indexedContext) {
                throw new Error('No context available. Please index context first.');
            }

            // Find similar chunks
            const similarChunks = await this.similarityMatcher.findSimilarChunksWithContext(question);
            
            // Create fenced context
            const fencedContext = this.contextFencer.createFencedContext(similarChunks, question);
            
            // Generate answer
            const answer = await this.qaEngine.generateAnswer(question, fencedContext);
            
            // Update performance metrics
            const responseTime = Date.now() - startTime;
            this.updatePerformanceMetrics(responseTime);

            return {
                ...answer,
                question,
                responseTime,
                similarChunks: similarChunks.length,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('Failed to answer question:', error);
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
     * Ask multiple questions in batch
     * @param {string[]} questions - Array of questions
     * @param {string} context - Optional context
     * @returns {Promise<Array>} - Array of answers
     */
    async askQuestions(questions, context = null) {
        const answers = [];
        
        // Index context once if provided
        if (context) {
            await this.indexContext(context);
        }

        // Process questions sequentially to avoid overwhelming the system
        for (const question of questions) {
            const answer = await this.askQuestion(question);
            answers.push(answer);
        }

        return answers;
    }

    /**
     * Get semantic search results without generating an answer
     * @param {string} query - Search query
     * @param {number} topK - Number of results to return
     * @returns {Promise<Array>} - Similar chunks
     */
    async semanticSearch(query, topK = 3) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!this.indexedContext) {
            throw new Error('No context indexed for search');
        }

        // Temporarily adjust topK for this search
        const originalTopK = this.similarityMatcher.topK;
        this.similarityMatcher.topK = topK;

        try {
            const results = await this.similarityMatcher.findSimilarChunksWithContext(query);
            return results;
        } finally {
            // Restore original topK
            this.similarityMatcher.topK = originalTopK;
        }
    }

    /**
     * Update performance metrics
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
     * Get system status and statistics
     * @returns {object} - System status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            hasIndexedContext: !!this.indexedContext,
            contextInfo: this.indexedContext ? {
                chunkCount: this.indexedContext.chunks.length,
                indexedAt: this.indexedContext.indexedAt,
                metadata: this.indexedContext.metadata
            } : null,
            embeddingService: this.embeddingService.getCacheStats(),
            similarityMatcher: this.similarityMatcher.getIndexStats(),
            performanceMetrics: { ...this.performanceMetrics }
        };
    }

    /**
     * Clear all cached data and reset system
     */
    reset() {
        this.embeddingService.clearCache();
        this.similarityMatcher.clearIndex();
        this.indexedContext = null;
        this.performanceMetrics = {
            totalQueries: 0,
            avgResponseTime: 0,
            cacheHits: 0
        };
        console.log('Semantic Q&A Manager reset');
    }

    /**
     * Export current context and embeddings
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
     * Import previously exported data
     * @param {object} data - Exported data
     * @returns {Promise<void>}
     */
    async importData(data) {
        if (!data || !data.context || !data.chunks) {
            throw new Error('Invalid import data');
        }

        await this.indexContext(data.context, data.metadata);
        console.log('Data imported successfully');
    }
}

export default SemanticQAManager;