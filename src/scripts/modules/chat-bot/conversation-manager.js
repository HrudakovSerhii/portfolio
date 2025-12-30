/**
 * ConversationManager - Manages conversation history and context
 *
 * Responsibilities:
 * - Track conversation history (max 25 messages)
 * - Provide topic-aware context retrieval (last 5 messages)
 * - Manage session IDs and conversation style
 * - Calculate conversation statistics
 *
 * Change History:
 * 2025-12-30: Removed dead code
 *   - Deleted 500+ lines of unused response generation methods
 *   - Removed: generateResponse, formatSingleResponse, combineResponses, etc.
 *   - Response generation now handled by LLM/Router system
 *   - Kept: history management, context retrieval, topic relations, statistics
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