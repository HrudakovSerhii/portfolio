/**
 * Similarity Calculator Utility Module
 * Handles similarity calculations, ranking, and threshold filtering
 * Optimized for SmolLM2-135M-Instruct with new CV schema
 */

/**
 * Calculate cosine similarity between two embeddings
 * @param {Array<number>} embedding1 - First embedding vector
 * @param {Array<number>} embedding2 - Second embedding vector
 * @returns {number} - Cosine similarity score between -1 and 1
 */
export function calculateCosineSimilarity(embedding1, embedding2) {
  if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
    throw new Error('Embeddings must be arrays');
  }

  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  if (embedding1.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * Find similar CV sections based on embedding similarity with priority weighting
 * @param {Array<number>} questionEmbedding - The question embedding vector
 * @param {Object} cvData - CV data with hierarchical sections
 * @param {number} maxSections - Maximum number of sections to return (optimized for small LLM)
 * @returns {Array} - Array of similar sections sorted by weighted similarity
 */
export function findSimilarSections(questionEmbedding, cvData, maxSections = 3) {
  if (!Array.isArray(questionEmbedding)) {
    throw new Error('Question embedding must be an array');
  }

  if (!cvData || !cvData.sections) {
    return [];
  }

  if (typeof maxSections !== 'number' || maxSections <= 0) {
    maxSections = 3; // Smaller default for small LLM context
  }

  const similarities = [];
  const allSections = flattenCVSections(cvData.sections);

  allSections.forEach((sectionData, index) => {
    const section = sectionData.section;
    
    if (section.embeddings && Array.isArray(section.embeddings)) {
      try {
        const similarity = calculateCosineSimilarity(questionEmbedding, section.embeddings);
        
        // Apply priority weighting (1=highest priority, 5=lowest)
        const priorityWeight = section.priority ? (6 - section.priority) / 5 : 0.6;
        
        // Apply confidence weighting
        const confidenceWeight = section.confidence || 1.0;
        
        // Calculate weighted similarity
        const weightedSimilarity = similarity * priorityWeight * confidenceWeight;
        
        similarities.push({
          ...sectionData,
          similarity,
          weightedSimilarity,
          priorityWeight,
          confidenceWeight,
          index
        });
      } catch (error) {
        console.warn(`Failed to calculate similarity for section ${section.id}:`, error);
      }
    }
  });

  // Sort by weighted similarity (highest first) and return top sections
  return similarities
    .sort((a, b) => b.weightedSimilarity - a.weightedSimilarity)
    .slice(0, maxSections);
}

/**
 * Flatten hierarchical CV sections for similarity calculation
 * @param {Object} sections - Hierarchical sections object
 * @returns {Array} - Flattened array of sections with metadata
 */
function flattenCVSections(sections) {
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
 * Rank CV sections by weighted similarity optimized for small LLM
 * @param {Array} sectionMatches - Array of section matches from findSimilarSections
 * @param {Object} options - Ranking options
 * @returns {Array} - Sections ranked by weighted similarity with metadata
 */
export function rankSectionsByWeightedSimilarity(sectionMatches, options = {}) {
  if (!Array.isArray(sectionMatches)) {
    return [];
  }

  const {
    priorityBoost = 0.2,      // Boost for high priority sections
    confidenceBoost = 0.1,    // Boost for high confidence sections
    categoryBoost = 0.05      // Boost for core/experience categories
  } = options;

  const rankedSections = sectionMatches.map((match, index) => {
    let finalScore = match.weightedSimilarity || match.similarity || 0;
    
    // Apply category boost for important categories
    if (match.category === 'core' || match.category === 'experience') {
      finalScore += categoryBoost;
    }
    
    // Apply priority boost for high priority sections (priority 1-2)
    if (match.section.priority && match.section.priority <= 2) {
      finalScore += priorityBoost;
    }
    
    // Apply confidence boost for high confidence sections (>0.8)
    if (match.section.confidence && match.section.confidence > 0.8) {
      finalScore += confidenceBoost;
    }

    return {
      ...match,
      finalScore,
      originalIndex: index,
      rankingMetadata: {
        baseSimilarity: match.similarity || 0,
        weightedSimilarity: match.weightedSimilarity || match.similarity || 0,
        priorityBoost: match.section.priority <= 2 ? priorityBoost : 0,
        confidenceBoost: match.section.confidence > 0.8 ? confidenceBoost : 0,
        categoryBoost: (match.category === 'core' || match.category === 'experience') ? categoryBoost : 0
      }
    };
  });

  // Sort by final score (highest first)
  return rankedSections.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Find similar chunks based on embedding similarity (for chunk-based processing)
 * @param {Array<number>} questionEmbedding - The question embedding vector
 * @param {Array} chunks - Array of CV chunks with embeddings
 * @param {number} maxChunks - Maximum number of chunks to return
 * @returns {Array} - Array of similar chunks sorted by weighted similarity
 */
export function findSimilarChunks(questionEmbedding, chunks, maxChunks = 3) {
  if (!Array.isArray(questionEmbedding)) {
    throw new Error('Question embedding must be an array');
  }

  if (!Array.isArray(chunks)) {
    return [];
  }

  if (typeof maxChunks !== 'number' || maxChunks <= 0) {
    maxChunks = 3;
  }

  const similarities = [];

  chunks.forEach((chunk, index) => {
    if (chunk.embedding && Array.isArray(chunk.embedding)) {
      try {
        console.log(`[SimilarityCalculator] Comparing embeddings - Question: ${questionEmbedding.length}D, Chunk ${chunk.id}: ${chunk.embedding.length}D`);
        
        const similarity = calculateCosineSimilarity(questionEmbedding, chunk.embedding);
        
        // Apply priority weighting from metadata
        const priority = chunk.metadata?.priority || 0;
        const priorityWeight = priority ? (6 - priority) / 5 : 0.6;
        
        // Apply confidence weighting from metadata
        const confidence = chunk.metadata?.confidence || 1.0;
        
        // Calculate weighted similarity
        const weightedSimilarity = similarity * priorityWeight * confidence;
        
        similarities.push({
          ...chunk,
          similarity,
          weightedSimilarity,
          priorityWeight,
          confidenceWeight: confidence,
          index,
          sectionId: chunk.id // For compatibility with existing code
        });
      } catch (error) {
        console.warn(`[SimilarityCalculator] Failed to calculate similarity for chunk ${chunk.id}:`, error);
        console.warn(`[SimilarityCalculator] Question embedding dimensions: ${questionEmbedding.length}, Chunk embedding dimensions: ${chunk.embedding?.length}`);
      }
    } else {
      console.warn(`[SimilarityCalculator] Chunk ${chunk.id} has no valid embedding:`, {
        hasEmbedding: !!chunk.embedding,
        isArray: Array.isArray(chunk.embedding),
        type: typeof chunk.embedding
      });
    }
  });

  // Sort by weighted similarity (highest first) and return top chunks
  return similarities
    .sort((a, b) => b.weightedSimilarity - a.weightedSimilarity)
    .slice(0, maxChunks);
}

/**
 * Apply adaptive similarity threshold optimized for small LLM
 * @param {Array} matches - Array of matches with similarity scores
 * @param {Object} options - Threshold options
 * @returns {Array} - Filtered matches above adaptive threshold
 */
export function applySimilarityThreshold(matches, options = {}) {
  if (!Array.isArray(matches)) {
    return [];
  }

  const {
    baseThreshold = 0.3,      // Lower threshold for small LLM (more permissive)
    priorityAdjustment = 0.1, // Lower threshold for high priority sections
    maxResults = 2            // Limit results for small LLM context
  } = options;

  const filteredMatches = matches.filter(match => {
    const similarity = match.finalScore || match.weightedSimilarity || match.similarity || 0;
    
    // Adjust threshold based on section priority
    let adjustedThreshold = baseThreshold;
    if (match.section && match.section.priority && match.section.priority <= 2) {
      adjustedThreshold -= priorityAdjustment; // Lower threshold for high priority
    }
    
    // Ensure threshold is within valid range
    adjustedThreshold = Math.max(0.1, Math.min(1, adjustedThreshold));
    
    return similarity >= adjustedThreshold;
  });

  // Return top results limited for small LLM context
  return filteredMatches.slice(0, maxResults);
}

/**
 * Calculate confidence score for retrieval results
 * @param {Array} matches - Array of similarity matches
 * @param {string} query - Original query
 * @returns {number} - Overall confidence score (0-1)
 */
export function calculateRetrievalConfidence(matches, query) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return 0;
  }

  // Base confidence from similarity scores
  const avgSimilarity = matches.reduce((sum, match) => {
    return sum + (match.finalScore || match.weightedSimilarity || match.similarity || 0);
  }, 0) / matches.length;

  // Boost confidence for keyword matches
  let keywordBoost = 0;
  if (query && typeof query === 'string') {
    const queryWords = query.toLowerCase().split(/\s+/);
    const totalKeywords = matches.reduce((sum, match) => {
      if (match.matchedKeywords && Array.isArray(match.matchedKeywords)) {
        return sum + match.matchedKeywords.length;
      }
      return sum;
    }, 0);
    keywordBoost = Math.min(0.2, totalKeywords / (queryWords.length * matches.length));
  }

  // Boost confidence for high priority sections
  const priorityBoost = matches.some(match => 
    match.section && match.section.priority && match.section.priority <= 2
  ) ? 0.1 : 0;

  return Math.min(1.0, avgSimilarity + keywordBoost + priorityBoost);
}