/**
 * CV Context Builder Utility Module
 * Handles CV data processing and context building for small LLM prompts
 * Optimized for SmolLM2-135M-Instruct with hierarchical CV structure
 */

/**
 * Find relevant CV sections using enhanced keyword matching for new schema
 * @param {string} query - The user's query
 * @param {Object} cvData - CV data object with hierarchical structure
 * @param {string} communicationStyle - Communication style ('hr', 'developer', 'friend')
 * @returns {Array} - Array of matched sections with scores and metadata
 */
export function findRelevantSectionsByKeywords(query, cvData, communicationStyle = 'developer') {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  if (!cvData || !cvData.sections) {
    throw new Error('CV data must have sections property');
  }

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const matches = [];

  // Process all sections from hierarchical structure
  const allSections = flattenCVSections(cvData.sections);

  for (const sectionData of allSections) {
    const section = sectionData.section;
    let score = 0;
    let matchedKeywords = [];

    // Use embeddingSourceText for keyword matching (optimized for retrieval)
    const searchText = (section.embeddingSourceText || '').toLowerCase();
    
    // Check query words against embedding source text
    queryWords.forEach((word) => {
      if (searchText.includes(word)) {
        const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
        if (searchText.match(wordRegex)) {
          score += 3; // Higher score for exact word boundaries
        } else {
          score += 1;
        }
        matchedKeywords.push(word);
      }
    });

    // Boost score for exact keyword matches (primary keywords)
    if (section.keywords && Array.isArray(section.keywords)) {
      section.keywords.forEach((keyword) => {
        if (query.toLowerCase().includes(keyword.toLowerCase())) {
          score += 5; // Higher boost for exact keyword match
          matchedKeywords.push(keyword);
        }
      });
    }

    // Apply priority weighting (1=highest, 5=lowest)
    const priorityMultiplier = section.priority ? (6 - section.priority) / 5 : 0.6;
    score *= priorityMultiplier;

    // Apply confidence weighting
    const confidenceMultiplier = section.confidence || 1.0;
    score *= confidenceMultiplier;

    if (score > 0) {
      matches.push({
        sectionId: section.id,
        similarity: Math.min(1.0, score / (queryWords.length + 3)),
        score: score,
        matchedKeywords: [...new Set(matchedKeywords)],
        section: section,
        category: sectionData.category,
        key: sectionData.key,
        priority: section.priority || 3,
        confidence: section.confidence || 1.0,
        communicationStyle: communicationStyle
      });
    }
  }

  // Sort by score (highest first) and return top 2 for small LLM context
  return matches.sort((a, b) => b.score - a.score).slice(0, 2);
}

/**
 * Build focused CV context optimized for small LLM models
 * @param {Array} relevantSections - Array of relevant section matches
 * @param {string} communicationStyle - Communication style ('hr', 'developer', 'friend')
 * @param {Object} cvData - Full CV data for related sections
 * @returns {string|null} - Built context string or null if no sections
 */
