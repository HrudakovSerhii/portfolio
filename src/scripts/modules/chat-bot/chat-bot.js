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
      this.ui.setEventHandlers({
        onStyleSelect: (style) => this.selectConversationStyle(style),
        onMessageSend: (message) => this.processMessage(message),
        onRestart: () => this.restartConversation()
      });
      this.ui.initialize();
      this.ui.showLoadingState();

      // Initialize worker
      await this._initializeWorker();

      // Initialize other services
      this.cvDataService = new this._CVDataService();
      await this.cvDataService.loadCVData();

      this.conversationManager = new this._ConversationManager();
      this.styleManager = new this._StyleManager();

      // Check for persisted style
      const persistedStyle = this.styleManager.loadPersistedStyle();
      if (persistedStyle) {
        this.currentStyle = persistedStyle;
        this.conversationManager.setStyle(persistedStyle);
        this.styleManager.setStyle(persistedStyle);
      }

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
        { default: ChatUI },
        { default: ConversationManager },
        { default: CVDataService },
        { default: StyleManager }
      ] = await Promise.all([
        import('./chat-ui.js'),
        import('./conversation-manager.js'),
        import('./cv-data-service.js'),
        import('./style-manager.js')
      ]);

      // Store classes for this instance
      this._ChatUI = ChatUI;
      this._ConversationManager = ConversationManager;
      this._CVDataService = CVDataService;
      this._StyleManager = StyleManager;
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
      const { type, answer, confidence, matchedSections, processingMetrics, error } = event.data;
      
      switch (type) {
        case 'response':
          this._handleWorkerResponse(answer, confidence, matchedSections, processingMetrics);
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

    if (!this.styleManager.isValidStyle(style)) {
      throw new Error(`Invalid conversation style: ${style}`);
    }

    // Set style in all managers
    this.currentStyle = style;
    this.conversationManager.setStyle(style);
    this.styleManager.setStyle(style);
    
    // Clear any existing messages and show chat interface
    this.ui.clearMessages();
    this.ui.showChatInterface();
    
    // Show greeting message based on style
    const greeting = this.styleManager.getGreeting(style);
    this.ui.addMessage(greeting, false, style);
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

    // Reset all managers
    this.currentStyle = null;
    this.conversationManager.clearHistory();
    this.styleManager.resetStyle();
    
    // Clear UI and show style selection
    this.ui.clearMessages();
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
  _handleWorkerResponse(answer, confidence, matchedSections, processingMetrics) {
    this.ui.hideTypingIndicator();
    
    // Log processing metrics for debugging
    if (processingMetrics) {
      console.log('Query processing metrics:', processingMetrics);
    }
    
    if (confidence < 0.5) {
      // Low confidence - trigger fallback
      this._handleLowConfidenceResponse();
    } else {
      // Format response based on current style
      const formattedAnswer = this.styleManager.formatResponse(answer, {
        matchedSections,
        confidence,
        metrics: processingMetrics
      });
      
      // Add response to conversation history
      this.conversationManager.addMessage(
        this.ui.getLastUserMessage(),
        formattedAnswer,
        matchedSections,
        confidence
      );
      
      // Display response
      this.ui.addMessage(formattedAnswer, false, this.currentStyle);
    }
  }

  /**
   * Handle worker error
   */
  _handleWorkerError(error) {
    this.ui.hideTypingIndicator();
    console.error('ChatBot: Worker error:', error);
    
    const errorMessage = this.styleManager.getErrorMessage(this.currentStyle);
    this.ui.addMessage(errorMessage, false, this.currentStyle);
  }

  /**
   * Handle low confidence responses
   */
  _handleLowConfidenceResponse() {
    const rephraseMessage = this.styleManager.getRephraseMessage(this.currentStyle);
    this.ui.addMessage(rephraseMessage, false, this.currentStyle);
  }

  /**
   * Handle processing errors
   */
  _handleProcessingError(error) {
    this.ui.hideTypingIndicator();
    console.error('ChatBot: Processing error:', error);
    
    const errorMessage = this.styleManager.getErrorMessage(this.currentStyle);
    this.ui.addMessage(errorMessage, false, this.currentStyle);
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


}

export { ChatBot };