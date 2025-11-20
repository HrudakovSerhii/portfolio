/**
 * Intent Classifier Utility
 * Classifies user queries to determine if they require fact retrieval or conversational synthesis
 */

/**
 * Fact-finding prefixes that indicate a fact retrieval query
 * These are checked at the start of the query (case-insensitive)
 */
const FACT_PREFIXES = [
  'how many',
  'how much',
  'what is',
  "what's",
  'what are',
  'when did',
  'when was',
  'where is',
  'where did',
  'where can',
  'who is',
  'which'
];

/**
 * Fact keywords that indicate a fact retrieval query
 * These can appear anywhere in the query (case-insensitive)
 */
const FACT_KEYWORDS = [
  'email',
  'contact',
  'phone',
  'linkedin',
  'github',
  'years',
  'experience',
  'education',
  'degree',
  'university',
  'college',
  'certification',
  'location',
  'address',
  'website',
  'portfolio'
];

/**
 * Classify user query intent
 * @param {string} query - User query to classify
 * @returns {string} - 'fact_retrieval' or 'conversational_synthesis'
 */
export function classifyIntent(query) {
  if (!query || typeof query !== 'string') {
    console.log('[IntentClassifier] Invalid query input, defaulting to conversational');
    return 'conversational_synthesis';
  }

  const normalizedQuery = query.toLowerCase().trim();
  const matchedPatterns = [];
  let reasoning = '';

  // Check for fact-finding prefixes first
  for (const prefix of FACT_PREFIXES) {
    if (normalizedQuery.startsWith(prefix)) {
      matchedPatterns.push(`prefix: "${prefix}"`);
      reasoning = `Query starts with fact-finding prefix "${prefix}"`;
      
      console.log('[IntentClassifier] Query:', query);
      console.log('[IntentClassifier] Detected patterns:', matchedPatterns);
      console.log('[IntentClassifier] Classification: fact_retrieval');
      console.log('[IntentClassifier] Reasoning:', reasoning);
      
      return 'fact_retrieval';
    }
  }

  // Check for fact keywords anywhere in the query
  for (const keyword of FACT_KEYWORDS) {
    if (normalizedQuery.includes(keyword)) {
      matchedPatterns.push(`keyword: "${keyword}"`);
    }
  }

  // If any fact keywords were found, classify as fact retrieval
  if (matchedPatterns.length > 0) {
    reasoning = `Query contains fact-related keywords: ${matchedPatterns.join(', ')}`;
    
    console.log('[IntentClassifier] Query:', query);
    console.log('[IntentClassifier] Detected patterns:', matchedPatterns);
    console.log('[IntentClassifier] Classification: fact_retrieval');
    console.log('[IntentClassifier] Reasoning:', reasoning);
    
    return 'fact_retrieval';
  }

  // Default to conversational synthesis
  reasoning = 'No fact-finding patterns detected, requires synthesized response';
  
  console.log('[IntentClassifier] Query:', query);
  console.log('[IntentClassifier] Detected patterns: none');
  console.log('[IntentClassifier] Classification: conversational_synthesis');
  console.log('[IntentClassifier] Reasoning:', reasoning);
  
  return 'conversational_synthesis';
}
