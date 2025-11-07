/**
 * Context Formatter Utility - Format facts and questions into structured context
 */

/**
 * Build the complete fenced context string
 * @param {Array} facts - Array of structured facts
 * @param {string} question - User question
 * @param {object} options - Formatting options
 * @returns {string} - Fenced context string
 */
export function buildContextString(facts, question, options = {}) {
    const {
        factPrefix = '* Fact:',
        questionPrefix = '* Question:',
        answerPrefix = '* Answer:'
    } = options;

    if (facts.length === 0) {
        return '';
    }

    const lines = [];
    
    // Add facts
    for (const fact of facts) {
        lines.push(`${factPrefix} ${fact.text}`);
    }
    
    // Add question
    lines.push(`${questionPrefix} ${question}`);
    
    // Add answer placeholder
    lines.push(`${answerPrefix}`);

    return lines.join('\n');
}

/**
 * Calculate overall context confidence
 * @param {Array} similarChunks - Similar chunks
 * @param {Array} facts - Extracted facts
 * @param {number} maxFacts - Maximum number of facts
 * @returns {number} - Confidence score
 */
export function calculateContextConfidence(similarChunks, facts, maxFacts = 5) {
    if (facts.length === 0) return 0;

    const avgSimilarity = calculateAverageSimilarity(similarChunks);
    const factQuality = facts.reduce((sum, fact) => sum + fact.relevance, 0) / facts.length;
    const factCount = Math.min(facts.length / maxFacts, 1);

    return (avgSimilarity * 0.4) + (factQuality * 0.4) + (factCount * 0.2);
}

/**
 * Calculate average similarity score
 * @param {Array} similarChunks - Similar chunks
 * @returns {number} - Average similarity
 */
export function calculateAverageSimilarity(similarChunks) {
    if (similarChunks.length === 0) return 0;
    
    const totalSimilarity = similarChunks.reduce((sum, chunk) => sum + chunk.similarity, 0);
    return totalSimilarity / similarChunks.length;
}

/**
 * Create context metadata
 * @param {Array} similarChunks - Similar chunks
 * @param {Array} facts - Extracted facts
 * @returns {object} - Context metadata
 */
export function createContextMetadata(similarChunks, facts) {
    return {
        chunkCount: similarChunks.length,
        factCount: facts.length,
        avgSimilarity: calculateAverageSimilarity(similarChunks),
        factTypes: getFactTypeDistribution(facts),
        sources: getUniqueSources(facts)
    };
}

/**
 * Get distribution of fact types
 * @param {Array} facts - Array of facts
 * @returns {object} - Fact type distribution
 */
export function getFactTypeDistribution(facts) {
    const distribution = {};
    
    for (const fact of facts) {
        distribution[fact.type] = (distribution[fact.type] || 0) + 1;
    }
    
    return distribution;
}

/**
 * Get unique sources from facts
 * @param {Array} facts - Array of facts
 * @returns {Array} - Array of unique sources
 */
export function getUniqueSources(facts) {
    const sources = new Set();
    
    for (const fact of facts) {
        if (fact.source) {
            sources.add(fact.source);
        }
    }
    
    return Array.from(sources);
}