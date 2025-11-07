/**
 * Q&A Engine - Generate answers using fenced context and system prompts
 */

class QAEngine {
    constructor(options = {}) {
        this.systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
        this.maxResponseLength = options.maxResponseLength || 200;
        this.confidenceThreshold = options.confidenceThreshold || 0.3;
        this.fallbackMessage = options.fallbackMessage || "I do not have that information.";
    }

    /**
     * Generate answer based on fenced context
     * @param {string} question - User question
     * @param {object} fencedContext - Fenced context object
     * @param {object} options - Generation options
     * @returns {Promise<object>} - Answer object
     */
    async generateAnswer(question, fencedContext, options = {}) {
        // Check if we have sufficient context
        if (!fencedContext.hasContext || fencedContext.confidence < this.confidenceThreshold) {
            return this.createFallbackResponse(question, fencedContext);
        }

        try {
            // Try LLM-based generation first if available
            if (options.llmService && fencedContext.confidence > 0.6) {
                const llmAnswer = await this.generateLLMAnswer(question, fencedContext, options.llmService);
                if (llmAnswer) {
                    return {
                        answer: llmAnswer,
                        confidence: fencedContext.confidence,
                        method: 'llm-based',
                        context: fencedContext.context,
                        facts: fencedContext.facts,
                        metadata: {
                            ...fencedContext.metadata,
                            responseTime: Date.now()
                        }
                    };
                }
            }

            // Use rule-based approach for fast, reliable answers
            const ruleBasedAnswer = this.generateRuleBasedAnswer(question, fencedContext);
            
            if (ruleBasedAnswer) {
                return {
                    answer: ruleBasedAnswer,
                    confidence: fencedContext.confidence,
                    method: 'rule-based',
                    context: fencedContext.context,
                    facts: fencedContext.facts,
                    metadata: {
                        ...fencedContext.metadata,
                        responseTime: Date.now()
                    }
                };
            }

            // Fallback to template-based generation
            const templateAnswer = this.generateTemplateAnswer(question, fencedContext);
            
            return {
                answer: templateAnswer,
                confidence: fencedContext.confidence * 0.8, // Slightly lower confidence
                method: 'template-based',
                context: fencedContext.context,
                facts: fencedContext.facts,
                metadata: {
                    ...fencedContext.metadata,
                    responseTime: Date.now()
                }
            };

        } catch (error) {
            console.error('Failed to generate answer:', error);
            return this.createErrorResponse(question, error);
        }
    }

    /**
     * Generate rule-based answer using pattern matching
     * @param {string} question - User question
     * @param {object} fencedContext - Fenced context
     * @returns {string|null} - Generated answer or null
     */
    generateRuleBasedAnswer(question, fencedContext) {
        const questionLower = question.toLowerCase();
        const facts = fencedContext.facts;

        // Experience questions
        if (this.matchesPattern(questionLower, ['experience', 'years', 'how long'])) {
            const experienceFact = facts.find(f => 
                f.type === 'experience' || /\b\d+\+?\s*years?\b/i.test(f.text)
            );
            if (experienceFact) {
                return this.extractExperienceAnswer(experienceFact.text, questionLower);
            }
        }

        // Role/position questions
        if (this.matchesPattern(questionLower, ['role', 'position', 'job', 'title', 'what does', 'who is'])) {
            const roleFact = facts.find(f => 
                f.type === 'role' || /\b(Senior|Lead|Principal|Manager|Developer|Engineer)\b/i.test(f.text)
            );
            if (roleFact) {
                return this.extractRoleAnswer(roleFact.text, questionLower);
            }
        }

        // Skill/technology questions
        if (this.matchesPattern(questionLower, ['skill', 'technology', 'know', 'familiar', 'use'])) {
            const skillFacts = facts.filter(f => 
                f.type === 'skill' || this.containsTechnology(f.text)
            );
            if (skillFacts.length > 0) {
                return this.extractSkillAnswer(skillFacts, questionLower);
            }
        }

        // Yes/No questions
        if (this.isYesNoQuestion(questionLower)) {
            return this.generateYesNoAnswer(questionLower, facts);
        }

        return null;
    }

    /**
     * Extract experience-related answer
     * @param {string} factText - Fact containing experience info
     * @param {string} question - Original question
     * @returns {string} - Experience answer
     */
    extractExperienceAnswer(factText, question) {
        const yearMatch = factText.match(/\b(\d+)\+?\s*years?\b/i);
        if (yearMatch) {
            const years = yearMatch[1];
            const technology = this.extractTechnology(factText);
            
            if (technology) {
                return `Yes, ${years}+ years of experience with ${technology}.`;
            } else {
                return `${years}+ years of experience.`;
            }
        }
        
        return factText.replace(/^[^.]*\./, '').trim();
    }

