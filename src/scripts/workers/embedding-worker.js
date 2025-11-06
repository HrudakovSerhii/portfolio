/**
 * Embedding Worker - Handle embedding generation in a separate thread
 */

let embeddingService = null;
let isInitialized = false;

// Import the embedding service
self.importScripts = self.importScripts || (() => {});

/**
 * Initialize the embedding service
 */
async function initializeEmbeddingService() {
    if (isInitialized) return;

    try {
        // Dynamic import for Xenova transformers
        const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js');
        
        // Initialize the pipeline
        const model = await pipeline('feature-extraction', 'Xenova/distilbert-base-uncased');
        
        embeddingService = {
            model,
            cache: new Map()
        };
        
        isInitialized = true;
        
        self.postMessage({
            type: 'initialized',
            success: true,
            message: 'Embedding service initialized successfully'
        });
        
    } catch (error) {
        console.error('Failed to initialize embedding service:', error);
        
        self.postMessage({
            type: 'initialized',
            success: false,
            error: error.message
        });
    }
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text, requestId) {
    if (!isInitialized) {
        self.postMessage({
            type: 'embedding',
            requestId,
            success: false,
            error: 'Service not initialized'
        });
        return;
    }

    try {
        // Check cache first
        const cacheKey = hashText(text);
        if (embeddingService.cache.has(cacheKey)) {
            const cachedEmbedding = embeddingService.cache.get(cacheKey);
            
            self.postMessage({
                type: 'embedding',
                requestId,
                success: true,
                embedding: Array.from(cachedEmbedding),
                cached: true
            });
            return;
        }

        // Generate new embedding
        const output = await embeddingService.model(text, { 
            pooling: 'mean', 
            normalize: true 
        });
        
        const embedding = new Float32Array(output.data);
        
        // Cache the result
        embeddingService.cache.set(cacheKey, embedding);
        
        self.postMessage({
            type: 'embedding',
            requestId,
            success: true,
            embedding: Array.from(embedding),
            cached: false
        });
        
    } catch (error) {
        console.error('Failed to generate embedding:', error);
        
        self.postMessage({
            type: 'embedding',
            requestId,
            success: false,
            error: error.message
        });
    }
}

/**
 * Generate batch embeddings
 */
async function generateBatchEmbeddings(texts, requestId) {
    if (!isInitialized) {
        self.postMessage({
            type: 'batchEmbedding',
            requestId,
            success: false,
            error: 'Service not initialized'
        });
        return;
    }

    try {
        const embeddings = [];
        const cacheHits = [];
        
        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            const cacheKey = hashText(text);
            
            if (embeddingService.cache.has(cacheKey)) {
                const cachedEmbedding = embeddingService.cache.get(cacheKey);
                embeddings.push(Array.from(cachedEmbedding));
                cacheHits.push(true);
            } else {
                const output = await embeddingService.model(text, { 
                    pooling: 'mean', 
                    normalize: true 
                });
                
                const embedding = new Float32Array(output.data);
                embeddingService.cache.set(cacheKey, embedding);
                
                embeddings.push(Array.from(embedding));
                cacheHits.push(false);
            }
            
            // Send progress update for large batches
            if (texts.length > 10 && (i + 1) % 5 === 0) {
                self.postMessage({
                    type: 'batchProgress',
                    requestId,
                    progress: (i + 1) / texts.length,
                    completed: i + 1,
                    total: texts.length
                });
            }
        }
        
        self.postMessage({
            type: 'batchEmbedding',
            requestId,
            success: true,
            embeddings,
            cacheHits
        });
        
    } catch (error) {
        console.error('Failed to generate batch embeddings:', error);
        
        self.postMessage({
            type: 'batchEmbedding',
            requestId,
            success: false,
            error: error.message
        });
    }
}

/**
 * Calculate cosine similarity between embeddings
 */
function calculateSimilarity(embedding1, embedding2, requestId) {
    try {
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
        const similarity = magnitude === 0 ? 0 : dotProduct / magnitude;

        self.postMessage({
            type: 'similarity',
            requestId,
            success: true,
            similarity
        });
        
    } catch (error) {
        self.postMessage({
            type: 'similarity',
            requestId,
            success: false,
            error: error.message
        });
    }
}

/**
 * Clear the embedding cache
 */
function clearCache(requestId) {
    if (embeddingService && embeddingService.cache) {
        embeddingService.cache.clear();
    }
    
    self.postMessage({
        type: 'cacheCleared',
        requestId,
        success: true
    });
}

/**
 * Get cache statistics
 */
function getCacheStats(requestId) {
    const stats = {
        size: embeddingService ? embeddingService.cache.size : 0,
        isInitialized,
        modelName: 'Xenova/distilbert-base-uncased'
    };
    
    self.postMessage({
        type: 'cacheStats',
        requestId,
        success: true,
        stats
    });
}

/**
 * Simple hash function for caching
 */
function hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
}

/**
 * Message handler
 */
self.onmessage = async function(event) {
    const { type, data, requestId } = event.data;
    
    switch (type) {
        case 'initialize':
            await initializeEmbeddingService();
            break;
            
        case 'generateEmbedding':
            await generateEmbedding(data.text, requestId);
            break;
            
        case 'generateBatchEmbeddings':
            await generateBatchEmbeddings(data.texts, requestId);
            break;
            
        case 'calculateSimilarity':
            calculateSimilarity(data.embedding1, data.embedding2, requestId);
            break;
            
        case 'clearCache':
            clearCache(requestId);
            break;
            
        case 'getCacheStats':
            getCacheStats(requestId);
            break;
            
        default:
            self.postMessage({
                type: 'error',
                requestId,
                error: `Unknown message type: ${type}`
            });
    }
};

// Handle worker errors
self.onerror = function(error) {
    console.error('Worker error:', error);
    self.postMessage({
        type: 'error',
        error: error.message
    });
};

// Auto-initialize when worker starts
initializeEmbeddingService();