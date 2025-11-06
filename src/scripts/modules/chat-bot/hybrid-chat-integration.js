/**
 * Hybrid Chat Integration
 * Combines template-based responses with constrained text generation
 */

import SimpleChatIntegration from './simple-chat-integration.js';

class HybridChatIntegration extends SimpleChatIntegration {
  constructor() {
    super();
    this.worker = null;
    this.useTextGeneration = true;
  }

  /**
   * Initialize the chat system with optional text generation
   */
  async initialize() {
    try {
      // Initialize base system
      await super.initialize();
      
      // Try to initialize ML worker
      if (this.useTextGeneration) {
        try {
          this.worker = new Worker('/scripts/workers/constrained-ml-worker.js');
          this.setupWorkerHandlers();

          // Send initialization message to worker
          this.worker.postMessage({
            type: 'initialize'
          });

          // Wait for worker to be ready
          await this.waitForWorkerReady();
          console.log('✅ Hybrid system with text generation ready');
        } catch (error) {
          console.warn('⚠️ Text generation failed to initialize, using template-only mode:', error);
          this.useTextGeneration = false;
          if (this.worker) {
            this.worker.terminate();
            this.worker = null;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Hybrid chat initialization failed:', error);
      throw error;
    }
  }

  /**
   * Wait for worker to be ready
   */
  async waitForWorkerReady() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 30000);

      const messageHandler = (event) => {
        if (event.data.type === 'ready') {
          clearTimeout(timeout);
          this.worker.removeEventListener('message', messageHandler);
          
          if (event.data.success) {
            resolve(true);
          } else {
            reject(new Error(event.data.error || 'Worker initialization failed'));
          }
        }
      };

      this.worker.addEventListener('message', messageHandler);
    });
  }

  /**
   * Setup worker event handlers
   */
  setupWorkerHandlers() {
    this.worker.addEventListener('message', (event) => {
      const { type } = event.data;

      switch (type) {
        case 'status':
          console.log('Worker status:', event.data.message);
          break;
        case 'progress':
          console.log('Loading progress:', event.data.progress);
          break;
        case 'error':
          console.error('Worker error:', event.data.error);
          break;
      }
    });
  }

  /**
   * Process user query with hybrid approach
   */
  async processQuery(userMessage, style = 'developer') {
    if (!this.isInitialized) {
      throw new Error('Chat system not initialized');
    }

    const startTime = Date.now();
    this.currentStyle = style;

    try {
      // First, try template matching (fast and reliable)
      const templateMatch = this.findMatchingTemplate(userMessage);
      
      if (templateMatch) {
        const response = templateMatch.responses[style] || templateMatch.responses.developer;
        
        return {
          answer: response,
          confidence: 0.95,
          matchedTopics: [{ id: templateMatch.id, score: templateMatch.score }],
          processingTime: Date.now() - startTime,
          source: 'template'
        };
      }

      // If no template match and text generation is available, try constrained generation
      if (this.useTextGeneration && this.worker) {
        try {
          const generationResult = await this.tryTextGeneration(userMessage, style);
          if (generationResult) {
            return {
              ...generationResult,
              processingTime: Date.now() - startTime,
              source: 'generated'
            };
          }
        } catch (error) {
          console.warn('Text generation failed, falling back to CV data:', error);
        }
      }

      // Fallback to CV data service
      const relevantTopics = this.cvDataService.findRelevantTopics(userMessage, 1);
      const confidence = this.cvDataService.calculateConfidence(relevantTopics, userMessage);

      if (confidence > 0.5 && relevantTopics.length > 0) {
        const topic = relevantTopics[0].topic;
        const response = topic.content;
        
        return {
          answer: response,
          confidence: confidence,
          matchedTopics: relevantTopics.map(t => ({ id: t.topicId, score: t.score })),
          processingTime: Date.now() - startTime,
          source: 'cv_data'
        };
      }

      // Final fallback
      const fallbackResponse = this.cvDataService.getFallbackResponse(style, confidence);
      
      return {
        answer: fallbackResponse,
        confidence: 0.2,
        matchedTopics: [],
        processingTime: Date.now() - startTime,
        source: 'fallback'
      };

    } catch (error) {
      console.error('Query processing failed:', error);
      
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
   * Try text generation with very constrained prompting
   */
  async tryTextGeneration(userMessage, style) {
    if (!this.worker) return null;

    // Find relevant CV data for context
    const relevantTopics = this.cvDataService.findRelevantTopics(userMessage, 1);
    
    if (relevantTopics.length === 0) {
      return null; // No context, don't try generation
    }

    const topic = relevantTopics[0].topic;
    
    // Create very constrained prompt
    const prompt = this.createConstrainedPrompt(userMessage, topic, style);
    
    try {
      const response = await this.generateResponse(prompt, userMessage);
      
      if (response && response.answer) {
        return {
          answer: response.answer,
          confidence: 0.8,
          matchedTopics: [{ id: relevantTopics[0].topicId, score: relevantTopics[0].score }],
          metrics: response.metrics
        };
      }
    } catch (error) {
      console.warn('Text generation failed:', error);
    }

    return null;
  }

  /**
   * Create very constrained prompt to minimize hallucination
   */
  createConstrainedPrompt(question, topic, style) {
    const styleInstructions = {
      hr: "professional manner",
      developer: "technical manner", 
      friend: "casual manner"
    };

    const instruction = styleInstructions[style] || "technical manner";

    // Very simple, constrained prompt
    const prompt = `Context: ${topic.content.substring(0, 200)}

Question: ${question}

Answer in a ${instruction} as Serhii in first person. Use only the context above. Keep it under 50 words.

Answer: I`;

    return prompt;
  }

  /**
   * Generate response using ML worker
   */
  async generateResponse(prompt, originalQuery) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response generation timeout'));
      }, 10000); // Shorter timeout

      const messageHandler = (event) => {
        if (event.data.type === 'response' && event.data.query === originalQuery) {
          clearTimeout(timeout);
          this.worker.removeEventListener('message', messageHandler);
          
          resolve({
            answer: "I " + event.data.answer, // Add back the "I" prefix
            metrics: event.data.processingMetrics || {}
          });
        } else if (event.data.type === 'error' && event.data.query === originalQuery) {
          clearTimeout(timeout);
          this.worker.removeEventListener('message', messageHandler);
          reject(new Error(event.data.error));
        }
      };

      this.worker.addEventListener('message', messageHandler);

      // Send generation request with strict limits
      this.worker.postMessage({
        type: 'generate',
        prompt: prompt,
        query: originalQuery,
        maxTokens: 50, // Very short
        temperature: 0.3 // Low temperature
      });
    });
  }

  /**
   * Get greeting with generation status
   */
  getGreeting() {
    const baseGreeting = super.getGreeting();
    const mode = this.useTextGeneration ? "hybrid (templates + AI)" : "template-only";
    return `${baseGreeting}\n\n<small>Running in ${mode} mode.</small>`;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    super.cleanup();
  }
}

export default HybridChatIntegration;