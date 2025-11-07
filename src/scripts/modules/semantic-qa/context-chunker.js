/**
 * Context Chunker - Split large context into semantic chunks
 */

class ContextChunker {
    constructor(options = {}) {
        this.maxChunkSize = options.maxChunkSize || 200; // words
        this.overlapSize = options.overlapSize || 20; // words
        this.preserveBoundaries = options.preserveBoundaries !== false;
    }

    /**
     * Split text into semantic chunks
     * @param {string} text - Input text to chunk
     * @param {object} metadata - Optional metadata for chunks
     * @returns {Array} - Array of chunk objects
     */
    chunkText(text, metadata = {}) {
        if (!text || typeof text !== 'string') {
            return [];
        }

        // Clean and normalize text
        const cleanText = this.cleanText(text);
        
        // Split into sentences first to preserve semantic boundaries
        const sentences = this.splitIntoSentences(cleanText);
        
        // Group sentences into chunks
        const chunks = this.groupSentencesIntoChunks(sentences);
        
        // Create chunk objects with metadata
        return chunks.map((chunk, index) => ({
            id: `chunk_${index}`,
            text: chunk.trim(),
            wordCount: this.countWords(chunk),
            metadata: {
                ...metadata,
                index,
                source: metadata.source || 'unknown'
            }
        }));
    }

    /**
     * Clean and normalize text
     * @param {string} text - Raw text
     * @returns {string} - Cleaned text
     */
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .trim();
    }

    /**
     * Split text into sentences
     * @param {string} text - Input text
     * @returns {string[]} - Array of sentences
     */
    splitIntoSentences(text) {
        // Simple sentence splitting - can be enhanced with more sophisticated NLP
        const sentences = text.split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        return sentences;
    }

    /**
     * Group sentences into chunks based on word count
     * @param {string[]} sentences - Array of sentences
     * @returns {string[]} - Array of chunks
     */
    groupSentencesIntoChunks(sentences) {
        const chunks = [];
        let currentChunk = '';
        let currentWordCount = 0;

        for (const sentence of sentences) {
            const sentenceWordCount = this.countWords(sentence);
            
            // If adding this sentence would exceed max chunk size
            if (currentWordCount + sentenceWordCount > this.maxChunkSize && currentChunk) {
                chunks.push(currentChunk);
                
                // Start new chunk with overlap if enabled
                if (this.overlapSize > 0) {
                    currentChunk = this.getOverlapText(currentChunk, this.overlapSize) + ' ' + sentence;
                    currentWordCount = this.countWords(currentChunk);
                } else {
                    currentChunk = sentence;
                    currentWordCount = sentenceWordCount;
                }
            } else {
                // Add sentence to current chunk
                currentChunk = currentChunk ? currentChunk + '. ' + sentence : sentence;
                currentWordCount += sentenceWordCount;
            }
        }

        // Add the last chunk if it has content
        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    /**
     * Get overlap text from the end of a chunk
     * @param {string} text - Source text
     * @param {number} wordCount - Number of words to extract
     * @returns {string} - Overlap text
     */
    getOverlapText(text, wordCount) {
        const words = text.split(/\s+/);
        if (words.length <= wordCount) {
            return text;
        }
        
        return words.slice(-wordCount).join(' ');
    }

    /**
     * Count words in text
     * @param {string} text - Input text
     * @returns {number} - Word count
     */
    countWords(text) {
        return text.split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Extract structured facts from text chunks
     * @param {Array} chunks - Array of chunk objects
     * @returns {Array} - Array of structured facts
     */
    extractFacts(chunks) {
        const facts = [];

        for (const chunk of chunks) {
            // Simple fact extraction - can be enhanced with NLP
            const sentences = this.splitIntoSentences(chunk.text);
            
            for (const sentence of sentences) {
                if (this.isFactualStatement(sentence)) {
                    facts.push({
                        text: sentence,
                        source: chunk.metadata.source,
                        chunkId: chunk.id,
                        confidence: this.calculateFactConfidence(sentence)
                    });
                }
            }
        }

        return facts;
    }

    /**
     * Determine if a sentence is a factual statement
     * @param {string} sentence - Input sentence
     * @returns {boolean} - True if factual
     */
    isFactualStatement(sentence) {
        // Simple heuristics - can be improved
        const factualIndicators = [
            /\b(is|are|was|were|has|have|had)\b/i,
            /\b(works|worked|working)\b/i,
            /\b(experience|years|since)\b/i,
            /\b(specializes|focuses|manages)\b/i
        ];

        return factualIndicators.some(pattern => pattern.test(sentence)) &&
               !sentence.includes('?') && // Not a question
               !/^(what|how|why|when|where|who)\b/i.test(sentence.trim()); // Not a question
    }

    /**
     * Calculate confidence score for a fact
     * @param {string} fact - Fact text
     * @returns {number} - Confidence score (0-1)
     */
    calculateFactConfidence(fact) {
        let confidence = 0.5; // Base confidence
        
        // Increase confidence for specific patterns
        if (/\b\d+\+?\s*(years?|months?)\b/i.test(fact)) confidence += 0.2;
        if (/\b(Senior|Lead|Principal|Manager)\b/i.test(fact)) confidence += 0.1;
        if (/\b(specializes|expert|proficient)\b/i.test(fact)) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }
}

export default ContextChunker;