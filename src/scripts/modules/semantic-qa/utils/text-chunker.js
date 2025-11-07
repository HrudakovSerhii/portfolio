/**
 * Text Chunker Utility - Split large text into semantic chunks
 */

/**
 * Split text into semantic chunks
 * @param {string} text - Input text to chunk
 * @param {object} metadata - Optional metadata for chunks
 * @param {object} options - Chunking options
 * @returns {Array} - Array of chunk objects
 */
export function chunkText(text, metadata = {}, options = {}) {
    const {
        maxChunkSize = 200, // words
        overlapSize = 20, // words
        preserveBoundaries = true
    } = options;

    if (!text || typeof text !== 'string') {
        return [];
    }

    // Clean and normalize text
    const cleanText = cleanText(text);
    
    // Split into sentences first to preserve semantic boundaries
    const sentences = splitIntoSentences(cleanText);
    
    // Group sentences into chunks
    const chunks = groupSentencesIntoChunks(sentences, maxChunkSize, overlapSize);
    
    // Create chunk objects with metadata
    return chunks.map((chunk, index) => ({
        id: `chunk_${index}`,
        text: chunk.trim(),
        wordCount: countWords(chunk),
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
export function cleanText(text) {
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
export function splitIntoSentences(text) {
    // Simple sentence splitting - can be enhanced with more sophisticated NLP
    const sentences = text.split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    return sentences;
}

/**
 * Group sentences into chunks based on word count
 * @param {string[]} sentences - Array of sentences
 * @param {number} maxChunkSize - Maximum words per chunk
 * @param {number} overlapSize - Words to overlap between chunks
 * @returns {string[]} - Array of chunks
 */
export function groupSentencesIntoChunks(sentences, maxChunkSize = 200, overlapSize = 20) {
    const chunks = [];
    let currentChunk = '';
    let currentWordCount = 0;

    for (const sentence of sentences) {
        const sentenceWordCount = countWords(sentence);
        
        // If adding this sentence would exceed max chunk size
        if (currentWordCount + sentenceWordCount > maxChunkSize && currentChunk) {
            chunks.push(currentChunk);
            
            // Start new chunk with overlap if enabled
            if (overlapSize > 0) {
                currentChunk = getOverlapText(currentChunk, overlapSize) + ' ' + sentence;
                currentWordCount = countWords(currentChunk);
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
export function getOverlapText(text, wordCount) {
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
export function countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
}