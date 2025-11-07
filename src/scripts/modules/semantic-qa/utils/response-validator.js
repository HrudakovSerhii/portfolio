/**
 * Response Validator Utility Module
 * Handles response quality validation, hallucination detection, and confidence scoring
 * Extracted from chat-ml-worker.js and constrained-ml-worker.js for modular architecture
 */

/**
 * Invalid patterns for hallucination detection
 * Patterns that indicate the model is generating incorrect or nonsensical content
 */
export const INVALID_PATTERNS = [
  /serdh?ii/i, // Misspelled name variations
  /serlindo/i,
  /serdoubust/i,
  /serdondogs/i,
  /webpack/i, // Random technical terms not in context
  /pylons/i,
  /ejs/i,
  /\d+\s+guys/i, // Random numbers with "guys"
  /work out of here/i, // Nonsensical phrases
  /ain't no joke/i,
  /made my life so much easier/i
];

/**
 * Validate response quality and adjust if necessary
 * @param {Object} response - Response object with answer, confidence, matchedSections, metrics
 * @param {string} originalQuery - The original user query
 * @returns {Object} - Validated response object
 */
export function validateResponseQuality(response, originalQuery) {
  if (!response || typeof response !== 'object') {
    throw new Error('Response must be an object');
  }

  if (!originalQuery || typeof originalQuery !== 'string') {
    throw new Error('Original query must be a non-empty string');
  }

  const validation = {
    answer: response.answer || '',
    confidence: response.confidence || 0,
    matchedSections: response.matchedSections || [],
    metrics: response.metrics || {},
  };

  // Check response length (too short might indicate poor matching)
  if (validation.answer.length < 20) {
    validation.confidence = Math.max(0, validation.confidence - 0.1);
    validation.metrics.qualityFlags = ['short_response'];
  }

  // Check if response actually addresses the query
  const queryRelevance = assessQueryRelevance(validation.answer, originalQuery);
  if (queryRelevance < 0.5) {
    validation.confidence = Math.max(0, validation.confidence - 0.15);
    validation.metrics.qualityFlags = validation.metrics.qualityFlags || [];
    validation.metrics.qualityFlags.push('low_relevance');
  }

  // Ensure minimum confidence threshold for quality responses
  if (validation.confidence < 0.3) {
    validation.answer = getFallbackResponse(originalQuery);
    validation.confidence = 0.2; // Low but not zero to indicate fallback
    validation.matchedSections = [];
    validation.metrics.qualityFlags = validation.metrics.qualityFlags || [];
    validation.metrics.qualityFlags.push('fallback_triggered');
  }

  // Add quality score to metrics
  validation.metrics.qualityScore = calculateQualityScore(validation);

  return validation;
}

/**
 * Assess how well the response addresses the original query
 * @param {string} response - The generated response
 * @param {string} query - The original query
 * @returns {number} - Relevance score between 0 and 1
 */
export function assessQueryRelevance(response, query) {
  if (!response || typeof response !== 'string') {
    return 0;
  }

  if (!query || typeof query !== 'string') {
    return 0;
  }

  // Simple keyword overlap assessment
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const responseWords = response.toLowerCase().split(/\s+/);

  let matches = 0;
  queryWords.forEach((word) => {
    if (
      responseWords.some(
        (respWord) => respWord.includes(word) || word.includes(respWord)
      )
    ) {
      matches++;
    }
  });

  return queryWords.length > 0 ? matches / queryWords.length : 0;
}

/**
 * Calculate overall confidence score based on multiple factors
 * @param {Array} relevantSections - Array of relevant sections
 * @param {string} query - The user's query
 * @returns {number} - Confidence score between 0 and 1
 */
