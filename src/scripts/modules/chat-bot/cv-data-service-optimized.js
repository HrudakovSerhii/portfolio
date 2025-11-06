/**
 * Optimized CV Data Service for Text Generation Models
 * Simplified structure focused on clear context building and semantic matching
 */

class OptimizedCVDataService {
  constructor() {
    this.cvData = null;
    this.isLoaded = false;
    this.keywordIndex = new Map();
    this.semanticIndex = new Map();
  }

  /**
   * Load optimized CV data
   */
  async loadCVData() {
    try {
      if (this.isLoaded && this.cvData) {
        return this.cvData;
      }

      const response = await fetch('/data/chat-bot/cv-data-optimized.json');
      if (!response.ok) {
        throw new Error(`Failed to load CV data: ${response.status}`);
      }

      const data = await response.json();
      this.cvData = data;
      this.isLoaded = true;

      // Build search indexes
      this.buildSearchIndexes();

      return this.cvData;
    } catch (error) {
      throw new Error(`CV data loading failed: ${error.message}`);
    }
  }

  /**
   * Build keyword and semantic search indexes
   */
  buildSearchIndexes() {
    if (!this.cvData?.knowledge_base) return;

    // Clear existing indexes
    this.keywordIndex.clear();
    this.semanticIndex.clear();

    // Build indexes from knowledge base
    for (const [topicId, topic] of Object.entries(this.cvData.knowledge_base)) {
      // Index keywords
      if (topic.keywords) {
        topic.keywords.forEach(keyword => {
          const normalizedKeyword = keyword.toLowerCase();
          if (!this.keywordIndex.has(normalizedKeyword)) {
            this.keywordIndex.set(normalizedKeyword, []);
          }
          this.keywordIndex.get(normalizedKeyword).push({
            topicId,
            topic,
            matchType: 'exact'
          });
        });
      }

      // Index semantic terms from content
      if (topic.content) {
        const semanticTerms = this.extractSemanticTerms(topic.content);
        semanticTerms.forEach(term => {
          if (!this.semanticIndex.has(term)) {
            this.semanticIndex.set(term, []);
          }
          this.semanticIndex.get(term).push({
            topicId,
            topic,
            matchType: 'semantic'
          });
        });
      }
    }
  }

