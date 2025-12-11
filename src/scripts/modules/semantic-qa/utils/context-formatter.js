/**
 * Context Formatter Utility - Format CV context for small LLM models
 * Optimized for SmolLM2-135M-Instruct with concise, structured prompts
 */

/**
 * Build optimized context string for small LLM models
 * @param {Array} relevantSections - Array of relevant CV sections
 * @param {string} question - User question
 * @param {string} communicationStyle - Communication style ('hr', 'developer', 'friend')
 * @param {Object} options - Formatting options
 * @returns {string} - Optimized context string for small LLM
 */
export function buildContextString(relevantSections, question, communicationStyle = 'developer', options = {}) {
    const {
        maxContextLength = 400,    // Shorter context for small LLM
        includePersonality = false,
        conciseMode = true
    } = options;

    if (!Array.isArray(relevantSections) || relevantSections.length === 0) {
        return '';
    }

    const contextParts = [];
    
    // Add relevant CV information (limit to 1-2 sections for small LLM)
    const sectionsToUse = relevantSections.slice(0, 2);
    
    for (const sectionMatch of sectionsToUse) {
        const section = sectionMatch.section;
        if (!section) continue;

        // Use appropriate communication style response
        const response = section.responses && section.responses[communicationStyle] 
            ? section.responses[communicationStyle]
            : section.responses?.developer || section.embeddingSourceText;

        if (response) {
            // Truncate if too long for small LLM
            const truncatedResponse = conciseMode && response.length > 150 
                ? response.substring(0, 147) + '...'
                : response;
            contextParts.push(`Info: ${truncatedResponse}`);
        }
    }

    // Add question
    contextParts.push(`Question: ${question}`);
    contextParts.push(`Answer:`);

    const fullContext = contextParts.join('\n');
    
    // Ensure context doesn't exceed max length for small LLM
    if (fullContext.length > maxContextLength) {
        const truncatedParts = contextParts.slice(0, -2); // Keep question and answer prompt
        const truncatedInfo = truncatedParts.join('\n').substring(0, maxContextLength - 50);
        return `${truncatedInfo}\nQuestion: ${question}\nAnswer:`;
    }

    return fullContext;
}

/**
 * Calculate context confidence for small LLM optimization
 * @param {Array} relevantSections - Relevant CV sections
 * @param {string} query - User query
 * @param {Object} options - Confidence calculation options
 * @returns {number} - Confidence score (0-1)
 */
export function calculateContextConfidence(relevantSections, query, options = {}) {
    if (!Array.isArray(relevantSections) || relevantSections.length === 0) {
        return 0;
    }

    const {
        similarityWeight = 0.4,
        keywordWeight = 0.3,
        priorityWeight = 0.2,
        confidenceWeight = 0.1
    } = options;

    // Average similarity score
    const avgSimilarity = relevantSections.reduce((sum, section) => {
        return sum + (section.finalScore || section.weightedSimilarity || section.similarity || 0);
    }, 0) / relevantSections.length;

    // Keyword match quality
    let keywordScore = 0;
    if (query && typeof query === 'string') {
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const totalMatches = relevantSections.reduce((sum, section) => {
            return sum + (section.matchedKeywords ? section.matchedKeywords.length : 0);
        }, 0);
        keywordScore = Math.min(1.0, totalMatches / Math.max(1, queryWords.length));
    }

    // Priority score (higher for priority 1-2 sections)
    const priorityScore = relevantSections.reduce((sum, section) => {
        if (section.section && section.section.priority) {
            return sum + ((6 - section.section.priority) / 5);
        }
        return sum + 0.6; // Default priority score
    }, 0) / relevantSections.length;

    // Section confidence score
    const sectionConfidence = relevantSections.reduce((sum, section) => {
        return sum + (section.section && section.section.confidence ? section.section.confidence : 1.0);
    }, 0) / relevantSections.length;

    return (avgSimilarity * similarityWeight) + 
           (keywordScore * keywordWeight) + 
           (priorityScore * priorityWeight) + 
           (sectionConfidence * confidenceWeight);
}

/**
 * Format response with communication style for small LLM
 * @param {string} baseResponse - Base LLM response
 * @param {string} communicationStyle - Communication style
 * @param {Object} cvData - CV data for personality context
 * @returns {string} - Styled response
 */
export function formatResponseWithStyle(baseResponse, communicationStyle, cvData) {
    if (!baseResponse || typeof baseResponse !== 'string') {
        return baseResponse;
    }

    // Get communication style context
    const styleContext = cvData?.personality?.communication_style?.[communicationStyle];
    if (!styleContext) {
        return baseResponse;
    }

    // Apply style-specific formatting
    switch (communicationStyle) {
        case 'hr':
            // Professional, metrics-focused
            return baseResponse.replace(/\b(I|me|my)\b/g, 'Serhii')
                              .replace(/!/g, '.');
        
        case 'friend':
            // Casual, enthusiastic - keep emojis and casual language
            return baseResponse;
        
        case 'developer':
        default:
            // Technical, direct - minimal changes
            return baseResponse;
    }
}

/**
 * Create context metadata for small LLM optimization
 * @param {Array} relevantSections - Relevant CV sections
 * @param {string} query - User query
 * @param {string} communicationStyle - Communication style
 * @returns {Object} - Context metadata
 */
export function createContextMetadata(relevantSections, query, communicationStyle) {
    return {
        sectionCount: relevantSections ? relevantSections.length : 0,
        communicationStyle: communicationStyle,
        queryLength: query ? query.length : 0,
        categories: getUniqueCategories(relevantSections),
        priorities: getPriorityDistribution(relevantSections),
        avgConfidence: calculateAverageConfidence(relevantSections),
        hasKeywordMatches: hasKeywordMatches(relevantSections)
    };
}

/**
 * Get unique categories from relevant sections
 * @param {Array} relevantSections - Relevant sections
 * @returns {Array} - Array of unique categories
 */
export function getUniqueCategories(relevantSections) {
    if (!Array.isArray(relevantSections)) return [];
    
    const categories = new Set();
    relevantSections.forEach(section => {
        if (section.category) {
            categories.add(section.category);
        }
    });
    
    return Array.from(categories);
}

/**
 * Get priority distribution from relevant sections
 * @param {Array} relevantSections - Relevant sections
 * @returns {Object} - Priority distribution
 */
export function getPriorityDistribution(relevantSections) {
    if (!Array.isArray(relevantSections)) return {};
    
    const distribution = {};
    relevantSections.forEach(section => {
        const priority = section.section?.priority || 3;
        distribution[priority] = (distribution[priority] || 0) + 1;
    });
    
    return distribution;
}

/**
 * Calculate average confidence from relevant sections
 * @param {Array} relevantSections - Relevant sections
 * @returns {number} - Average confidence score
 */
export function calculateAverageConfidence(relevantSections) {
    if (!Array.isArray(relevantSections) || relevantSections.length === 0) return 0;
    
    const totalConfidence = relevantSections.reduce((sum, section) => {
        return sum + (section.section?.confidence || 1.0);
    }, 0);
    
    return totalConfidence / relevantSections.length;
}

/**
 * Check if sections have keyword matches
 * @param {Array} relevantSections - Relevant sections
 * @returns {boolean} - True if any section has keyword matches
 */
export function hasKeywordMatches(relevantSections) {
    if (!Array.isArray(relevantSections)) return false;
    
    return relevantSections.some(section => 
        section.matchedKeywords && Array.isArray(section.matchedKeywords) && section.matchedKeywords.length > 0
    );
}