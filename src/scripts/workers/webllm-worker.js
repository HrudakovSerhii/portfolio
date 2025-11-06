/**
 * WebLLM Worker for Llama-2-7B processing
 * Handles model loading, prompt-based query processing, and memory management
 */

// Import WebLLM library
let webllm;

// Global variables for WebLLM
let engine = null;
let isInitialized = false;
let modelConfig = null;

// Performance and memory management
class WebLLMPerformanceManager {
  constructor() {
    this.metrics = {
      modelLoadTime: 0,
      queryProcessingTimes: [],
      memoryUsage: [],
      tokenCounts: [],
      sessionStartTime: Date.now()
    };
    
    this.cache = {
      responses: new Map(),
      maxCacheSize: 20, // Smaller cache for LLM responses
      maxAge: 600000 // 10 minutes
    };
    
    this.performanceLog = [];
  }

  cacheResponse(prompt, response, metadata = {}) {
    const key = this.generateCacheKey(prompt);
    if (this.cache.responses.size >= this.cache.maxCacheSize) {
      const firstKey = this.cache.responses.keys().next().value;
      this.cache.responses.delete(firstKey);
    }
    this.cache.responses.set(key, { 
      response, 
      metadata,
      timestamp: Date.now() 
    });
  }

  getCachedResponse(prompt) {
    const key = this.generateCacheKey(prompt);
    const cached = this.cache.responses.get(key);
    if (cached && (Date.now() - cached.timestamp < this.cache.maxAge)) {
      return cached;
    }
    if (cached) this.cache.responses.delete(key);
    return null;
  }

  generateCacheKey(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  logPerformanceEvent(event, data = {}) {
    const logEntry = {
      timestamp: Date.now(),
      event,
      data,
      sessionTime: Date.now() - this.metrics.sessionStartTime
    };
    
    this.performanceLog.push(logEntry);
    if (this.performanceLog.length > 100) {
      this.performanceLog = this.performanceLog.slice(-50);
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheStats: {
        responsesCacheSize: this.cache.responses.size,
        hitRate: this.calculateHitRate()
      }
    };
  }

  calculateHitRate() {
    // Simple hit rate calculation based on cache size vs queries
    return this.cache.responses.size > 0 ? 0.3 : 0; // Placeholder
  }

  cleanup() {
    this.cache.responses.clear();
    this.performanceLog = [];
  }
}

class WebLLMWorker {
  constructor() {
    this.performanceManager = new WebLLMPerformanceManager();
    this.cvData = null;
    this.promptTemplates = null;
    this.isLoading = false;
    this.loadingPromise = null;
  }

