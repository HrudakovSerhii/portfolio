/**
 * FallbackHandler - Manages query understanding failure detection and fallback flows
 * Implements two-attempt fallback system: rephrase request → email contact
 */

class FallbackHandler {
  constructor(styleManager, conversationManager) {
    this.styleManager = styleManager;
    this.conversationManager = conversationManager;
    this.fallbackAttempts = new Map(); // Track attempts per session
    this.maxAttempts = 2;
    this.confidenceThreshold = 0.5;
    this.lowConfidenceThreshold = 0.3;
  }

  /**
   * Check if a response should trigger fallback handling
   * @param {number} confidence - Confidence score from ML processing
   * @param {string} query - Original user query
   * @param {Array} matchedSections - Matched CV sections
   * @returns {Object} Fallback decision with type and action
   */
  shouldTriggerFallback(confidence, query, matchedSections = []) {
    // No matches found
    if (!matchedSections || matchedSections.length === 0) {
      return {
        shouldFallback: true,
        reason: 'no_matches',
        action: this.getNextFallbackAction(query)
      };
    }

    // Very low confidence
    if (confidence < this.lowConfidenceThreshold) {
      return {
        shouldFallback: true,
        reason: 'very_low_confidence',
        action: this.getNextFallbackAction(query)
      };
    }

    // Low confidence but above threshold
    if (confidence < this.confidenceThreshold) {
      return {
        shouldFallback: true,
        reason: 'low_confidence',
        action: this.getNextFallbackAction(query)
      };
    }

    return {
      shouldFallback: false,
      reason: 'sufficient_confidence',
      action: null
    };
  }

  /**
   * Get the next fallback action based on attempt history
   * @param {string} query - User query to track attempts for
   * @returns {string} Next fallback action: 'rephrase' or 'email'
   */
  getNextFallbackAction(query) {
    const queryKey = this.normalizeQuery(query);
    const attempts = this.fallbackAttempts.get(queryKey) || 0;

    if (attempts === 0) {
      // First attempt - ask to rephrase
      this.fallbackAttempts.set(queryKey, 1);
      return 'rephrase';
    } else {
      // Second attempt - offer email contact
      this.fallbackAttempts.set(queryKey, 2);
      return 'email';
    }
  }

  /**
   * Normalize query for attempt tracking
   * @param {string} query - Original query
   * @returns {string} Normalized query key
   */
  normalizeQuery(query) {
    return query.toLowerCase().trim().replace(/[^\w\s]/g, '').substring(0, 50);
  }

  /**
   * Generate fallback response based on action type
   * @param {string} action - Fallback action: 'rephrase' or 'email'
   * @param {string} style - Conversation style
   * @param {Object} context - Additional context
   * @returns {Object} Fallback response with message and UI action
   */
  generateFallbackResponse(action, style, context = {}) {
    const styleData = this.styleManager.getStyleData(style);
    
    if (action === 'rephrase') {
      return {
        type: 'rephrase',
        message: this.generateRephraseMessage(style, context),
        uiAction: 'show_message',
        showFallbackButton: false
      };
    } else if (action === 'email') {
      return {
        type: 'email',
        message: this.generateEmailOfferMessage(style, context),
        uiAction: 'show_email_form',
        showFallbackButton: true
      };
    }

    // Default fallback
    return {
      type: 'default',
      message: styleData.fallbackIntro + ' ' + styleData.fallbackRequest,
      uiAction: 'show_message',
      showFallbackButton: false
    };
  }

  /**
   * Generate style-appropriate rephrase request message
   * @param {string} style - Conversation style
   * @param {Object} context - Additional context
   * @returns {string} Rephrase request message
   */
  generateRephraseMessage(style, context = {}) {
    const styleData = this.styleManager.getStyleData(style);
    const baseMessage = styleData.rephraseMessage;

    // Add context-specific suggestions based on style
    const suggestions = this.getRephrasesSuggestions(style);
    
    return `${baseMessage} ${suggestions}`;
  }

  /**
   * Get style-specific rephrase suggestions
   * @param {string} style - Conversation style
   * @returns {string} Suggestions for rephrasing
   */
  getRephrasesSuggestions(style) {
    const suggestions = {
      hr: "You might ask about my professional experience, technical skills, project achievements, or career background.",
      developer: "Try asking about specific technologies, projects I've worked on, or technical challenges I've solved.",
      friend: "Maybe ask about my favorite projects, what I love about coding, or fun tech stuff I've been working on! 😊"
    };

    return suggestions[style] || suggestions.developer;
  }

  /**
   * Generate email contact offer message
   * @param {string} style - Conversation style
   * @param {Object} context - Additional context
   * @returns {string} Email offer message
   */
  generateEmailOfferMessage(style, context = {}) {
    const messages = {
      hr: "I apologize that I couldn't provide the specific information you're looking for. I'd be happy to connect you directly with Serhii for a more detailed discussion. Would you like me to help you send him an email?",
      developer: "Hmm, seems like I'm not quite getting what you're after. How about we get you in touch with Serhii directly? I can help you draft an email to him if you'd like.",
      friend: "Oops! 😅 I'm not being very helpful, am I? Let's get you connected with the real Serhii! Want me to help you send him an email? He's much better at answering tricky questions than I am! 😊"
    };

    return messages[style] || messages.developer;
  }

