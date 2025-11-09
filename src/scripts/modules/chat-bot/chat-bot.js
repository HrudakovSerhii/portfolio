/**
 * ChatBot - Main entry point for the chatbot feature
 * Handles lazy loading, dual-engine initialization, and browser compatibility
 */
class ChatBot {
  constructor() {
    this.isInitialized = false;
    this.chatbotQARouter = null;
    this.ui = null;
    this.conversationManager = null;
    this.cvDataService = null;
    this.cvChunks = null;
    this.currentStyle = null;
    this.initializationPromise = null;

    this.sessionStartTime = Date.now();
    this.queryCount = 0;
    this.engineMode = 'semantic-qa'; // Semantic QA mode only
  }

  /**
   * Initialize the chatbot system with lazy loading
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
        onRestart: () => this.restartConversation(),
        onFallbackSubmit: (name, email) => this.handleFallbackSubmit(name, email),
        onRetry: () => this.retryInitialization()
      });
      this.ui.initialize();
      this.ui.showLoadingState();



      // Initialize CV data service first
      this.cvDataService = new this._CVDataService();
      await this.cvDataService.loadCVData();

      // Initialize dual-engine system
      await this.initializeChat();

      this.conversationManager = new this._ConversationManager();
      this.styleManager = new this._StyleManager();
      this.fallbackHandler = new this._FallbackHandler(this.styleManager, this.conversationManager);

      // Check for persisted style
      const persistedStyle = this.styleManager.loadPersistedStyle();
      if (persistedStyle) {
        this.currentStyle = persistedStyle;
        this.conversationManager.setStyle(persistedStyle);
        this.styleManager.setStyle(persistedStyle);
      }

      this.isInitialized = true;

      // Complete progress bar animation
      this._completeProgressBar();

      // Show style selection after a brief delay
      setTimeout(() => {
        this.ui.showStyleSelection();
      }, 500);

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
   * Lazy load required modules with performance optimization
   */
  async _loadModules() {
    try {
      // Dynamic imports for lazy loading with performance tracking
      const moduleLoadStart = performance.now();

      const [
        { default: ChatUI },
        { default: ConversationManager },
        { default: CVDataService },
        { default: StyleManager },
        { default: FallbackHandler }
      ] = await Promise.all([
        import('./chat-ui.js'),
        import('./conversation-manager.js'),
        import('./cv-data-service.js'),
        import('./style-manager.js'),
        import('./fallback-handler.js')
      ]);

      // Store classes for this instance
      this._ChatUI = ChatUI;
      this._ConversationManager = ConversationManager;
      this._CVDataService = CVDataService;
      this._StyleManager = StyleManager;
      this._FallbackHandler = FallbackHandler;

      const moduleLoadTime = performance.now() - moduleLoadStart;
      if (window.isDev) {
        console.log(`Chat modules loaded in ${moduleLoadTime.toFixed(2)}ms`);
      }

    } catch (error) {
      throw new Error(`MODULE_LOAD_FAILED: ${error.message}`);
    }
  }

  /**
   * Initialize the Chat Bot QA Router
   */
  async initializeChat() {
    try {
      console.log('🔧 CHAT-BOT: Initializing chat bot QA router...');

      // Import the chatbot QA router
      const { default: ChatBotQARouter } = await import('./chat-bot-qa-router.js');

      // Use cv-data-service to load and prepare CV data
      await this.cvDataService.loadCVData();
      this.cvChunks = this.cvDataService.prepareCVChunks();

      console.log('📊 CHAT-BOT: CV data loaded via cv-data-service:', {
        totalChunks: this.cvChunks.length,
        categories: [...new Set(this.cvChunks.map(chunk => chunk.metadata.category))],
        version: this.cvDataService.getMetadata().version,
        sampleChunk: this.cvChunks[0] ? {
          id: this.cvChunks[0].id,
          hasEmbedding: !!this.cvChunks[0].embedding,
          embeddingDimensions: this.cvChunks[0].embedding?.length,
          textPreview: this.cvChunks[0].text?.substring(0, 100) + '...'
        } : null
      });

      // Initialize the chatbot QA router with CV chunks for embedding pre-computation
      this.chatbotQARouter = new ChatBotQARouter({
        embeddingWorkerPath: './scripts/workers/embedding-worker.js',
        textGenWorkerPath: './scripts/workers/optimized-ml-worker.js',
        eqaWorkerPath: './scripts/workers/eqa-worker.js',
        maxContextChunks: 5,
        similarityThreshold: 0.3,
        eqaConfidenceThreshold: 0.3,
        timeout: 5000
      });

      console.log('🚀 CHAT-BOT: Starting router initialization with CV chunks:', this.cvChunks.length);

      // Initialize the router with prepared chunks
      await this.chatbotQARouter.initialize(this.cvChunks);

      console.log('✅ CHAT-BOT: Chat bot QA router initialized successfully, router ready state:', this.chatbotQARouter.getStatus());
    } catch (error) {
      console.error('❌ CHAT-BOT: Router initialization failed:', error);
      throw error;
    }
  }



