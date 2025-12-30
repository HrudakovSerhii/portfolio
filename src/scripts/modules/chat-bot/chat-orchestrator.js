/**
 * ChatOrchestrator - Pure data orchestration for chat functionality
 *
 * Responsibilities:
 * - Initialize and coordinate data processing workers (embedding, text generation)
 * - Route user queries through ChatBotQARouter
 * - Manage conversation state and context
 * - Load role-specific precomputed embeddings (no client-side embedding generation for CV data)
 * - Provide data-only API (no UI manipulation)
 *
 * Architecture:
 * - Build time: Embeddings precomputed and stored in public/data/embeddings-{role}.json
 * - Initialize: Sets up orchestrator, no CV data loaded yet
 * - selectConversationStyle(role): Fetches precomputed embeddings for specific role
 * - processMessage(query): Only embeds user query, uses preloaded CV embeddings for search
 *
 * Change History:
 * 2025-12-30: Refactored from chat-bot.js
 *   - Removed all UI manipulation (progress bars, messages, forms, error displays)
 *   - Extracted UI event handlers to integration layer
 *   - Made class UI-agnostic with callback-based architecture
 *   - Renamed from ChatBot to ChatOrchestrator for clarity
 *   - Exposed pure data API for processing queries and managing state
 *   - Implemented role-based embedding loading (fetch precomputed embeddings per role)
 *   - Moved CV data loading from initialize() to selectConversationStyle()
 */

import {ChatBotQARouter} from "./chat-bot-qa-router.js";

class ChatOrchestrator {
  constructor(callbacks = {}) {
    this.isInitialized = false;
    this.chatbotQARouter = null;
    this.conversationManager = null;
    this.cvDataService = null;
    this.cvChunks = null;
    this.currentStyle = null;
    this.initializationPromise = null;
    this.styleManager = null;
    this.fallbackHandler = null;

    this.sessionStartTime = Date.now();
    this.queryCount = 0;
    this.engineMode = 'semantic-qa';
    this.currentFallbackQuery = null;

    // Store callbacks for external handling (typically UI)
    this.callbacks = {
      onProgress: callbacks.onProgress || (() => {}),
      onInitialized: callbacks.onInitialized || (() => {}),
      onError: callbacks.onError || (() => {}),
      onMessage: callbacks.onMessage || (() => {}),
      onFallback: callbacks.onFallback || (() => {}),
      onRoleDataLoading: callbacks.onRoleDataLoading || (() => {}),
      onRoleDataLoaded: callbacks.onRoleDataLoaded || (() => {}),
      ...callbacks
    };
  }

  /**
   * Initialize the orchestrator with lazy loading
   * Does NOT load CV data - that happens when role is selected
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

      // Initialize managers (no CV data yet)
      this.cvDataService = new this._CVDataService();
      this.conversationManager = new this._ConversationManager();
      this.styleManager = new this._ConversationStyleManager();
      this.fallbackHandler = new this._FallbackHandler(this.styleManager, this.conversationManager);

      // Check for persisted style
      const persistedStyle = this.styleManager.loadPersistedStyle();

      this.isInitialized = true;

      // Notify initialization complete via callback
      this.callbacks.onInitialized({
        success: true,
        persistedStyle
      });

      // If there's a persisted style, load that role's data automatically
      if (persistedStyle) {
        await this.selectConversationStyle(persistedStyle);
      }

      return true;
    } catch (error) {
      this.callbacks.onError({
        type: 'initialization',
        error: error.message,
        details: error
      });
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
      console.warn('ChatOrchestrator: Web Workers not supported');
      return false;
    }

    // Check for WebAssembly support (required for ML models)
    if (typeof WebAssembly === 'undefined') {
      console.warn('ChatOrchestrator: WebAssembly not supported');
      return false;
    }

    // Check for modern JavaScript features
    try {
      eval('(async () => {})');
      eval('class Test {}');
      eval('const test = { ...{} }');
    } catch (e) {
      console.warn('ChatOrchestrator: Modern JavaScript features not supported');
      return false;
    }

    return true;
  }

  /**
   * Lazy load required modules
   */
  async _loadModules() {
    try {
      const [
        { default: ConversationManager },
        { default: CVDataService },
        { default: ConversationStyleManager },
        { default: FallbackHandler }
      ] = await Promise.all([
        import('./conversation-manager.js'),
        import('./cv-data-service.js'),
        import('./conversation-style-manager.js'),
        import('./fallback-handler.js')
      ]);

      // Store classes for this instance
      this._ConversationManager = ConversationManager;
      this._CVDataService = CVDataService;
      this._ConversationStyleManager = ConversationStyleManager;
      this._FallbackHandler = FallbackHandler;
    } catch (error) {
      throw new Error(`MODULE_LOAD_FAILED: ${error.message}`);
    }
  }