  /**
   * Generate mailto link with conversation context
   * @param {string} name - User's name
   * @param {string} email - User's email
   * @param {string} originalQuery - Original query that triggered fallback
   * @param {string} style - Conversation style
   * @returns {string} Formatted mailto URL
   */
  generateMailtoLink(name, email, originalQuery, style) {
    const styleData = this.styleManager.getStyleData(style);
    const subject = encodeURIComponent(`${styleData.emailSubject} - ${name}`);
    
    const conversationContext = this.getConversationContext();
    const body = this.generateEmailBody(name, email, originalQuery, conversationContext, style);
    
    return `mailto:serhii@example.com?subject=${subject}&body=${encodeURIComponent(body)}`;
  }

  /**
   * Generate email body with conversation context
   * @param {string} name - User's name
   * @param {string} email - User's email
   * @param {string} originalQuery - Original query
   * @param {string} conversationContext - Conversation history
   * @param {string} style - Conversation style
   * @returns {string} Formatted email body
   */
  generateEmailBody(name, email, originalQuery, conversationContext, style) {
    const greetings = {
      hr: `Dear Serhii,\n\nI hope this message finds you well. I was reviewing your portfolio and had some questions that your AI assistant couldn't fully address.`,
      developer: `Hi Serhii,\n\nI was checking out your portfolio and chatting with your AI assistant, but I have some questions that need a human touch.`,
      friend: `Hey Serhii! 👋\n\nI was having a fun chat with your AI buddy on your portfolio, but I think I need to talk to the real you for this one! 😊`
    };

    const closings = {
      hr: `I would appreciate the opportunity to discuss this further at your convenience.\n\nBest regards,`,
      developer: `Would love to chat more about this when you have a chance.\n\nCheers,`,
      friend: `Hope to hear from you soon!\n\nThanks! 😊`
    };

    const greeting = greetings[style] || greetings.developer;
    const closing = closings[style] || closings.developer;

    return `${greeting}

My contact information:
Name: ${name}
Email: ${email}

Original question: "${originalQuery}"

${conversationContext ? `Conversation context:\n${conversationContext}\n` : ''}
${closing}
${name}`;
  }

  /**
   * Get formatted conversation context for email
   * @returns {string} Formatted conversation history
   */
  getConversationContext() {
    const context = this.conversationManager.getContext(3); // Last 3 exchanges
    
    if (!context || context.length === 0) {
      return '';
    }

    return context.map((entry, index) => {
      return `${index + 1}. User: ${entry.userMessage}\n   AI: ${entry.botResponse.substring(0, 100)}${entry.botResponse.length > 100 ? '...' : ''}`;
    }).join('\n\n');
  }

  /**
   * Reset fallback attempts for a new conversation
   */
  resetFallbackAttempts() {
    this.fallbackAttempts.clear();
  }

  /**
   * Check if query has reached maximum fallback attempts
   * @param {string} query - Query to check
   * @returns {boolean} True if max attempts reached
   */
  hasReachedMaxAttempts(query) {
    const queryKey = this.normalizeQuery(query);
    const attempts = this.fallbackAttempts.get(queryKey) || 0;
    return attempts >= this.maxAttempts;
  }

  /**
   * Get fallback statistics for debugging
   * @returns {Object} Fallback usage statistics
   */
  getFallbackStats() {
    return {
      totalQueries: this.fallbackAttempts.size,
      averageAttempts: this.calculateAverageAttempts(),
      maxAttempts: this.maxAttempts,
      confidenceThreshold: this.confidenceThreshold,
      lowConfidenceThreshold: this.lowConfidenceThreshold
    };
  }

  /**
   * Calculate average fallback attempts
   * @returns {number} Average attempts per query
   */
  calculateAverageAttempts() {
    if (this.fallbackAttempts.size === 0) return 0;
    
    const totalAttempts = Array.from(this.fallbackAttempts.values()).reduce((sum, attempts) => sum + attempts, 0);
    return totalAttempts / this.fallbackAttempts.size;
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if email format is valid
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate name format
   * @param {string} name - Name to validate
   * @returns {boolean} True if name is valid
   */
  validateName(name) {
    if (!name || typeof name !== 'string') return false;
    const trimmedName = name.trim();
    return trimmedName.length >= 2 && trimmedName.length <= 50;
  }

  /**
   * Sanitize user input for email generation
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/<script.*?<\/script>/gi, '') // Remove script tags first
      .replace(/[<>]/g, '') // Remove remaining HTML brackets
      .substring(0, 200); // Limit length
  }
}

export default FallbackHandler;