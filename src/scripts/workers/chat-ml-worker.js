/**
 * ML Worker for SmolLM2-135M-Instruct processing
 * Handles model loading, text generation, and CV-based question answering
 * Includes performance optimizations, caching, and resource management
 */

// Inline performance management for worker context
class WorkerPerformanceManager {
  constructor() {
    this.metrics = {
      modelLoadTime: 0,
      queryProcessingTimes: [],
      memoryUsage: [],
      cacheHits: 0,
      cacheMisses: 0,
      sessionStartTime: Date.now(),
    };

    this.cache = {
      embeddings: new Map(),
      queryResults: new Map(),
      maxCacheSize: 50, // Smaller cache for worker
      maxEmbeddingCacheSize: 200,
    };

    this.performanceLog = [];
  }

  cacheEmbedding(text, embedding) {
    const key = this.generateCacheKey(text);
    if (this.cache.embeddings.size >= this.cache.maxEmbeddingCacheSize) {
      const firstKey = this.cache.embeddings.keys().next().value;
      this.cache.embeddings.delete(firstKey);
    }
    this.cache.embeddings.set(key, { embedding, timestamp: Date.now() });
  }

  getCachedEmbedding(text) {
    const key = this.generateCacheKey(text);
    const cached = this.cache.embeddings.get(key);
    if (cached) {
      this.metrics.cacheHits++;
      return cached.embedding;
    }
    this.metrics.cacheMisses++;
    return null;
  }

