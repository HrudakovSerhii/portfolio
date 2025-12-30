/**
 * CV Data Service Module
 * Handles loading, validation, and management of precomputed CV embeddings for RAG
 *
 * Architecture:
 * - Loads role-specific precomputed embeddings from public/data/embeddings-{role}.json
 * - Expected format: Array of chunks with precomputed 384-dim embeddings
 * - No client-side embedding generation for CV data (done at build time)
 * - Supports role switching by loading different embedding files
 *
 * Change History:
 * 2025-12-30: Refactored for RAG architecture (457 lines → 163 lines, 64% reduction)
 *   - Added role parameter to loadCVData(role)
 *   - Fetch from public/data/embeddings-{role}.json
 *   - Simplified validation (chunks are pre-validated at build time)
 *   - Removed complex keyword/section indexing (not needed for vector search)
 *   - prepareCVChunks() returns loaded chunks directly
 *
 * Removed Methods (no longer needed for RAG):
 *   - validateCVData() - Complex validation for old nested CV data format
 *   - validateSection() - Per-section validation for old format
 *   - buildSectionsIndex() - Keyword/section indexing (replaced by vector search)
 *   - getSectionById() - Section lookup (chunks accessed via prepareCVChunks())
 *   - getSectionsByCategory() - Category filtering (not applicable to flat chunks)
 *   - findSectionsByKeywords() - Keyword search (replaced by vector similarity)
 *   - getEmbeddings() - Direct embedding access (chunks have embeddings property)
 *   - cacheEmbeddings() - Embedding cache (embeddings precomputed, no runtime caching)
 *   - getCachedEmbeddings() - Cache retrieval (not needed)
 *   - getPersonality() - Personality config (not used in RAG approach)
 *   - getResponseTemplates() - Response templates (handled by LLM)
 *   - getCommunicationStyle() - Style config (managed by ConversationStyleManager)
 *   - getAllSections() - Section enumeration (use prepareCVChunks() instead)
 */

// Constants
const VALID_ROLES = ['hr', 'developer', 'friend'];
const EXPECTED_EMBEDDING_DIM = 384; // all-MiniLM-L6-v2 dimension

class CVDataService {
  constructor() {
    // Store loaded data as object with role metadata
    this.cvData = null; // { role: string, chunks: Array }
  }

  /**
   * Load role-specific CV embeddings from precomputed file
   * @param {string} role - Conversation role: 'hr', 'developer', or 'friend'
   * @returns {Promise<Array>} Loaded CV chunks with embeddings
   */
  async loadCVData(role) {
    this.validateRole(role);

    // Return cached data if already loaded for this role
    if (this.cvData && this.cvData.role === role) {
      return this.cvData.chunks;
    }

    try {
      const chunks = await this.fetchEmbeddings(role);
      this.validateChunks(chunks);

      // Store with role metadata
      this.cvData = { role, chunks };

      return chunks;
    } catch (error) {
      this.handleLoadError(error, role);
    }
  }

  /**
   * Validate role parameter
   * @param {string} role - Role to validate
   * @throws {Error} If role is invalid
   */
  validateRole(role) {
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);
    }
  }

  /**
   * Fetch embeddings file for specific role
   * @param {string} role - Role to fetch embeddings for
   * @returns {Promise<Array>} Parsed chunks array
   * @throws {Error} If fetch fails
   */
  async fetchEmbeddings(role) {
    const embeddingsPath = `public/data/embeddings-${role}.json`;
    const response = await fetch(embeddingsPath);

    if (!response.ok) {
      throw new Error(`Failed to load embeddings: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Handle load errors with context
   * @param {Error} error - Original error
   * @param {string} role - Role that failed to load
   * @throws {Error} Enhanced error with context
   */
  handleLoadError(error, role) {
    console.error(`[CVDataService] Failed to load CV data for role ${role}:`, error);
    throw new Error(`CV data loading failed: ${error.message}`);
  }

  /**
   * Validate chunks array structure
   * @param {Array} chunks - Chunks to validate
   * @throws {Error} If validation fails
   */
  validateChunks(chunks) {
    this.validateChunksArray(chunks);
    this.validateChunkStructure(chunks[0]);
  }

  /**
   * Validate that chunks is a non-empty array
   * @param {Array} chunks - Chunks to validate
   * @throws {Error} If not a valid array
   */
  validateChunksArray(chunks) {
    if (!Array.isArray(chunks)) {
      throw new Error('CV data must be an array of chunks');
    }

    if (chunks.length === 0) {
      throw new Error('CV data array is empty');
    }
  }

  /**
   * Validate chunk structure using first chunk as sample
   * @param {Object} sampleChunk - First chunk to validate
   * @throws {Error} If structure is invalid
   */
  validateChunkStructure(sampleChunk) {
    // Validate required properties
    const requiredProps = ['id', 'text', 'embedding'];
    for (const prop of requiredProps) {
      if (!(prop in sampleChunk)) {
        throw new Error(`Chunk missing required property: ${prop}`);
      }
    }

    // Validate ID
    if (typeof sampleChunk.id !== 'string' || sampleChunk.id.length === 0) {
      throw new Error('Chunk ID must be a non-empty string');
    }

    // Validate text
    if (typeof sampleChunk.text !== 'string' || sampleChunk.text.length === 0) {
      throw new Error('Chunk text must be a non-empty string');
    }

    // Validate embedding array
    this.validateEmbedding(sampleChunk.embedding);
  }

  /**
   * Validate embedding array
   * @param {Array} embedding - Embedding to validate
   * @throws {Error} If embedding is invalid
   */
  validateEmbedding(embedding) {
    if (!Array.isArray(embedding)) {
      throw new Error('Chunk embedding must be an array');
    }

    if (embedding.length === 0) {
      throw new Error('Chunk embedding array is empty');
    }

    if (!embedding.every(val => typeof val === 'number')) {
      throw new Error('Chunk embedding must contain only numbers');
    }

    // Warn if dimension doesn't match expected
    if (embedding.length !== EXPECTED_EMBEDDING_DIM) {
      console.warn(`[CVDataService] Warning: Expected embedding dimension ${EXPECTED_EMBEDDING_DIM}, got ${embedding.length}`);
    }
  }

  /**
   * Prepare CV chunks for semantic processing
   * For precomputed embeddings, this returns the loaded chunks directly
   * @returns {Array} Array of CV chunks ready for semantic processing
   * @throws {Error} If data not loaded
   */
  prepareCVChunks() {
    if (!this.isDataLoaded()) {
      throw new Error('CV data not loaded. Call loadCVData(role) first.');
    }

    // Chunks are already prepared with embeddings from build time
    return this.cvData.chunks;
  }

  /**
   * Check if CV data is loaded
   * @returns {boolean} True if data is loaded
   */
  isDataLoaded() {
    return this.cvData !== null && Array.isArray(this.cvData.chunks);
  }

  /**
   * Get metadata about loaded data
   * @returns {Object} Metadata including role, chunk count, embedding dimension
   * @throws {Error} If data not loaded
   */
  getMetadata() {
    if (!this.isDataLoaded()) {
      throw new Error('CV data not loaded. Call loadCVData(role) first.');
    }

    return {
      role: this.cvData.role,
      chunkCount: this.cvData.chunks.length,
      embeddingDimension: this.cvData.chunks[0]?.embedding?.length || 0,
      isLoaded: true
    };
  }

  /**
   * Clear all cached data and reset service
   */
  reset() {
    this.cvData = null;
  }
}

export default CVDataService;