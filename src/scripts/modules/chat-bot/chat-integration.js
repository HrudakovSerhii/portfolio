/**
 * Chat Integration - Connects ChatUI with the hero section trigger
 * Handles initialization and event coordination between UI components
 */

// Dynamic imports will be used in the initialize method

class ChatIntegration {
  constructor() {
    this.chatUI = null;
    this.conversationManager = null;
    this.isInitialized = false;
    this.heroTrigger = null;
  }

  /**
   * Initialize the chat integration
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Find the hero chat trigger button
      this.heroTrigger = document.getElementById('hero-chat-trigger');

      if (!this.heroTrigger) {
        console.warn('Hero chat trigger not found');
        return;
      }

      // Dynamic imports for modules
      const { default: ChatUI } = await import('./chat-ui.js');
      const { default: ConversationManager } = await import('./conversation-manager.js');

      // Initialize ChatUI
      this.chatUI = new ChatUI();
      this.chatUI.initialize();

      // Initialize ConversationManager
      this.conversationManager = new ConversationManager();
      await this.conversationManager.initialize();

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      console.log('Chat integration initialized successfully');

    } catch (error) {
      console.error('Failed to initialize chat integration:', error);
      this.showError('Failed to initialize chat system');
    }
  }

  /**
   * Set up event handlers for chat interactions
   */
  setupEventHandlers() {
    // Hero trigger button click
    this.heroTrigger.addEventListener('click', () => {
      this.startChat();
    });

    // ChatUI event handlers
    this.chatUI.setEventHandlers({
      onStyleSelect: (style) => this.handleStyleSelection(style),
      onMessageSend: (message) => this.handleMessageSend(message),
      onRestart: () => this.handleRestart()
    });

    // ConversationManager event handlers
    this.conversationManager.setEventHandlers({
      onResponse: (response) => this.handleBotResponse(response),
      onError: (error) => this.handleError(error),
      onFallback: () => this.handleFallback()
    });
  }

  /**
   * Start the chat interaction
   */
  async startChat() {
    try {
      // Show chat UI
      this.chatUI.show();

      // Check if conversation manager is ready
      if (!this.conversationManager.isReady()) {
        this.chatUI.showLoadingState('Initializing AI assistant...');

        // Wait for initialization
        await this.conversationManager.waitForReady();
      }

      // Show style selection
      this.chatUI.showStyleSelection();

    } catch (error) {
      console.error('Failed to start chat:', error);
      this.chatUI.showError('Failed to start chat. Please try again.');
    }
  }

  /**
   * Handle conversation style selection
   */
  async handleStyleSelection(style) {
    try {
      this.chatUI.showLoadingState('Setting up your conversation style...');

      // Set conversation style
      await this.conversationManager.setConversationStyle(style);

      // Show chat interface
      this.chatUI.showChatInterface();

      // Add welcome message
      const welcomeMessage = this.getWelcomeMessage(style);
      this.chatUI.addMessage(welcomeMessage, false, style);

    } catch (error) {
      console.error('Failed to set conversation style:', error);
      this.chatUI.showError('Failed to set conversation style. Please try again.');
    }
  }

  /**
   * Handle user message sending
   */
  async handleMessageSend(message) {
    try {
      // Add user message to UI
      this.chatUI.addMessage(message, true);

      // Show typing indicator
      this.chatUI.showTypingIndicator();

      // Send message to conversation manager
      await this.conversationManager.sendMessage(message);

    } catch (error) {
      console.error('Failed to send message:', error);
      this.chatUI.hideTypingIndicator();
      this.chatUI.showError('Failed to send message. Please try again.');
    }
  }

  /**
   * Handle bot response
   */
  handleBotResponse(response) {
    // Hide typing indicator
    this.chatUI.hideTypingIndicator();

    // Add bot message to UI
    const currentStyle = this.conversationManager.getCurrentStyle();
    this.chatUI.addMessage(response, false, currentStyle);
  }

  /**
   * Handle conversation restart
   */
  async handleRestart() {
    try {
      // Clear messages
      this.chatUI.clearMessages();

      // Reset conversation manager
      await this.conversationManager.reset();

      // Show style selection again
      this.chatUI.showStyleSelection();

    } catch (error) {
      console.error('Failed to restart conversation:', error);
      this.chatUI.showError('Failed to restart conversation. Please try again.');
    }
  }

  /**
   * Handle errors from conversation manager
   */
  handleError(error) {
    console.error('Conversation error:', error);
    this.chatUI.hideTypingIndicator();

    // Show appropriate error message based on error type
    let errorMessage = 'Something went wrong. Please try again.';

    if (error.type === 'network') {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else if (error.type === 'validation') {
      errorMessage = 'Invalid input. Please rephrase your question.';
    } else if (error.type === 'rate_limit') {
      errorMessage = 'Too many requests. Please wait a moment and try again.';
    }

    this.chatUI.showError(errorMessage);
  }

  /**
   * Handle fallback to email contact
   */
  handleFallback() {
    this.chatUI.hideTypingIndicator();
    this.chatUI.showFallbackForm();
  }

  /**
   * Get welcome message based on conversation style
   */
  getWelcomeMessage(style) {
    const welcomeMessages = {
      hr: "Hello! I'm Serhii's AI assistant. I'm here to provide you with detailed information about his professional background, skills, and experience. What would you like to know about his qualifications?",

      developer: "Hey there! I'm Serhii's AI assistant, and I'm excited to chat with a fellow developer! I can tell you all about his technical skills, projects, and development experience. What interests you most about his work?",

      friend: "Hi! I'm Serhii's AI assistant, and I'm here to have a friendly chat about him and his work. Feel free to ask me anything - I love talking about his projects, interests, and experiences. What would you like to know?"
    };

    return welcomeMessages[style] || welcomeMessages.friend;
  }

  /**
   * Show error message
   */
  showError(message) {
    if (this.chatUI) {
      this.chatUI.showError(message);
    } else {
      console.error('Chat error:', message);
    }
  }

  /**
   * Destroy the chat integration
   */
  destroy() {
    if (this.chatUI) {
      this.chatUI.destroy();
    }

    if (this.conversationManager) {
      this.conversationManager.destroy();
    }

    if (this.heroTrigger) {
      this.heroTrigger.removeEventListener('click', this.startChat);
    }

    this.isInitialized = false;
  }
}

export default ChatIntegration;
