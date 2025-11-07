/**
 * Optimized Chat Integration for Text Generation Models
 * Simplified approach focused on better prompting and context management
 */

import OptimizedCVDataService from './cv-data-service-optimized.js';

class OptimizedChatIntegration {
  constructor() {
    this.cvDataService = new OptimizedCVDataService();
    this.worker = null;
    this.isInitialized = false;
    this.conversationHistory = [];
    this.currentStyle = 'developer';

    // Performance tracking
    this.metrics = {
      totalQueries: 0,
      averageResponseTime: 0,
      successfulResponses: 0
    };
  }

  /**
   * Initialize the chat system
   */
  async initialize() {
    try {
      // Load CV data
      const cvData = await this.cvDataService.loadCVData();
      console.log('✅ CV data loaded successfully');

      // Initialize ML worker
      this.worker = new Worker('/scripts/workers/optimized-ml-worker.js');
      this.setupWorkerHandlers();

      // Send initialization message to worker
      this.worker.postMessage({
        type: 'initialize'
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 30000);

        this.worker.addEventListener('message', function initHandler(event) {
          if (event.data.type === 'ready') {
            clearTimeout(timeout);
            this.removeEventListener('message', initHandler);
            
            if (event.data.success) {
              console.log('✅ ML Worker initialized successfully');
              this.isInitialized = true;
              resolve(true);
            } else {
              reject(new Error(event.data.error || 'Worker initialization failed'));
            }
          }
        });
      });

    } catch (error) {
      console.error('❌ Chat initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup worker event handlers
   */
  setupWorkerHandlers() {
    this.worker.addEventListener('message', (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'status':
          console.log('Worker status:', data.message);
          break;
        case 'progress':
          console.log('Loading progress:', data.progress);
          break;
        case 'error':
          console.error('Worker error:', data.error);
          break;
      }
    });
  }

  /**
   * Process user query with optimized approach
   */
  async processQuery(userMessage, style = 'developer') {
    if (!this.isInitialized) {
      throw new Error('Chat system not initialized');
    }

    const startTime = Date.now();
    this.currentStyle = style;

    try {
      // Find relevant topics using the optimized service
      const relevantTopics = this.cvDataService.findRelevantTopics(userMessage, 2);

      // Calculate confidence based on match quality
      const confidence = this.cvDataService.calculateConfidence(relevantTopics, userMessage);

      // If confidence is too low, return fallback response
      if (confidence < 0.4) {
        const fallbackResponse = this.cvDataService.getFallbackResponse(style, confidence);

        this.updateMetrics(startTime, false);

        return {
          answer: fallbackResponse,
          confidence: confidence,
          matchedTopics: [],
          processingTime: Date.now() - startTime,
          source: 'fallback'
        };
      }

      // Build focused context
      const context = this.cvDataService.buildContext(relevantTopics, style);

      // Create optimized prompt
      const prompt = this.cvDataService.createPrompt(
        userMessage,
        context,
        style,
        this.conversationHistory.slice(-2)
      );

      // Send to worker for text generation
      const response = await this.generateResponse(prompt, userMessage, relevantTopics);

      // Update conversation history
      this.updateConversationHistory(userMessage, response.answer, relevantTopics);

      // Update metrics
      this.updateMetrics(startTime, true);

      return {
        ...response,
        confidence: confidence,
        processingTime: Date.now() - startTime,
        source: 'generated'
      };

    } catch (error) {
      console.error('Query processing failed:', error);
      this.updateMetrics(startTime, false);

      return {
        answer: "I'm having trouble processing your question right now. Could you try rephrasing it?",
        confidence: 0.1,
        matchedTopics: [],
        processingTime: Date.now() - startTime,
        source: 'error',
        error: error.message
      };
    }
  }

  /**
   * Generate response using ML worker
   */
  async generateResponse(prompt, originalQuery, relevantTopics) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response generation timeout'));
      }, 15000);

      const messageHandler = (event) => {
        if (event.data.type === 'response' && event.data.query === originalQuery) {
          clearTimeout(timeout);
          this.worker.removeEventListener('message', messageHandler);

          resolve({
            answer: event.data.answer,
            matchedTopics: relevantTopics.map(topic => ({
              id: topic.topicId,
              score: topic.score,
              matchType: topic.matchType,
              matchedTerms: topic.matchedTerms
            })),
            metrics: event.data.processingMetrics || {}
          });
        } else if (event.data.type === 'error' && event.data.query === originalQuery) {
          clearTimeout(timeout);
          this.worker.removeEventListener('message', messageHandler);
          reject(new Error(event.data.error));
        }
      };

      this.worker.addEventListener('message', messageHandler);

      // Send generation request
      this.worker.postMessage({
        type: 'generate',
        prompt: prompt,
        query: originalQuery,
        maxTokens: 150,
        temperature: 0.7
      });
    });
  }

  /**
   * Update conversation history
   */
  updateConversationHistory(userMessage, botResponse, matchedTopics) {
    this.conversationHistory.push({
      timestamp: Date.now(),
      userMessage,
      botResponse,
      matchedTopics: matchedTopics.map(t => t.topicId),
      style: this.currentStyle
    });

    // Keep only last 10 exchanges
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics(startTime, success) {
    this.metrics.totalQueries++;

    const responseTime = Date.now() - startTime;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.totalQueries - 1) + responseTime) /
      this.metrics.totalQueries;

    if (success) {
      this.metrics.successfulResponses++;
    }
  }

  /**
   * Set communication style
   */
  setStyle(style) {
    if (['hr', 'developer', 'friend'].includes(style)) {
      this.currentStyle = style;
    }
  }

  /**
   * Get current style
   */
  getStyle() {
    return this.currentStyle;
  }

  /**
   * Get greeting for current style
   */
  getGreeting() {
    return this.cvDataService.getGreeting(this.currentStyle);
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalQueries > 0 ?
        (this.metrics.successfulResponses / this.metrics.totalQueries) * 100 : 0,
      conversationLength: this.conversationHistory.length
    };
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.conversationHistory = [];
    this.cvDataService.reset();
    this.isInitialized = false;
  }
}

export default OptimizedChatIntegration;
