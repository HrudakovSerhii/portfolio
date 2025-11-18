/**
 * Embedding Worker - Handle embedding generation in a separate thread
 * Provides consistent interface with the main thread embedding service
 */

let embeddingService = null;
let isInitialized = false;
let initializationConfig = null;

// Default configuration - simplified for better compatibility
const DEFAULT_CONFIG = {
    modelName: 'Xenova/all-MiniLM-L6-v2',
    quantized: true,
    pooling: 'mean',
    normalize: true
};

/**
 * Initialize the embedding service with configuration
 * @param {Object} config - Configuration parameters for the pipeline
 */
async function initializeEmbeddingService(config = {}) {
    if (isInitialized) return;

    // Merge with default config
    initializationConfig = { ...DEFAULT_CONFIG, ...config };

    try {
        // Dynamic import for Xenova transformers - use latest stable version
        const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');

        // Configure environment for web worker
        env.allowRemoteModels = true;
        env.allowLocalModels = false;

        // Prepare pipeline options - simplified for better compatibility
        const pipelineOptions = {
            quantized: initializationConfig.quantized,
            progress_callback: (progress) => {
                if (progress.status === 'downloading' || progress.status === 'loading') {
                    self.postMessage({
                        type: 'downloadProgress',
                        progress: progress.progress || 0,
                        status: progress.status,
                        file: progress.file || progress.name
                    });
                }
            }
        };

        // Remove undefined values and device/dtype for better compatibility
        Object.keys(pipelineOptions).forEach(key => {
            if (pipelineOptions[key] === undefined) {
                delete pipelineOptions[key];
            }
        });

        // Initialize feature extraction pipeline with simplified config
        const model = await pipeline('feature-extraction', initializationConfig.modelName, pipelineOptions);

        embeddingService = {
            model,
            cache: new Map(),
            config: initializationConfig
        };

        isInitialized = true;

        self.postMessage({
            type: 'initialized',
            success: true,
            message: 'Embedding service initialized successfully',
            config: initializationConfig
        });

    } catch (error) {
        console.error('Failed to initialize embedding service:', error);

        self.postMessage({
            type: 'initialized',
            success: false,
            error: error.message,
            config: initializationConfig
        });
    }
}

/**
 * Generate embedding for text
 * @param {string} text - Input text to embed
 * @param {string} requestId - Request identifier
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

    if (!text || typeof text !== 'string') {
        self.postMessage({
            type: 'embedding',
            requestId,
            success: false,
            error: 'Invalid text input'
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

        // Generate new embedding with proper pooling
        const output = await embeddingService.model(text, {
            pooling: 'mean',
            normalize: true
        });

        // Handle different output formats (consistent with embedding service)
        let embedding;
        if (output.data) {
            embedding = new Float32Array(output.data);
        } else if (Array.isArray(output)) {
            embedding = new Float32Array(output);
        } else {
            embedding = new Float32Array(output);
        }

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
 * @param {string[]} texts - Array of texts to embed
 * @param {string} requestId - Request identifier
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

    if (!Array.isArray(texts) || texts.length === 0) {
        self.postMessage({
            type: 'batchEmbedding',
            requestId,
            success: false,
            error: 'Invalid texts input - must be non-empty array'
        });
        return;
    }

    try {
        const embeddings = [];
        const cacheHits = [];

        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];

            if (!text || typeof text !== 'string') {
                console.warn(`Skipping invalid text at index ${i}`);
                continue;
            }

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

                // Handle different output formats (consistent with embedding service)
                let embedding;
                if (output.data) {
                    embedding = new Float32Array(output.data);
                } else if (Array.isArray(output)) {
                    embedding = new Float32Array(output);
                } else {
                    embedding = new Float32Array(output);
                }

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
            cacheHits,
            processed: embeddings.length,
            total: texts.length
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
 * @param {number[]} embedding1 - First embedding vector
 * @param {number[]} embedding2 - Second embedding vector
 * @param {string} requestId - Request identifier
 */
