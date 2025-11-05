/**
 * ChatBot - Main entry point for the chat-bot feature
 * Handles lazy loading, worker initialization, and browser compatibility
 */
class ChatBot {
  constructor() {
    this.isInitialized = false;
    this.worker = null;
    this.ui = null;
    this.conversationManager = null;
    this.cvDataService = null;
    this.currentStyle = null;
    this.initializationPromise = null;
  }

  /**
   * Initialize the chat-bot system with lazy loading
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  async _performInitialization() {
    try {
      // Check browser compatibility first
      if (!this._checkBrowserCompatibility()) {
        throw new Error('BROWSER_UNSUPPORTED');
      }

      // Lazy load required modules
      await this._loadModules();

      // Initialize UI and show loading state immediately
      this.ui = new this._ChatUI();
      this.ui.showLoadingState();

      // Initialize worker
      await this._initializeWorker();

      // Initialize other services
      this.cvDataService = new this._CVDataService();
      await this.cvDataService.loadCVData();

      this.conversationManager = new this._ConversationManager();

      this.isInitialized = true;
      this.ui.showStyleSelection();
      
      return true;
    } catch (error) {
      this._handleInitializationError(error);
      return false;
    }
  }

  /**
   * Check if the browser supports required features
   * @returns {boolean} Browser compatibility status
   */
  _checkBrowserCompatibility() {
    // Check for Web Workers support
    if (typeof Worker === 'undefined') {
      console.warn('ChatBot: Web Workers not supported');
      return false;
    }

    // Check for WebAssembly support (required for DistilBERT)
    if (typeof WebAssembly === 'undefined') {
      console.warn('ChatBot: WebAssembly not supported');
      return false;
    }

    // Check for modern JavaScript features
    try {
      // Test for async/await, classes, and other ES6+ features
      eval('(async () => {})');
      eval('class Test {}');
      eval('const test = { ...{} }');
    } catch (e) {
      console.warn('ChatBot: Modern JavaScript features not supported');
      return false;
    }

    return true;
  }

  /**
   * Lazy load required modules
   */
  async _loadModules() {
    try {
      // Dynamic imports for lazy loading
      const [
        { ChatUI },
        { ConversationManager },
        { CVDataService }
      ] = await Promise.all([
        import('./chat-ui.js'),
        import('./conversation-manager.js'),
        import('./cv-data-service.js')
      ]);

      // Store classes for this instance
      this._ChatUI = ChatUI;
      this._ConversationManager = ConversationManager;
      this._CVDataService = CVDataService;
    } catch (error) {
      throw new Error(`MODULE_LOAD_FAILED: ${error.message}`);
    }
  }