  /**
   * Process message using chatbot QA router
   */
  async _processMessageWithRouter(message, conversationContext) {
    try {
      console.log('🔍 CHAT-BOT: Starting router processing...');
      console.log('📝 CHAT-BOT: User message:', message);
      console.log('🎨 CHAT-BOT: Conversation style:', this.currentStyle);

      // Query the router with conversation style and context
      const result = await this.chatbotQARouter.processQuery(message, {
        style: this.currentStyle,
        context: conversationContext
      });

      console.log('📊 CHAT-BOT: Router result:', {
        hasAnswer: !!result.answer,
        confidence: result.confidence,
        intent: result.intent,
        method: result.method,
        matchedChunks: result.matchedChunks?.length || 0,
        processingTime: result.processingTime
      });

      // Log the context that was selected
      if (result.matchedChunks && result.matchedChunks.length > 0) {
        console.log('🎯 CHAT-BOT: Selected CV context:',
          result.matchedChunks.map(chunk => ({
            id: chunk.id,
            similarity: chunk.similarity,
            preview: chunk.text.substring(0, 100) + '...'
          }))
        );
      }

      // Handle the response
      this._handleRouterResponse(result, message);

    } catch (error) {
      console.error('❌ CHAT-BOT: Router processing failed:', error);
      this._handleWorkerError(error.message);
    }
  }

  /**
   * Handle router response
   */
  _handleRouterResponse(result, originalMessage) {
    this.ui.hideTypingIndicator();

    if (result.error) {
      console.error('❌ CHAT-BOT: Router error:', result.error);
      this._handleWorkerError(result.error);
      return;
    }

    // Log processing metrics for debugging
    if (result.metrics && window.isDev) {
      console.log('📈 CHAT-BOT: Processing metrics:', result.metrics);
    }

    // Check if fallback handling is needed
    const fallbackDecision = this.fallbackHandler.shouldTriggerFallback(
      result.confidence,
      originalMessage,
      result.matchedChunks
    );

    if (fallbackDecision.shouldFallback) {
      this._handleFallbackResponse(fallbackDecision, originalMessage);
    } else {
      // Format response based on current style
      const formattedAnswer = this.styleManager.formatResponse(result.answer, {
        matchedSections: result.matchedChunks,
        confidence: result.confidence,
        metrics: result.metrics
      });

      // Add response to conversation history
      this.conversationManager.addMessage(
        originalMessage,
        formattedAnswer,
        result.matchedChunks,
        result.confidence
      );

      // Display response
      this.ui.addMessage(formattedAnswer, false, this.currentStyle);
    }
  }

