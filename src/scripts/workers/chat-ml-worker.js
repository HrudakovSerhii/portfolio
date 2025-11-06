/**
 * ML Worker for DistilBERT processing
 * Handles model loading, embedding generation, and semantic similarity computation
 */

// Global variables for transformers
let pipeline, env;

// Load transformers library dynamically
async function loadTransformers() {
  try {
    const transformers = await import('@huggingface/transformers');
    pipeline = transformers.pipeline;
    env = transformers.env;
    
    // Configure Transformers.js environment for web worker
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    
    return true;
  } catch (error) {
    console.error('Failed to load transformers:', error);
    return false;
  }
}

class MLWorker {
  constructor() {
    this.model = null;
    this.tokenizer = null;
    this.isInitialized = false;
    this.cvData = null;
    this.cvEmbeddings = new Map();
  }

  /**
   * Initialize the DistilBERT model and tokenizer
   */
  async initialize(cvData) {
    debugger
    try {
      // First load the transformers library
      const transformersLoaded = await loadTransformers();
      if (!transformersLoaded) {
        throw new Error('Failed to load transformers library');
      }

      this.postMessage({
        type: 'status',
        message: 'Loading DistilBERT model...'
      });

      // Load the feature extraction pipeline with DistilBERT
      this.model = await pipeline('feature-extraction', 'distilbert-base-uncased', {
        quantized: true, // Use quantized model for better performance
        progress_callback: (progress) => {
          this.postMessage({
            type: 'progress',
            progress: progress
          });
        }
      });

      this.cvData = cvData;

      // Pre-compute embeddings for CV sections
      await this.precomputeEmbeddings();

      this.isInitialized = true;

      this.postMessage({
        type: 'ready',
        success: true,
        message: 'DistilBERT model loaded successfully'
      });

    } catch (error) {
      console.error('Failed to initialize ML model:', error);
      this.postMessage({
        type: 'ready',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Pre-compute embeddings for all CV sections
   */
  async precomputeEmbeddings() {
    if (!this.cvData || !this.cvData.sections) {
      throw new Error('CV data not available for embedding computation');
    }

    this.postMessage({
      type: 'status',
      message: 'Computing embeddings for CV sections...'
    });

    const sections = this.cvData.sections;
    let processedCount = 0;
    const totalSections = this.getTotalSectionCount(sections);

    for (const [categoryKey, category] of Object.entries(sections)) {
      for (const [sectionKey, section] of Object.entries(category)) {
        try {
          // Create text for embedding from keywords and responses
          const textForEmbedding = this.createEmbeddingText(section);
          const embedding = await this.generateEmbedding(textForEmbedding);

          // Store embedding with section reference
          const sectionId = section.id || `${categoryKey}_${sectionKey}`;
          this.cvEmbeddings.set(sectionId, {
            embedding: embedding,
            section: section,
            category: categoryKey,
            key: sectionKey
          });

          processedCount++;
          this.postMessage({
            type: 'embedding_progress',
            processed: processedCount,
            total: totalSections
          });

        } catch (error) {
          console.error(`Failed to compute embedding for ${categoryKey}.${sectionKey}:`, error);
        }
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
   * Create text for embedding from section data
   */
  createEmbeddingText(section) {
    const parts = [];

    // Add keywords
    if (section.keywords && Array.isArray(section.keywords)) {
      parts.push(section.keywords.join(' '));
    }

    // Add response text (use developer style as it's most comprehensive)
    if (section.responses && section.responses.developer) {
      parts.push(section.responses.developer);
    }

    // Add details if available
    if (section.details) {
      if (section.details.skills && Array.isArray(section.details.skills)) {
        parts.push(section.details.skills.join(' '));
      }
      if (section.details.technologies && Array.isArray(section.details.technologies)) {
        parts.push(section.details.technologies.join(' '));
      }
    }

    return parts.join(' ').toLowerCase();
  }

  /**
   * Generate embedding for given text
   */
  async generateEmbedding(text) {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      // Generate embedding using the model
      const output = await this.model(text, { pooling: 'mean', normalize: true });

      // Convert to regular array for easier manipulation
      return Array.from(output.data);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Process user query and find relevant CV sections
   */
  async processQuery(message, context = [], style = 'developer') {
    if (!this.isInitialized) {
      throw new Error('Model not initialized');
    }

    try {
      // Preprocess the query
      const preprocessedQuery = this.preprocessQuery(message, context);

      // Generate embedding for the preprocessed query
      const queryEmbedding = await this.generateEmbedding(preprocessedQuery);

      // Find relevant sections using adaptive similarity thresholds
      const relevantSections = await this.findRelevantSections(queryEmbedding, this.getAdaptiveThreshold(message));

      // Generate response with enhanced synthesis and confidence scoring
      const response = await this.generateEnhancedResponse(relevantSections, message, context, style);

      // Validate response quality
      const validatedResponse = this.validateResponseQuality(response, message);

      this.postMessage({
        type: 'response',
        answer: validatedResponse.answer,
        confidence: validatedResponse.confidence,
        matchedSections: validatedResponse.matchedSections,
        query: message,
        processingMetrics: validatedResponse.metrics
      });

    } catch (error) {
      console.error('Failed to process query:', error);
      this.postMessage({
        type: 'error',
        error: error.message,
        query: message
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
      processedQuery += ' ' + contextKeywords.join(' ');
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

    recentMessages.forEach(entry => {
      if (entry.matchedSections) {
        entry.matchedSections.forEach(sectionId => {
          const sectionData = this.cvEmbeddings.get(sectionId);
          if (sectionData && sectionData.section.keywords) {
            sectionData.section.keywords.forEach(keyword => keywords.add(keyword));
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
      'react': ['reactjs', 'jsx', 'hooks', 'components'],
      'javascript': ['js', 'es6', 'es2020', 'vanilla'],
      'node': ['nodejs', 'backend', 'server'],
      'css': ['styling', 'styles', 'scss', 'sass'],
      'database': ['db', 'sql', 'mongodb', 'postgres'],
      'api': ['rest', 'endpoint', 'service', 'backend'],
      'frontend': ['ui', 'interface', 'client', 'browser'],
      'backend': ['server', 'api', 'service', 'database'],
      'experience': ['work', 'job', 'career', 'professional'],
      'skills': ['abilities', 'expertise', 'knowledge', 'competencies'],
      'projects': ['work', 'portfolio', 'applications', 'development']
    };

    let expandedQuery = query;

    Object.entries(synonymMap).forEach(([term, synonyms]) => {
      if (query.includes(term)) {
        // Add most relevant synonym
        expandedQuery += ' ' + synonyms[0];
      }
    });

    return expandedQuery;
  }

  /**
   * Normalize and clean query text
   */
  normalizeQuery(query) {
    return query
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
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
    if (query.includes('?') || query.startsWith('what') || query.startsWith('how') || query.startsWith('do you')) {
      return baseThreshold - 0.05;
    }

    // Higher threshold for very specific technical terms
    const technicalTerms = ['framework', 'library', 'algorithm', 'architecture', 'implementation'];
    if (technicalTerms.some(term => query.toLowerCase().includes(term))) {
      return baseThreshold + 0.05;
    }

    return baseThreshold;
  }

  /**
   * Find relevant CV sections using enhanced semantic similarity
   */
  async findRelevantSections(queryEmbedding, threshold = 0.7) {
    const similarities = [];

    for (const [sectionId, sectionData] of this.cvEmbeddings.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, sectionData.embedding);

      // Apply keyword boost for exact matches
      const keywordBoost = this.calculateKeywordBoost(queryEmbedding, sectionData);
      const adjustedSimilarity = Math.min(1.0, similarity + keywordBoost);

      if (adjustedSimilarity >= threshold) {
        similarities.push({
          sectionId: sectionId,
          similarity: adjustedSimilarity,
          rawSimilarity: similarity,
          keywordBoost: keywordBoost,
          section: sectionData.section,
          category: sectionData.category,
          key: sectionData.key
        });
      }
    }

    // Sort by adjusted similarity score (highest first)
    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate keyword boost for sections with exact keyword matches
   */
  calculateKeywordBoost(queryEmbedding, sectionData) {
    // This is a simplified boost - in a real implementation,
    // you might analyze the original query text against section keywords
    // For now, return a small boost for high-confidence sections
    return 0.02; // Small boost to maintain semantic similarity priority
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
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
        metrics: { processingTime: 0, sectionsAnalyzed: 0 }
      };
    }

    const startTime = Date.now();

    // Calculate overall confidence score
    const overallConfidence = this.calculateOverallConfidence(relevantSections, query);

    // Synthesize response from multiple sections if applicable
    const synthesizedResponse = await this.synthesizeMultiSectionResponse(
      relevantSections,
      query,
      context,
      style
    );

    // Add contextual enhancements
    const contextualResponse = this.enhanceWithContext(synthesizedResponse, context, style, relevantSections);

    const processingTime = Date.now() - startTime;

    return {
      answer: contextualResponse,
      confidence: overallConfidence,
      matchedSections: relevantSections.slice(0, 3).map(match => ({
        id: match.sectionId,
        category: match.category,
        similarity: match.similarity,
        rawSimilarity: match.rawSimilarity,
        keywordBoost: match.keywordBoost
      })),
      metrics: {
        processingTime,
        sectionsAnalyzed: relevantSections.length,
        synthesisMethod: relevantSections.length > 1 ? 'multi-section' : 'single-section'
      }
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
    const specificTerms = ['react', 'javascript', 'node', 'typescript', 'scss'];
    if (specificTerms.some(term => query.toLowerCase().includes(term))) {
      adjustedConfidence += 0.03;
    }

    // Lower confidence for very broad queries
    const broadTerms = ['experience', 'skills', 'background', 'about'];
    if (broadTerms.some(term => query.toLowerCase().includes(term)) && query.length < 30) {
      adjustedConfidence -= 0.05;
    }

    // Higher confidence for direct questions about specific projects
    if (query.toLowerCase().includes('project') && query.includes('?')) {
      adjustedConfidence += 0.02;
    }

    return adjustedConfidence;
  }

  /**
   * Synthesize response from multiple relevant sections
   */
  async synthesizeMultiSectionResponse(relevantSections, query, context, style) {
    if (relevantSections.length === 1) {
      return this.getSingleSectionResponse(relevantSections[0], style);
    }

    // Group sections by category for better synthesis
    const sectionsByCategory = this.groupSectionsByCategory(relevantSections);

    // Determine synthesis strategy based on query type and sections
    const synthesisStrategy = this.determineSynthesisStrategy(query, sectionsByCategory);

    switch (synthesisStrategy) {
      case 'comprehensive':
        return this.synthesizeComprehensiveResponse(relevantSections, style, query);
      case 'focused':
        return this.synthesizeFocusedResponse(relevantSections, style, query);
      case 'comparative':
        return this.synthesizeComparativeResponse(relevantSections, style, query);
      default:
        return this.getSingleSectionResponse(relevantSections[0], style);
    }
  }

  /**
   * Get response from a single section
   */
  getSingleSectionResponse(sectionMatch, style) {
    const section = sectionMatch.section;
    return section.responses[style] || section.responses.developer || 'I have experience in this area.';
  }

  /**
   * Group sections by category for better synthesis
   */
  groupSectionsByCategory(sections) {
    const grouped = {};
    sections.forEach(section => {
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
    if (query.includes('vs') || query.includes('compare') || query.includes('difference')) {
      return 'comparative';
    }

    // If sections span multiple categories, provide comprehensive view
    if (categoryCount > 1) {
      return 'comprehensive';
    }

    // If multiple sections in same category, provide focused view
    if (categoryCount === 1 && Object.values(sectionsByCategory)[0].length > 1) {
      return 'focused';
    }

    return 'single';
  }

  /**
   * Synthesize comprehensive response covering multiple categories
   */
  synthesizeComprehensiveResponse(sections, style, query) {
    const topSections = sections.slice(0, 3);
    const responses = topSections.map(section => section.section.responses[style]).filter(Boolean);

    if (responses.length === 0) {
      return this.getNoMatchResponse(style);
    }

    const connectors = this.getStyleConnectors(style);
    const intro = this.getComprehensiveIntro(style, query);

    // Combine responses with appropriate connectors
    let combinedResponse = intro + ' ' + responses[0];

    if (responses.length > 1) {
      combinedResponse += ` ${connectors.continuation} ` + responses.slice(1).join(` ${connectors.continuation} `);
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
        .map(s => s.section.keywords[0])
        .join(', ');

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
        continuation: 'Additionally,',
        conclusion: 'These qualifications demonstrate'
      },
      developer: {
        continuation: 'Also,',
        conclusion: 'So yeah,'
      },
      friend: {
        continuation: 'Oh, and',
        conclusion: 'Pretty cool stuff, right?'
      }
    };

    return connectors[style] || connectors.developer;
  }

  /**
   * Get comprehensive introduction based on style
   */
  getComprehensiveIntro(style, query) {
    const intros = {
      hr: 'Regarding your question about my background,',
      developer: 'Great question! Let me break that down for you.',
      friend: 'Oh, that\'s a good one! 😊 Let me tell you about that.'
    };

    return intros[style] || intros.developer;
  }

  /**
   * Get comparison introduction based on style
   */
  getComparisonIntro(style) {
    const intros = {
      hr: 'I have experience with both areas.',
      developer: 'I\'ve worked with both of those.',
      friend: 'Oh, I know both of those! 😄'
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
    const contextualConnection = this.findContextualConnection(context, relevantSections);

    if (contextualConnection) {
      const contextualPhrases = {
        hr: 'Building on our previous discussion, ',
        developer: 'Following up on that, ',
        friend: 'Oh, and speaking of what we talked about, '
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
    const currentSectionIds = relevantSections.map(s => s.sectionId);
    const previousSectionIds = lastEntry.matchedSections.map(s => s.id || s);

    return currentSectionIds.some(id =>
      previousSectionIds.some(prevId => this.areSectionsRelated(id, prevId))
    );
  }

  /**
   * Check if two sections are related
   */
  areSectionsRelated(sectionId1, sectionId2) {
    // Simple relationship check - could be enhanced with more sophisticated logic
    if (sectionId1 === sectionId2) return true;

    // Check if they're in the same category
    const category1 = sectionId1.split('_')[0];
    const category2 = sectionId2.split('_')[0];

    return category1 === category2;
  }

  /**
   * Get appropriate "no match" response based on style
   */
  getNoMatchResponse(style) {
    const responses = {
      hr: "I don't have specific information about that in my professional background. Could you rephrase your question or ask about my experience, skills, or projects?",
      developer: "Hmm, I'm not sure I have relevant experience with that specific topic. Could you try rephrasing or ask about something else from my background?",
      friend: "Oops! 🤔 I'm not sure I can help with that one. Maybe try asking about my projects, skills, or work experience? I'd love to share more about those!"
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
        friend: "Oh, and speaking of that, "
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
      metrics: response.metrics || {}
    };

    // Check response length (too short might indicate poor matching)
    if (response.answer.length < 20) {
      validation.confidence = Math.max(0, validation.confidence - 0.1);
      validation.metrics.qualityFlags = ['short_response'];
    }

    // Check if response actually addresses the query
    const queryRelevance = this.assessQueryRelevance(response.answer, originalQuery);
    if (queryRelevance < 0.5) {
      validation.confidence = Math.max(0, validation.confidence - 0.15);
      validation.metrics.qualityFlags = validation.metrics.qualityFlags || [];
      validation.metrics.qualityFlags.push('low_relevance');
    }

    // Ensure minimum confidence threshold for quality responses
    if (validation.confidence < 0.3) {
      validation.answer = this.getFallbackResponse(originalQuery);
      validation.confidence = 0.2; // Low but not zero to indicate fallback
      validation.matchedSections = [];
      validation.metrics.qualityFlags = validation.metrics.qualityFlags || [];
      validation.metrics.qualityFlags.push('fallback_triggered');
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
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const responseWords = response.toLowerCase().split(/\s+/);

    let matches = 0;
    queryWords.forEach(word => {
      if (responseWords.some(respWord => respWord.includes(word) || word.includes(respWord))) {
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
    const sectionScore = Math.min(0.1, validation.matchedSections.length * 0.03);
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
      friend: " Oh, and I've also dabbled in "
    };

    const connector = connectors[style] || connectors.developer;
    const relatedTopics = relatedSections
      .map(match => match.section.keywords?.[0] || 'related technologies')
      .join(', ');

    return response + connector + relatedTopics + ".";
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
self.onmessage = async function(event) {
  const { type, message, context, style, modelPath, cvData } = event.data;

  try {
    switch (type) {
      case 'initialize':
        await mlWorker.initialize(cvData);
        break;

      case 'process_query':
        await mlWorker.processQuery(
          message,
          context || [],
          style || 'developer'
        );
        break;

      case 'ping':
        mlWorker.postMessage({ type: 'pong' });
        break;

      default:
        console.warn('Unknown message type:', type);
        mlWorker.postMessage({
          type: 'error',
          error: `Unknown message type: ${type}`
        });
    }
  } catch (error) {
    console.error('Worker error:', error);
    mlWorker.postMessage({
      type: 'error',
      error: error.message
    });
  }
};

// Handle worker errors
self.onerror = function(error) {
  console.error('Worker error:', error);
  self.postMessage({
    type: 'error',
    error: error.message || 'Unknown worker error'
  });
};

// Handle unhandled promise rejections
self.onunhandledrejection = function(event) {
  console.error('Unhandled promise rejection in worker:', event.reason);
  self.postMessage({
    type: 'error',
    error: event.reason?.message || 'Unhandled promise rejection'
  });
};