  /**
   * Initialize the Chat Bot QA Router with role-specific CV data
   * @param {Array} cvChunks - Precomputed CV chunks with embeddings
   */
  async initializeChatRouter(cvChunks) {
    try {
      // Import the chatbot QA router
      const { ChatBotQARouter } = await import('./chat-bot-qa-router.js');

      // Initialize the chatbot QA router with precomputed CV chunks
      this.chatbotQARouter = new ChatBotQARouter({
        embeddingWorkerPath: './scripts/workers/embedding-worker.js',
        textGenWorkerPath: './scripts/workers/optimized-ml-worker.js',
        eqaWorkerPath: './scripts/workers/eqa-worker.js',
        maxContextChunks: 5,
        similarityThreshold: 0.3,
        eqaConfidenceThreshold: 0.05,
        timeout: 60000,
        onProgress: (worker, progress) => {
          // Forward progress to callback
          this.callbacks.onProgress(worker, progress);
        }
      });

      // Initialize the router with prepared chunks
      await this.chatbotQARouter.initializeRouter(cvChunks);
    } catch (error) {
      console.error('❌ CHAT-ORCHESTRATOR: Router initialization failed:', error);
      throw error;
    }
  }

  /**
   * Select conversation style and load role-specific CV data
   * This triggers loading of precomputed embeddings for the selected role
   * @param {string} style - 'hr', 'developer', or 'friend'
   * @returns {Promise<Object>} Style selection result
   */
  async selectConversationStyle(style) {
    if (!this.isInitialized) {
      throw new Error('ChatOrchestrator not initialized');
    }

    if (!this.styleManager.isValidStyle(style)) {
      throw new Error(`Invalid conversation style: ${style}`);
    }

    try {
      // Notify that role data is loading
      this.callbacks.onRoleDataLoading({ role: style });

      // Load role-specific CV data with precomputed embeddings
      await this.cvDataService.loadCVData(style);
      this.cvChunks = this.cvDataService.prepareCVChunks();

      // Initialize or reinitialize router with role-specific chunks
      if (this.chatbotQARouter) {
        // Router already exists, cleanup and reinitialize
        this.chatbotQARouter.cleanup();
      }

      await this.initializeChatRouter(this.cvChunks);

      // Set style in all managers
      this.currentStyle = style;
      this.conversationManager.setStyle(style);
      this.styleManager.setStyle(style);

      // Get greeting data for external rendering
      const greeting = this.styleManager.getGreeting(style);

      // Notify that role data is loaded
      this.callbacks.onRoleDataLoaded({
        role: style,
        chunkCount: this.cvChunks.length
      });

      return {
        style,
        greeting,
        success: true,
        chunkCount: this.cvChunks.length
      };
    } catch (error) {
      console.error('❌ CHAT-ORCHESTRATOR: Style selection failed:', error);
      this.callbacks.onError({
        type: 'style_selection',
        error: error.message,
        style
      });
      throw error;
    }
  }

  /**
   * Process user message - returns data result, does not manipulate UI
   * @param {string} message - User's message
   * @returns {Promise<Object>} Processing result with answer data
   */
  async processMessage(message) {
    if (!this.isInitialized || !this.currentStyle) {
      throw new Error('ChatOrchestrator not ready for messages');
    }

    if (!this.chatbotQARouter) {
      throw new Error('ChatOrchestrator: No role selected, cannot process message');
    }

    try {
      // Track query performance
      this.queryCount++;
      const queryStartTime = performance.now();

      // Get conversation context
      const context = this.conversationManager.getContext();

      // Process message and get result
      const result = await this._processMessageWithRouter(message, context);

      // Add processing time
      result.processingTime = performance.now() - queryStartTime;

      return result;
    } catch (error) {
      console.error('ChatOrchestrator: Processing error:', error);
      return {
        success: false,
        error: error.message,
        message
      };
    }
  }

  /**
   * Process message using chatbot QA router
   * @private
   */
  async _processMessageWithRouter(message, conversationContext) {
    try {
      // Query the router with conversation style and context
      const result = await this.chatbotQARouter.processQuery(message, {
        style: this.currentStyle,
        context: conversationContext
      });

      // Process the router result into a structured response
      return this._processRouterResult(result, message);
    } catch (error) {
      console.error('❌ CHAT-ORCHESTRATOR: Router processing failed:', error);
      throw error;
    }
  }