  /**
   * Extract semantic terms from content for better matching
   */
  extractSemanticTerms(content) {
    const terms = new Set();
    const text = content.toLowerCase();

    // Technical terms and patterns
    const technicalPatterns = [
      /\b(framework|library|api|database|frontend|backend|fullstack|full-stack)\b/g,
      /\b(experience|years|built|developed|created|implemented|worked)\b/g,
      /\b(project|application|website|platform|dashboard|system)\b/g,
      /\b(performance|optimization|responsive|real-time|scalable)\b/g
    ];

    technicalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => terms.add(match));
      }
    });

    return Array.from(terms);
  }

  /**
   * Find relevant topics based on query with improved matching
   */
  findRelevantTopics(query, maxResults = 3) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    const matches = new Map();

    // Direct keyword matching (highest priority)
    queryWords.forEach(word => {
      const keywordMatches = this.keywordIndex.get(word);
      if (keywordMatches) {
        keywordMatches.forEach(match => {
          const key = match.topicId;
          if (!matches.has(key)) {
            matches.set(key, {
              ...match,
              score: 0,
              matchedTerms: []
            });
          }
          matches.get(key).score += 3; // High score for exact keyword match
          matches.get(key).matchedTerms.push(word);
        });
      }
    });

    // Semantic matching (medium priority)
    queryWords.forEach(word => {
      const semanticMatches = this.semanticIndex.get(word);
      if (semanticMatches) {
        semanticMatches.forEach(match => {
          const key = match.topicId;
          if (!matches.has(key)) {
            matches.set(key, {
              ...match,
              score: 0,
              matchedTerms: []
            });
          }
          matches.get(key).score += 1; // Lower score for semantic match
          matches.get(key).matchedTerms.push(word);
        });
      }
    });

    // Content substring matching (lowest priority)
    if (matches.size < maxResults) {
      for (const [topicId, topic] of Object.entries(this.cvData.knowledge_base)) {
        if (!matches.has(topicId) && topic.content) {
          const contentLower = topic.content.toLowerCase();
          let substringScore = 0;
          const matchedSubstrings = [];

          queryWords.forEach(word => {
            if (contentLower.includes(word)) {
              substringScore += 0.5;
              matchedSubstrings.push(word);
            }
          });

          if (substringScore > 0) {
            matches.set(topicId, {
              topicId,
              topic,
              matchType: 'substring',
              score: substringScore,
              matchedTerms: matchedSubstrings
            });
          }
        }
      }
    }

    // Sort by score and return top results
    return Array.from(matches.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Build focused context for text generation
   */
  buildContext(relevantTopics, style = 'developer') {
    if (!relevantTopics || relevantTopics.length === 0) {
      return null;
    }

    // Use only the most relevant topic to avoid context confusion
    const primaryTopic = relevantTopics[0];
    const topic = primaryTopic.topic;

    let context = `About ${this.cvData.profile.name}:\n`;
    context += `${topic.content}\n`;

    // Add specific details if available
    if (topic.details) {
      if (topic.details.years) {
        context += `Experience: ${topic.details.years} years\n`;
      }
      if (topic.details.level) {
        context += `Skill level: ${topic.details.level}\n`;
      }
      if (topic.details.key_skills) {
        context += `Key skills: ${topic.details.key_skills.join(', ')}\n`;
      }
      if (topic.details.achievements) {
        context += `Notable achievements: ${topic.details.achievements.join(', ')}\n`;
      }
    }

    return context.trim();
  }

  /**
   * Create optimized prompt for text generation
   */
  createPrompt(question, context, style = 'developer', conversationHistory = []) {
    const styleConfig = this.cvData.communication_styles[style] || this.cvData.communication_styles.developer;
    
    let systemPrompt = `You are Serhii, a software developer. Respond in a ${styleConfig.tone} manner. `;
    
    // Style-specific instructions
    switch (style) {
      case 'hr':
        systemPrompt += 'Focus on professional achievements, experience, and qualifications. Be concise and highlight measurable results.';
        break;
      case 'developer':
        systemPrompt += 'Use technical language and share insights about technologies. Be conversational but knowledgeable.';
        break;
      case 'friend':
        systemPrompt += 'Be casual and enthusiastic. Use emojis when appropriate and make technical concepts accessible.';
        break;
    }

    let prompt = systemPrompt + '\n\n';

    if (context) {
      prompt += `Based on this information:\n${context}\n\n`;
    }

    prompt += `Question: ${question}\n\n`;
    prompt += 'Instructions:\n';
    prompt += '- Answer as Serhii in first person\n';
    prompt += '- Only use information provided in the context\n';
    prompt += '- If context doesn\'t contain relevant info, say so honestly\n';
    prompt += '- Keep response focused and under 150 words\n';
    prompt += '- Be specific and provide examples when possible\n\n';
    prompt += 'Answer:';

    return prompt;
  }

  /**
   * Get fallback response when no good match is found
   */
  getFallbackResponse(style = 'developer', confidence = 0) {
    const fallbacks = this.cvData.fallback_responses;
    
    if (confidence < 0.3) {
      return fallbacks.no_match[style];
    } else {
      return fallbacks.low_confidence[style];
    }
  }

  /**
   * Calculate confidence based on matching quality
   */
  calculateConfidence(relevantTopics, query) {
    if (!relevantTopics || relevantTopics.length === 0) {
      return 0.1;
    }

    const bestMatch = relevantTopics[0];
    let confidence = 0.5; // Base confidence

    // Boost confidence based on match quality
    if (bestMatch.matchType === 'exact') {
      confidence += 0.3;
    } else if (bestMatch.matchType === 'semantic') {
      confidence += 0.2;
    } else {
      confidence += 0.1;
    }

    // Boost confidence based on score
    const normalizedScore = Math.min(1.0, bestMatch.score / 3);
    confidence += normalizedScore * 0.2;

    // Boost confidence if multiple terms matched
    if (bestMatch.matchedTerms && bestMatch.matchedTerms.length > 1) {
      confidence += 0.1;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Get communication style greeting
   */
  getGreeting(style = 'developer') {
    const styleConfig = this.cvData.communication_styles[style];
    return styleConfig ? styleConfig.greeting : this.cvData.communication_styles.developer.greeting;
  }

  /**
   * Get profile information
   */
  getProfile() {
    return this.cvData?.profile || {};
  }

  /**
   * Check if data is loaded
   */
  isDataLoaded() {
    return this.isLoaded && this.cvData !== null;
  }

  /**
   * Reset service
   */
  reset() {
    this.cvData = null;
    this.isLoaded = false;
    this.keywordIndex.clear();
    this.semanticIndex.clear();
  }
}

export default OptimizedCVDataService;