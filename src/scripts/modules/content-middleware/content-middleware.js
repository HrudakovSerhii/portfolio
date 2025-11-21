/// <reference path="../types/content.types.js" />

// Import universal fetch utility
// import { universalFetch } from '../utils/fetch-polyfill.js';

/**
 * ContentMiddleware - Abstracts content retrieval to enable future chatbot integration
 *
 * This middleware layer provides a promise-based API for fetching role-based content.
 * The initial implementation uses JSON files, but the interface is designed to allow
 * future replacement with a chatbot API without requiring UI changes.
 */
class ContentMiddleware {
  /**
   * @param {string} dataSourceUrl - URL to the JSON data source
   */
  constructor(dataSourceUrl = '/data/content.json') {
    this.dataSourceUrl = dataSourceUrl;
    /** @type {PortfolioData|null} */
    this.contentData = null;
    /** @type {Promise<PortfolioData>|null} */
    this.loadPromise = null;
  }

  /**
   * Get fetch function (native or polyfill)
   * @private
   * @returns {Function} Fetch function
   */
  _getFetch() {
    // Use universalFetch if available (from fetch-polyfill.js)
    if (typeof universalFetch !== 'undefined') {
      return universalFetch;
    }
    // Use native fetch if available
    if (typeof fetch !== 'undefined') {
      return fetch;
    }
    // No fetch available
    throw new Error('No fetch implementation available. Please include fetch-polyfill.js or use a modern browser.');
  }