  /**
   * Handle semantic-qa response (legacy compatibility)
   */
  _handleSemanticQAResponse(result, originalMessage) {
    // Redirect to router response handler
    this._handleRouterResponse(result, originalMessage);
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
   * Process user message with dual-engine system
   * @param {string} message - User's message
   */
  async processMessage(message) {
    if (!this.isInitialized || !this.currentStyle) {
      throw new Error('ChatBot not ready for messages');
    }

    try {
      // Track query performance
      this.queryCount++;
      const queryStartTime = performance.now();

      // Add user message to UI
      this.ui.addMessage(message, true);
      this.ui.showTypingIndicator();

      // Get conversation context
      const context = this.conversationManager.getContext();

      console.log('🚀 CHAT-BOT: Processing message:', {
        message,
        contextLength: context.length,
        contextPreview: context.slice(0, 2),
        style: this.currentStyle,
        queryCount: this.queryCount
      });

      // Always use semantic-qa system
      console.log('🧠 CHAT-BOT: Using semantic-qa system...');
      await this._processMessageWithRouter(message, context);

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

    // Reset fallback handler if it exists
    if (this.fallbackHandler) {
      this.fallbackHandler.resetFallbackAttempts();
    }

    // Clear stored fallback query
    this.currentFallbackQuery = null;

    // Clear UI and show style selection
    this.ui.clearMessages();
    this.ui.showStyleSelection();
  }

  /**
   * Get current engine mode
   */
  getEngineMode() {
    return this.engineMode;
  }



  /**
   * Get available engines
   */
  getAvailableEngines() {
    return ['semantic-qa']; // Semantic QA system only
  }

  /**
   * Clean up resources
   */
  async destroy() {
    console.log('🧹 CHAT-BOT: Cleaning up resources...');

    // Clean up router and terminate workers
    if (this.chatbotQARouter) {
      try {
        this.chatbotQARouter.cleanup();
        console.log('✅ CHAT-BOT: Router cleanup completed');
      } catch (error) {
        console.error('❌ CHAT-BOT: Router cleanup error:', error);
      }
      this.chatbotQARouter = null;
    }

    // Clean up managers
    if (this.conversationManager) {
      this.conversationManager.clearHistory();
    }

    // Reset state
    this.isInitialized = false;
    this.initializationPromise = null;
    this.queryCount = 0;

    console.log('✅ CHAT-BOT: All resources cleaned up');
  }



  /**
   * Handle worker response (legacy for direct worker communication)
   */
  _handleWorkerResponse(answer, confidence, matchedSections, processingMetrics) {
    this.ui.hideTypingIndicator();

    // Log processing metrics for debugging
    if (processingMetrics && window.isDev) {
      console.log('Query processing metrics:', processingMetrics);
    }

    const lastUserMessage = this.ui.getLastUserMessage();

    // Check if fallback handling is needed
    const fallbackDecision = this.fallbackHandler.shouldTriggerFallback(
      confidence,
      lastUserMessage,
      matchedSections
    );

    if (fallbackDecision.shouldFallback) {
      this._handleFallbackResponse(fallbackDecision, lastUserMessage);
    } else {
      // Format response based on current style
      const formattedAnswer = this.styleManager.formatResponse(answer, {
        matchedSections,
        confidence,
        metrics: processingMetrics
      });

      // Add response to conversation history
      this.conversationManager.addMessage(
        lastUserMessage,
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
   * Handle fallback responses based on fallback decision
   * @param {Object} fallbackDecision - Decision object from fallback handler
   * @param {string} originalQuery - Original user query
   */
  _handleFallbackResponse(fallbackDecision, originalQuery) {
    const fallbackResponse = this.fallbackHandler.generateFallbackResponse(
      fallbackDecision.action,
      this.currentStyle,
      { originalQuery, reason: fallbackDecision.reason }
    );

    // Add fallback message to conversation history
    this.conversationManager.addMessage(
      originalQuery,
      fallbackResponse.message,
      [],
      0 // Zero confidence for fallback responses
    );

    // Display the fallback message
    this.ui.addMessage(fallbackResponse.message, false, this.currentStyle);

    // Handle UI action if needed
    if (fallbackResponse.uiAction === 'show_email_form') {
      // Store the original query for email generation
      this.currentFallbackQuery = originalQuery;

      // Show email form after a brief delay
      setTimeout(() => {
        this.ui.showFallbackForm();
      }, 1000);
    }
  }

  /**
   * Handle fallback form submission
   * @param {string} name - User's name
   * @param {string} email - User's email
   */
  handleFallbackSubmit(name, email) {
    // Sanitize inputs
    const sanitizedName = this.fallbackHandler.sanitizeInput(name);
    const sanitizedEmail = this.fallbackHandler.sanitizeInput(email);

    // Validate inputs
    if (!this.fallbackHandler.validateName(sanitizedName)) {
      this.ui.showFormValidationError('name', 'Please enter a valid name (2-50 characters)');
      return;
    }

    if (!this.fallbackHandler.validateEmail(sanitizedEmail)) {
      this.ui.showFormValidationError('email', 'Please enter a valid email address');
      return;
    }

    // Generate mailto link with conversation context
    const mailtoUrl = this.fallbackHandler.generateMailtoLink(
      sanitizedName,
      sanitizedEmail,
      this.currentFallbackQuery || 'General inquiry',
      this.currentStyle
    );

    // Use the UI method to open email and show confirmation
    this.ui.generateEmailLink(sanitizedName, sanitizedEmail, mailtoUrl, this.currentStyle);

    // Clear the stored fallback query
    this.currentFallbackQuery = null;
  }

  /**
   * Handle low confidence responses (legacy method for compatibility)
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
   * Retry initialization after an error
   */
  async retryInitialization() {
    // Reset state
    this.isInitialized = false;
    this.initializationPromise = null;

    // Clean up existing semantic-qa if any
    if (this.chatbotQARouter) {
      this.chatbotQARouter = null;
    }

    // Retry initialization
    return this.initialize();
  }

  /**
   * Complete the progress bar animation
   */
  _completeProgressBar() {
    if (this.ui && this.ui.chatContainer) {
      const progressBar = this.ui.chatContainer.querySelector('.progress-bar');
      if (progressBar) {
        progressBar.style.width = '100%';

        // Clear any existing progress interval
        if (this.ui.chatContainer._progressInterval) {
          clearInterval(this.ui.chatContainer._progressInterval);
          this.ui.chatContainer._progressInterval = null;
        }
      }
    }
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    // Add session-specific metrics
    return {
      sessionMetrics: {
        sessionDuration: Date.now() - this.sessionStartTime,
        totalQueries: this.queryCount,
        queriesPerMinute: this.queryCount / ((Date.now() - this.sessionStartTime) / 60000),
        isInitialized: this.isInitialized,
        currentStyle: this.currentStyle
      }
    };
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
