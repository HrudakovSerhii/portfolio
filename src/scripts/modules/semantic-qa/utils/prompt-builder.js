/**
 * Prompt Builder Utility Module
 * Handles prompt construction and optimization for LLM text generation
 * Extracted from chat-ml-worker.js for modular architecture
 */

/**
 * Create optimized prompt for text generation
 * @param {string} question - The user's question
 * @param {string|null} cvContext - CV context information
 * @param {string} style - Response style ('hr', 'developer', 'friend')
 * @param {Array} conversationContext - Previous conversation context
 * @returns {string} - Optimized prompt for LLM
 */
export function createPrompt(question, cvContext, style = 'developer', conversationContext = []) {
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  if (style && !['hr', 'developer', 'friend'].includes(style)) {
    style = 'developer';
  }

  const instruction = getStyleInstructions(style);

  let prompt = `You are Serhii, a software developer. Respond in a ${instruction}.\n\n`;

  if (cvContext && typeof cvContext === 'string') {
    prompt += `Based on this information:\n${cvContext}\n\n`;
  }

  prompt += `Question: ${question}\n\n`;
  prompt += `Instructions:
- Answer as Serhii in first person
- Only use information provided above
- If no relevant info is provided, say so honestly
- Keep response under 100 words
- Be specific and provide examples when possible

Answer:`;

  return prompt;
}

/**
 * Build enhanced prompt with additional options
 * @param {string} question - The user's question
 * @param {string} fencedContext - Context wrapped in fences
 * @param {Object} options - Additional options for prompt building
 * @returns {string} - Enhanced prompt
 */
export function buildEnhancedPrompt(question, fencedContext, options = {}) {
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  const {
    style = 'developer',
    maxWords = 100,
    includeExamples = true,
    conversationContext = []
  } = options;

  const instruction = getStyleInstructions(style);
  
  let prompt = `You are Serhii, a software developer. Respond in a ${instruction}.\n\n`;

  if (fencedContext && typeof fencedContext === 'string') {
    prompt += `Context:\n${fencedContext}\n\n`;
  }

  // Add conversation context if available
  if (Array.isArray(conversationContext) && conversationContext.length > 0) {
    const recentContext = conversationContext.slice(-2); // Last 2 exchanges
    prompt += `Recent conversation:\n`;
    recentContext.forEach((entry, index) => {
      if (entry.userMessage && entry.response) {
        prompt += `Q${index + 1}: ${entry.userMessage}\nA${index + 1}: ${entry.response}\n`;
      }
    });
    prompt += `\n`;
  }

  prompt += `Current question: ${question}\n\n`;
  
  prompt += `Instructions:
- Answer as Serhii in first person
- Use only the information provided in the context above
- If no relevant information is available, acknowledge this honestly
- Keep response under ${maxWords} words
- Be specific and concrete`;

  if (includeExamples) {
    prompt += `
- Provide examples when possible`;
  }

  prompt += `\n\nAnswer:`;

  return prompt;
}

/**
 * Get style-specific instructions for prompt building
 * @param {string} style - The response style
 * @returns {string} - Style instruction text
 */
export function getStyleInstructions(style) {
  const styleInstructions = {
    hr: "professional and achievement-focused manner. Focus on experience, qualifications, and measurable results",
    developer: "technical and collaborative manner. Use technical language and share insights about technologies",
    friend: "casual and enthusiastic manner. Use emojis when appropriate and make concepts accessible"
  };

  return styleInstructions[style] || styleInstructions.developer;
}

/**
 * Format context for prompt optimization
 * @param {string|Object} context - Context to format
 * @returns {string} - Formatted context string
 */
export function formatContextForPrompt(context) {
  if (!context) {
    return '';
  }

  if (typeof context === 'string') {
    return context.trim();
  }

  if (typeof context === 'object') {
    // If context is an object, try to extract meaningful text
    if (context.text) {
      return context.text.trim();
    }
    
    if (context.content) {
      return context.content.trim();
    }

    // Try to stringify object in a readable way
    try {
      return JSON.stringify(context, null, 2);
    } catch (error) {
      return String(context);
    }
  }

  return String(context).trim();
}