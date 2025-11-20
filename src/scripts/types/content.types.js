/**
 * @typedef {Object} UserProfile
 * @property {string} name - Full name
 * @property {string} title - Professional title
 * @property {string} email - Contact email
 * @property {string} [phone] - Contact phone number
 * @property {string} [location] - Location/city
 * @property {Object.<string, string>} [socialLinks] - Social media links (github, linkedin, twitter, etc.)
 */

/**
 * @typedef {Object} SectionMetadata
 * @property {string} title - Section title
 * @property {string} icon - Icon identifier
 * @property {number} order - Display order
 * @property {string[]} [main_items] - Main/highlighted items for this section
 */

/**
 * @typedef {Object} RoleContent
 * @property {string} text - Content text for this role
 * @property {string} imageUrl - Image URL
 * @property {string} imageAlt - Image alt text
 * @property {string} aspectRatio - CSS aspect ratio class
 */

/**
 * @typedef {Object} Section
 * @property {SectionMetadata} metadata - Section metadata
 * @property {Object.<string, RoleContent>} content - Role-based content (recruiter, developer, friend)
 */

/**
 * @typedef {Object} PortfolioData
 * @property {UserProfile} profile - User profile information
 * @property {Object.<string, Section>} sections - Portfolio sections
 */

/**
 * @typedef {Object} SectionContent
 * @property {string} sectionId - Section identifier
 * @property {string} title - Section title
 * @property {string} text - Content text
 * @property {string} imageUrl - Image URL
 * @property {string} imageAlt - Image alt text
 * @property {string} aspectRatio - CSS aspect ratio class
 * @property {string|null} customQuery - Custom query if provided
 * @property {boolean} [isError] - Whether this is error/fallback content
 * @property {string} [errorMessage] - Error message if isError is true
 */

// Export types for JSDoc usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}
