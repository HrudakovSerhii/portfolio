/**
 * Fact Extractor Utility - Extract and structure facts from text chunks
 */

/**
 * Extract structured facts from similar chunks
 * @param {Array} similarChunks - Array of chunk results
 * @param {number} maxFacts - Maximum number of facts to extract
 * @returns {Array} - Array of structured facts
 */
export function extractStructuredFacts(similarChunks, maxFacts = 5) {
    const facts = [];
    const seenFacts = new Set();

    for (const result of similarChunks) {
        const chunkFacts = extractFactsFromChunk(result.chunk, result.similarity);
        
        for (const fact of chunkFacts) {
            // Avoid duplicate facts
            const factKey = normalizeFactText(fact.text);
            if (!seenFacts.has(factKey) && facts.length < maxFacts) {
                facts.push({
                    ...fact,
                    similarity: result.similarity,
                    source: result.chunk.metadata?.source || 'unknown'
                });
                seenFacts.add(factKey);
            }
        }
    }

    // Sort facts by relevance score
    return facts.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Extract facts from a single chunk
 * @param {object} chunk - Chunk object
 * @param {number} similarity - Similarity score
 * @returns {Array} - Array of facts
 */
export function extractFactsFromChunk(chunk, similarity) {
    const sentences = splitIntoSentences(chunk.text);
    const facts = [];

    for (const sentence of sentences) {
        if (isFactualStatement(sentence)) {
            const structuredFact = structureFact(sentence);
            if (structuredFact) {
                facts.push({
                    text: structuredFact,
                    original: sentence,
                    relevance: calculateFactRelevance(sentence, similarity),
                    type: classifyFactType(sentence)
                });
            }
        }
    }

    return facts;
}

/**
 * Structure a fact into a clear, concise format
 * @param {string} sentence - Original sentence
 * @returns {string} - Structured fact
 */
export function structureFact(sentence) {
    // Clean and normalize the sentence
    let fact = sentence.trim();
    
    // Ensure it ends with a period
    if (!fact.endsWith('.')) {
        fact += '.';
    }

    // Remove redundant words and improve clarity
    fact = fact
        .replace(/\b(well|actually|basically|essentially)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    return fact;
}

/**
 * Split text into sentences
 * @param {string} text - Input text
 * @returns {string[]} - Array of sentences
 */
export function splitIntoSentences(text) {
    return text.split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/**
 * Check if a sentence is factual
 * @param {string} sentence - Input sentence
 * @returns {boolean} - True if factual
 */
export function isFactualStatement(sentence) {
    const factualPatterns = [
        /\b(is|are|was|were|has|have|had|works|worked|specializes)\b/i,
        /\b\d+\+?\s*(years?|months?)\b/i,
        /\b(experience|expertise|background|role|position)\b/i,
        /\b(Senior|Lead|Principal|Manager|Developer|Engineer)\b/i
    ];

    return factualPatterns.some(pattern => pattern.test(sentence)) &&
           sentence.length > 10 && // Minimum length
           !sentence.includes('?') && // Not a question
           !/^(what|how|why|when|where|who)\b/i.test(sentence.trim()); // Not a question
}

/**
 * Classify the type of fact
 * @param {string} fact - Fact text
 * @returns {string} - Fact type
 */
export function classifyFactType(fact) {
    if (/\b(experience|years|worked|working)\b/i.test(fact)) return 'experience';
    if (/\b(role|position|title|manager|developer)\b/i.test(fact)) return 'role';
    if (/\b(skill|technology|language|framework|knows|javascript|python|react)\b/i.test(fact)) return 'skill';
    if (/\b(education|degree|university|studied)\b/i.test(fact)) return 'education';
    if (/\b(project|built|created|developed)\b/i.test(fact)) return 'project';
    return 'general';
}

/**
 * Calculate fact relevance score
 * @param {string} fact - Fact text
 * @param {number} similarity - Chunk similarity
 * @returns {number} - Relevance score
 */
export function calculateFactRelevance(fact, similarity) {
    let relevance = similarity * 0.7; // Base on similarity
    
    // Boost for specific patterns
    if (/\b\d+\+?\s*years?\b/i.test(fact)) relevance += 0.2;
    if (/\b(Senior|Lead|Principal)\b/i.test(fact)) relevance += 0.1;
    if (/\b(specializes|expert|proficient)\b/i.test(fact)) relevance += 0.1;
    
    return Math.min(relevance, 1.0);
}

/**
 * Normalize fact text for deduplication
 * @param {string} text - Fact text
 * @returns {string} - Normalized text
 */
export function normalizeFactText(text) {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}