export function buildCVContext(relevantSections, communicationStyle = 'developer', cvData = null) {
  console.log('[CVContextBuilder] buildCVContext called with:', relevantSections.length, 'sections, style:', communicationStyle);
  
  if (!Array.isArray(relevantSections) || relevantSections.length === 0) {
    console.log('[CVContextBuilder] No relevant sections provided');
    return null;
  }

  const contextParts = [];
  
  // Process up to 2 sections for small LLM context window
  const sectionsToProcess = relevantSections.slice(0, 2);
  console.log('[CVContextBuilder] Processing sections:', sectionsToProcess.map(s => s.id));
  
  for (const chunk of sectionsToProcess) {
    console.log('[CVContextBuilder] Processing chunk:', chunk.id, 'has responses:', !!chunk.responses);
    
    // Handle both old structure (match.section) and new structure (direct chunk)
    const section = chunk.section || chunk;
    if (!section) continue;

    // Use appropriate communication style response
    const response = section.responses && section.responses[communicationStyle] 
      ? section.responses[communicationStyle]
      : section.responses?.developer || section.embeddingSourceText || section.text;

    if (response) {
      console.log('[CVContextBuilder] Adding response for', section.id, 'length:', response.length);
      contextParts.push(response);
    }

    // Add concise key details for small LLM
    if (section.details) {
      const details = extractKeyDetails(section.details, communicationStyle);
      if (details) {
        console.log('[CVContextBuilder] Adding details for', section.id, 'length:', details.length);
        contextParts.push(details);
      }
    }
  }

  // Include related sections if available and context allows
  if (cvData && sectionsToProcess.length === 1) {
    const relatedContext = buildRelatedSectionsContext(
      sectionsToProcess[0].section, 
      cvData, 
      communicationStyle
    );
    if (relatedContext) {
      contextParts.push(relatedContext);
    }
  }

  const result = contextParts.length > 0 ? contextParts.join('\n\n') : null;
  console.log('[CVContextBuilder] Returning context:', result ? `${result.length} chars` : 'null');
  console.log('[CVContextBuilder] Context preview:', result?.substring(0, 200) + '...');
  return result;
}

/**
 * Flatten hierarchical CV sections into searchable array
 * @param {Object} sections - Hierarchical sections object
 * @returns {Array} - Flattened array of sections with metadata
 */
export function flattenCVSections(sections) {
  const flattened = [];
  
  for (const [category, categoryData] of Object.entries(sections)) {
    for (const [key, section] of Object.entries(categoryData)) {
      flattened.push({
        category,
        key,
        section
      });
    }
  }
  
  return flattened;
}

/**
 * Extract key details optimized for small LLM context
 * @param {Object} details - Section details object
 * @param {string} communicationStyle - Communication style
 * @returns {string|null} - Formatted key details or null
 */
export function extractKeyDetails(details, communicationStyle) {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const keyInfo = [];

  // Extract most relevant details based on communication style
  if (communicationStyle === 'hr') {
    if (details.position) keyInfo.push(`Position: ${details.position}`);
    if (details.company) keyInfo.push(`Company: ${details.company}`);
    if (details.period) keyInfo.push(`Period: ${details.period}`);
    if (details.experience_years) keyInfo.push(`Experience: ${details.experience_years}`);
  } else if (communicationStyle === 'developer') {
    if (details.technologies && Array.isArray(details.technologies)) {
      keyInfo.push(`Tech: ${details.technologies.slice(0, 5).join(', ')}`);
    }
    if (details.primary_technologies && Array.isArray(details.primary_technologies)) {
      keyInfo.push(`Tech: ${details.primary_technologies.slice(0, 5).join(', ')}`);
    }
    if (details.specialties && Array.isArray(details.specialties)) {
      keyInfo.push(`Specialties: ${details.specialties.slice(0, 3).join(', ')}`);
    }
  } else { // friend style
    if (details.interests && Array.isArray(details.interests)) {
      keyInfo.push(`Interests: ${details.interests.slice(0, 3).join(', ')}`);
    }
    if (details.activities && Array.isArray(details.activities)) {
      keyInfo.push(`Activities: ${details.activities.slice(0, 3).join(', ')}`);
    }
  }

  return keyInfo.length > 0 ? keyInfo.join(' | ') : null;
}

/**
 * Build context from related sections for richer information
 * @param {Object} mainSection - Main section object
 * @param {Object} cvData - Full CV data
 * @param {string} communicationStyle - Communication style
 * @returns {string|null} - Related sections context or null
 */