    /**
     * Extract role-related answer
     * @param {string} factText - Fact containing role info
     * @param {string} question - Original question
     * @returns {string} - Role answer
     */
    extractRoleAnswer(factText, question) {
        const roleMatch = factText.match(/\b(Senior|Lead|Principal|Manager|Developer|Engineer|Analyst)[^.]*\b/i);
        if (roleMatch) {
            return roleMatch[0] + '.';
        }
        
        return factText;
    }

    /**
     * Extract skill-related answer
     * @param {Array} skillFacts - Facts containing skill info
     * @param {string} question - Original question
     * @returns {string} - Skill answer
     */
    extractSkillAnswer(skillFacts, question) {
        const technologies = [];
        
        for (const fact of skillFacts) {
            const tech = this.extractTechnology(fact.text);
            if (tech) technologies.push(tech);
        }
        
        if (technologies.length > 0) {
            return `Yes, experienced with ${technologies.join(', ')}.`;
        }
        
        return skillFacts[0].text;
    }

    /**
     * Generate Yes/No answer
     * @param {string} question - Question text
     * @param {Array} facts - Available facts
     * @returns {string} - Yes/No answer
     */
    generateYesNoAnswer(question, facts) {
        // Extract key terms from question
        const keyTerms = this.extractKeyTerms(question);
        
        // Check if any fact contains these terms
        for (const fact of facts) {
            const factLower = fact.text.toLowerCase();
            const hasMatch = keyTerms.some(term => factLower.includes(term));
            
            if (hasMatch) {
                // Extract relevant part of the fact
                const relevantPart = this.extractRelevantPart(fact.text, keyTerms);
                return `Yes, ${relevantPart}`;
            }
        }
        
        return "No, I don't have that information.";
    }

    /**
     * Generate template-based answer
     * @param {string} question - User question
     * @param {object} fencedContext - Fenced context
     * @returns {string} - Template-based answer
     */
    generateTemplateAnswer(question, fencedContext) {
        const facts = fencedContext.facts;
        
        if (facts.length === 0) {
            return this.fallbackMessage;
        }

        // Use the most relevant fact
        const topFact = facts[0];
        
        // Simple template based on fact type
        switch (topFact.type) {
            case 'experience':
                return `Based on the information available: ${topFact.text}`;
            case 'role':
                return `${topFact.text}`;
            case 'skill':
                return `Yes, ${topFact.text}`;
            default:
                return topFact.text;
        }
    }

    /**
     * Create fallback response
     * @param {string} question - Original question
     * @param {object} fencedContext - Context object
     * @returns {object} - Fallback response
     */
    createFallbackResponse(question, fencedContext) {
        return {
            answer: this.fallbackMessage,
            confidence: 0,
            method: 'fallback',
            context: '',
            facts: [],
            metadata: {
                reason: fencedContext.hasContext ? 'low_confidence' : 'no_context',
                originalConfidence: fencedContext.confidence
            }
        };
    }

    /**
     * Create error response
     * @param {string} question - Original question
     * @param {Error} error - Error object
     * @returns {object} - Error response
     */
    createErrorResponse(question, error) {
        return {
            answer: "I encountered an error processing your question.",
            confidence: 0,
            method: 'error',
            context: '',
            facts: [],
            metadata: {
                error: error.message,
                timestamp: Date.now()
            }
        };
    }

    /**
     * Check if question matches patterns
     * @param {string} question - Question text
     * @param {string[]} patterns - Patterns to match
     * @returns {boolean} - True if matches
     */
    matchesPattern(question, patterns) {
        return patterns.some(pattern => question.includes(pattern));
    }

    /**
     * Check if question is Yes/No type
     * @param {string} question - Question text
     * @returns {boolean} - True if Yes/No question
     */
    isYesNoQuestion(question) {
        const yesNoIndicators = ['does', 'is', 'are', 'has', 'have', 'can', 'will', 'would'];
        return yesNoIndicators.some(indicator => question.startsWith(indicator));
    }

    /**
     * Extract technology names from text
     * @param {string} text - Input text
     * @returns {string|null} - Technology name
     */
    extractTechnology(text) {
        const techPatterns = [
            /\b(React|JavaScript|Python|Java|Node\.js|TypeScript|Angular|Vue)\b/i,
            /\b(HTML|CSS|SCSS|SQL|MongoDB|PostgreSQL|MySQL)\b/i,
            /\b(AWS|Azure|Docker|Kubernetes|Git|Jenkins)\b/i
        ];
        
        for (const pattern of techPatterns) {
            const match = text.match(pattern);
            if (match) return match[0];
        }
        
        return null;
    }

