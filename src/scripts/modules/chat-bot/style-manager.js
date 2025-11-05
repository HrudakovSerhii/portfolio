/**
 * StyleManager - Manages conversation styles and their specific behaviors
 * Handles style selection, persistence, greeting messages, and style-specific formatting
 */

class StyleManager {
  constructor() {
    this.currentStyle = null;
    this.availableStyles = ['hr', 'developer', 'friend'];
    this.styleData = this.initializeStyleData();
  }

  /**
   * Initialize style-specific data including greetings and formatting
   */
  initializeStyleData() {
    return {
      hr: {
        name: 'Professional (HR)',
        icon: '👔',
        description: 'Formal, structured responses about experience and achievements',
        greeting: "Hello! I'm Serhii's AI assistant. I can help you learn about his professional experience, skills, and achievements. What would you like to know?",
        rephraseMessage: "I'm not entirely certain about that topic. Could you please rephrase your question or be more specific about what you'd like to know?",
        errorMessage: "I apologize, but I'm experiencing technical difficulties. Please try rephrasing your question or contact Serhii directly.",
        fallbackIntro: "I apologize, but I don't have specific information about that topic in my current knowledge base.",
        fallbackRequest: "Could you please rephrase your question or ask about my experience, skills, or projects?",
        emailSubject: "Professional Inquiry from Portfolio Chat",
        responseStyle: {
          formality: 'formal',
          tone: 'professional',
          structure: 'structured',
          language: 'business'
        }
      },
      developer: {
        name: 'Technical (Developer)',
        icon: '💻',
        description: 'Conversational, technical discussion about projects and skills',
        greeting: "Hey there! I'm an AI version of Serhii. Feel free to ask me about his technical experience, projects, or anything development-related. What's on your mind?",
        rephraseMessage: "I'm not quite sure what you're looking for there. Could you rephrase that or give me a bit more context?",
        errorMessage: "Hmm, something went wrong on my end. Mind trying that again or rephrasing your question?",
        fallbackIntro: "Hmm, I don't have details on that specific topic.",
        fallbackRequest: "Could you try rephrasing the question? I'd be happy to talk about my experience, tech stack, or projects.",
        emailSubject: "Technical Discussion from Portfolio Chat",
        responseStyle: {
          formality: 'casual',
          tone: 'collaborative',
          structure: 'conversational',
          language: 'technical'
        }
      },
      friend: {
        name: 'Casual (Friend)',
        icon: '😊',
        description: 'Friendly, enthusiastic chat with personality and emojis',
        greeting: "Hi! 👋 I'm Serhii's AI buddy! Ask me anything about his work, projects, or just chat about tech stuff. What would you like to know? 😊",
        rephraseMessage: "Hmm, I'm not sure I got that! 🤔 Could you ask that in a different way? Maybe be a bit more specific?",
        errorMessage: "Oops! 😅 Something got mixed up. Can you try asking that again in a different way?",
        fallbackIntro: "Oops! 😅 I don't think I have info about that.",
        fallbackRequest: "Could you ask me something else? I love talking about my coding adventures and projects!",
        emailSubject: "Friendly Chat from Portfolio Website",
        responseStyle: {
          formality: 'casual',
          tone: 'enthusiastic',
          structure: 'friendly',
          language: 'conversational',
          emojis: true
        }
      }
    };
  }

  /**
   * Set the current conversation style
   * @param {string} style - The style to set ('hr', 'developer', 'friend')
   * @returns {boolean} Success status
   */
  setStyle(style) {
    if (!this.availableStyles.includes(style)) {
      console.error(`Invalid style: ${style}. Available styles: ${this.availableStyles.join(', ')}`);
      return false;
    }

    this.currentStyle = style;
    this.persistStyle(style);
    return true;
  }

  /**
   * Get the current conversation style
   * @returns {string|null} Current style or null if not set
   */
  getCurrentStyle() {
    return this.currentStyle;
  }

  /**
   * Get style data for a specific style
   * @param {string} style - Style to get data for (defaults to current style)
   * @returns {Object|null} Style data object or null if invalid
   */
  getStyleData(style = this.currentStyle) {
    if (!style || !this.styleData[style]) {
      return null;
    }
    return this.styleData[style];
  }

  /**
   * Get greeting message for current or specified style
   * @param {string} style - Style to get greeting for (defaults to current style)
   * @returns {string} Greeting message
   */
  getGreeting(style = this.currentStyle) {
    const styleData = this.getStyleData(style);
    return styleData ? styleData.greeting : this.styleData.developer.greeting;
  }

  /**
   * Get rephrase message for current or specified style
   * @param {string} style - Style to get message for (defaults to current style)
   * @returns {string} Rephrase request message
   */
  getRephraseMessage(style = this.currentStyle) {
    const styleData = this.getStyleData(style);
    return styleData ? styleData.rephraseMessage : this.styleData.developer.rephraseMessage;
  }

  /**
   * Get error message for current or specified style
   * @param {string} style - Style to get message for (defaults to current style)
   * @returns {string} Error message
   */
  getErrorMessage(style = this.currentStyle) {
    const styleData = this.getStyleData(style);
    return styleData ? styleData.errorMessage : this.styleData.developer.errorMessage;
  }

  /**
   * Get fallback messages for current or specified style
   * @param {string} style - Style to get messages for (defaults to current style)
   * @returns {Object} Object with intro and request messages
   */
  getFallbackMessages(style = this.currentStyle) {
    const styleData = this.getStyleData(style);
    if (!styleData) {
      return {
        intro: this.styleData.developer.fallbackIntro,
        request: this.styleData.developer.fallbackRequest
      };
    }
    
    return {
      intro: styleData.fallbackIntro,
      request: styleData.fallbackRequest
    };
  }