export function buildRelatedSectionsContext(mainSection, cvData, communicationStyle) {
  if (!mainSection.relatedSections || !Array.isArray(mainSection.relatedSections)) {
    return null;
  }

  const allSections = flattenCVSections(cvData.sections);
  const relatedContexts = [];

  // Limit to 1 related section for small LLM context
  for (const relatedId of mainSection.relatedSections.slice(0, 1)) {
    const relatedSection = allSections.find(s => s.section.id === relatedId);
    if (relatedSection && relatedSection.section.responses) {
      const response = relatedSection.section.responses[communicationStyle] ||
                      relatedSection.section.responses.developer;
      if (response) {
        relatedContexts.push(`Related: ${response}`);
      }
    }
  }

  return relatedContexts.length > 0 ? relatedContexts.join('\n') : null;
}

/**
 * Detect communication style from query patterns
 * @param {string} query - User query
 * @returns {string} - Detected communication style ('hr', 'developer', 'friend')
 */
export function detectCommunicationStyle(query) {
  if (!query || typeof query !== 'string') {
    return 'developer';
  }

  const queryLower = query.toLowerCase();

  // HR/Professional patterns
  const hrPatterns = [
    'experience', 'years', 'position', 'role', 'company', 'team lead', 'management',
    'achievements', 'results', 'revenue', 'project', 'leadership', 'hire', 'hiring'
  ];

  // Developer patterns  
  const devPatterns = [
    'tech', 'technology', 'code', 'programming', 'framework', 'library', 'api',
    'typescript', 'react', 'node', 'javascript', 'backend', 'frontend', 'database'
  ];

  // Friend/Casual patterns
  const friendPatterns = [
    'like', 'love', 'enjoy', 'fun', 'cool', 'awesome', 'hobby', 'interest',
    'passion', 'outside', 'personal', 'tell me about', 'what do you'
  ];

  let hrScore = 0;
  let devScore = 0;
  let friendScore = 0;

  hrPatterns.forEach(pattern => {
    if (queryLower.includes(pattern)) hrScore++;
  });

  devPatterns.forEach(pattern => {
    if (queryLower.includes(pattern)) devScore++;
  });

  friendPatterns.forEach(pattern => {
    if (queryLower.includes(pattern)) friendScore++;
  });

  // Return style with highest score, default to developer
  if (hrScore > devScore && hrScore > friendScore) return 'hr';
  if (friendScore > devScore && friendScore > hrScore) return 'friend';
  return 'developer';
}

/**
 * Get fallback response based on communication style and confidence
 * @param {Object} cvData - CV data with response templates
 * @param {string} communicationStyle - Communication style
 * @param {number} confidence - Confidence score (0-1)
 * @returns {string} - Appropriate fallback response
 */
export function getFallbackResponse(cvData, communicationStyle, confidence = 0) {
  if (!cvData.responseTemplates) {
    return "I don't have information about that topic.";
  }

  const templates = cvData.responseTemplates;

  if (confidence === 0) {
    return templates.noMatch[communicationStyle] || templates.noMatch.developer;
  }

  if (confidence < 0.3) {
    return templates.lowConfidence[communicationStyle] || templates.lowConfidence.developer;
  }

  return templates.fallbackRequest[communicationStyle] || templates.fallbackRequest.developer;
}

/**
 * Build personality-aware context for small LLM
 * @param {Object} cvData - CV data with personality information
 * @param {string} communicationStyle - Communication style
 * @returns {string|null} - Personality context or null
 */
export function buildPersonalityContext(cvData, communicationStyle) {
  if (!cvData.personality) {
    return null;
  }

  const personality = cvData.personality;
  const contextParts = [];

  // Add communication style greeting
  if (personality.communication_style && personality.communication_style[communicationStyle]) {
    const styleInfo = personality.communication_style[communicationStyle];
    if (styleInfo.greeting) {
      contextParts.push(styleInfo.greeting);
    }
  }

  // Add relevant traits based on communication style
  if (personality.traits && Array.isArray(personality.traits)) {
    const relevantTraits = personality.traits.slice(0, 3).join(', ');
    contextParts.push(`Key traits: ${relevantTraits}`);
  }

  return contextParts.length > 0 ? contextParts.join('\n') : null;
}