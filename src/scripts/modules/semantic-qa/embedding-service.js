/**
 * Embedding Service - Core functionality for text embeddings using tiny analyzer models
 */

class EmbeddingService {
    constructor() {
        this.model = null;
        this.tokenizer = null;
        this.isInitialized = false;
        this.cache = new Map();
        this.modelName = 'Xenova/distilbert-base-uncased';
    }

    /**
     * Initialize the embedding model
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Dynamic import to avoid blocking main thread
            const { pipeline } = await import('@xenova/transformers');
            
            // Initialize feature extraction pipeline
            this.model = await pipeline('feature-extraction', this.modelName);
            this.isInitialized = true;
            
            console.log('Embedding service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize embedding service:', error);
            throw new Error('Embedding service initialization failed');
        }
    }

    /**
     * Generate embeddings for text
     * @param {string} text - Input text to embed
     * @returns {Promise<Float32Array>} - Embedding vector
     */
    async generateEmbedding(text) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Check cache first
        const cacheKey = this.hashText(text);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Generate embedding using the model
            const output = await this.model(text, { pooling: 'mean', normalize: true });
            const embedding = new Float32Array(output.data);
            
            // Cache the result
            this.cache.set(cacheKey, embedding);
            
            return embedding;
        } catch (error) {
            console.error('Failed to generate embedding:', error);
            throw new Error('Embedding generation failed');
        }
    }

    /**
     * Generate embeddings for multiple texts
     * @param {string[]} texts - Array of texts to embed
     * @returns {Promise<Float32Array[]>} - Array of embedding vectors
     */
    async generateBatchEmbeddings(texts) {
        const embeddings = [];
        
        for (const text of texts) {
            const embedding = await this.generateEmbedding(text);
            embeddings.push(embedding);
        }
        
        return embeddings;
    }

    /**
     * Calculate cosine similarity between two embeddings
     * @param {Float32Array} embedding1 - First embedding
     * @param {Float32Array} embedding2 - Second embedding
     * @returns {number} - Similarity score (0-1)
     */
    calculateSimilarity(embedding1, embedding2) {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embeddings must have the same dimension');
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
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }

    /**
     * Simple hash function for caching
     * @param {string} text - Text to hash
     * @returns {string} - Hash string
     */
    hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * Clear the embedding cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     * @returns {object} - Cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            isInitialized: this.isInitialized,
            modelName: this.modelName
        };
    }
}

export default EmbeddingService;