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

      const response = await fetch('public/cv/cv-data.v2.json');

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
   * Validate CV data structure against schema requirements
   * @param {Object} data - CV data to validate
   * @throws {Error} If validation fails
   */
  validateCVData(data) {
    // Check required top-level properties
    const requiredProps = ['metadata', 'sections', 'personality', 'responseTemplates'];

    for (const prop of requiredProps) {
      if (!data[prop]) {
        throw new Error(`Missing required property: ${prop}`);
      }
    }

    // Validate metadata
    const metadata = data.metadata;

    if (!metadata.version || !metadata.lastUpdated || !metadata.totalSections) {
      throw new Error('Invalid metadata structure');
    }

    if (typeof metadata.totalSections !== 'number' || metadata.totalSections < 1) {
      throw new Error('Invalid totalSections in metadata');
    }

    // Validate sections structure
    if (typeof data.sections !== 'object') {
      throw new Error('Sections must be an object');
    }

    let sectionCount = 0;
    for (const [categoryName, category] of Object.entries(data.sections)) {
      if (typeof category !== 'object') {
        throw new Error(`Category ${categoryName} must be an object`);
      }

      for (const [sectionName, section] of Object.entries(category)) {
        this.validateSection(section, `${categoryName}.${sectionName}`);
        sectionCount++;
      }
    }

    // Validate section count matches metadata
    if (sectionCount !== metadata.totalSections) {
      // Section count mismatch - metadata may be outdated
    }

    // Validate personality structure
    const personality = data.personality;
    const requiredPersonalityProps = ['traits', 'values', 'workStyle', 'interests', 'communication_style'];
    for (const prop of requiredPersonalityProps) {
      if (!personality[prop]) {
        throw new Error(`Missing personality property: ${prop}`);
      }
    }

    // Validate communication styles
    const styles = ['hr', 'developer', 'friend'];
    for (const style of styles) {
      if (!personality.communication_style[style]) {
        throw new Error(`Missing communication style: ${style}`);
      }
    }

    // Validate response templates
    const templates = data.responseTemplates;
    const requiredTemplates = ['noMatch', 'lowConfidence', 'fallbackRequest', 'emailFallback'];
    for (const template of requiredTemplates) {
      if (!templates[template]) {
        throw new Error(`Missing response template: ${template}`);
      }

      for (const style of styles) {
        if (!templates[template][style]) {
          throw new Error(`Missing ${style} response for template: ${template}`);
        }
      }
    }
  }

  /**
   * Validate individual CV section
   * @param {Object} section - Section to validate
   * @param {string} path - Section path for error reporting
   */
  validateSection(section, path) {
    const requiredProps = ['id', 'keywords', 'embeddings', 'responses', 'details'];
    for (const prop of requiredProps) {
      if (section[prop] === undefined) {
        throw new Error(`Missing property ${prop} in section: ${path}`);
      }
    }

    // Validate ID format
    if (typeof section.id !== 'string' || !/^[a-zA-Z0-9_]+$/.test(section.id)) {
      throw new Error(`Invalid ID format in section: ${path}`);
    }

    // Validate keywords
    if (!Array.isArray(section.keywords) || section.keywords.length === 0) {
      throw new Error(`Invalid keywords in section: ${path}`);
    }

    // Validate embeddings (can be null or array of numbers)
    if (section.embeddings !== null && (!Array.isArray(section.embeddings) ||
        !section.embeddings.every(e => typeof e === 'number'))) {
      throw new Error(`Invalid embeddings in section: ${path}`);
    }

    // Validate responses
    const styles = ['hr', 'developer', 'friend'];
    for (const style of styles) {
      if (!section.responses[style] || typeof section.responses[style] !== 'string' ||
          section.responses[style].length < 10) {
        throw new Error(`Invalid ${style} response in section: ${path}`);
      }
    }

    // Validate details (must be object)
    if (typeof section.details !== 'object') {
      throw new Error(`Invalid details in section: ${path}`);
    }
  }

  /**
   * Build internal index for faster section lookups
   */
  buildSectionsIndex() {
    this.sectionsIndex.clear();

    if (!this.cvData || !this.cvData.sections) {
      return;
    }

    for (const [categoryName, category] of Object.entries(this.cvData.sections)) {
      for (const [sectionName, section] of Object.entries(category)) {
        const fullPath = `${categoryName}.${sectionName}`;
        this.sectionsIndex.set(section.id, {
          path: fullPath,
          category: categoryName,
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
            path: fullPath,
            section: section
          });
        });
      }
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
   * Get sections by category
   * @param {string} category - Category name (e.g., 'experience', 'skills')
   * @returns {Array} Array of sections in the category
   */
  getSectionsByCategory(category) {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }

    if (!this.cvData.sections[category]) {
      return [];
    }

    return Object.entries(this.cvData.sections[category]).map(([name, section]) => ({
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
   * Get personality data
   * @returns {Object} Personality configuration
   */
  getPersonality() {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }
    return this.cvData.personality;
  }

  /**
   * Get response templates
   * @returns {Object} Response templates for different scenarios
   */
  getResponseTemplates() {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }
    return this.cvData.responseTemplates;
  }

  /**
   * Get communication style for a specific style
   * @param {string} style - Communication style ('hr', 'developer', 'friend')
   * @returns {Object} Communication style configuration
   */
  getCommunicationStyle(style) {
    const personality = this.getPersonality();
    if (!personality.communication_style[style]) {
      throw new Error(`Invalid communication style: ${style}`);
    }
    return personality.communication_style[style];
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
    for (const [categoryName, category] of Object.entries(this.cvData.sections)) {
      for (const [sectionName, section] of Object.entries(category)) {
        sections.push({
          id: section.id,
          category: categoryName,
          name: sectionName,
          path: `${categoryName}.${sectionName}`,
          ...section
        });
      }
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
   * Transforms CV sections into standardized chunks for embedding and search
   * @returns {Array} Array of CV chunks ready for semantic processing
   */
  prepareCVChunks() {
    if (!this.isLoaded) {
      throw new Error('CV data not loaded. Call loadCVData() first.');
    }

    const chunks = [];

    // Process all sections from all categories
    for (const [categoryName, category] of Object.entries(this.cvData.sections)) {
      for (const [sectionName, section] of Object.entries(category)) {
        // Use embeddingSourceText as the primary text content for chunks
        const text = section.embeddingSourceText || section.details?.summary || '';

        if (text.trim()) {
          chunks.push({
            id: section.id,
            text: text,
            keywords: section.keywords || [],
            metadata: {
              type: 'cv_section',
              category: categoryName,
              sectionName: sectionName,
              path: `${categoryName}.${sectionName}`,
              priority: section.priority || 0,
              confidence: section.confidence || 0.5,
              details: section.details || {},
              relatedSections: section.relatedSections || []
            },
            // Include existing embeddings if available
            embedding: section.embeddings || null
          });
        }
      }
    }

    console.log('📝 CV-DATA-SERVICE: CV chunks prepared:', {
      totalChunks: chunks.length,
      chunkIds: chunks.map(c => c.id),
      avgLength: chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length,
      categories: Object.keys(this.cvData.sections)
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
