/**
 * ConversationManager - Manages conversation history, context, and response generation
 * Handles 5-message context window with automatic cleanup and style-based responses
 */

class ConversationManager {
  constructor() {
    this.history = [];
    this.maxHistorySize = 25; // Keep up to 25 messages total
    this.maxContextSize = 5; // Use max 5 messages for model context
    this.currentStyle = null;
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate a unique session ID
   * @returns {string} UUID-like session identifier
   */
  generateSessionId() {
    return (
      "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    );
  }

  /**
   * Add a message exchange to conversation history
   * @param {string} userMessage - The user's question
   * @param {string} botResponse - The bot's response
   * @param {Array} matchedSections - CV sections that matched the query
   * @param {number} confidence - Confidence score of the response
   */
  addMessage(userMessage, botResponse, matchedSections = [], confidence = 0) {
    const messageEntry = {
      timestamp: new Date().toISOString(),
      userMessage: userMessage.trim(),
      botResponse: botResponse.trim(),
      matchedSections,
      confidence,
      style: this.currentStyle,
    };

    this.history.push(messageEntry);
    this.maintainContextWindow();
  }

  /**
   * Maintain the 25-message history limit by removing oldest entries
   */
  maintainContextWindow() {
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get conversation context for processing - returns last 5 messages from current topic
   * @param {Array} currentTopics - Topics from the current query (optional)
   * @param {number} limit - Maximum number of messages to return (default: 5)
   * @returns {Array} Array of conversation entries from the same topic
   */
  getContext(currentTopics = null, limit = this.maxContextSize) {
    // Handle backward compatibility: if first parameter is a number, treat it as limit
    if (typeof currentTopics === "number") {
      limit = currentTopics;
      currentTopics = null;
    }

    if (
      !currentTopics ||
      currentTopics.length === 0 ||
      this.history.length === 0
    ) {
      // If no topics specified or no history, return recent messages
      return this.history.slice(-limit);
    }

    // Find messages related to current topics, starting from most recent
    const topicRelatedMessages = [];

    // Go through history in reverse (most recent first)
    for (
      let i = this.history.length - 1;
      i >= 0 && topicRelatedMessages.length < limit;
      i--
    ) {
      const message = this.history[i];

      if (this.isMessageRelatedToTopics(message, currentTopics)) {
        topicRelatedMessages.unshift(message); // Add to beginning to maintain chronological order
      }
    }

    // If we don't have enough topic-related messages, fall back to recent messages
    if (topicRelatedMessages.length === 0) {
      return this.history.slice(-Math.min(limit, this.history.length));
    }

    return topicRelatedMessages;
  }

  /**
   * Check if a message is related to the given topics
   * @param {Object} message - Message entry from history
   * @param {Array} topics - Array of topic identifiers to check against
   * @returns {boolean} True if message is related to any of the topics
   */
  isMessageRelatedToTopics(message, topics) {
    if (!message.matchedSections || message.matchedSections.length === 0) {
      return false;
    }

    if (!Array.isArray(topics)) {
      return false;
    }

    // Check if any of the message's matched sections overlap with current topics
    return message.matchedSections.some((section) =>
      topics.some((topic) => this.areTopicsRelated(section, topic))
    );
  }

  /**
   * Determine if two topics are related (exact match or same category)
   * @param {string} topic1 - First topic identifier (e.g., 'experience.react' or 'exp_react')
   * @param {string} topic2 - Second topic identifier (e.g., 'experience.javascript' or 'exp_javascript')
   * @returns {boolean} True if topics are related
   */
  areTopicsRelated(topic1, topic2) {
    // Exact match
    if (topic1 === topic2) {
      return true;
    }

    // Check if they're in the same category - handle both dot and underscore formats
    let category1, category2;
    
    if (topic1.includes('.')) {
      category1 = topic1.split('.')[0];
    } else if (topic1.includes('_')) {
      category1 = topic1.split('_')[0];
    } else {
      category1 = topic1;
    }
    
    if (topic2.includes('.')) {
      category2 = topic2.split('.')[0];
    } else if (topic2.includes('_')) {
      category2 = topic2.split('_')[0];
    } else {
      category2 = topic2;
    }
    
    return category1 === category2;
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.history = [];
    this.sessionId = this.generateSessionId();
  }

  /**
   * Set conversation style
   * @param {string} style - Conversation style: 'hr', 'developer', or 'friend'
   */
  setStyle(style) {
    const validStyles = ["hr", "developer", "friend"];
    if (!validStyles.includes(style)) {
      throw new Error(
        `Invalid conversation style: ${style}. Must be one of: ${validStyles.join(
          ", "
        )}`
      );
    }
    this.currentStyle = style;
  }

  /**
   * Get current conversation style
   * @returns {string|null} Current style or null if not set
   */
  getStyle() {
    return this.currentStyle;
  }

  /**
   * Generate response using templates and matched CV sections
   * @param {string} query - User's query
   * @param {Array} cvMatches - Matched CV sections with responses
   * @param {string} style - Response style
   * @returns {string} Generated response
   */
  generateResponse(query, cvMatches, style = this.currentStyle) {
    if (!style) {
      throw new Error(
        "Conversation style must be set before generating responses"
      );
    }

    if (!cvMatches || cvMatches.length === 0) {
      return this.generateFallbackResponse(style);
    }

    // Extract current topics from CV matches for context-aware response generation
    const currentTopics = cvMatches.map((match) => match.id).filter((id) => id);

    // Sort matches by confidence/relevance
    const sortedMatches = cvMatches.sort(
      (a, b) => (b.confidence || 0) - (a.confidence || 0)
    );

    // Use the best match or combine multiple matches
    if (sortedMatches.length === 1) {
      return this.formatSingleResponse(sortedMatches[0], style, currentTopics);
    } else {
      return this.formatMultipleResponses(
        sortedMatches,
        style,
        query,
        currentTopics
      );
    }
  }

  /**
   * Format response from a single CV section match
   * @param {Object} match - CV section match with response templates
   * @param {string} style - Response style
   * @returns {string} Formatted response
   */
  formatSingleResponse(match, style, currentTopics = null) {
    if (match.responses && match.responses[style]) {
      return this.addContextualElements(
        match.responses[style],
        style,
        currentTopics
      );
    }

    // Fallback if no style-specific response
    return this.generateGenericResponse(match, style);
  }

  /**
   * Format response combining multiple CV section matches
   * @param {Array} matches - Array of CV section matches
   * @param {string} style - Response style
   * @param {string} query - Original user query
   * @param {Array} currentTopics - Current topics being discussed
   * @returns {string} Combined response
   */
  formatMultipleResponses(matches, style, query, currentTopics = null) {
    const topMatches = matches.slice(0, 3); // Use top 3 matches
    const responses = topMatches
      .filter((match) => match.responses && match.responses[style])
      .map((match) => match.responses[style]);

    if (responses.length === 0) {
      return this.generateFallbackResponse(style);
    }

    // Combine responses based on style
    return this.combineResponses(responses, style, query, currentTopics);
  }

  /**
   * Combine multiple responses into a coherent answer
   * @param {Array} responses - Array of response strings
   * @param {string} style - Response style
   * @param {string} query - Original query for context
   * @param {Array} currentTopics - Current topics being discussed
   * @returns {string} Combined response
   */
  combineResponses(responses, style, query, currentTopics = null) {
    const connectors = this.getStyleConnectors(style);

    if (responses.length === 1) {
      return this.addContextualElements(responses[0], style, currentTopics);
    }

    // Create introduction based on style
    const intro = this.getMultiTopicIntro(style, query);

    // Join responses with appropriate connectors
    const combinedContent = responses.join(` ${connectors.continuation} `);

    return this.addContextualElements(
      `${intro} ${combinedContent}`,
      style,
      currentTopics
    );
  }

  /**
   * Get style-specific connectors for combining responses
   * @param {string} style - Response style
   * @returns {Object} Connector phrases for the style
   */
  getStyleConnectors(style) {
    const connectors = {
      hr: {
        continuation: "Additionally,",
        conclusion: "These qualifications demonstrate",
      },
      developer: {
        continuation: "Also,",
        conclusion: "So yeah,",
      },
      friend: {
        continuation: "Oh, and",
        conclusion: "Pretty cool stuff, right?",
      },
    };

    return connectors[style] || connectors.developer;
  }

  /**
   * Get introduction for multi-topic responses
   * @param {string} style - Response style
   * @param {string} query - Original query
   * @returns {string} Style-appropriate introduction
   */
  getMultiTopicIntro(style, query) {
    const intros = {
      hr: "Regarding your question,",
      developer: "Great question!",
      friend: "Oh, that's a good one! 😊",
    };

    return intros[style] || intros.developer;
  }

  /**
   * Add contextual elements based on conversation history and style
   * @param {string} response - Base response
   * @param {string} style - Response style
   * @param {Array} currentTopics - Current topics being discussed
   * @returns {string} Response with contextual elements
   */
  addContextualElements(response, style, currentTopics = null) {
    // Check if this is a follow-up question using topic-aware context
    const context = this.getContext(currentTopics, 3);
    if (context.length > 0) {
      const lastTopic = this.extractTopicFromHistory(context);
      if (lastTopic && currentTopics && currentTopics.length > 0) {
        // Check if current question relates to previous conversation (more inclusive)
        const isRelated = currentTopics.some(topic => this.areTopicsRelated(topic, lastTopic));
        if (isRelated) {
          response = this.addContextualReference(response, lastTopic, style, context);
        }
      }
    }

    return response;
  }

  /**
   * Determine if current question is a follow-up to previous conversation
   * @param {Array} context - Recent conversation history
   * @param {Array} currentTopics - Current topics being discussed
   * @returns {boolean} True if this appears to be a follow-up question
   */
  isFollowUpQuestion(context, currentTopics) {
    if (context.length === 0 || !currentTopics || currentTopics.length === 0) {
      return false;
    }

    // Check if any current topics match recent conversation topics
    const recentTopics = new Set();
    context.forEach(entry => {
      if (entry.matchedSections) {
        entry.matchedSections.forEach(section => recentTopics.add(section));
      }
    });

    return currentTopics.some(topic => recentTopics.has(topic));
  }

  /**
   * Extract topic from conversation history for context
   * @param {Array} context - Recent conversation history
   * @returns {string|null} Extracted topic or null
   */
  extractTopicFromHistory(context) {
    if (context.length === 0) return null;

    const lastEntry = context[context.length - 1];
    if (lastEntry.matchedSections && lastEntry.matchedSections.length > 0) {
      return lastEntry.matchedSections[0];
    }

    return null;
  }

  /**
   * Add contextual reference to previous conversation
   * @param {string} response - Base response
   * @param {string} lastTopic - Previous topic discussed
   * @param {string} style - Response style
   * @param {Array} context - Recent conversation context
   * @returns {string} Response with contextual reference
   */
  addContextualReference(response, lastTopic, style, context = []) {
    const contextualPhrases = {
      hr: "Building on our previous discussion,",
      developer: "Following up on what we talked about,",
      friend: "Speaking of what we just discussed,",
    };

    const phrase = contextualPhrases[style] || contextualPhrases.developer;

    // Only add contextual reference if it makes sense
    if (this.isRelatedTopic(lastTopic, response)) {
      // Check if we can add more specific context from recent conversation
      const specificContext = this.getSpecificContextualPhrase(context, style);
      if (specificContext) {
        return `${specificContext} ${response}`;
      }
      return `${phrase} ${response}`;
    }

    return response;
  }

  /**
   * Get specific contextual phrase based on recent conversation
   * @param {Array} context - Recent conversation history
   * @param {string} style - Response style
   * @returns {string|null} Specific contextual phrase or null
   */
  getSpecificContextualPhrase(context, style) {
    if (context.length === 0) return null;

    const lastEntry = context[context.length - 1];
    if (!lastEntry.userMessage) return null;

    // Detect question patterns that suggest follow-up
    const userMessage = lastEntry.userMessage.toLowerCase();
    
    if (userMessage.includes('more about') || userMessage.includes('tell me more')) {
      const phrases = {
        hr: "To elaborate further,",
        developer: "Going deeper into that,",
        friend: "Oh, you want to know more! 😊"
      };
      return phrases[style] || phrases.developer;
    }

    if (userMessage.includes('how') && (userMessage.includes('work') || userMessage.includes('use'))) {
      const phrases = {
        hr: "Regarding the implementation details,",
        developer: "As for how I work with that,",
        friend: "Great question about the how-to! 🤔"
      };
      return phrases[style] || phrases.developer;
    }

    if (userMessage.includes('example') || userMessage.includes('show me')) {
      const phrases = {
        hr: "To provide a concrete example,",
        developer: "Here's a practical example:",
        friend: "Oh, you want to see it in action! 🚀"
      };
      return phrases[style] || phrases.developer;
    }

    return null;
  }

  /**
   * Check if current response is related to previous topic
   * @param {string} lastTopic - Previous topic
   * @param {string} response - Current response
   * @returns {boolean} True if topics are related
   */
  isRelatedTopic(lastTopic, response) {
    // Simple keyword matching - could be enhanced with more sophisticated logic
    const topicKeywords = lastTopic.toLowerCase().split(/[._-]/);
    const responseLower = response.toLowerCase();

    // Check for direct keyword matches
    const hasKeywordMatch = topicKeywords.some(
      (keyword) => keyword.length > 2 && responseLower.includes(keyword)
    );

    if (hasKeywordMatch) {
      return true;
    }

    // For experience/skills topics, consider them related if they're both technical
    // This allows for natural conversation flow between related professional topics
    const isExperienceTopic = lastTopic.toLowerCase().includes('exp') || lastTopic.toLowerCase().includes('experience');
    const isSkillsTopic = lastTopic.toLowerCase().includes('skill') || lastTopic.toLowerCase().includes('tech');
    const isTechnicalResponse = responseLower.includes('experience') || 
                               responseLower.includes('years') || 
                               responseLower.includes('work') ||
                               responseLower.includes('develop') ||
                               responseLower.includes('code') ||
                               responseLower.includes('build');

    return (isExperienceTopic || isSkillsTopic) && isTechnicalResponse;
  }

  /**
   * Generate fallback response when no CV matches found
   * @param {string} style - Response style
   * @returns {string} Style-appropriate fallback response
   */
  generateFallbackResponse(style) {
    const fallbacks = {
      hr: "I apologize, but I don't have specific information about that topic in my current knowledge base. Could you please rephrase your question or ask about my experience, skills, or projects?",
      developer:
        "Hmm, I don't have details on that specific topic. Could you try rephrasing the question? I'd be happy to talk about my experience, tech stack, or projects.",
      friend:
        "Oops! 😅 I don't think I have info about that. Could you ask me something else? I love talking about my coding adventures and projects!",
    };

    return fallbacks[style] || fallbacks.developer;
  }

  /**
   * Generate generic response when no style-specific template exists
   * @param {Object} match - CV section match
   * @param {string} style - Response style
   * @returns {string} Generic response
   */
  generateGenericResponse(match, style) {
    const styleModifiers = {
      hr: "professionally",
      developer: "technically",
      friend: "enthusiastically",
    };

    const modifier = styleModifiers[style] || "professionally";
    return `I can ${modifier} discuss ${
      match.id || "this topic"
    } based on my experience.`;
  }

  /**
   * Generate context-aware response using conversation history
   * @param {string} query - User's current query
   * @param {Array} cvMatches - Matched CV sections
   * @param {string} style - Response style
   * @returns {Object} Enhanced response with context information
   */
  generateContextAwareResponse(query, cvMatches, style = this.currentStyle) {
    if (!style) {
      throw new Error('Conversation style must be set before generating responses');
    }

    // Get current topics from CV matches
    const currentTopics = cvMatches.map(match => match.id).filter(id => id);
    
    // Get relevant context based on current topics
    const relevantContext = this.getContext(currentTopics, this.maxContextSize);
    
    // Generate base response
    const baseResponse = this.generateResponse(query, cvMatches, style);
    
    // Analyze conversation flow for better context integration
    const contextAnalysis = this.analyzeConversationFlow(relevantContext, currentTopics, query);
    
    return {
      response: baseResponse,
      contextUsed: relevantContext.length > 0,
      contextSize: relevantContext.length,
      conversationFlow: contextAnalysis.flow,
      topicContinuity: contextAnalysis.topicContinuity,
      followUpSuggestions: this.generateFollowUpSuggestions(currentTopics, style)
    };
  }

  /**
   * Analyze conversation flow and topic continuity
   * @param {Array} context - Recent conversation context
   * @param {Array} currentTopics - Current topics being discussed
   * @param {string} query - Current user query
   * @returns {Object} Analysis of conversation flow
   */
  analyzeConversationFlow(context, currentTopics, query) {
    const analysis = {
      flow: 'new_topic',
      topicContinuity: 0,
      queryType: this.classifyQuery(query)
    };

    if (context.length === 0) {
      return analysis;
    }

    // Calculate topic continuity score
    const recentTopics = new Set();
    context.forEach(entry => {
      if (entry.matchedSections) {
        entry.matchedSections.forEach(section => recentTopics.add(section));
      }
    });

    const continuityScore = currentTopics.filter(topic => recentTopics.has(topic)).length / Math.max(currentTopics.length, 1);
    analysis.topicContinuity = continuityScore;

    // Determine conversation flow
    if (continuityScore > 0.5) {
      analysis.flow = 'topic_continuation';
    } else if (continuityScore > 0) {
      analysis.flow = 'topic_expansion';
    } else {
      analysis.flow = 'topic_change';
    }

    return analysis;
  }

  /**
   * Classify the type of user query
   * @param {string} query - User's query
   * @returns {string} Query classification
   */
  classifyQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    // Check for follow-up patterns first (more specific)
    if (lowerQuery.includes('more') || lowerQuery.includes('detail') || lowerQuery.includes('elaborate')) {
      return 'follow_up';
    }
    
    // Check for explanation requests
    if (lowerQuery.includes('tell me') || lowerQuery.includes('show me') || lowerQuery.includes('explain')) {
      return 'request_explanation';
    }
    
    // Check for example requests
    if (lowerQuery.includes('example') || lowerQuery.includes('demo') || lowerQuery.includes('sample')) {
      return 'request_example';
    }
    
    // Check for questions (less specific, so check last)
    if (lowerQuery.includes('how') || lowerQuery.includes('what') || lowerQuery.includes('why')) {
      return 'question';
    }
    
    return 'general';
  }

  /**
   * Generate follow-up suggestions based on current topics
   * @param {Array} currentTopics - Current topics being discussed
   * @param {string} style - Response style
   * @returns {Array} Array of suggested follow-up questions
   */
  generateFollowUpSuggestions(currentTopics, style) {
    if (!currentTopics || currentTopics.length === 0) {
      return [];
    }

    const suggestions = [];
    const maxSuggestions = 2;

    // Generate topic-specific suggestions
    currentTopics.slice(0, maxSuggestions).forEach(topic => {
      const suggestion = this.getTopicFollowUpSuggestion(topic, style);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    });

    return suggestions;
  }

  /**
   * Get follow-up suggestion for a specific topic
   * @param {string} topic - Topic identifier
   * @param {string} style - Response style
   * @returns {string|null} Follow-up suggestion or null
   */
  getTopicFollowUpSuggestion(topic, style) {
    const topicSuggestions = {
      'experience.react': {
        hr: 'What specific React projects has Serhii worked on?',
        developer: 'What React patterns do you prefer?',
        friend: 'Any cool React tricks you\'ve learned?'
      },
      'skills.javascript': {
        hr: 'How many years of JavaScript experience does Serhii have?',
        developer: 'What\'s your favorite JavaScript feature?',
        friend: 'What got you into JavaScript?'
      }
    };

    // Extract base topic (e.g., 'experience.react' -> 'react')
    const baseTopic = topic.split('.').pop();
    
    // Try exact match first, then base topic
    const suggestions = topicSuggestions[topic] || topicSuggestions[baseTopic];
    
    return suggestions ? suggestions[style] : null;
  }

  /**
   * Get conversation statistics
   * @returns {Object} Statistics about the current conversation
   */
  getConversationStats() {
    return {
      sessionId: this.sessionId,
      messageCount: this.history.length,
      currentStyle: this.currentStyle,
      averageConfidence: this.calculateAverageConfidence(),
      topicsDiscussed: this.getUniqueTopics(),
    };
  }

  /**
   * Calculate average confidence of responses in conversation
   * @returns {number} Average confidence score
   */
  calculateAverageConfidence() {
    if (this.history.length === 0) return 0;

    const totalConfidence = this.history.reduce(
      (sum, entry) => sum + (entry.confidence || 0),
      0
    );
    return totalConfidence / this.history.length;
  }

  /**
   * Get unique topics discussed in conversation
   * @returns {Array} Array of unique topic identifiers
   */
  getUniqueTopics() {
    const topics = new Set();
    this.history.forEach((entry) => {
      if (entry.matchedSections) {
        entry.matchedSections.forEach((section) => topics.add(section));
      }
    });
    return Array.from(topics);
  }
}

export default ConversationManager;
