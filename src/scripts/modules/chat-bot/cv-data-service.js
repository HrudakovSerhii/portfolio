/**
 * CV Data Service Module
 * Handles loading, validation, and management of CV data for the chatbot
 */

class CVDataService {
  constructor() {
    this.cvData = null;
    this.isLoaded = false;
    this.embeddingsCache = new Map();
    this.sectionsIndex = new Map();
  }

  /**
   * Load CV data from JSON file
   * @returns {Promise<Object>} Loaded and validated CV data
   */
  async loadCVData() {
    try {
      if (this.isLoaded && this.cvData) {
        return this.cvData;
      }

      const response = await fetch('./cv/cv-data.json');

      if (!response.ok) {
        throw new Error(`Failed to load CV data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Validate the loaded data
      this.validateCVData(data);

      this.cvData = data;
      this.isLoaded = true;

      // Build sections index for faster lookups
      this.buildSectionsIndex();

      return this.cvData;
    } catch (error) {
      throw new Error(`CV data loading failed: ${error.message}`);
    }
  }

  /**
   * Validate CV data structure against knowledge_base format
   * @param {Object} data - CV data to validate
   * @throws {Error} If validation fails
   */
  validateCVData(data) {
    // Check required top-level properties for knowledge_base format
    const requiredProps = ['metadata', 'knowledge_base', 'communication_styles', 'fallback_responses'];

    for (const prop of requiredProps) {
      if (!data[prop]) {
        throw new Error(`Missing required property: ${prop}`);
      }
    }

    // Validate metadata
    const metadata = data.metadata;

    if (!metadata.version || !metadata.lastUpdated) {
      throw new Error('Invalid metadata structure');
    }

    // Validate knowledge_base structure
    if (typeof data.knowledge_base !== 'object') {
      throw new Error('knowledge_base must be an object');
    }

    let sectionCount = 0;
    for (const [sectionName, section] of Object.entries(data.knowledge_base)) {
      this.validateKnowledgeBaseSection(section, sectionName);
      sectionCount++;
    }

    // Validate communication styles
    const communicationStyles = data.communication_styles;
    const styles = ['hr', 'developer', 'friend'];
    for (const style of styles) {
      if (!communicationStyles[style]) {
        throw new Error(`Missing communication style: ${style}`);
      }
      if (!communicationStyles[style].tone || !communicationStyles[style].greeting) {
        throw new Error(`Invalid communication style structure for: ${style}`);
      }
    }

    // Validate fallback responses
    const fallbackResponses = data.fallback_responses;
    const requiredFallbacks = ['no_match', 'low_confidence'];
    for (const fallback of requiredFallbacks) {
      if (!fallbackResponses[fallback]) {
        throw new Error(`Missing fallback response: ${fallback}`);
      }

      for (const style of styles) {
        if (!fallbackResponses[fallback][style]) {
          throw new Error(`Missing ${style} response for fallback: ${fallback}`);
        }
      }
    }
  }

  /**
   * Validate individual knowledge base section
   * @param {Object} section - Section to validate
   * @param {string} sectionName - Section name for error reporting
   */
  validateKnowledgeBaseSection(section, sectionName) {
    const requiredProps = ['keywords', 'content', 'details'];
    for (const prop of requiredProps) {
      if (section[prop] === undefined) {
        throw new Error(`Missing property ${prop} in knowledge_base section: ${sectionName}`);
      }
    }

    // Validate keywords
    if (!Array.isArray(section.keywords) || section.keywords.length === 0) {
      throw new Error(`Invalid keywords in knowledge_base section: ${sectionName}`);
    }

    // Validate content
    if (typeof section.content !== 'string' || section.content.length < 10) {
      throw new Error(`Invalid content in knowledge_base section: ${sectionName}`);
    }

    // Validate details (must be object)
    if (typeof section.details !== 'object') {
      throw new Error(`Invalid details in knowledge_base section: ${sectionName}`);
    }
  }

  /**
   * Build internal index for faster section lookups
   */
  buildSectionsIndex() {
    this.sectionsIndex.clear();

    if (!this.cvData || !this.cvData.knowledge_base) {
      return;
    }

    for (const [sectionName, section] of Object.entries(this.cvData.knowledge_base)) {
      this.sectionsIndex.set(sectionName, {
        path: `knowledge_base.${sectionName}`,
        category: 'knowledge_base',
        name: sectionName,
        section: section
      });

      // Also index by keywords for faster searching
      section.keywords.forEach(keyword => {
        const normalizedKeyword = keyword.toLowerCase();
        if (!this.sectionsIndex.has(`keyword:${normalizedKeyword}`)) {
          this.sectionsIndex.set(`keyword:${normalizedKeyword}`, []);
        }
        this.sectionsIndex.get(`keyword:${normalizedKeyword}`).push({
          path: `knowledge_base.${sectionName}`,
          section: section
        });
      });
    }
  }

  /**
   * Get section by ID
   * @param {string} sectionId - Section ID to retrieve
   * @returns {Object|null} Section data or null if not found
   */
  getSectionById(sectionId) {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }

    const indexEntry = this.sectionsIndex.get(sectionId);
    return indexEntry ? indexEntry.section : null;
  }

  /**
   * Get sections by category (for knowledge_base format, returns all sections)
   * @param {string} category - Category name (ignored for knowledge_base format)
   * @returns {Array} Array of sections in the knowledge base
   */
  getSectionsByCategory(category) {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }

    // For knowledge_base format, return all sections regardless of category
    return Object.entries(this.cvData.knowledge_base).map(([name, section]) => ({
      name,
      ...section
    }));
  }

  /**
   * Find sections by keywords
   * @param {Array<string>} keywords - Keywords to search for
   * @returns {Array} Array of matching sections with relevance scores
   */
  findSectionsByKeywords(keywords) {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }

    const matches = new Map();

    keywords.forEach(keyword => {
      const normalizedKeyword = keyword.toLowerCase();
      const keywordMatches = this.sectionsIndex.get(`keyword:${normalizedKeyword}`);

      if (keywordMatches) {
        keywordMatches.forEach(match => {
          const existing = matches.get(match.path);
          if (existing) {
            existing.score += 1;
            existing.matchedKeywords.push(keyword);
          } else {
            matches.set(match.path, {
              ...match,
              score: 1,
              matchedKeywords: [keyword]
            });
          }
        });
      }
    });

    // Convert to array and sort by relevance score
    return Array.from(matches.values())
      .sort((a, b) => b.score - a.score)
      .map(match => ({
        section: match.section,
        path: match.path,
        relevanceScore: match.score / keywords.length,
        matchedKeywords: match.matchedKeywords
      }));
  }

  /**
   * Get embeddings for a section
   * @param {string} sectionId - Section ID
   * @returns {Array<number>|null} Embeddings array or null if not available
   */
  getEmbeddings(sectionId) {
    const section = this.getSectionById(sectionId);

    return section ? section.embeddings : null;
  }

  /**
   * Cache embeddings for a section
   * @param {string} sectionId - Section ID
   * @param {Array<number>} embeddings - Computed embeddings
   */
  cacheEmbeddings(sectionId, embeddings) {
    if (!Array.isArray(embeddings) || !embeddings.every(e => typeof e === 'number')) {
      throw new Error('Invalid embeddings format');
    }

    this.embeddingsCache.set(sectionId, embeddings);

    // Also update the section data if it exists
    const section = this.getSectionById(sectionId);
    if (section) {
      section.embeddings = embeddings;
    }
  }

  /**
   * Get cached embeddings
   * @param {string} sectionId - Section ID
   * @returns {Array<number>|null} Cached embeddings or null
   */
  getCachedEmbeddings(sectionId) {
    return this.embeddingsCache.get(sectionId) || null;
  }

  /**
   * Get communication styles data
   * @returns {Object} Communication styles configuration
   */
  getCommunicationStyles() {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }
    return this.cvData.communication_styles;
  }

  /**
   * Get fallback response templates
   * @returns {Object} Fallback response templates for different scenarios
   */
  getFallbackResponses() {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }
    return this.cvData.fallback_responses;
  }

  /**
   * Get communication style for a specific style
   * @param {string} style - Communication style ('hr', 'developer', 'friend')
   * @returns {Object} Communication style configuration
   */
  getCommunicationStyle(style) {
    const communicationStyles = this.getCommunicationStyles();
    if (!communicationStyles[style]) {
      throw new Error(`Invalid communication style: ${style}`);
    }
    return communicationStyles[style];
  }

  /**
   * Get all available sections as a flat array
   * @returns {Array} All sections with metadata
   */
  getAllSections() {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }

    const sections = [];
    for (const [sectionName, section] of Object.entries(this.cvData.knowledge_base)) {
      sections.push({
        id: sectionName,
        category: 'knowledge_base',
        name: sectionName,
        path: `knowledge_base.${sectionName}`,
        ...section
      });
    }
    return sections;
  }

  /**
   * Get metadata about the CV data
   * @returns {Object} CV data metadata
   */
  getMetadata() {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }
    return this.cvData.metadata;
  }

  /**
   * Prepare CV data chunks for semantic processing
   * Transforms knowledge_base sections into standardized chunks for embedding and search
   * @returns {Array} Array of CV chunks ready for semantic processing
   */
  prepareCVChunks() {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }

    const chunks = [];

    // Process all sections from knowledge_base
    for (const [sectionName, section] of Object.entries(this.cvData.knowledge_base)) {
      // Use content as the primary text content for chunks
      const text = section.content || '';
      
      if (text.trim()) {
        chunks.push({
          id: sectionName,
          text: text,
          keywords: section.keywords || [],
          metadata: {
            type: 'knowledge_base',
            category: 'knowledge_base',
            sectionName: sectionName,
            path: `knowledge_base.${sectionName}`,
            priority: 1, // Default priority for knowledge_base items
            confidence: 1.0, // Default confidence for knowledge_base items
            details: section.details || {}
          },
          // Include existing embeddings if available (null for knowledge_base format)
          embedding: null
        });
      }
    }

    console.log('📝 CV-DATA-SERVICE: CV chunks prepared:', {
      totalChunks: chunks.length,
      chunkIds: chunks.map(c => c.id),
      avgLength: chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length,
      knowledgeBaseKeys: Object.keys(this.cvData.knowledge_base)
    });

    return chunks;
  }

  /**
   * Check if CV data is loaded
   * @returns {boolean} True if data is loaded
   */
  isDataLoaded() {
    return this.isLoaded && this.cvData !== null;
  }

  /**
   * Clear all cached data and reset service
   */
  reset() {
    this.cvData = null;
    this.isLoaded = false;
    this.embeddingsCache.clear();
    this.sectionsIndex.clear();
  }
}

export default CVDataService;
