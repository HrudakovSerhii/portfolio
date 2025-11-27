/**
 * Section display order
 * @constant {CVSection[]}
 */
const SECTION_ORDER = ['hero', 'about', 'skills', 'experience', 'projects', 'contact'];

/**
 * @typedef {'light'|'dark'} Theme
 * Available theme modes
 */

/**
 * @typedef {Object} ThemeContextType
 * @property {Theme} theme - Current theme mode
 * @property {() => void} toggleTheme - Function to toggle between themes
 */

/**
 * @typedef {Object} CVMetadata
 * @property {string} version - Schema version (e.g., "4.0")
 * @property {string} lastUpdated - Last update date in YYYY-MM-DD format
 * @property {string} embeddingModel - Model used for generating embeddings (e.g., "Xenova/all-MiniLM-L6-v2")
 * @property {string} strategy - Retrieval strategy description
 * @property {string} description - Schema description and purpose
 */

/**
 * @typedef {Object} ContextData
 * @property {string} hr - Professional, achievement-focused response for HR/recruiters
 * @property {string} developer - Technical, detailed response for fellow developers
 * @property {string} friend - Casual, enthusiastic response for informal conversations
 */

/**
 * @typedef {Object} CVSection
 * @property {string} id - Unique identifier for this section
 * @property {string[]} keywords - Primary keywords for semantic matching
 * @property {string} embeddingSourceText - Dense, keyword-rich text for embedding generation
 * @property {ContextData} context_data - Pre-written responses for each communication style
 */

/**
 * @typedef {Object.<string, CVSection>} CVSections
 * Flat object containing all CV sections indexed by section ID
 */

/**
 * @typedef {Object} CVData
 * @property {string} $schema - JSON schema reference
 * @property {CVMetadata} metadata - Schema metadata and configuration
 * @property {CVSections} sections - Flat object containing all CV sections
 */

// Export types and constants for JSDoc usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SECTION_ORDER
  };
}
