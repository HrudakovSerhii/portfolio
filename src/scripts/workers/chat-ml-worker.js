/**
 * ML Worker for DistilBERT processing
 * Handles model loading, embedding generation, and semantic similarity computation
 */

import { pipeline, env } from '@huggingface/transformers';

// Configure Transformers.js environment for web worker
env.allowRemoteModels = true;
env.allowLocalModels = false;

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
    try {
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
      // Generate embedding for the user query
      const queryEmbedding = await this.generateEmbedding(message.toLowerCase());

      // Find relevant sections using semantic similarity
      const relevantSections = await this.findRelevantSections(queryEmbedding, 0.7);

      // Generate response based on matched sections and style
      const response = this.generateResponse(relevantSections, message, context, style);

      this.postMessage({
        type: 'response',
        answer: response.answer,
        confidence: response.confidence,
        matchedSections: response.matchedSections,
        query: message
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
   * Find relevant CV sections using cosine similarity
   */
  async findRelevantSections(queryEmbedding, threshold = 0.7) {
    const similarities = [];

    for (const [sectionId, sectionData] of this.cvEmbeddings.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, sectionData.embedding);
      
      if (similarity >= threshold) {
        similarities.push({
          sectionId: sectionId,
          similarity: similarity,
          section: sectionData.section,
          category: sectionData.category,
          key: sectionData.key
        });
      }
    }

    // Sort by similarity score (highest first)
    return similarities.sort((a, b) => b.similarity - a.similarity);
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
   * Generate response based on matched sections and conversation style
   */
  generateResponse(relevantSections, query, context, style) {
    if (relevantSections.length === 0) {
      return {
        answer: this.getNoMatchResponse(style),
        confidence: 0,
        matchedSections: []
      };
    }

    // Get the best matching section
    const bestMatch = relevantSections[0];
    const section = bestMatch.section;

    // Get style-appropriate response
    let response = section.responses[style] || section.responses.developer || 'I have experience in this area.';

    // Add context awareness if there are previous messages
    if (context.length > 0) {
      response = this.addContextualElements(response, context, style);
    }

    // If multiple sections are relevant, mention related areas
    if (relevantSections.length > 1) {
      response = this.addRelatedSections(response, relevantSections.slice(1, 3), style);
    }

    return {
      answer: response,
      confidence: bestMatch.similarity,
      matchedSections: relevantSections.slice(0, 3).map(match => ({
        id: match.sectionId,
        category: match.category,
        similarity: match.similarity
      }))
    };
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
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'initialize':
        await mlWorker.initialize(data.cvData);
        break;

      case 'process_query':
        await mlWorker.processQuery(
          data.message,
          data.context || [],
          data.style || 'developer'
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