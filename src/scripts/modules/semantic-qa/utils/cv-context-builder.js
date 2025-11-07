/**
 * CV Context Builder Utility Module
 * Handles CV data processing and context building for LLM prompts
 * Extracted from chat-ml-worker.js for modular architecture
 */

/**
 * Find relevant CV sections using improved keyword matching
 * @param {string} query - The user's query
 * @param {Map} cvSections - Map of CV sections with search data
 * @returns {Array} - Array of matched sections with scores
 */
export function findRelevantSectionsByKeywords(query, cvSections) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  if (!cvSections || !(cvSections instanceof Map)) {
    throw new Error('CV sections must be a Map');
  }

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const matches = [];

  for (const [sectionId, sectionData] of cvSections.entries()) {
    const searchText = sectionData.searchText || '';
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
    if (sectionData.section && sectionData.section.keywords) {
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
 * @param {Array} relevantSections - Array of relevant section matches
 * @returns {string|null} - Built context string or null if no sections
 */
export function buildCVContext(relevantSections) {
  if (!Array.isArray(relevantSections) || relevantSections.length === 0) {
    return null;
  }

  // Use only the most relevant section to avoid context confusion
  const bestMatch = relevantSections[0];
  const section = bestMatch.section;

  if (!section) {
    return null;
  }

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
    if (section.details.skills && Array.isArray(section.details.skills) && section.details.skills.length > 0) {
      context += `Key skills: ${section.details.skills.slice(0, 5).join(", ")}\n`;
    }
    if (section.details.achievements && Array.isArray(section.details.achievements) && section.details.achievements.length > 0) {
      context += `Notable achievements: ${section.details.achievements.slice(0, 2).join(", ")}\n`;
    }
  }

  return context.trim();
}

/**
 * Create search text from section data for keyword matching
 * @param {Object} section - CV section object
 * @returns {string} - Search text for keyword matching
 */
export function createSearchText(section) {
  if (!section || typeof section !== 'object') {
    return '';
  }

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
    if (section.details.technologies && Array.isArray(section.details.technologies)) {
      parts.push(section.details.technologies.join(" "));
    }
  }

  return parts.join(" ").toLowerCase();
}

/**
 * Group sections by category for better synthesis
 * @param {Array} sections - Array of section matches
 * @returns {Object} - Sections grouped by category
 */
export function groupSectionsByCategory(sections) {
  if (!Array.isArray(sections)) {
    return {};
  }

  const grouped = {};
  sections.forEach((section) => {
    const category = section.category || 'unknown';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(section);
  });
  return grouped;
}

/**
 * Determine the best synthesis strategy based on query and sections
 * @param {string} query - The user's query
 * @param {Object} sectionsByCategory - Sections grouped by category
 * @returns {string} - Synthesis strategy ('single', 'focused', 'comprehensive', 'comparative')
 */
export function determineSynthesisStrategy(query, sectionsByCategory) {
  if (!query || typeof query !== 'string') {
    return 'single';
  }

  if (!sectionsByCategory || typeof sectionsByCategory !== 'object') {
    return 'single';
  }

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