export function calculateOverallConfidence(relevantSections, query) {
  if (!Array.isArray(relevantSections) || relevantSections.length === 0) {
    return 0;
  }

  if (!query || typeof query !== 'string') {
    return 0;
  }

  const bestMatch = relevantSections[0];
  let confidence = bestMatch.similarity || 0;

  // Boost confidence if multiple sections are relevant (indicates comprehensive knowledge)
  if (relevantSections.length > 1) {
    const secondBest = relevantSections[1];
    if (secondBest.similarity && secondBest.similarity > 0.6) {
      confidence = Math.min(1.0, confidence + 0.05);
    }
  }

  // Adjust based on query characteristics
  confidence = adjustConfidenceForQuery(confidence, query);

  // Ensure confidence is within valid range
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Adjust confidence based on query characteristics
 * @param {number} baseConfidence - Base confidence score
 * @param {string} query - The user's query
 * @returns {number} - Adjusted confidence score
 */
export function adjustConfidenceForQuery(baseConfidence, query) {
  if (typeof baseConfidence !== 'number') {
    return 0;
  }

  if (!query || typeof query !== 'string') {
    return baseConfidence;
  }

  let adjustedConfidence = baseConfidence;

  // Higher confidence for specific technical queries
  const specificTerms = ["react", "javascript", "node", "typescript", "scss"];
  if (specificTerms.some((term) => query.toLowerCase().includes(term))) {
    adjustedConfidence += 0.03;
  }

  // Lower confidence for very broad queries
  const broadTerms = ["experience", "skills", "background", "about"];
  if (
    broadTerms.some((term) => query.toLowerCase().includes(term)) &&
    query.length < 30
  ) {
    adjustedConfidence -= 0.05;
  }

  // Higher confidence for direct questions about specific projects
  if (query.toLowerCase().includes("project") && query.includes("?")) {
    adjustedConfidence += 0.02;
  }

  return adjustedConfidence;
}

/**
 * Calculate overall quality score for the response
 * @param {Object} validation - Validation object with answer, confidence, matchedSections, metrics
 * @returns {number} - Quality score between 0 and 1
 */
export function calculateQualityScore(validation) {
  if (!validation || typeof validation !== 'object') {
    return 0;
  }

  let score = (validation.confidence || 0) * 0.6; // Base score from confidence

  // Add points for response length (within reasonable bounds)
  const answerLength = validation.answer ? validation.answer.length : 0;
  const lengthScore = Math.min(0.2, answerLength / 500);
  score += lengthScore;

  // Add points for multiple matched sections (indicates comprehensive knowledge)
  const sectionsCount = validation.matchedSections ? validation.matchedSections.length : 0;
  const sectionScore = Math.min(0.1, sectionsCount * 0.03);
  score += sectionScore;

  // Subtract points for quality flags
  const qualityFlags = validation.metrics && validation.metrics.qualityFlags ? validation.metrics.qualityFlags : [];
  score -= qualityFlags.length * 0.05;

  return Math.max(0, Math.min(1, score));
}

/**
 * Clean and validate generated text with strict filtering
 * @param {string} text - The generated text to clean and validate
 * @returns {string|null} - Cleaned text or null if validation fails
 */
export function cleanAndValidateText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Clean the text
  let cleaned = text
    .replace(/^(Response:|Answer:)\s*/i, "") // Remove prefixes
    .replace(/\n\s*\n/g, "\n") // Remove extra newlines
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // Validate the text doesn't contain hallucinated content
  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(cleaned)) {
      console.warn('Generated text contains hallucinated content:', cleaned);
      return null; // Return null to indicate invalid generation
    }
  }

  // Check if text is too short or too generic
  if (cleaned.length < 10) {
    return null;
  }

  // Check if text starts with "I" (first person) as expected
  if (!cleaned.match(/^(I|Yes|No)/i)) {
    console.warn('Generated text does not start appropriately:', cleaned);
    return null;
  }

  return cleaned;
}

/**
 * Get fallback response for low-quality matches
 * @param {string} query - The original query
 * @returns {string} - Fallback response
 */
function getFallbackResponse(query) {
  return "I'd be happy to help you with that! Could you be a bit more specific about what you'd like to know? I can share details about my experience, skills, or projects.";
}