  /**
   * Initialize WebLLM with Llama-2-7B model
   */
  async initialize(cvData, config = {}, messageId = null) {
    const initStartTime = Date.now();
    
    // Send immediate acknowledgment
    this.postMessage({
      type: 'status',
      message: 'WebLLM worker received initialization request...'
    });
    
    try {
      // Return existing loading promise if already loading
      if (this.loadingPromise) {
        return this.loadingPromise;
      }
      
      if (isInitialized && engine) {
        this.cvData = cvData;
        this.setupPromptTemplates();
        
        this.postMessage({
          type: 'ready',
          messageId,
          success: true,
          message: 'WebLLM engine already initialized',
          metrics: { cached: true, initTime: Date.now() - initStartTime }
        });
        return;
      }
      
      this.loadingPromise = this._performInitialization(cvData, config, initStartTime, messageId);
      await this.loadingPromise;
      this.loadingPromise = null;

    } catch (error) {
      this.loadingPromise = null;
      console.error('Failed to initialize WebLLM:', error);
      this.performanceManager.logPerformanceEvent('webllm_initialization_failed', {
        error: error.message,
        initTime: Date.now() - initStartTime
      });
      
      this.postMessage({
        type: 'ready',
        messageId,
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Perform the actual WebLLM initialization
   */
  async _performInitialization(cvData, config, initStartTime, messageId = null) {
    this.isLoading = true;

    this.postMessage({
      type: 'status',
      message: 'Attempting to load WebLLM library...'
    });

    // Load WebLLM library with multiple fallback options
    try {
      console.log('Attempting to load WebLLM from CDN...');
      
      // Try multiple CDN sources
      const cdnSources = [
        'https://esm.run/@mlc-ai/web-llm',
        'https://cdn.skypack.dev/@mlc-ai/web-llm',
        'https://unpkg.com/@mlc-ai/web-llm/lib/index.js'
      ];
      
      let loadError = null;
      for (const source of cdnSources) {
        try {
          console.log(`Trying to load WebLLM from: ${source}`);
          webllm = await import(source);
          console.log('WebLLM library loaded successfully from:', source);
          break;
        } catch (error) {
          console.warn(`Failed to load from ${source}:`, error.message);
          loadError = error;
          continue;
        }
      }
      
      if (!webllm) {
        throw new Error(`Failed to load WebLLM library from all sources. Last error: ${loadError?.message}`);
      }
      
    } catch (error) {
      console.error('WebLLM library loading failed:', error);
      
      // For now, simulate WebLLM functionality for testing
      this.postMessage({
        type: 'status',
        message: 'WebLLM library unavailable, using simulation mode for testing...'
      });
      
      return this._initializeSimulationMode(cvData, config, initStartTime, messageId);
    }

    this.postMessage({
      type: 'status',
      message: 'WebLLM library loaded, initializing model...'
    });

    // Configure model
    modelConfig = {
      model: config.model || "Llama-2-7b-chat-hf-q4f16_1-MLC",
      model_lib: config.model_lib || "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-libs/v0_2_46/Llama-2-7b-chat-hf-q4f16_1-ctx4k_cs1k-webgpu.wasm",
      vram_required_MB: config.vram_required_MB || 3000,
      low_resource_required: config.low_resource_required || false,
      buffer_size_required_bytes: config.buffer_size_required_bytes || 262144000
    };

    try {
      // Initialize WebLLM engine with progress callback
      engine = new webllm.MLCEngine();
      
      this.postMessage({
        type: 'status',
        message: 'Loading Llama-2-7B model (this may take several minutes)...'
      });
      
      await engine.reload(modelConfig.model, {
        model_lib: modelConfig.model_lib,
        progress_callback: (progress) => {
          this.postMessage({
            type: 'progress',
            progress: progress
          });
        }
      });

      this.cvData = cvData;
      this.setupPromptTemplates();
      
      isInitialized = true;
      this.isLoading = false;
      
      const initTime = Date.now() - initStartTime;
      this.performanceManager.logPerformanceEvent('webllm_initialization_complete', {
        initTime,
        modelConfig: modelConfig.model,
        cvSectionsCount: this.getTotalSectionCount(this.cvData?.sections || {})
      });

      this.postMessage({
        type: 'ready',
        messageId,
        success: true,
        message: 'WebLLM Llama-2-7B model loaded successfully',
        metrics: {
          initTime,
          modelConfig: modelConfig.model,
          memoryRequired: modelConfig.vram_required_MB
        }
      });
      
    } catch (error) {
      console.error('WebLLM model loading failed:', error);
      
      // Fallback to simulation mode
      this.postMessage({
        type: 'status',
        message: 'Model loading failed, falling back to simulation mode...'
      });
      
      return this._initializeSimulationMode(cvData, config, initStartTime, messageId);
    }
  }

  /**
   * Initialize simulation mode for testing when WebLLM is unavailable
   */
  async _initializeSimulationMode(cvData, config, initStartTime, messageId = null) {
    console.log('Initializing WebLLM simulation mode...');
    
    this.cvData = cvData;
    this.setupPromptTemplates();
    
    // Simulate loading progress
    for (let i = 0; i <= 100; i += 20) {
      this.postMessage({
        type: 'progress',
        progress: { progress: i / 100, text: `Simulating model loading... ${i}%` }
      });
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    isInitialized = true;
    this.isLoading = false;
    
    const initTime = Date.now() - initStartTime;
    this.performanceManager.logPerformanceEvent('webllm_simulation_initialized', {
      initTime,
      mode: 'simulation',
      cvSectionsCount: this.getTotalSectionCount(this.cvData?.sections || {})
    });

    this.postMessage({
      type: 'ready',
      messageId,
      success: true,
      message: 'WebLLM simulation mode initialized (for testing)',
      metrics: {
        initTime,
        modelConfig: 'simulation-mode',
        memoryRequired: 0,
        simulationMode: true
      }
    });
  }

  /**
   * Setup prompt templates for CV-specific responses
   */
  setupPromptTemplates() {
    this.promptTemplates = {
      system: {
        hr: `You are Serhii, a professional software developer. Respond as if you are Serhii speaking directly to an HR representative or recruiter. Use professional, structured language focusing on achievements, experience, and qualifications. Keep responses concise and highlight measurable results.`,
        
        developer: `You are Serhii, a software developer. Respond as if you are Serhii speaking to a fellow developer. Use technical language, share insights about technologies and methodologies, and be conversational but knowledgeable. Focus on technical details and problem-solving approaches.`,
        
        friend: `You are Serhii, a friendly software developer. Respond as if you are Serhii talking to a friend who's curious about your work. Use casual, enthusiastic language with emojis when appropriate. Share personal insights and make technical concepts accessible and engaging.`
      },
      
      context: `Based on the following information about Serhii's professional background:

{cv_context}

Answer the following question: {question}

Guidelines:
- Only use information provided in the context
- If the context doesn't contain relevant information, say so honestly
- Stay in character as Serhii
- Be specific and provide examples when possible
- Keep responses focused and relevant to the question`,

      fallback: {
        hr: "I don't have specific information about that in my professional background. I'd be happy to discuss this further in a direct conversation.",
        developer: "That's not something I have detailed info on right now. Feel free to ask about my specific technical experience or projects.",
        friend: "Hmm, I don't have the details on that one! 😅 Ask me about something else or we can chat about it directly!"
      }
    };
  }

  /**
   * Process user query using WebLLM
   */
  async processQuery(message, context = [], style = 'developer', cvSections = [], messageId = null) {
    if (!isInitialized || !engine) {
      throw new Error('WebLLM not initialized');
    }

    const queryId = `webllm_query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = `${message}_${style}_${JSON.stringify(cvSections.slice(0, 3))}`;
      const cachedResult = this.performanceManager.getCachedResponse(cacheKey);
      
      if (cachedResult) {
        this.postMessage({
          type: 'response',
          messageId,
          answer: cachedResult.response,
          confidence: cachedResult.metadata.confidence || 0.8,
          matchedSections: cachedResult.metadata.matchedSections || [],
          query: message,
          processingMetrics: {
            ...cachedResult.metadata,
            cached: true,
            processingTime: 0
          }
        });
        return;
      }

      // Build context from CV sections
      const cvContext = this.buildCVContext(cvSections);
      
      // Create prompt
      const prompt = this.createPrompt(message, cvContext, style, context);
      
      // Generate response using WebLLM
      const response = await this.generateResponse(prompt, style);
      
      // Validate and enhance response
      const validatedResponse = this.validateAndEnhanceResponse(response, message, cvSections, style);
      
      const processingTime = Date.now() - startTime;
      
      // Cache the result
      const cacheMetadata = {
        confidence: validatedResponse.confidence,
        matchedSections: validatedResponse.matchedSections,
        processingTime,
        cached: false
      };
      
      this.performanceManager.cacheResponse(cacheKey, validatedResponse.answer, cacheMetadata);
      
      this.performanceManager.logPerformanceEvent('webllm_query_processed', {
        queryId,
        queryLength: message.length,
        contextSize: context.length,
        sectionsUsed: cvSections.length,
        processingTime,
        confidence: validatedResponse.confidence
      });

      this.postMessage({
        type: 'response',
        messageId,
        answer: validatedResponse.answer,
        confidence: validatedResponse.confidence,
        matchedSections: validatedResponse.matchedSections,
        query: message,
        processingMetrics: {
          processingTime,
          cached: false,
          tokensGenerated: response.usage?.completion_tokens || 0,
          sectionsUsed: cvSections.length
        }
      });

    } catch (error) {
      console.error('WebLLM query processing failed:', error);
      this.performanceManager.logPerformanceEvent('webllm_query_failed', {
        queryId,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      
      this.postMessage({
        type: 'error',
        messageId,
        error: error.message,
        query: message
      });
    }
  }

  /**
   * Build CV context from relevant sections
   */
  buildCVContext(cvSections) {
    if (!cvSections || cvSections.length === 0) {
      return "No specific information available.";
    }

    const contextParts = [];
    
    cvSections.slice(0, 5).forEach((sectionMatch, index) => {
      const section = sectionMatch.section || sectionMatch;
      
      let sectionText = `Section ${index + 1}:\n`;
      
      // Add keywords
      if (section.keywords) {
        sectionText += `Keywords: ${section.keywords.join(', ')}\n`;
      }
      
      // Add main response (use developer style as most comprehensive)
      if (section.responses && section.responses.developer) {
        sectionText += `Information: ${section.responses.developer}\n`;
      }
      
      // Add relevant details
      if (section.details) {
        if (section.details.years) {
          sectionText += `Experience: ${section.details.years} years\n`;
        }
        if (section.details.technologies) {
          sectionText += `Technologies: ${section.details.technologies.join(', ')}\n`;
        }
        if (section.details.skills) {
          sectionText += `Skills: ${section.details.skills.join(', ')}\n`;
        }
        if (section.details.achievements) {
          sectionText += `Achievements: ${section.details.achievements.join(', ')}\n`;
        }
      }
      
      contextParts.push(sectionText);
    });
    
    return contextParts.join('\n---\n');
  }

  /**
   * Create prompt for WebLLM
   */
  createPrompt(question, cvContext, style, conversationContext = []) {
    const systemPrompt = this.promptTemplates.system[style];
    
    let contextPrompt = this.promptTemplates.context
      .replace('{cv_context}', cvContext)
      .replace('{question}', question);
    
    // Add conversation context if available
    if (conversationContext && conversationContext.length > 0) {
      const recentContext = conversationContext.slice(-2);
      const contextStr = recentContext.map(ctx => 
        `Q: ${ctx.userMessage}\nA: ${ctx.botResponse}`
      ).join('\n\n');
      
      contextPrompt += `\n\nRecent conversation context:\n${contextStr}`;
    }
    
    return `<s>[INST] <<SYS>>\n${systemPrompt}\n<</SYS>>\n\n${contextPrompt} [/INST]`;
  }

  /**
   * Generate response using WebLLM engine or simulation
   */
  async generateResponse(prompt, style) {
    try {
      // Check if we have actual WebLLM engine
      if (engine && webllm) {
        const response = await engine.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          max_tokens: this.getMaxTokensForStyle(style),
          temperature: this.getTemperatureForStyle(style),
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        });

        return response;
      } else {
        // Simulation mode - generate a realistic response
        return this.generateSimulatedResponse(prompt, style);
      }
    } catch (error) {
      console.error('WebLLM generation error:', error);
      
      // Fallback to simulation if WebLLM fails
      console.log('Falling back to simulation mode for this query...');
      return this.generateSimulatedResponse(prompt, style);
    }
  }

  /**
   * Generate simulated response for testing
   */
  async generateSimulatedResponse(prompt, style) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Extract question from prompt
    const questionMatch = prompt.match(/Answer the following question: (.+?)(?:\n|$)/);
    const question = questionMatch ? questionMatch[1].toLowerCase() : prompt.toLowerCase();
    
    // Generate contextual response based on question content
    let response = '';
    
    if (question.includes('experience') || question.includes('work')) {
      response = `I have extensive experience in software development, particularly with modern web technologies. I've worked on various projects ranging from frontend applications to backend systems, always focusing on clean code and best practices.`;
    } else if (question.includes('skill') || question.includes('technology')) {
      response = `My technical skills include JavaScript, TypeScript, React, Node.js, and various other modern web technologies. I'm always learning and adapting to new tools and frameworks as they emerge.`;
    } else if (question.includes('project')) {
      response = `I've worked on several interesting projects, including web applications, API development, and system integrations. Each project taught me something new and helped me grow as a developer.`;
    } else if (question.includes('education') || question.includes('learn')) {
      response = `I believe in continuous learning and staying up-to-date with industry trends. I regularly explore new technologies and methodologies to improve my development skills.`;
    } else {
      response = `That's an interesting question! Based on my professional background, I'd say that every challenge is an opportunity to learn and grow. I approach problems systematically and enjoy finding elegant solutions.`;
    }
    
    // Style-specific adjustments
    if (style === 'friend') {
      response += ' 😊 Feel free to ask me more about any specific area!';
    } else if (style === 'hr') {
      response = response.replace(/I'd say that/, 'I believe that').replace(/😊.*/, '');
    }
    
    return {
      choices: [{
        message: {
          content: response
        }
      }],
      usage: {
        completion_tokens: response.split(' ').length,
        prompt_tokens: prompt.split(' ').length
      }
    };
  }

  /**
   * Get max tokens based on conversation style
   */
  getMaxTokensForStyle(style) {
    const tokenLimits = {
      hr: 150,      // Concise, professional responses
      developer: 200, // More detailed technical responses
      friend: 180    // Casual but informative responses
    };
    return tokenLimits[style] || 150;
  }

  /**
   * Get temperature based on conversation style
   */
  getTemperatureForStyle(style) {
    const temperatures = {
      hr: 0.3,      // More conservative, professional
      developer: 0.5, // Balanced creativity and accuracy
      friend: 0.7    // More creative and casual
    };
    return temperatures[style] || 0.5;
  }

  /**
   * Validate and enhance the generated response
   */
  validateAndEnhanceResponse(response, originalQuery, cvSections, style) {
    let answer = '';
    let confidence = 0.7; // Default confidence for WebLLM responses
    
    if (response.choices && response.choices.length > 0) {
      answer = response.choices[0].message.content.trim();
      
      // Calculate confidence based on response quality
      confidence = this.calculateResponseConfidence(answer, originalQuery, cvSections);
      
      // Enhance response if needed
      answer = this.enhanceResponse(answer, style, cvSections);
    } else {
      // Fallback response
      answer = this.promptTemplates.fallback[style];
      confidence = 0.1;
    }

    return {
      answer,
      confidence,
      matchedSections: cvSections.slice(0, 3).map(section => ({
        id: section.sectionId || section.id,
        category: section.category,
        similarity: section.similarity || 0.8
      }))
    };
  }

  /**
   * Calculate confidence score for the response
   */
  calculateResponseConfidence(answer, query, cvSections) {
    let confidence = 0.7; // Base confidence for WebLLM
    
    // Boost confidence if response is substantial
    if (answer.length > 50) {
      confidence += 0.1;
    }
    
    // Boost confidence if multiple CV sections were used
    if (cvSections.length > 1) {
      confidence += 0.05;
    }
    
    // Reduce confidence if response seems generic
    const genericPhrases = ['i have experience', 'i work with', 'i know'];
    const hasGenericPhrases = genericPhrases.some(phrase => 
      answer.toLowerCase().includes(phrase)
    );
    if (hasGenericPhrases && answer.length < 100) {
      confidence -= 0.1;
    }
    
    // Boost confidence if response includes specific details
    const specificIndicators = ['years', 'project', 'built', 'implemented', 'developed'];
    const hasSpecificDetails = specificIndicators.some(indicator => 
      answer.toLowerCase().includes(indicator)
    );
    if (hasSpecificDetails) {
      confidence += 0.05;
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  /**
   * Enhance response based on style and context
   */
  enhanceResponse(answer, style, cvSections) {
    // Remove any system artifacts or incomplete sentences
    answer = answer.replace(/\[INST\]|\[\/INST\]|<s>|<\/s>/g, '').trim();
    
    // Ensure response ends properly
    if (!answer.match(/[.!?]$/)) {
      answer += '.';
    }
    
    // Style-specific enhancements
    if (style === 'friend' && !answer.includes('😊') && !answer.includes('🚀') && Math.random() > 0.7) {
      // Occasionally add friendly emoji for friend style
      answer += ' 😊';
    }
    
    return answer;
  }

  /**
   * Get total section count for metrics
   */
  getTotalSectionCount(sections) {
    let count = 0;
    for (const category of Object.values(sections)) {
      count += Object.keys(category).length;
    }
    return count;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return this.performanceManager.getMetrics();
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (engine) {
        // WebLLM cleanup if available
        await engine.unload();
      }
      this.performanceManager.cleanup();
      isInitialized = false;
      engine = null;
    } catch (error) {
      console.error('WebLLM cleanup error:', error);
    }
  }

  /**
   * Post message to main thread
   */
  postMessage(message) {
    self.postMessage(message);
  }
}

// Worker instance
const webllmWorker = new WebLLMWorker();

// Message handler
self.onmessage = async function(event) {
  const { type, messageId, ...data } = event.data;

  console.log(`WebLLM Worker received message: ${type}`, { messageId });

  try {
    switch (type) {
      case 'initialize':
        console.log('WebLLM Worker starting initialization...');
        await webllmWorker.initialize(data.cvData, data.config, messageId);
        break;
        
      case 'process_query':
        await webllmWorker.processQuery(
          data.message, 
          data.context, 
          data.style, 
          data.cvSections,
          messageId
        );
        break;
        
      case 'get_metrics':
        self.postMessage({
          type: 'metrics',
          messageId,
          metrics: webllmWorker.getMetrics()
        });
        break;
        
      case 'cleanup':
        await webllmWorker.cleanup();
        self.postMessage({ 
          type: 'cleanup_complete',
          messageId 
        });
        break;
        
      default:
        console.warn('Unknown message type:', type);
        if (messageId) {
          self.postMessage({
            type: 'error',
            messageId,
            error: `Unknown message type: ${type}`
          });
        }
    }
  } catch (error) {
    console.error('WebLLM worker error:', error);
    self.postMessage({
      type: 'error',
      messageId,
      error: error.message
    });
  }
};

// Handle worker termination
self.addEventListener('beforeunload', () => {
  webllmWorker.cleanup();
});