  /**
   * Process router result into structured data
   * @private
   */
  _processRouterResult(result, originalMessage) {
    if (result.error) {
      return {
        success: false,
        error: result.error,
        message: originalMessage
      };
    }

    // Check if fallback is needed
    const isFallbackResponse = result.method === 'fallback' || result.confidence === 0;

    if (isFallbackResponse) {
      const fallbackDecision = {
        shouldFallback: true,
        reason: result.matchedChunks?.length === 0 ? 'no_matches' : 'low_confidence',
        action: this.fallbackHandler.getNextFallbackAction(originalMessage)
      };

      return this._generateFallbackResponse(fallbackDecision, originalMessage);
    }

    // Format successful response
    const formattedAnswer = this.styleManager.formatResponse(result.answer, {
      matchedSections: result.matchedChunks,
      confidence: result.confidence,
      metrics: result.metrics
    });

    // Add to conversation history
    this.conversationManager.addMessage(
      originalMessage,
      formattedAnswer,
      result.matchedChunks,
      result.confidence
    );

    return {
      success: true,
      type: 'answer',
      message: originalMessage,
      answer: formattedAnswer,
      confidence: result.confidence,
      matchedChunks: result.matchedChunks,
      metrics: result.metrics,
      style: this.currentStyle
    };
  }

  /**
   * Generate fallback response data
   * @private
   */
  _generateFallbackResponse(fallbackDecision, originalQuery) {
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
      0
    );

    // Store original query if email form is needed
    if (fallbackResponse.uiAction === 'show_email_form') {
      this.currentFallbackQuery = originalQuery;
    }

    return {
      success: true,
      type: 'fallback',
      message: originalQuery,
      answer: fallbackResponse.message,
      confidence: 0,
      uiAction: fallbackResponse.uiAction,
      style: this.currentStyle
    };
  }

  /**
   * Restart conversation
   * @returns {Object} Restart result
   */
  restartConversation() {
    if (!this.isInitialized) {
      throw new Error('ChatOrchestrator not initialized');
    }

    // Reset all managers
    this.currentStyle = null;
    this.conversationManager.clearHistory();
    this.styleManager.resetStyle();

    if (this.fallbackHandler) {
      this.fallbackHandler.resetFallbackAttempts();
    }

    this.currentFallbackQuery = null;

    // Cleanup router (will be reinitialized when role is selected)
    if (this.chatbotQARouter) {
      this.chatbotQARouter.cleanup();
      this.chatbotQARouter = null;
    }

    return {
      success: true,
      action: 'restart'
    };
  }

  /**
   * Generate mailto link for fallback form
   * @param {string} name - User's name
   * @param {string} email - User's email
   * @returns {Object} Mailto link data
   */
  generateFallbackEmail(name, email) {
    // Sanitize inputs
    const sanitizedName = this.fallbackHandler.sanitizeInput(name);
    const sanitizedEmail = this.fallbackHandler.sanitizeInput(email);

    // Validate inputs
    if (!this.fallbackHandler.validateName(sanitizedName)) {
      return {
        success: false,
        error: 'INVALID_NAME',
        field: 'name',
        message: 'Please enter a valid name (2-50 characters)'
      };
    }

    if (!this.fallbackHandler.validateEmail(sanitizedEmail)) {
      return {
        success: false,
        error: 'INVALID_EMAIL',
        field: 'email',
        message: 'Please enter a valid email address'
      };
    }

    // Generate mailto link
    const mailtoUrl = this.fallbackHandler.generateMailtoLink(
      sanitizedName,
      sanitizedEmail,
      this.currentFallbackQuery || 'General inquiry',
      this.currentStyle
    );

    // Clear stored fallback query
    this.currentFallbackQuery = null;

    return {
      success: true,
      mailtoUrl,
      name: sanitizedName,
      email: sanitizedEmail
    };
  }

  /**
   * Get current state
   * @returns {Object} Current orchestrator state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      currentStyle: this.currentStyle,
      engineMode: this.engineMode,
      queryCount: this.queryCount,
      hasConversation: this.conversationManager?.getContext().length > 0,
      hasCVData: this.cvChunks !== null,
      chunkCount: this.cvChunks?.length || 0
    };
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
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
   * Get available engines
   */
  getAvailableEngines() {
    return ['semantic-qa'];
  }

  /**
   * Get engine mode
   */
  getEngineMode() {
    return this.engineMode;
  }

  /**
   * Retry initialization after an error
   */
  async retryInitialization() {
    // Reset state
    this.isInitialized = false;
    this.initializationPromise = null;

    if (this.chatbotQARouter) {
      this.chatbotQARouter.cleanup();
      this.chatbotQARouter = null;
    }

    return this.initialize();
  }

  /**
   * Clean up resources
   */
  async destroy() {
    if (this.chatbotQARouter) {
      try {
        this.chatbotQARouter.cleanup();
      } catch (error) {
        console.error('❌ CHAT-ORCHESTRATOR: Router cleanup error:', error);
      }
      this.chatbotQARouter = null;
    }

    if (this.conversationManager) {
      this.conversationManager.clearHistory();
    }

    this.isInitialized = false;
    this.initializationPromise = null;
    this.queryCount = 0;
    this.cvChunks = null;
  }
}

export { ChatOrchestrator };