/**
 * Similarity Calculator Utility Module
 * Handles similarity calculations, ranking, and threshold filtering
 * Extracted from chat-ml-worker.js for modular architecture
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
 * Find similar chunks based on embedding similarity
 * @param {Array<number>} questionEmbedding - The question embedding vector
 * @param {Array} cvChunks - Array of CV chunks with embeddings
 * @param {number} maxChunks - Maximum number of chunks to return
 * @returns {Array} - Array of similar chunks sorted by similarity
 */
export function findSimilarChunks(questionEmbedding, cvChunks, maxChunks = 5) {
  if (!Array.isArray(questionEmbedding)) {
    throw new Error('Question embedding must be an array');
  }

  if (!Array.isArray(cvChunks)) {
    return [];
  }

  if (typeof maxChunks !== 'number' || maxChunks <= 0) {
    maxChunks = 5;
  }

  const similarities = [];

  cvChunks.forEach((chunk, index) => {
    if (chunk.embedding && Array.isArray(chunk.embedding)) {
      try {
        const similarity = calculateCosineSimilarity(questionEmbedding, chunk.embedding);
        similarities.push({
          ...chunk,
          similarity,
          index
        });
      } catch (error) {
        console.warn(`Failed to calculate similarity for chunk ${index}:`, error);
      }
    }
  });

  // Sort by similarity (highest first) and return top chunks
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxChunks);
}

/**
 * Rank sections by similarity to query embedding
 * @param {Array} sections - Array of sections with embeddings
 * @param {Array<number>} queryEmbedding - Query embedding vector
 * @returns {Array} - Sections ranked by similarity
 */
export function rankSectionsBySimilarity(sections, queryEmbedding) {
  if (!Array.isArray(sections)) {
    return [];
  }

  if (!Array.isArray(queryEmbedding)) {
    throw new Error('Query embedding must be an array');
  }

  const rankedSections = [];

  sections.forEach((section, index) => {
    if (section.embedding && Array.isArray(section.embedding)) {
      try {
        const similarity = calculateCosineSimilarity(queryEmbedding, section.embedding);
        rankedSections.push({
          ...section,
          similarity,
          originalIndex: index
        });
      } catch (error) {
        console.warn(`Failed to calculate similarity for section ${index}:`, error);
      }
    } else {
      // If no embedding, add with zero similarity
      rankedSections.push({
        ...section,
        similarity: 0,
        originalIndex: index
      });
    }
  });

  // Sort by similarity (highest first)
  return rankedSections.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Apply similarity threshold filtering to matches
 * @param {Array} matches - Array of matches with similarity scores
 * @param {number} threshold - Minimum similarity threshold (0-1)
 * @returns {Array} - Filtered matches above threshold
 */
export function applySimilarityThreshold(matches, threshold = 0.5) {
  if (!Array.isArray(matches)) {
    return [];
  }

  if (typeof threshold !== 'number') {
    threshold = 0.5;
  }

  // Ensure threshold is within valid range
  threshold = Math.max(0, Math.min(1, threshold));

  return matches.filter(match => {
    const similarity = match.similarity || 0;
    return similarity >= threshold;
  });
}