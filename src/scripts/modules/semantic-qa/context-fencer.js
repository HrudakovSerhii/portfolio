/**
 * Context Fencer - Create structured fenced context for Q&A
 */

class ContextFencer {
    constructor(options = {}) {
        this.maxFacts = options.maxFacts || 5;
        this.factPrefix = options.factPrefix || '* Fact:';
        this.questionPrefix = options.questionPrefix || '* Question:';
        this.answerPrefix = options.answerPrefix || '* Answer:';
    }

    /**
     * Create fenced context from similar chunks
     * @param {Array} similarChunks - Array of similar chunk results
     * @param {string} question - User question
     * @returns {object} - Fenced context object
     */
    createFencedContext(similarChunks, question) {
        if (!similarChunks || similarChunks.length === 0) {
            return {
                context: '',
                facts: [],
                hasContext: false,
                confidence: 0
            };
        }

        // Extract and structure facts from chunks
        const facts = this.extractStructuredFacts(similarChunks);
        
        // Build fenced context string
        const contextString = this.buildContextString(facts, question);
        
        // Calculate overall confidence
        const confidence = this.calculateContextConfidence(similarChunks, facts);

        return {
            context: contextString,
            facts,
            hasContext: facts.length > 0,
            confidence,
            metadata: {
                chunkCount: similarChunks.length,
                factCount: facts.length,
                avgSimilarity: this.calculateAverageSimilarity(similarChunks)
            }
        };
    }

    /**
     * Extract structured facts from similar chunks
     * @param {Array} similarChunks - Array of chunk results
     * @returns {Array} - Array of structured facts
     */
    extractStructuredFacts(similarChunks) {
        const facts = [];
        const seenFacts = new Set();

        for (const result of similarChunks) {
            const chunkFacts = this.extractFactsFromChunk(result.chunk, result.similarity);
            
            for (const fact of chunkFacts) {
                // Avoid duplicate facts
                const factKey = this.normalizeFactText(fact.text);
                if (!seenFacts.has(factKey) && facts.length < this.maxFacts) {
                    facts.push({
                        ...fact,
                        similarity: result.similarity,
                        source: result.chunk.metadata.source
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
    extractFactsFromChunk(chunk, similarity) {
        const sentences = this.splitIntoSentences(chunk.text);
        const facts = [];

        for (const sentence of sentences) {
            if (this.isFactualStatement(sentence)) {
                const structuredFact = this.structureFact(sentence);
                if (structuredFact) {
                    facts.push({
                        text: structuredFact,
                        original: sentence,
                        relevance: this.calculateFactRelevance(sentence, similarity),
                        type: this.classifyFactType(sentence)
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
    structureFact(sentence) {
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
     * Build the complete fenced context string
     * @param {Array} facts - Array of structured facts
     * @param {string} question - User question
     * @returns {string} - Fenced context string
     */
    buildContextString(facts, question) {
        if (facts.length === 0) {
            return '';
        }

        const lines = [];
        
        // Add facts
        for (const fact of facts) {
            lines.push(`${this.factPrefix} ${fact.text}`);
        }
        
        // Add question
        lines.push(`${this.questionPrefix} ${question}`);
        
        // Add answer placeholder
        lines.push(`${this.answerPrefix}`);

        return lines.join('\n');
    }

    /**
     * Split text into sentences
     * @param {string} text - Input text
     * @returns {string[]} - Array of sentences
     */
    splitIntoSentences(text) {
        return text.split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    /**
     * Check if a sentence is factual
     * @param {string} sentence - Input sentence
     * @returns {boolean} - True if factual
     */
    isFactualStatement(sentence) {
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
    classifyFactType(fact) {
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
    calculateFactRelevance(fact, similarity) {
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
    normalizeFactText(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Calculate overall context confidence
     * @param {Array} similarChunks - Similar chunks
     * @param {Array} facts - Extracted facts
     * @returns {number} - Confidence score
     */
    calculateContextConfidence(similarChunks, facts) {
        if (facts.length === 0) return 0;

        const avgSimilarity = this.calculateAverageSimilarity(similarChunks);
        const factQuality = facts.reduce((sum, fact) => sum + fact.relevance, 0) / facts.length;
        const factCount = Math.min(facts.length / this.maxFacts, 1);

        return (avgSimilarity * 0.4) + (factQuality * 0.4) + (factCount * 0.2);
    }

    /**
     * Calculate average similarity score
     * @param {Array} similarChunks - Similar chunks
     * @returns {number} - Average similarity
     */
    calculateAverageSimilarity(similarChunks) {
        if (similarChunks.length === 0) return 0;
        
        const totalSimilarity = similarChunks.reduce((sum, chunk) => sum + chunk.similarity, 0);
        return totalSimilarity / similarChunks.length;
    }
}

export default ContextFencer;