/**
 * Context Fencer - Create structured fenced context for Q&A
 * Refactored to use utility modules for better modularity
 */

import * as factExtractor from './utils/fact-extractor.js';
import * as contextFormatter from './utils/context-formatter.js';

class ContextFencer {
    constructor(options = {}) {
        this.maxFacts = options.maxFacts || 5;
        this.formatOptions = {
            factPrefix: options.factPrefix || '* Fact:',
            questionPrefix: options.questionPrefix || '* Question:',
            answerPrefix: options.answerPrefix || '* Answer:'
        };
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

        // Extract and structure facts from chunks using utility
        const facts = factExtractor.extractStructuredFacts(similarChunks, this.maxFacts);
        
        // Build fenced context string using utility
        const contextString = contextFormatter.buildContextString(facts, question, this.formatOptions);
        
        // Calculate overall confidence using utility
        const confidence = contextFormatter.calculateContextConfidence(similarChunks, facts, this.maxFacts);

        return {
            context: contextString,
            facts,
            hasContext: facts.length > 0,
            confidence,
            metadata: contextFormatter.createContextMetadata(similarChunks, facts)
        };
    }


}

export default ContextFencer;