  /**
   * Get email subject for current or specified style
   * @param {string} style - Style to get subject for (defaults to current style)
   * @returns {string} Email subject line
   */
  getEmailSubject(style = this.currentStyle) {
    const styleData = this.getStyleData(style);
    return styleData ? styleData.emailSubject : this.styleData.developer.emailSubject;
  }

  /**
   * Get all available styles with their metadata
   * @returns {Array} Array of style objects with id, name, icon, and description
   */
  getAvailableStyles() {
    return this.availableStyles.map(styleId => ({
      id: styleId,
      name: this.styleData[styleId].name,
      icon: this.styleData[styleId].icon,
      description: this.styleData[styleId].description
    }));
  }

  /**
   * Check if a style is valid
   * @param {string} style - Style to validate
   * @returns {boolean} True if style is valid
   */
  isValidStyle(style) {
    return this.availableStyles.includes(style);
  }

  /**
   * Reset style selection
   */
  resetStyle() {
    this.currentStyle = null;
    this.clearPersistedStyle();
  }

  /**
   * Persist style selection to session storage
   * @param {string} style - Style to persist
   */
  persistStyle(style) {
    try {
      sessionStorage.setItem('chatbot-conversation-style', style);
    } catch (error) {
      console.warn('Could not persist conversation style:', error);
    }
  }

  /**
   * Load persisted style from session storage
   * @returns {string|null} Persisted style or null if not found
   */
  loadPersistedStyle() {
    try {
      const persistedStyle = sessionStorage.getItem('chatbot-conversation-style');
      if (persistedStyle && this.isValidStyle(persistedStyle)) {
        return persistedStyle;
      }
    } catch (error) {
      console.warn('Could not load persisted conversation style:', error);
    }
    return null;
  }

  /**
   * Clear persisted style from session storage
   */
  clearPersistedStyle() {
    try {
      sessionStorage.removeItem('chatbot-conversation-style');
    } catch (error) {
      console.warn('Could not clear persisted conversation style:', error);
    }
  }

  /**
   * Format response based on current style
   * @param {string} response - Base response text
   * @param {Object} context - Additional context for formatting
   * @returns {string} Formatted response
   */
  formatResponse(response, context = {}) {
    // Handle null/undefined responses
    if (!response) {
      return response;
    }

    const styleData = this.getStyleData();
    if (!styleData) {
      return response;
    }

    let formattedResponse = response;

    // Apply style-specific formatting
    if (styleData.responseStyle.emojis && !this.hasEmojis(response)) {
      formattedResponse = this.addStyleAppropriateEmojis(formattedResponse, context);
    }

    // Apply tone adjustments
    if (styleData.responseStyle.tone === 'enthusiastic' && !this.hasEnthusiasticTone(response)) {
      formattedResponse = this.addEnthusiasticElements(formattedResponse);
    }

    return formattedResponse;
  }

  /**
   * Check if text contains emojis
   * @param {string} text - Text to check
   * @returns {boolean} True if text contains emojis
   */
  hasEmojis(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    return emojiRegex.test(text);
  }

  /**
   * Add style-appropriate emojis to response
   * @param {string} response - Response text
   * @param {Object} context - Context for emoji selection
   * @returns {string} Response with emojis
   */
  addStyleAppropriateEmojis(response, context) {
    if (this.currentStyle !== 'friend') {
      return response;
    }

    // Add contextual emojis based on content
    const emojiMap = {
      'react': '⚛️',
      'javascript': '🚀',
      'project': '💻',
      'experience': '🎯',
      'skill': '⭐',
      'work': '💼',
      'code': '👨‍💻',
      'development': '🔧',
      'web': '🌐',
      'mobile': '📱',
      'database': '🗄️',
      'api': '🔌',
      'performance': '⚡',
      'testing': '🧪',
      'deployment': '🚀'
    };

    let enhancedResponse = response;
    
    // Add emojis based on keywords
    Object.entries(emojiMap).forEach(([keyword, emoji]) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(enhancedResponse) && !this.hasEmojis(enhancedResponse)) {
        enhancedResponse = enhancedResponse.replace(regex, `${keyword} ${emoji}`);
      }
    });

    return enhancedResponse;
  }

  /**
   * Check if text has enthusiastic tone
   * @param {string} text - Text to check
   * @returns {boolean} True if text has enthusiastic elements
   */
  hasEnthusiasticTone(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }
    
    const enthusiasticMarkers = ['!', '😊', '🎉', '🚀', 'awesome', 'amazing', 'love', 'excited'];
    return enthusiasticMarkers.some(marker => text.includes(marker));
  }

  /**
   * Add enthusiastic elements to response
   * @param {string} response - Response text
   * @returns {string} Response with enthusiastic elements
   */
  addEnthusiasticElements(response) {
    if (this.currentStyle !== 'friend') {
      return response;
    }

    // Add enthusiasm markers occasionally
    if (Math.random() > 0.7) { // 30% chance
      const enthusiasticPhrases = [
        'That\'s awesome! ',
        'Great question! ',
        'I love talking about this! ',
        'This is exciting! '
      ];
      
      const randomPhrase = enthusiasticPhrases[Math.floor(Math.random() * enthusiasticPhrases.length)];
      return randomPhrase + response;
    }

    return response;
  }

  /**
   * Get conversation statistics for current session
   * @returns {Object} Statistics about style usage
   */
  getStyleStats() {
    return {
      currentStyle: this.currentStyle,
      availableStyles: this.availableStyles,
      styleData: this.currentStyle ? this.getStyleData() : null,
      sessionPersisted: !!this.loadPersistedStyle()
    };
  }
}

export default StyleManager;