  /**
   * Load content data from JSON source
   * @private
   * @returns {Promise<PortfolioData>} Loaded content data
   */
  async _loadContentData() {
    if (this.contentData) {
      return this.contentData;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    try {
      const fetchFn = this._getFetch();

      this.loadPromise = fetchFn(this.dataSourceUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load content: ${response.status} ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          this.contentData = data;
          return data;
        })
        .catch(error => {
          this.loadPromise = null;
          throw error;
        });

      return this.loadPromise;
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  /**
   * Fetch section content based on role and optional custom query
   * @param {string} sectionId - Section identifier (hero, about, skills, etc.)
   * @param {string} role - User role (recruiter, developer, friend)
   * @param {string} [customQuery] - Optional custom query for personalized content
   * @returns {Promise<SectionContent>} Section content object
   */
  async fetchSectionContent(sectionId, role, customQuery = null) {
    try {
      const data = await this._loadContentData();

      if (!data.sections || !data.sections[sectionId]) {
        throw new Error(`Section "${sectionId}" not found in content data`);
      }

      const section = data.sections[sectionId];

      if (!section.content || !section.content[role]) {
        throw new Error(`Content for role "${role}" not found in section "${sectionId}"`);
      }

      const roleContent = section.content[role];

      return {
        sectionId,
        title: section.metadata.title,
        text: roleContent.text,
        imageUrl: roleContent.imageUrl,
        imageAlt: roleContent.imageAlt,
        aspectRatio: roleContent.aspectRatio,
        customQuery: customQuery || null
      };
    } catch (error) {
      console.error(`Error fetching content for section "${sectionId}":`, error);

      // Return fallback content instead of throwing
      return this._getFallbackContent(sectionId, error);
    }
  }

  /**
   * Generate fallback content when loading fails
   * @private
   * @param {string} sectionId - Section identifier
   * @param {Error} error - Original error
   * @returns {SectionContent} Fallback content object
   */
  _getFallbackContent(sectionId, error) {
    // Only use title from loaded data - no hardcoded fallbacks
    // This ensures we know immediately if content.json failed to load
    const title = this.contentData?.sections?.[sectionId]?.metadata?.title || '⚠️ ERROR: Content Not Loaded';

    return {
      sectionId,
      title,
      text: `⚠️ CONTENT LOADING ERROR: Failed to load content for section "${sectionId}". Error: ${error.message}. Please check that /data/content.json is accessible and properly formatted.`,
      imageUrl: '/images/placeholder.svg',
      imageAlt: 'Content unavailable - loading error',
      aspectRatio: 'aspect-video',
      customQuery: null,
      isError: true,
      errorMessage: error.message
    };
  }

  /**
   * Get placeholder text for action prompts from section metadata
   * Uses main_items array from section metadata to generate contextual placeholders
   * @param {string} sectionId - Section identifier
   * @returns {Promise<string>} Placeholder text
   */
  async getActionPromptPlaceholder(sectionId) {
    try {
      const data = await this._loadContentData();

      if (!data.sections || !data.sections[sectionId]) {
        console.warn(`Section "${sectionId}" not found for placeholder`);
        return this._getDefaultPlaceholder(sectionId);
      }

      const section = data.sections[sectionId];

      // Use main_items array if available
      if (section.metadata.main_items && section.metadata.main_items.length > 0) {
        return section.metadata.main_items.join(', ');
      }

      // Default placeholder based on section title
      return `Ask about ${section.metadata.title}...`;
    } catch (error) {
      console.error(`Error getting placeholder for section "${sectionId}":`, error);
      return this._getDefaultPlaceholder(sectionId);
    }
  }

  /**
   * Get default placeholder when data loading fails
   * @private
   * @param {string} sectionId - Section identifier
   * @returns {string} Default placeholder text
   */
  _getDefaultPlaceholder(sectionId) {
    const defaults = {
      hero: 'Tell me about yourself...',
      about: 'What\'s your background?',
      skills: 'What are your skills?',
      experience: 'Tell me about your experience...',
      projects: 'What have you built?',
      contact: 'How can I reach you?'
    };

    return defaults[sectionId] || 'Ask me anything...';
  }

  /**
   * Get section metadata (title, icon, order)
   * @param {string} sectionId - Section identifier
   * @returns {Promise<SectionMetadata>} Section metadata object
   */
  async getSectionMetadata(sectionId) {
    try {
      const data = await this._loadContentData();

      if (!data.sections || !data.sections[sectionId]) {
        throw new Error(`Section "${sectionId}" not found in content data`);
      }

      const section = data.sections[sectionId];

      return {
        id: sectionId,
        title: section.metadata.title,
        icon: section.metadata.icon,
        order: section.metadata.order
      };
    } catch (error) {
      console.error(`Error getting metadata for section "${sectionId}":`, error);

      // Return fallback metadata
      return this._getFallbackMetadata(sectionId);
    }
  }

  /**
   * Generate fallback metadata when loading fails
   * @private
   * @param {string} sectionId - Section identifier
   * @returns {SectionMetadata} Fallback metadata object
   */
  _getFallbackMetadata(sectionId) {
    // No hardcoded fallbacks - make errors obvious
    return {
      id: sectionId,
      title: '⚠️ ERROR: Metadata Not Loaded',
      icon: 'alert-circle',
      order: 0
    };
  }

  /**
   * Get user profile information
   * @returns {Promise<UserProfile>} User profile data
   */
  async getUserProfile() {
    try {
      const data = await this._loadContentData();

      if (!data.profile) {
        throw new Error('Profile data not found in content.json');
      }

      return data.profile;
    } catch (error) {
      console.error('Error getting user profile:', error);

      // Return error profile to make loading failure obvious
      return {
        name: '⚠️ ERROR: Profile Not Loaded',
        title: `Error: ${error.message}`,
        email: 'error@content-not-loaded.com'
      };
    }
  }

  /**
   * Get main items for a section (highlighted/featured items)
   * @param {string} sectionId - Section identifier
   * @returns {Promise<string[]>} Array of main items
   */
  async getMainItems(sectionId) {
    try {
      const data = await this._loadContentData();

      if (!data.sections || !data.sections[sectionId]) {
        return [];
      }

      const section = data.sections[sectionId];
      return section.metadata.main_items || [];
    } catch (error) {
      console.error(`Error getting main items for section "${sectionId}":`, error);
      return [];
    }
  }

  /**
   * Get all sections metadata sorted by order
   * @returns {Promise<SectionMetadata[]>} Array of section metadata
   */
  async getAllSections() {
    try {
      const data = await this._loadContentData();

      if (!data.sections) {
        return [];
      }

      return Object.keys(data.sections)
        .map(sectionId => ({
          id: sectionId,
          title: data.sections[sectionId].metadata.title,
          icon: data.sections[sectionId].metadata.icon,
          order: data.sections[sectionId].metadata.order
        }))
        .sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Error getting all sections:', error);
      return [];
    }
  }
}

export default ContentMiddleware;
