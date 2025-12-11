/**
 * Query Processor Utility Module
 * Handles query preprocessing, enhancement, and normalization
 * Extracted from chat-ml-worker.js for modular architecture
 */

/**
 * Preprocess user query to improve matching accuracy
 * @param {string} message - The user's query message
 * @param {Array} context - Conversation context array
 * @returns {string} - Processed query string
 */
export function preprocessQuery(message, context = []) {
  if (!message || typeof message !== 'string') {
    throw new Error('Message must be a non-empty string');
  }

  let processedQuery = message.toLowerCase().trim();

  // Extract context keywords from recent conversation
  const contextKeywords = extractContextKeywords(context);

  // Expand query with synonyms and related terms
  processedQuery = expandQueryWithSynonyms(processedQuery);

  // Add context if relevant
  if (contextKeywords.length > 0) {
    processedQuery += " " + contextKeywords.join(" ");
  }

  // Clean and normalize
  processedQuery = normalizeQuery(processedQuery);

  return processedQuery;
}

/**
 * Extract relevant keywords from conversation context
 * @param {Array} context - Conversation context array
 * @returns {Array<string>} - Array of relevant keywords
 */
export function extractContextKeywords(context) {
  if (!Array.isArray(context) || context.length === 0) {
    return [];
  }

  const keywords = new Set();
  const recentMessages = context.slice(-2); // Last 2 exchanges

  recentMessages.forEach((entry) => {
    if (entry && entry.matchedSections) {
      entry.matchedSections.forEach((sectionId) => {
        // This would need access to section data, but for pure function
        // we'll extract keywords from the section ID itself
        if (typeof sectionId === 'string') {
          const parts = sectionId.split('_');
          parts.forEach(part => {
            if (part.length > 2) {
              keywords.add(part);
            }
          });
        }
      });
    }
  });

  return Array.from(keywords).slice(0, 3); // Limit to 3 most relevant
}

/**
 * Expand query with synonyms and related terms
 * @param {string} query - The query to expand
 * @returns {string} - Expanded query with synonyms
 */
export function expandQueryWithSynonyms(query) {
  if (!query || typeof query !== 'string') {
    return query;
  }

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
 * @param {string} query - The query to normalize
 * @returns {string} - Normalized query
 */
export function normalizeQuery(query) {
  if (!query || typeof query !== 'string') {
    return '';
  }

  return query
    .replace(/[^\w\s]/g, " ") // Remove special characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Get adaptive similarity threshold based on query characteristics
 * Optimized for embedding models with lower similarity scores
 * @param {string} query - The query to analyze
 * @returns {number} - Adaptive threshold value between 0 and 1
 */
export function getAdaptiveThreshold(query) {
  console.log('[QueryProcessor] 🎯 CALCULATING ADAPTIVE THRESHOLD');
  console.log('[QueryProcessor] Query:', query);
  console.log('[QueryProcessor] Query length:', query?.length);

  if (!query || typeof query !== 'string') {
    console.log('[QueryProcessor] Invalid query, returning default: 0.3');
    return 0.3; // Lower default threshold for embedding models
  }

  // Much lower base threshold optimized for embedding similarity scores
  // Embedding models typically produce scores in 0.2-0.6 range for relevant matches
  const baseThreshold = 0.3;
  console.log('[QueryProcessor] Base threshold:', baseThreshold);

  // Lower threshold for shorter queries (they might be less specific)
  if (query.length < 20) {
    const threshold = baseThreshold - 0.05;
    console.log('[QueryProcessor] Short query (<20 chars), adjusted threshold:', threshold);
    return threshold;
  }

  // Lower threshold for questions (they might be more exploratory)
  const isQuestion = query.includes("?") ||
    query.toLowerCase().startsWith("what") ||
    query.toLowerCase().startsWith("how") ||
    query.toLowerCase().startsWith("do you") ||
    query.toLowerCase().startsWith("tell me");
  
  if (isQuestion) {
    const threshold = baseThreshold - 0.05;
    console.log('[QueryProcessor] Question detected, adjusted threshold:', threshold);
    return threshold;
  }

  // Slightly higher threshold for very specific technical terms
  const technicalTerms = [
    "framework",
    "library",
    "algorithm",
    "architecture",
    "implementation",
  ];
  if (technicalTerms.some((term) => query.toLowerCase().includes(term))) {
    const threshold = baseThreshold + 0.05;
    console.log('[QueryProcessor] Technical terms detected, adjusted threshold:', threshold);
    return threshold;
  }

  console.log('[QueryProcessor] Using base threshold:', baseThreshold);
  return baseThreshold;
}