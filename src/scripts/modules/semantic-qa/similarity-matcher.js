/**
 * Similarity Matcher - Find semantically similar chunks to user questions
 */

class SimilarityMatcher {
    constructor(embeddingService, options = {}) {
        this.embeddingService = embeddingService;
        this.topK = options.topK || 3;
        this.minSimilarity = options.minSimilarity || 0.3;
        this.chunkEmbeddings = new Map();
    }

    /**
     * Index chunks by generating embeddings
     * @param {Array} chunks - Array of chunk objects
     * @returns {Promise<void>}
     */
    async indexChunks(chunks) {
        console.log(`Indexing ${chunks.length} chunks...`);
        
        for (const chunk of chunks) {
            try {
                const embedding = await this.embeddingService.generateEmbedding(chunk.text);
                this.chunkEmbeddings.set(chunk.id, {
                    chunk,
                    embedding
                });
            } catch (error) {
                console.error(`Failed to embed chunk ${chunk.id}:`, error);
            }
        }
        
        console.log(`Successfully indexed ${this.chunkEmbeddings.size} chunks`);
    }

    /**
     * Find most similar chunks to a query
     * @param {string} query - User question
     * @returns {Promise<Array>} - Array of similar chunks with scores
     */
    async findSimilarChunks(query) {
        if (!query || typeof query !== 'string') {
            return [];
        }

        try {
            // Generate embedding for the query
            const queryEmbedding = await this.embeddingService.generateEmbedding(query);
            
            // Calculate similarities with all chunks
            const similarities = [];
            
            for (const [chunkId, { chunk, embedding }] of this.chunkEmbeddings) {
                const similarity = this.embeddingService.calculateSimilarity(
                    queryEmbedding, 
                    embedding
                );
                
                if (similarity >= this.minSimilarity) {
                    similarities.push({
                        chunk,
                        similarity,
                        chunkId
                    });
                }
            }
            
            // Sort by similarity (descending) and take top K
            similarities.sort((a, b) => b.similarity - a.similarity);
            return similarities.slice(0, this.topK);
            
        } catch (error) {
            console.error('Failed to find similar chunks:', error);
            return [];
        }
    }

    /**
     * Find similar chunks with enhanced context
     * @param {string} query - User question
     * @param {object} options - Additional options
     * @returns {Promise<Array>} - Enhanced results with context
     */
    async findSimilarChunksWithContext(query, options = {}) {
        const similarChunks = await this.findSimilarChunks(query);
        
        return similarChunks.map(result => ({
            ...result,
            context: this.extractRelevantContext(result.chunk, query),
            relevanceScore: this.calculateRelevanceScore(result, query),
            metadata: {
                ...result.chunk.metadata,
                queryMatch: this.findQueryMatches(result.chunk.text, query)
            }
        }));
    }

    /**
     * Extract relevant context from a chunk
     * @param {object} chunk - Chunk object
     * @param {string} query - User query
     * @returns {object} - Context information
     */
    extractRelevantContext(chunk, query) {
        const queryWords = this.extractKeywords(query);
        const chunkWords = this.extractKeywords(chunk.text);
        
        const matchingWords = queryWords.filter(word => 
            chunkWords.some(chunkWord => 
                chunkWord.toLowerCase().includes(word.toLowerCase()) ||
                word.toLowerCase().includes(chunkWord.toLowerCase())
            )
        );

        return {
            matchingKeywords: matchingWords,
            keywordDensity: matchingWords.length / queryWords.length,
            chunkLength: chunk.wordCount,
            source: chunk.metadata.source
        };
    }

    /**
     * Calculate enhanced relevance score
     * @param {object} result - Similarity result
     * @param {string} query - User query
     * @returns {number} - Enhanced relevance score
     */
    calculateRelevanceScore(result, query) {
        const baseSimilarity = result.similarity;
        const keywordBonus = result.context?.keywordDensity || 0;
        const lengthPenalty = Math.max(0, (result.chunk.wordCount - 100) / 1000);
        
        return Math.min(1.0, baseSimilarity + (keywordBonus * 0.2) - (lengthPenalty * 0.1));
    }

    /**
     * Extract keywords from text
     * @param {string} text - Input text
     * @returns {string[]} - Array of keywords
     */
    extractKeywords(text) {
        // Simple keyword extraction - can be enhanced
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
        ]);

        return text.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
            .slice(0, 10); // Limit to top 10 keywords
    }

    /**
     * Find direct matches between chunk text and query
     * @param {string} chunkText - Chunk text
     * @param {string} query - User query
     * @returns {Array} - Array of matches
     */
    findQueryMatches(chunkText, query) {
        const queryWords = this.extractKeywords(query);
        const matches = [];

        for (const word of queryWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const wordMatches = chunkText.match(regex);
            if (wordMatches) {
                matches.push({
                    word,
                    count: wordMatches.length,
                    positions: this.findWordPositions(chunkText, word)
                });
            }
        }

        return matches;
    }

    /**
     * Find positions of a word in text
     * @param {string} text - Source text
     * @param {string} word - Word to find
     * @returns {number[]} - Array of positions
     */
    findWordPositions(text, word) {
        const positions = [];
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        let match;

        while ((match = regex.exec(text)) !== null) {
            positions.push(match.index);
        }

        return positions;
    }

    /**
     * Clear the chunk index
     */
    clearIndex() {
        this.chunkEmbeddings.clear();
    }

    /**
     * Get index statistics
     * @returns {object} - Index stats
     */
    getIndexStats() {
        return {
            indexedChunks: this.chunkEmbeddings.size,
            topK: this.topK,
            minSimilarity: this.minSimilarity
        };
    }
}

export default SimilarityMatcher;