function calculateSimilarity(embedding1, embedding2, requestId) {
    try {
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

        self.postMessage({
            type: 'similarity',
            requestId,
            success: true,
            similarity,
            dimensions: embedding1.length
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
 * Process CV sections for batch embedding generation
 * @param {Array} cvSections - Array of CV section objects
 * @param {string} requestId - Request identifier
 */
async function processCVSections(cvSections, requestId) {
    if (!isInitialized) {
        self.postMessage({
            type: 'cvSectionsProcessed',
            requestId,
            success: false,
            error: 'Service not initialized'
        });
        return;
    }

    if (!Array.isArray(cvSections) || cvSections.length === 0) {
        self.postMessage({
            type: 'cvSectionsProcessed',
            requestId,
            success: false,
            error: 'Invalid CV sections input - must be non-empty array'
        });
        return;
    }

    try {
        const processedSections = [];

        for (let i = 0; i < cvSections.length; i++) {
            const section = cvSections[i];

            if (!section || typeof section !== 'object') {
                console.warn(`Skipping invalid section at index ${i}`);
                continue;
            }

            // Extract text content from section for embedding
            let textContent = '';

            // Build text from section keywords and responses
            if (section.keywords && Array.isArray(section.keywords)) {
                textContent += section.keywords.join(' ') + ' ';
            }

            // Add response content (prefer developer style, fallback to others)
            if (section.responses) {
                const response = section.responses.developer ||
                               section.responses.hr ||
                               section.responses.friend || '';
                textContent += response;
            }

            // Add details if available
            if (section.details && typeof section.details === 'object') {
                const detailsText = Object.values(section.details)
                    .filter(value => typeof value === 'string')
                    .join(' ');
                textContent += ' ' + detailsText;
            }

            if (!textContent.trim()) {
                console.warn(`No text content found for section at index ${i}`);
                continue;
            }

            const sanitizedText = sanitizeText(textContent);
            const cacheKey = hashText(sanitizedText);

            let embedding;
            let cached = false;

            if (embeddingService.cache.has(cacheKey)) {
                embedding = Array.from(embeddingService.cache.get(cacheKey));
                cached = true;
            } else {
                const output = await embeddingService.model(sanitizedText, {
                    pooling: 'mean',
                    normalize: true
                });

                // Handle different output formats
                let embeddingArray;
                if (output.data) {
                    embeddingArray = new Float32Array(output.data);
                } else if (Array.isArray(output)) {
                    embeddingArray = new Float32Array(output);
                } else {
                    embeddingArray = new Float32Array(output);
                }

                embeddingService.cache.set(cacheKey, embeddingArray);
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

            // Send progress update for large batches
            if (cvSections.length > 10 && (i + 1) % 5 === 0) {
                self.postMessage({
                    type: 'cvProcessingProgress',
                    requestId,
                    progress: (i + 1) / cvSections.length,
                    completed: i + 1,
                    total: cvSections.length
                });
            }
        }

        self.postMessage({
            type: 'cvSectionsProcessed',
            requestId,
            success: true,
            processedSections,
            totalProcessed: processedSections.length,
            totalInput: cvSections.length
        });

    } catch (error) {
        console.error('Failed to process CV sections:', error);

        self.postMessage({
            type: 'cvSectionsProcessed',
            requestId,
            success: false,
            error: error.message
        });
    }
}

/**
 * Filter similarities by threshold
 * @param {Array} similarities - Array of similarity objects with score property
 * @param {number} threshold - Minimum similarity threshold (0-1)
 * @param {string} requestId - Request identifier
 */
function filterBySimilarityThreshold(similarities, threshold, requestId) {
    try {
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

            // Support different property names for similarity score
            const score = item.similarity || item.score || item.similarityScore;

            if (typeof score !== 'number') {
                return false;
            }

            return score >= threshold;
        });

        // Sort by similarity score in descending order
        filteredSimilarities.sort((a, b) => {
            const scoreA = a.similarity || a.score || a.similarityScore || 0;
            const scoreB = b.similarity || b.score || b.similarityScore || 0;
            return scoreB - scoreA;
        });

        self.postMessage({
            type: 'similaritiesFiltered',
            requestId,
            success: true,
            filteredSimilarities,
            originalCount: similarities.length,
            filteredCount: filteredSimilarities.length,
            threshold
        });

    } catch (error) {
        self.postMessage({
            type: 'similaritiesFiltered',
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
 * @param {string} requestId - Request identifier
 */
function getCacheStats(requestId) {
    const stats = {
        size: embeddingService ? embeddingService.cache.size : 0,
        isInitialized,
        modelName: initializationConfig ? initializationConfig.modelName : DEFAULT_CONFIG.modelName,
        memoryUsage: embeddingService ? getApproximateMemoryUsage() : 0
    };

    self.postMessage({
        type: 'cacheStats',
        requestId,
        success: true,
        stats
    });
}

/**
 * Get approximate memory usage of cache
 * @returns {number} - Approximate memory usage in bytes
 */
function getApproximateMemoryUsage() {
    if (!embeddingService || !embeddingService.cache) return 0;

    // Estimate: each Float32Array element is 4 bytes
    // Assume average embedding dimension of 768 (DistilBERT)
    const avgEmbeddingSize = 768 * 4; // 4 bytes per float32
    return embeddingService.cache.size * avgEmbeddingSize;
}

/**
 * Simple hash function for caching (consistent with embedding service)
 * @param {string} text - Text to hash
 * @returns {string} - Hash string
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
 * Validate and sanitize text input
 * @param {string} text - Input text
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
    if (typeof text !== 'string') {
        throw new Error('Text must be a string');
    }

    // Trim whitespace and normalize
    text = text.trim();

    if (text.length === 0) {
        throw new Error('Text cannot be empty');
    }

    if (text.length > 10000) {
        console.warn('Text is very long, truncating to 10000 characters');
        text = text.substring(0, 10000);
    }

    return text;
}

/**
 * Message handler
 */
self.onmessage = async function(event) {
    const { type, data, requestId } = event.data;

    try {
        switch (type) {
            case 'initialize':
                await initializeEmbeddingService();
                break;

            case 'generateEmbedding':
                if (!data || !data.text) {
                    throw new Error('Missing text data for embedding generation');
                }
                const sanitizedText = sanitizeText(data.text);
                await generateEmbedding(sanitizedText, requestId);
                break;

            case 'generateBatchEmbeddings':
                if (!data || !data.texts) {
                    throw new Error('Missing texts data for batch embedding generation');
                }
                await generateBatchEmbeddings(data.texts, requestId);
                break;

            case 'calculateSimilarity':
                if (!data || !data.embedding1 || !data.embedding2) {
                    throw new Error('Missing embedding data for similarity calculation');
                }
                calculateSimilarity(data.embedding1, data.embedding2, requestId);
                break;

            case 'processCVSections':
                if (!data || !data.cvSections) {
                    throw new Error('Missing CV sections data for processing');
                }
                await processCVSections(data.cvSections, requestId);
                break;

            case 'filterBySimilarityThreshold':
                if (!data || !data.similarities || typeof data.threshold !== 'number') {
                    throw new Error('Missing similarities data or threshold for filtering');
                }
                filterBySimilarityThreshold(data.similarities, data.threshold, requestId);
                break;

            case 'clearCache':
                clearCache(requestId);
                break;

            case 'getCacheStats':
                getCacheStats(requestId);
                break;

            case 'ping':
                self.postMessage({
                    type: 'pong',
                    requestId,
                    success: true,
                    timestamp: Date.now()
                });
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId,
            success: false,
            error: error.message
        });
    }
};

/**
 * Handle worker errors
 */
self.onerror = function(error) {
    console.error('Worker error:', error);
    self.postMessage({
        type: 'workerError',
        success: false,
        error: error.message || 'Unknown worker error',
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno
    });
};

/**
 * Handle unhandled promise rejections
 */
self.onunhandledrejection = function(event) {
    console.error('Unhandled promise rejection in worker:', event.reason);
    self.postMessage({
        type: 'workerError',
        success: false,
        error: `Unhandled promise rejection: ${event.reason}`,
        source: 'unhandledrejection'
    });
};

// Send ready signal when worker loads
self.postMessage({
    type: 'workerReady',
    success: true,
    timestamp: Date.now()
});

// Auto-initialize when worker starts
initializeEmbeddingService().catch(error => {
    console.error('[EmbeddingWorker] Auto-initialization failed:', error);
    self.postMessage({
        type: 'initialized',
        success: false,
        error: error.message,
        stack: error.stack
    });
});