    /**
     * Check if text contains technology terms
     * @param {string} text - Input text
     * @returns {boolean} - True if contains tech terms
     */
    containsTechnology(text) {
        return this.extractTechnology(text) !== null;
    }

    /**
     * Extract key terms from question
     * @param {string} question - Question text
     * @returns {string[]} - Key terms
     */
    extractKeyTerms(question) {
        const stopWords = new Set(['does', 'is', 'are', 'has', 'have', 'the', 'a', 'an']);
        return question.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
            .slice(0, 5);
    }

    /**
     * Extract relevant part of fact based on key terms
     * @param {string} factText - Fact text
     * @param {string[]} keyTerms - Key terms to match
     * @returns {string} - Relevant part
     */
    extractRelevantPart(factText, keyTerms) {
        // Find sentence containing key terms
        const sentences = factText.split(/[.!?]+/);
        
        for (const sentence of sentences) {
            const sentenceLower = sentence.toLowerCase();
            if (keyTerms.some(term => sentenceLower.includes(term))) {
                return sentence.trim() + '.';
            }
        }
        
        return factText;
    }

    /**
     * Generate LLM-based answer using SmolLM2
     * @param {string} question - User question
     * @param {object} fencedContext - Fenced context
     * @param {object} llmService - LLM service instance
     * @returns {Promise<string|null>} - Generated answer or null
     */
    async generateLLMAnswer(question, fencedContext, llmService) {
        try {
            // Create the prompt with system instructions and fenced context
            const prompt = this.createLLMPrompt(question, fencedContext);
            
            // Generate response using SmolLM2
            const response = await llmService.generateResponse(prompt, {
                maxTokens: 150,
                temperature: 0.3, // Low temperature for factual responses
                stopSequences: ['\n\n', 'Question:', 'Context:']
            });
            
            // Clean and validate the response
            const cleanAnswer = this.cleanLLMResponse(response);
            
            // Validate that the answer is based on the context
            if (this.validateAnswerAgainstContext(cleanAnswer, fencedContext)) {
                return cleanAnswer;
            }
            
            return null; // Fall back to rule-based if validation fails
            
        } catch (error) {
            console.error('LLM answer generation failed:', error);
            return null; // Fall back to rule-based
        }
    }

    /**
     * Create LLM prompt with fenced context
     * @param {string} question - User question
     * @param {object} fencedContext - Fenced context
     * @returns {string} - Formatted prompt
     */
    createLLMPrompt(question, fencedContext) {
        return `${this.systemPrompt}

**Relevant Context:**
${fencedContext.context}

**Instructions:**
- Answer based ONLY on the facts provided above
- Be direct and concise (1-2 sentences maximum)
- If the answer is not in the context, say "I do not have that information"
- Do not add speculation or external knowledge

**Answer:**`;
    }

    /**
     * Clean LLM response
     * @param {string} response - Raw LLM response
     * @returns {string} - Cleaned response
     */
    cleanLLMResponse(response) {
        return response
            .trim()
            .replace(/^(Answer:|A:)/i, '') // Remove answer prefixes
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    /**
     * Validate answer against context
     * @param {string} answer - Generated answer
     * @param {object} fencedContext - Fenced context
     * @returns {boolean} - True if valid
     */
    validateAnswerAgainstContext(answer, fencedContext) {
        // Check if answer contains hallucinated information
        const answerLower = answer.toLowerCase();
        
        // Allow fallback responses
        if (answerLower.includes('do not have') || answerLower.includes('not available')) {
            return true;
        }
        
        // Check if key terms in answer exist in context
        const contextText = fencedContext.facts.map(f => f.text).join(' ').toLowerCase();
        const answerWords = answerLower.split(/\W+/).filter(w => w.length > 3);
        
        // At least 50% of significant words should be in context
        const contextWords = contextText.split(/\W+/);
        const matchingWords = answerWords.filter(word => 
            contextWords.some(contextWord => 
                contextWord.includes(word) || word.includes(contextWord)
            )
        );
        
        return matchingWords.length / answerWords.length >= 0.5;
    }

    /**
     * Get default system prompt
     * @returns {string} - Default system prompt
     */
    getDefaultSystemPrompt() {
        return `You are a helpful Q&A assistant. You must follow these rules:
1. Answer the user's question based ONLY on the "Relevant Context" provided.
2. Do not use any information outside of this context.
3. Be direct and concise.
4. If the answer is not in the context, say "I do not have that information."
5. Use facts exactly as provided without adding speculation.`;
    }
}

export default QAEngine;