  cacheQueryResult(query, result) {
    const key = this.generateCacheKey(query);
    if (this.cache.queryResults.size >= this.cache.maxCacheSize) {
      const firstKey = this.cache.queryResults.keys().next().value;
      this.cache.queryResults.delete(firstKey);
    }
    this.cache.queryResults.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  getCachedQueryResult(query) {
    const key = this.generateCacheKey(query);
    const cached = this.cache.queryResults.get(key);
    if (cached && Date.now() - cached.timestamp < 300000) {
      // 5 minutes
      this.metrics.cacheHits++;
      return { ...cached.result };
    }
    if (cached) this.cache.queryResults.delete(key);
    this.metrics.cacheMisses++;
    return null;
  }

  generateCacheKey(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  startQueryTimer(queryId) {
    const timerId = `query_${queryId}_${Date.now()}`;
    performance.mark(`${timerId}_start`);
    return timerId;
  }

  stopQueryTimer(timerId, metadata = {}) {
    performance.mark(`${timerId}_end`);
    performance.measure(timerId, `${timerId}_start`, `${timerId}_end`);
    const measure = performance.getEntriesByName(timerId)[0];
    const duration = measure ? measure.duration : 0;

    this.metrics.queryProcessingTimes.push({
      duration,
      timestamp: Date.now(),
      metadata,
    });

    if (this.metrics.queryProcessingTimes.length > 50) {
      this.metrics.queryProcessingTimes =
        this.metrics.queryProcessingTimes.slice(-50);
    }

    performance.clearMarks(`${timerId}_start`);
    performance.clearMarks(`${timerId}_end`);
    performance.clearMeasures(timerId);

    return duration;
  }

  logPerformanceEvent(event, data = {}) {
    const logEntry = {
      timestamp: Date.now(),
      event,
      data,
      sessionTime: Date.now() - this.metrics.sessionStartTime,
    };

    this.performanceLog.push(logEntry);
    if (this.performanceLog.length > 200) {
      this.performanceLog = this.performanceLog.slice(-100);
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheStats: {
        embeddingsCacheSize: this.cache.embeddings.size,
        queryResultsCacheSize: this.cache.queryResults.size,
        hitRate:
          this.metrics.cacheHits /
            (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      },
    };
  }

  cleanup() {
    this.cache.embeddings.clear();
    this.cache.queryResults.clear();
    this.performanceLog = [];
  }
}

// Global variables for transformers
let pipeline, env;

// Check WebGPU availability
async function checkWebGPUAvailability() {
  try {
    if (!navigator.gpu) {
      console.warn('WebGPU not available in this browser');
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.warn('WebGPU adapter not available');
      return false;
    }

    const device = await adapter.requestDevice();
    if (!device) {
      console.warn('WebGPU device not available');
      return false;
    }

    console.log('WebGPU is available and working');
    return true;
  } catch (error) {
    console.warn('WebGPU check failed:', error);
    return false;
  }
}

// Load transformers library dynamically
async function loadTransformers() {
  try {
    const transformers = await import(
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers"
    );

    pipeline = transformers.pipeline;
    env = transformers.env;

    // Configure Transformers.js environment for web worker
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    
    // Set ONNX runtime settings to reduce warnings
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.simd = true;

    return true;
  } catch (error) {
    console.error("Failed to load transformers:", error);
    return false;
  }
}

class MLWorker {
  constructor(
    modelConfig = {
      name: "HuggingFaceTB/SmolLM2-135M-Instruct",
      type: "text-generation",
      dtype: "q4",
      device: "webgpu", // Will fallback to 'wasm' if WebGPU unavailable
    }
  ) {
    this.model = null;
    this.tokenizer = null;
    this.isInitialized = false;
    this.cvData = null;
    this.cvEmbeddings = new Map();

    this.modelConfig = modelConfig;

    // Performance optimization components
    this.performanceManager = new WorkerPerformanceManager();

    // Query processing optimization
    this.queryQueue = [];
    this.isProcessingQueue = false;
    this.maxConcurrentQueries = 1; // Process one query at a time for consistency

    // Model loading optimization
    this.modelCache = null;
    this.loadingPromise = null;
  }

  /**
   * Initialize the DistilBERT model and tokenizer with performance optimizations
   */
  async initialize(cvData) {
    const initStartTime = Date.now();

    try {
      // Return existing loading promise if already loading
      if (this.loadingPromise) {
        return this.loadingPromise;
      }

      // Check if model is already cached
      if (this.modelCache) {
        this.model = this.modelCache;
        this.cvData = cvData;
        await this.precomputeEmbeddingsOptimized();
        this.isInitialized = true;

        this.postMessage({
          type: "ready",
          success: true,
          message: `${this.modelConfig.name} model loaded from cache`,
          metrics: { cached: true, initTime: Date.now() - initStartTime },
        });
        return;
      }

      this.loadingPromise = this._performInitialization(cvData, initStartTime);
      await this.loadingPromise;
      this.loadingPromise = null;
    } catch (error) {
      this.loadingPromise = null;
      console.error("Failed to initialize ML model:", error);
      this.performanceManager.logPerformanceEvent(
        "worker_initialization_failed",
        {
          error: error.message,
          initTime: Date.now() - initStartTime,
        }
      );

      this.postMessage({
        type: "ready",
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Perform the actual initialization
   */
  async _performInitialization(cvData, initStartTime) {
    // First load the transformers library
    const transformersLoaded = await loadTransformers();

    if (!transformersLoaded) {
      throw new Error("Failed to load transformers library");
    }

    // Check WebGPU availability and adjust device if needed
    let deviceToUse = this.modelConfig.device;
    if (this.modelConfig.device === 'webgpu') {
      const webgpuAvailable = await checkWebGPUAvailability();
      if (!webgpuAvailable) {
        console.warn('WebGPU not available, falling back to WASM');
        deviceToUse = 'wasm';
        this.postMessage({
          type: "status",
          message: "WebGPU not available, using WASM backend",
        });
      }
    }

    this.postMessage({
      type: "status",
      message: `Loading ${this.modelConfig.name} model with ${deviceToUse} backend`,
    });

    // Load the text generation pipeline with SmolLM2-135M-Instruct
    this.model = await pipeline(
      this.modelConfig.type,
      this.modelConfig.name,
      {
        dtype: this.modelConfig.dtype,
        device: deviceToUse,
      },
      {
        quantized: true, // Use quantized model for better performance
        progress_callback: (progress) => {
          this.postMessage({
            type: "progress",
            progress: progress,
          });
        },
      }
    );

    // Cache the model for future use
    this.modelCache = this.model;

    this.cvData = cvData;

    // Pre-compute embeddings for CV sections with caching
    await this.precomputeEmbeddingsOptimized();

    this.isInitialized = true;

    const initTime = Date.now() - initStartTime;
    this.performanceManager.logPerformanceEvent(
      "worker_initialization_complete",
      {
        initTime,
        cvSectionsCount: this.getTotalSectionCount(this.cvData?.sections || {}),
        embeddingsCacheSize: this.cvEmbeddings.size,
      }
    );

    this.postMessage({
      type: "ready",
      success: true,
      message: `${this.modelConfig.name} model loaded successfully`,
      metrics: {
        initTime,
        cacheEnabled: true,
        cvSectionsLoaded: this.getTotalSectionCount(
          this.cvData?.sections || {}
        ),
      },
    });
  }

  /**
   * Prepare CV data for text generation context
   */
  async precomputeEmbeddingsOptimized() {
    if (!this.cvData || !this.cvData.sections) {
      throw new Error("CV data not available");
    }

    this.postMessage({
      type: "status",
      message: "Preparing CV data for text generation...",
    });

    const sections = this.cvData.sections;
    let processedCount = 0;
    const totalSections = this.getTotalSectionCount(sections);

    // Store CV sections for text generation context instead of embeddings
    for (const [categoryKey, category] of Object.entries(sections)) {
      for (const [sectionKey, section] of Object.entries(category)) {
        const sectionId = section.id || `${categoryKey}_${sectionKey}`;
        this.cvEmbeddings.set(sectionId, {
          section: section,
          category: categoryKey,
          key: sectionKey,
          searchText: this.createSearchText(section), // For keyword matching
        });

        processedCount++;
        this.postMessage({
          type: "embedding_progress",
          processed: processedCount,
          total: totalSections,
        });
      }
    }

    this.performanceManager.logPerformanceEvent("cv_data_prepared", {
      totalSections,
      sectionsLoaded: this.cvEmbeddings.size,
    });
  }

  /**
   * Process a batch of embeddings
   */
  async processBatchEmbeddings(batch, processedCount, totalSections) {
    for (const { categoryKey, sectionKey, section } of batch) {
      try {
        // Create text for embedding from keywords and responses
        const textForEmbedding = this.createEmbeddingText(section);

        // Check cache first
        let embedding =
          this.performanceManager.getCachedEmbedding(textForEmbedding);

        if (!embedding) {
          embedding = await this.generateEmbedding(textForEmbedding);
          // Cache the embedding
          this.performanceManager.cacheEmbedding(textForEmbedding, embedding);
        }

        // Store embedding with section reference
        const sectionId = section.id || `${categoryKey}_${sectionKey}`;
        this.cvEmbeddings.set(sectionId, {
          embedding: embedding,
          section: section,
          category: categoryKey,
          key: sectionKey,
        });

        processedCount++;
        this.postMessage({
          type: "embedding_progress",
          processed: processedCount,
          total: totalSections,
        });
      } catch (error) {
        console.error(
          `Failed to compute embedding for ${categoryKey}.${sectionKey}:`,
          error
        );
        this.performanceManager.logPerformanceEvent(
          "embedding_computation_failed",
          {
            categoryKey,
            sectionKey,
            error: error.message,
          }
        );
      }
    }
  }

  /**
   * Count total sections for progress tracking
   */
  getTotalSectionCount(sections) {
    let count = 0;
    for (const category of Object.values(sections)) {
      count += Object.keys(category).length;
    }
    return count;
  }

  /**
   * Create search text from section data for keyword matching
   */
  createSearchText(section) {
    const parts = [];

    // Add keywords
    if (section.keywords && Array.isArray(section.keywords)) {
      parts.push(section.keywords.join(" "));
    }

    // Add response text (use developer style as it's most comprehensive)
    if (section.responses && section.responses.developer) {
      parts.push(section.responses.developer);
    }

    // Add details if available
    if (section.details) {
      if (section.details.skills && Array.isArray(section.details.skills)) {
        parts.push(section.details.skills.join(" "));
      }
      if (
        section.details.technologies &&
        Array.isArray(section.details.technologies)
      ) {
        parts.push(section.details.technologies.join(" "));
      }
    }

    return parts.join(" ").toLowerCase();
  }

  /**
   * Generate text response using SmolLM2
   */
  async generateTextResponse(prompt) {
    if (!this.model) {
      throw new Error("Model not initialized");
    }

    try {
      // Generate text using the text generation model
      const output = await this.model(prompt, {
        max_new_tokens: 150,
        temperature: 0.7,
        do_sample: true,
        top_p: 0.9,
        repetition_penalty: 1.1,
        return_full_text: false,
      });

      // Extract generated text
      let generatedText = "";
      if (Array.isArray(output) && output.length > 0) {
        generatedText = output[0].generated_text || "";
      } else if (output.generated_text) {
        generatedText = output.generated_text;
      }

      return generatedText.trim();
    } catch (error) {
      console.error("Failed to generate text:", error);
      throw error;
    }
  }

  /**
   * Process user query with performance optimizations and caching
   */
  async processQuery(message, context = [], style = "developer") {
    if (!this.isInitialized) {
      throw new Error("Model not initialized");
    }

    // Add to queue for processing
    return new Promise((resolve, reject) => {
      this.queryQueue.push({
        message,
        context,
        style,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.processQueryQueue();
    });
  }

  /**
   * Process query queue to manage concurrent processing
   */
  async processQueryQueue() {
    if (this.isProcessingQueue || this.queryQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.queryQueue.length > 0) {
      const queryItem = this.queryQueue.shift();

      try {
        await this.processQueryOptimized(queryItem);
        queryItem.resolve();
      } catch (error) {
        queryItem.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Process individual query with text generation
   */
  async processQueryOptimized(queryItem) {
    const { message, context, style } = queryItem;
    const queryId = `query_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Start performance timing
    const timerId = this.performanceManager.startQueryTimer(queryId);

    try {
      // Check cache first
      const cacheKey = `${message}_${style}_${JSON.stringify(context)}`;
      const cachedResult =
        this.performanceManager.getCachedQueryResult(cacheKey);

      if (cachedResult) {
        this.performanceManager.stopQueryTimer(timerId, { cached: true });

        this.postMessage({
          type: "response",
          answer: cachedResult.answer,
          confidence: cachedResult.confidence,
          matchedSections: cachedResult.matchedSections,
          query: message,
          processingMetrics: {
            ...cachedResult.metrics,
            cached: true,
            processingTime: 0,
          },
        });
        return;
      }

      // Find relevant sections using keyword matching
      const relevantSections = this.findRelevantSectionsByKeywords(message);

      // Build context from relevant sections
      const cvContext = this.buildCVContext(relevantSections);

      // Create prompt for text generation
      const prompt = this.createPrompt(message, cvContext, style, context);

      // Generate response using SmolLM2
      const generatedText = await this.generateTextResponse(prompt);

      // Process and validate the generated response
      const processedResponse = this.processGeneratedResponse(
        generatedText,
        relevantSections,
        message,
        style
      );

      // Stop timing and add metrics
      const processingTime = this.performanceManager.stopQueryTimer(timerId, {
        queryLength: message.length,
        contextSize: context.length,
        sectionsFound: relevantSections.length,
        confidence: processedResponse.confidence,
      });

      processedResponse.metrics.processingTime = processingTime;
      processedResponse.metrics.cached = false;

      // Cache the result
      this.performanceManager.cacheQueryResult(cacheKey, processedResponse);

      this.postMessage({
        type: "response",
        answer: processedResponse.answer,
        confidence: processedResponse.confidence,
        matchedSections: processedResponse.matchedSections,
        query: message,
        processingMetrics: processedResponse.metrics,
      });
    } catch (error) {
      this.performanceManager.stopQueryTimer(timerId, { error: error.message });

      console.error("Failed to process query:", error);
      this.performanceManager.logPerformanceEvent("query_processing_failed", {
        queryId,
        error: error.message,
        queryLength: message.length,
      });

      this.postMessage({
        type: "error",
        error: error.message,
        query: message,
      });
    }
  }

  /**
   * Preprocess user query to improve matching accuracy
   */
  preprocessQuery(message, context = []) {
    let processedQuery = message.toLowerCase().trim();

    // Extract context keywords from recent conversation
    const contextKeywords = this.extractContextKeywords(context);

    // Expand query with synonyms and related terms
    processedQuery = this.expandQueryWithSynonyms(processedQuery);

    // Add context if relevant
    if (contextKeywords.length > 0) {
      processedQuery += " " + contextKeywords.join(" ");
    }

    // Clean and normalize
    processedQuery = this.normalizeQuery(processedQuery);

    return processedQuery;
  }

  /**
   * Extract relevant keywords from conversation context
   */
  extractContextKeywords(context) {
    if (!context || context.length === 0) return [];

    const keywords = new Set();
    const recentMessages = context.slice(-2); // Last 2 exchanges

    recentMessages.forEach((entry) => {
      if (entry.matchedSections) {
        entry.matchedSections.forEach((sectionId) => {
          const sectionData = this.cvEmbeddings.get(sectionId);
          if (sectionData && sectionData.section.keywords) {
            sectionData.section.keywords.forEach((keyword) =>
              keywords.add(keyword)
            );
          }
        });
      }
    });

    return Array.from(keywords).slice(0, 3); // Limit to 3 most relevant
  }

  /**
   * Expand query with synonyms and related terms
   */
  expandQueryWithSynonyms(query) {
    const synonymMap = {
      react: ["reactjs", "jsx", "hooks", "components"],
      javascript: ["js", "es6", "es2020", "vanilla"],
      node: ["nodejs", "backend", "server"],
      css: ["styling", "styles", "scss", "sass"],
      database: ["db", "sql", "mongodb", "postgres"],
      api: ["rest", "endpoint", "service", "backend"],
      frontend: ["ui", "interface", "client", "browser"],
      backend: ["server", "api", "service", "database"],
      experience: ["work", "job", "career", "professional"],
      skills: ["abilities", "expertise", "knowledge", "competencies"],
      projects: ["work", "portfolio", "applications", "development"],
    };

    let expandedQuery = query;

    Object.entries(synonymMap).forEach(([term, synonyms]) => {
      if (query.includes(term)) {
        // Add most relevant synonym
        expandedQuery += " " + synonyms[0];
      }
    });

    return expandedQuery;
  }

  /**
   * Normalize and clean query text
   */
  normalizeQuery(query) {
    return query
      .replace(/[^\w\s]/g, " ") // Remove special characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Get adaptive similarity threshold based on query characteristics
   */
  getAdaptiveThreshold(query) {
    const baseThreshold = 0.7;

    // Lower threshold for shorter queries (they might be less specific)
    if (query.length < 20) {
      return baseThreshold - 0.1;
    }

    // Lower threshold for questions (they might be more exploratory)
    if (
      query.includes("?") ||
      query.startsWith("what") ||
      query.startsWith("how") ||
      query.startsWith("do you")
    ) {
      return baseThreshold - 0.05;
    }

    // Higher threshold for very specific technical terms
    const technicalTerms = [
      "framework",
      "library",
      "algorithm",
      "architecture",
      "implementation",
    ];
    if (technicalTerms.some((term) => query.toLowerCase().includes(term))) {
      return baseThreshold + 0.05;
    }

    return baseThreshold;
  }

  /**
   * Find relevant CV sections using improved keyword matching
   */
  findRelevantSectionsByKeywords(query) {
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);
    const matches = [];

    for (const [sectionId, sectionData] of this.cvEmbeddings.entries()) {
      const searchText = sectionData.searchText;
      let score = 0;
      let matchedKeywords = [];

      // Check for keyword matches with better scoring
      queryWords.forEach((word) => {
        if (searchText.includes(word)) {
          // Exact word match gets higher score
          const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
          if (searchText.match(wordRegex)) {
            score += 2;
          } else {
            score += 1;
          }
          matchedKeywords.push(word);
        }
      });

      // Boost score significantly for exact keyword matches
      if (sectionData.section.keywords) {
        sectionData.section.keywords.forEach((keyword) => {
          if (query.toLowerCase().includes(keyword.toLowerCase())) {
            score += 3; // Higher boost for exact keyword match
            matchedKeywords.push(keyword);
          }
        });
      }

      if (score > 0) {
        matches.push({
          sectionId: sectionId,
          similarity: Math.min(1.0, score / (queryWords.length + 2)),
          score: score,
          matchedKeywords: [...new Set(matchedKeywords)],
          section: sectionData.section,
          category: sectionData.category,
          key: sectionData.key,
        });
      }
    }

    // Sort by score (highest first) and return top 3 for focused context
    return matches.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  /**
   * Build focused CV context from relevant sections
   */
  buildCVContext(relevantSections) {
    if (!relevantSections || relevantSections.length === 0) {
      return null;
    }

    // Use only the most relevant section to avoid context confusion
    const bestMatch = relevantSections[0];
    const section = bestMatch.section;

    let context = "About Serhii:\n";

    // Add main response (use developer style as most comprehensive)
    if (section.responses && section.responses.developer) {
      context += section.responses.developer + "\n";
    }

    // Add key details concisely
    if (section.details) {
      if (section.details.years) {
        context += `Experience: ${section.details.years} years\n`;
      }
      if (section.details.level) {
        context += `Skill level: ${section.details.level}\n`;
      }
      if (section.details.skills && section.details.skills.length > 0) {
        context += `Key skills: ${section.details.skills.slice(0, 5).join(", ")}\n`;
      }
      if (section.details.achievements && section.details.achievements.length > 0) {
        context += `Notable achievements: ${section.details.achievements.slice(0, 2).join(", ")}\n`;
      }
    }

    return context.trim();
  }

  /**
   * Create optimized prompt for text generation
   */
  createPrompt(question, cvContext, style, conversationContext = []) {
    const styleInstructions = {
      hr: "professional and achievement-focused manner. Focus on experience, qualifications, and measurable results",
      developer: "technical and collaborative manner. Use technical language and share insights about technologies",
      friend: "casual and enthusiastic manner. Use emojis when appropriate and make concepts accessible"
    };

    const instruction = styleInstructions[style] || styleInstructions.developer;

    let prompt = `You are Serhii, a software developer. Respond in a ${instruction}.\n\n`;

    if (cvContext) {
      prompt += `Based on this information:\n${cvContext}\n\n`;
    }

    prompt += `Question: ${question}\n\n`;
    prompt += `Instructions:
- Answer as Serhii in first person
- Only use information provided above
- If no relevant info is provided, say so honestly
- Keep response under 100 words
- Be specific and provide examples when possible

Answer:`;

    return prompt;
  }

  /**
   * Process and validate generated response
   */
  processGeneratedResponse(
    generatedText,
    relevantSections,
    originalQuery,
    style
  ) {
    let answer = generatedText;
    let confidence = 0.7; // Base confidence for text generation

    // Clean up the response
    answer = this.cleanGeneratedText(answer);

    // Calculate confidence based on response quality and relevance
    confidence = this.calculateTextGenerationConfidence(
      answer,
      relevantSections,
      originalQuery
    );

    // Enhance response if needed
    answer = this.enhanceGeneratedResponse(answer, style, relevantSections);

    return {
      answer,
      confidence,
      matchedSections: relevantSections.slice(0, 3).map((match) => ({
        id: match.sectionId,
        category: match.category,
        similarity: match.similarity,
        score: match.score,
        matchedKeywords: match.matchedKeywords,
      })),
      metrics: {
        sectionsAnalyzed: relevantSections.length,
        generationMethod: "text-generation",
      },
    };
  }

  /**
   * Clean generated text
   */
  cleanGeneratedText(text) {
    return text
      .replace(/^Response:\s*/i, "") // Remove "Response:" prefix
      .replace(/\n\s*\n/g, "\n") // Remove extra newlines
      .trim();
  }

  /**
   * Calculate confidence for text generation
   */
  calculateTextGenerationConfidence(answer, relevantSections, query) {
    let confidence = 0.6; // Base confidence

    // Boost confidence if we have relevant sections
    if (relevantSections.length > 0) {
      confidence += 0.1;
    }

    // Boost confidence if response is substantial
    if (answer.length > 50) {
      confidence += 0.1;
    }

    // Boost confidence if response includes specific details
    const specificIndicators = [
      "years",
      "project",
      "built",
      "implemented",
      "developed",
      "experience",
    ];
    if (
      specificIndicators.some((indicator) =>
        answer.toLowerCase().includes(indicator)
      )
    ) {
      confidence += 0.05;
    }

    // Reduce confidence if response seems too generic
    if (
      answer.length < 30 ||
      answer.includes("I don't have specific information")
    ) {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  /**
   * Enhance generated response based on style
   */
  enhanceGeneratedResponse(answer, style, relevantSections) {
    // Ensure response ends properly
    if (!answer.match(/[.!?]$/)) {
      answer += ".";
    }

    // Style-specific enhancements
    if (style === "friend" && !answer.includes("😊") && Math.random() > 0.7) {
      answer += " 😊";
    }

    return answer;
  }

  /**
   * Generate enhanced response with improved synthesis and confidence scoring
   */
  async generateEnhancedResponse(relevantSections, query, context, style) {
    if (relevantSections.length === 0) {
      return {
        answer: this.getNoMatchResponse(style),
        confidence: 0,
        matchedSections: [],
        metrics: { processingTime: 0, sectionsAnalyzed: 0 },
      };
    }

    const startTime = Date.now();

    // Calculate overall confidence score
    const overallConfidence = this.calculateOverallConfidence(
      relevantSections,
      query
    );

    // Synthesize response from multiple sections if applicable
    const synthesizedResponse = await this.synthesizeMultiSectionResponse(
      relevantSections,
      query,
      context,
      style
    );

    // Add contextual enhancements
    const contextualResponse = this.enhanceWithContext(
      synthesizedResponse,
      context,
      style,
      relevantSections
    );

    const processingTime = Date.now() - startTime;

    return {
      answer: contextualResponse,
      confidence: overallConfidence,
      matchedSections: relevantSections.slice(0, 3).map((match) => ({
        id: match.sectionId,
        category: match.category,
        similarity: match.similarity,
        rawSimilarity: match.rawSimilarity,
        keywordBoost: match.keywordBoost,
      })),
      metrics: {
        processingTime,
        sectionsAnalyzed: relevantSections.length,
        synthesisMethod:
          relevantSections.length > 1 ? "multi-section" : "single-section",
      },
    };
  }

  /**
   * Calculate overall confidence score based on multiple factors
   */
  calculateOverallConfidence(relevantSections, query) {
    if (relevantSections.length === 0) return 0;

    const bestMatch = relevantSections[0];
    let confidence = bestMatch.similarity;

    // Boost confidence if multiple sections are relevant (indicates comprehensive knowledge)
    if (relevantSections.length > 1) {
      const secondBest = relevantSections[1];
      if (secondBest.similarity > 0.6) {
        confidence = Math.min(1.0, confidence + 0.05);
      }
    }

    // Adjust based on query characteristics
    confidence = this.adjustConfidenceForQuery(confidence, query);

    // Ensure confidence is within valid range
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Adjust confidence based on query characteristics
   */
  adjustConfidenceForQuery(baseConfidence, query) {
    let adjustedConfidence = baseConfidence;

    // Higher confidence for specific technical queries
    const specificTerms = ["react", "javascript", "node", "typescript", "scss"];
    if (specificTerms.some((term) => query.toLowerCase().includes(term))) {
      adjustedConfidence += 0.03;
    }

    // Lower confidence for very broad queries
    const broadTerms = ["experience", "skills", "background", "about"];
    if (
      broadTerms.some((term) => query.toLowerCase().includes(term)) &&
      query.length < 30
    ) {
      adjustedConfidence -= 0.05;
    }

    // Higher confidence for direct questions about specific projects
    if (query.toLowerCase().includes("project") && query.includes("?")) {
      adjustedConfidence += 0.02;
    }

    return adjustedConfidence;
  }

  /**
   * Synthesize response from multiple relevant sections
   */
  async synthesizeMultiSectionResponse(
    relevantSections,
    query,
    context,
    style
  ) {
    if (relevantSections.length === 1) {
      return this.getSingleSectionResponse(relevantSections[0], style);
    }

    // Group sections by category for better synthesis
    const sectionsByCategory = this.groupSectionsByCategory(relevantSections);

    // Determine synthesis strategy based on query type and sections
    const synthesisStrategy = this.determineSynthesisStrategy(
      query,
      sectionsByCategory
    );

    switch (synthesisStrategy) {
      case "comprehensive":
        return this.synthesizeComprehensiveResponse(
          relevantSections,
          style,
          query
        );
      case "focused":
        return this.synthesizeFocusedResponse(relevantSections, style, query);
      case "comparative":
        return this.synthesizeComparativeResponse(
          relevantSections,
          style,
          query
        );
      default:
        return this.getSingleSectionResponse(relevantSections[0], style);
    }
  }

  /**
   * Get response from a single section
   */
  getSingleSectionResponse(sectionMatch, style) {
    const section = sectionMatch.section;
    return (
      section.responses[style] ||
      section.responses.developer ||
      "I have experience in this area."
    );
  }

  /**
   * Group sections by category for better synthesis
   */
  groupSectionsByCategory(sections) {
    const grouped = {};
    sections.forEach((section) => {
      if (!grouped[section.category]) {
        grouped[section.category] = [];
      }
      grouped[section.category].push(section);
    });
    return grouped;
  }

  /**
   * Determine the best synthesis strategy
   */
  determineSynthesisStrategy(query, sectionsByCategory) {
    const categoryCount = Object.keys(sectionsByCategory).length;

    // If query asks for comparison or mentions multiple technologies
    if (
      query.includes("vs") ||
      query.includes("compare") ||
      query.includes("difference")
    ) {
      return "comparative";
    }

    // If sections span multiple categories, provide comprehensive view
    if (categoryCount > 1) {
      return "comprehensive";
    }

    // If multiple sections in same category, provide focused view
    if (
      categoryCount === 1 &&
      Object.values(sectionsByCategory)[0].length > 1
    ) {
      return "focused";
    }

    return "single";
  }

  /**
   * Synthesize comprehensive response covering multiple categories
   */
  synthesizeComprehensiveResponse(sections, style, query) {
    const topSections = sections.slice(0, 3);
    const responses = topSections
      .map((section) => section.section.responses[style])
      .filter(Boolean);

    if (responses.length === 0) {
      return this.getNoMatchResponse(style);
    }

    const connectors = this.getStyleConnectors(style);
    const intro = this.getComprehensiveIntro(style, query);

    // Combine responses with appropriate connectors
    let combinedResponse = intro + " " + responses[0];

    if (responses.length > 1) {
      combinedResponse +=
        ` ${connectors.continuation} ` +
        responses.slice(1).join(` ${connectors.continuation} `);
    }

    return combinedResponse;
  }

  /**
   * Synthesize focused response within a single category
   */
  synthesizeFocusedResponse(sections, style, query) {
    const primarySection = sections[0];
    const relatedSections = sections.slice(1, 3);

    let response = primarySection.section.responses[style];

    if (relatedSections.length > 0) {
      const connectors = this.getStyleConnectors(style);
      const relatedTopics = relatedSections
        .map((s) => s.section.keywords[0])
        .join(", ");

      response += ` ${connectors.continuation} I also have experience with ${relatedTopics}.`;
    }

    return response;
  }

  /**
   * Synthesize comparative response for comparison queries
   */
  synthesizeComparativeResponse(sections, style, query) {
    if (sections.length < 2) {
      return this.getSingleSectionResponse(sections[0], style);
    }

    const section1 = sections[0];
    const section2 = sections[1];

    const connectors = this.getStyleConnectors(style);
    const compareIntro = this.getComparisonIntro(style);

    return `${compareIntro} ${section1.section.responses[style]} ${connectors.continuation} ${section2.section.responses[style]}`;
  }

  /**
   * Get style-specific connectors for response synthesis
   */
  getStyleConnectors(style) {
    const connectors = {
      hr: {
        continuation: "Additionally,",
        conclusion: "These qualifications demonstrate",
      },
      developer: {
        continuation: "Also,",
        conclusion: "So yeah,",
      },
      friend: {
        continuation: "Oh, and",
        conclusion: "Pretty cool stuff, right?",
      },
    };

    return connectors[style] || connectors.developer;
  }

  /**
   * Get comprehensive introduction based on style
   */
  getComprehensiveIntro(style, query) {
    const intros = {
      hr: "Regarding your question about my background,",
      developer: "Great question! Let me break that down for you.",
      friend: "Oh, that's a good one! 😊 Let me tell you about that.",
    };

    return intros[style] || intros.developer;
  }

  /**
   * Get comparison introduction based on style
   */
  getComparisonIntro(style) {
    const intros = {
      hr: "I have experience with both areas.",
      developer: "I've worked with both of those.",
      friend: "Oh, I know both of those! 😄",
    };

    return intros[style] || intros.developer;
  }

  /**
   * Enhance response with contextual information
   */
  enhanceWithContext(response, context, style, relevantSections) {
    if (!context || context.length === 0) {
      return response;
    }

    // Check if this continues a previous conversation topic
    const contextualConnection = this.findContextualConnection(
      context,
      relevantSections
    );

    if (contextualConnection) {
      const contextualPhrases = {
        hr: "Building on our previous discussion, ",
        developer: "Following up on that, ",
        friend: "Oh, and speaking of what we talked about, ",
      };

      const phrase = contextualPhrases[style] || contextualPhrases.developer;
      return phrase + response;
    }

    return response;
  }

  /**
   * Find connection between current response and previous context
   */
  findContextualConnection(context, relevantSections) {
    if (context.length === 0 || relevantSections.length === 0) {
      return false;
    }

    const lastEntry = context[context.length - 1];
    if (!lastEntry.matchedSections) {
      return false;
    }

    // Check if any current sections relate to previous sections
    const currentSectionIds = relevantSections.map((s) => s.sectionId);
    const previousSectionIds = lastEntry.matchedSections.map((s) => s.id || s);

    return currentSectionIds.some((id) =>
      previousSectionIds.some((prevId) => this.areSectionsRelated(id, prevId))
    );
  }

  /**
   * Check if two sections are related
   */
  areSectionsRelated(sectionId1, sectionId2) {
    // Simple relationship check - could be enhanced with more sophisticated logic
    if (sectionId1 === sectionId2) return true;

    // Check if they're in the same category
    const category1 = sectionId1.split("_")[0];
    const category2 = sectionId2.split("_")[0];

    return category1 === category2;
  }

  /**
   * Get appropriate "no match" response based on style
   */
  getNoMatchResponse(style) {
    const responses = {
      hr: "I don't have specific information about that in my professional background. Could you rephrase your question or ask about my experience, skills, or projects?",
      developer:
        "Hmm, I'm not sure I have relevant experience with that specific topic. Could you try rephrasing or ask about something else from my background?",
      friend:
        "Oops! 🤔 I'm not sure I can help with that one. Maybe try asking about my projects, skills, or work experience? I'd love to share more about those!",
    };

    return responses[style] || responses.developer;
  }

  /**
   * Add contextual elements based on conversation history
   */
  addContextualElements(response, context, style) {
    // Simple context awareness - could be enhanced
    const lastMessage = context[context.length - 1];

    if (lastMessage && lastMessage.userMessage) {
      const contextualPrefixes = {
        hr: "Building on our previous discussion, ",
        developer: "Following up on that, ",
        friend: "Oh, and speaking of that, ",
      };

      const prefix = contextualPrefixes[style] || "";
      return prefix + response;
    }

    return response;
  }

  /**
   * Validate response quality and adjust if necessary
   */
  validateResponseQuality(response, originalQuery) {
    const validation = {
      answer: response.answer,
      confidence: response.confidence,
      matchedSections: response.matchedSections,
      metrics: response.metrics || {},
    };

    // Check response length (too short might indicate poor matching)
    if (response.answer.length < 20) {
      validation.confidence = Math.max(0, validation.confidence - 0.1);
      validation.metrics.qualityFlags = ["short_response"];
    }

    // Check if response actually addresses the query
    const queryRelevance = this.assessQueryRelevance(
      response.answer,
      originalQuery
    );
    if (queryRelevance < 0.5) {
      validation.confidence = Math.max(0, validation.confidence - 0.15);
      validation.metrics.qualityFlags = validation.metrics.qualityFlags || [];
      validation.metrics.qualityFlags.push("low_relevance");
    }

    // Ensure minimum confidence threshold for quality responses
    if (validation.confidence < 0.3) {
      validation.answer = this.getFallbackResponse(originalQuery);
      validation.confidence = 0.2; // Low but not zero to indicate fallback
      validation.matchedSections = [];
      validation.metrics.qualityFlags = validation.metrics.qualityFlags || [];
      validation.metrics.qualityFlags.push("fallback_triggered");
    }

    // Add quality score to metrics
    validation.metrics.qualityScore = this.calculateQualityScore(validation);

    return validation;
  }

  /**
   * Assess how well the response addresses the original query
   */
  assessQueryRelevance(response, query) {
    // Simple keyword overlap assessment
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);
    const responseWords = response.toLowerCase().split(/\s+/);

    let matches = 0;
    queryWords.forEach((word) => {
      if (
        responseWords.some(
          (respWord) => respWord.includes(word) || word.includes(respWord)
        )
      ) {
        matches++;
      }
    });

    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  /**
   * Get fallback response for low-quality matches
   */
  getFallbackResponse(query) {
    return "I'd be happy to help you with that! Could you be a bit more specific about what you'd like to know? I can share details about my experience, skills, or projects.";
  }

  /**
   * Calculate overall quality score for the response
   */
  calculateQualityScore(validation) {
    let score = validation.confidence * 0.6; // Base score from confidence

    // Add points for response length (within reasonable bounds)
    const lengthScore = Math.min(0.2, validation.answer.length / 500);
    score += lengthScore;

    // Add points for multiple matched sections (indicates comprehensive knowledge)
    const sectionScore = Math.min(
      0.1,
      validation.matchedSections.length * 0.03
    );
    score += sectionScore;

    // Subtract points for quality flags
    const qualityFlags = validation.metrics.qualityFlags || [];
    score -= qualityFlags.length * 0.05;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Add information about related sections
   */
  addRelatedSections(response, relatedSections, style) {
    if (relatedSections.length === 0) return response;

    const connectors = {
      hr: " Additionally, I have experience with ",
      developer: " I've also worked with ",
      friend: " Oh, and I've also dabbled in ",
    };

    const connector = connectors[style] || connectors.developer;
    const relatedTopics = relatedSections
      .map((match) => match.section.keywords?.[0] || "related technologies")
      .join(", ");

    return response + connector + relatedTopics + ".";
  }

  /**
   * Get performance metrics from the worker
   */
  getPerformanceMetrics() {
    return this.performanceManager.getMetrics();
  }

  /**
   * Clean up resources and perform memory management
   */
  cleanup() {
    // Clear embeddings cache
    this.cvEmbeddings.clear();

    // Clear query queue
    this.queryQueue = [];
    this.isProcessingQueue = false;

    // Cleanup performance manager
    this.performanceManager.cleanup();

    // Clear model references (but keep cache for reuse)
    this.model = null;
    this.cvData = null;
    this.isInitialized = false;
    this.loadingPromise = null;

    this.performanceManager.logPerformanceEvent("worker_cleanup_complete");
  }

  /**
   * Utility method to delay execution
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Post message to main thread
   */
  postMessage(data) {
    self.postMessage(data);
  }
}

// Initialize worker instance
const mlWorker = new MLWorker();

// Handle messages from main thread
self.onmessage = async function (event) {
  const { type, message, context, style, modelPath, cvData } = event.data;

  try {
    switch (type) {
      case "initialize":
        await mlWorker.initialize(cvData);
        break;

      case "process_query":
        await mlWorker.processQuery(
          message,
          context || [],
          style || "developer"
        );
        break;

      case "get_performance_metrics":
        mlWorker.postMessage({
          type: "performance_metrics",
          metrics: mlWorker.getPerformanceMetrics(),
        });
        break;

      case "cleanup":
        mlWorker.cleanup();
        mlWorker.postMessage({ type: "cleanup_complete" });
        break;

      case "ping":
        mlWorker.postMessage({ type: "pong" });
        break;

      default:
        console.warn("Unknown message type:", type);
        mlWorker.postMessage({
          type: "error",
          error: `Unknown message type: ${type}`,
        });
    }
  } catch (error) {
    console.error("Worker error:", error);
    mlWorker.postMessage({
      type: "error",
      error: error.message,
    });
  }
};

// Handle worker errors
self.onerror = function (error) {
  console.error("Worker error:", error);
  self.postMessage({
    type: "error",
    error: error.message || "Unknown worker error",
  });
};

// Handle unhandled promise rejections
self.onunhandledrejection = function (event) {
  console.error("Unhandled promise rejection in worker:", event.reason);
  self.postMessage({
    type: "error",
    error: event.reason?.message || "Unhandled promise rejection",
  });
};