  /**
   * Initialize the ML Worker
   */
  async _initializeWorker() {
    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker('/src/scripts/workers/chat-ml-worker.js');
        
        const timeout = setTimeout(() => {
          reject(new Error('WORKER_TIMEOUT'));
        }, 30000); // 30 second timeout

        this.worker.onmessage = (event) => {
          const { type, success, error } = event.data;
          
          if (type === 'ready') {
            clearTimeout(timeout);
            if (success) {
              this._setupWorkerMessageHandling();
              resolve();
            } else {
              reject(new Error(`WORKER_INIT_FAILED: ${error}`));
            }
          }
        };

        this.worker.onerror = (error) => {
          clearTimeout(timeout);
          reject(new Error(`WORKER_ERROR: ${error.message}`));
        };

        // Initialize worker with CV data
        this.worker.postMessage({
          type: 'initialize',
          modelPath: '/models/distilbert',
          cvData: null // Will be loaded by CVDataService
        });

      } catch (error) {
        reject(new Error(`WORKER_CREATE_FAILED: ${error.message}`));
      }
    });
  }

  /**
   * Setup ongoing worker message handling
   */
  _setupWorkerMessageHandling() {
    this.worker.onmessage = (event) => {
      const { type, answer, confidence, matchedSections, error } = event.data;
      
      switch (type) {
        case 'response':
          this._handleWorkerResponse(answer, confidence, matchedSections);
          break;
        case 'error':
          this._handleWorkerError(error);
          break;
        default:
          console.warn('ChatBot: Unknown worker message type:', type);
      }
    };
  }

  /**
   * Select conversation style and start chat
   * @param {string} style - 'hr', 'developer', or 'friend'
   */
  async selectConversationStyle(style) {
    if (!this.isInitialized) {
      throw new Error('ChatBot not initialized');
    }

    if (!['hr', 'developer', 'friend'].includes(style)) {
      throw new Error('Invalid conversation style');
    }

    this.currentStyle = style;
    this.conversationManager.setStyle(style);
    this.ui.showChatInterface();
    
    // Show greeting message based on style
    const greeting = this._getStyleGreeting(style);
    this.ui.addMessage(greeting, false);
  }

  /**
   * Process user message
   * @param {string} message - User's message
   */
  async processMessage(message) {
    if (!this.isInitialized || !this.currentStyle) {
      throw new Error('ChatBot not ready for messages');
    }

    try {
      // Add user message to UI
      this.ui.addMessage(message, true);
      this.ui.showTypingIndicator();

      // Get conversation context
      const context = this.conversationManager.getContext();

      // Send to worker for processing
      this.worker.postMessage({
        type: 'process_query',
        message: message,
        context: context,
        style: this.currentStyle
      });

    } catch (error) {
      this._handleProcessingError(error);
    }
  }

  /**
   * Restart conversation with new style selection
   */
  async restartConversation() {
    if (!this.isInitialized) {
      return;
    }

    this.currentStyle = null;
    this.conversationManager.clearHistory();
    this.ui.showStyleSelection();
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.conversationManager) {
      this.conversationManager.clearHistory();
    }

    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Handle worker response
   */
  _handleWorkerResponse(answer, confidence, matchedSections) {
    this.ui.hideTypingIndicator();
    
    if (confidence < 0.5) {
      // Low confidence - trigger fallback
      this._handleLowConfidenceResponse();
    } else {
      // Add response to conversation history
      this.conversationManager.addMessage(
        this.ui.getLastUserMessage(),
        answer
      );
      
      // Display response
      this.ui.addMessage(answer, false);
    }
  }

  /**
   * Handle worker error
   */
  _handleWorkerError(error) {
    this.ui.hideTypingIndicator();
    console.error('ChatBot: Worker error:', error);
    
    const errorMessage = this._getStyleErrorMessage(this.currentStyle);
    this.ui.addMessage(errorMessage, false);
  }

  /**
   * Handle low confidence responses
   */
  _handleLowConfidenceResponse() {
    const rephraseMessage = this._getStyleRephraseMessage(this.currentStyle);
    this.ui.addMessage(rephraseMessage, false);
  }

  /**
   * Handle processing errors
   */
  _handleProcessingError(error) {
    this.ui.hideTypingIndicator();
    console.error('ChatBot: Processing error:', error);
    
    const errorMessage = this._getStyleErrorMessage(this.currentStyle);
    this.ui.addMessage(errorMessage, false);
  }

  /**
   * Handle initialization errors
   */
  _handleInitializationError(error) {
    console.error('ChatBot: Initialization error:', error);
    
    let errorMessage;
    switch (error.message) {
      case 'BROWSER_UNSUPPORTED':
        errorMessage = "Oops, sorry, we couldn't load Serhii to your browser :(";
        break;
      case 'WORKER_TIMEOUT':
        errorMessage = "Having trouble downloading my brain 🧠 Check your connection?";
        break;
      default:
        errorMessage = "Something went wrong during initialization. Please try refreshing the page.";
    }

    if (this.ui) {
      this.ui.showError(errorMessage);
    } else {
      // Fallback if UI isn't available
      if (typeof alert !== 'undefined') {
        alert(errorMessage);
      } else {
        console.error('ChatBot initialization error:', errorMessage);
      }
    }
  }

  /**
   * Get greeting message for style
   */
  _getStyleGreeting(style) {
    const greetings = {
      hr: "Hello! I'm Serhii's AI assistant. I can help you learn about his professional experience, skills, and achievements. What would you like to know?",
      developer: "Hey there! I'm an AI version of Serhii. Feel free to ask me about his technical experience, projects, or anything development-related. What's on your mind?",
      friend: "Hi! 👋 I'm Serhii's AI buddy! Ask me anything about his work, projects, or just chat about tech stuff. What would you like to know? 😊"
    };
    
    return greetings[style] || greetings.developer;
  }

  /**
   * Get error message for style
   */
  _getStyleErrorMessage(style) {
    const messages = {
      hr: "I apologize, but I'm experiencing technical difficulties. Please try rephrasing your question or contact Serhii directly.",
      developer: "Hmm, something went wrong on my end. Mind trying that again or rephrasing your question?",
      friend: "Oops! 😅 Something got mixed up. Can you try asking that again in a different way?"
    };
    
    return messages[style] || messages.developer;
  }

  /**
   * Get rephrase message for style
   */
  _getStyleRephraseMessage(style) {
    const messages = {
      hr: "I'm not entirely certain about that topic. Could you please rephrase your question or be more specific about what you'd like to know?",
      developer: "I'm not quite sure what you're looking for there. Could you rephrase that or give me a bit more context?",
      friend: "Hmm, I'm not sure I got that! 🤔 Could you ask that in a different way? Maybe be a bit more specific?"
    };
    
    return messages[style] || messages.developer;
  }
}

export { ChatBot };