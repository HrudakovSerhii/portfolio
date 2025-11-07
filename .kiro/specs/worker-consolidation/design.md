# Worker Consolidation and Refactoring Design

## Overview

This design document outlines the consolidation of four ML workers into a streamlined two-worker architecture with modular utility functions. The approach focuses on separation of concerns, maintainability, and testability while preserving all existing functionality.

## Architecture

### Current State
```
├── constrained-ml-worker.js (335 lines)
├── chat-ml-worker.js (800+ lines) 
├── optimized-ml-worker.js (150 lines)
└── embedding-worker.js (400 lines)
```

### Target State
```
src/scripts/modules/semantic-qa/
├── dual-worker-coordinator.js          # Simplified orchestrator (~150 lines)
├── utils/
│   ├── query-processor.js              # Query enhancement (~100 lines)
│   ├── cv-context-builder.js           # CV processing (~150 lines)
│   ├── response-validator.js           # Quality validation (~120 lines)
│   ├── similarity-calculator.js        # Similarity operations (~80 lines)
│   ├── prompt-builder.js               # Prompt construction (~100 lines)
│   └── cache-manager.js                # Caching operations (~80 lines)
└── workers/
    ├── embedding-worker.js              # Enhanced (~450 lines)
    └── optimized-ml-worker.js           # Enhanced (~200 lines)
```

## Components and Interfaces

### 1. Enhanced Embedding Worker
**File:** `src/scripts/workers/embedding-worker.js`

**Enhancements:**
- Add CV data service integration for batch processing
- Add simple similarity threshold filtering
- Maintain existing caching and batch processing capabilities

**Interface:**
```javascript
// Existing methods preserved
generateEmbedding(text, requestId)
generateBatchEmbeddings(texts, requestId)
calculateSimilarity(embedding1, embedding2, requestId)

// New methods
processCVSections(cvSections, requestId)
filterBySimilarityThreshold(similarities, threshold, requestId)
```

### 2. Enhanced Text Generation Worker
**File:** `src/scripts/workers/optimized-ml-worker.js`

**Enhancements from constrained-ml-worker:**
- Strict response validation with hallucination detection
- Constrained generation parameters (max 60 tokens, temp 0.3)
- First-person response validation
- Invalid pattern filtering

**Interface:**
```javascript
// Enhanced methods
initialize()
generateText(prompt, options)
processGeneration(data)

// New validation methods
cleanAndValidateText(text)
validateResponseFormat(text)
```

### 3. Query Processor Utility
**File:** `src/scripts/modules/semantic-qa/utils/query-processor.js`

**Functions migrated from chat-ml-worker:**
```javascript
export function preprocessQuery(message, context = [])
export function expandQueryWithSynonyms(query)
export function normalizeQuery(query)
export function extractContextKeywords(context)
export function getAdaptiveThreshold(query)
```

**Purpose:** Clean, enhance, and prepare user queries for processing

### 4. CV Context Builder Utility
**File:** `src/scripts/modules/semantic-qa/utils/cv-context-builder.js`

**Functions migrated from chat-ml-worker:**
```javascript
export function findRelevantSectionsByKeywords(query, cvSections)
export function buildCVContext(relevantSections)
export function createSearchText(section)
export function groupSectionsByCategory(sections)
export function determineSynthesisStrategy(query, sectionsByCategory)
```

**Purpose:** Process CV data and build relevant context for the LLM

### 5. Response Validator Utility
**File:** `src/scripts/modules/semantic-qa/utils/response-validator.js`

**Functions migrated from chat-ml-worker and constrained-ml-worker:**
```javascript
export function validateResponseQuality(response, originalQuery)
export function assessQueryRelevance(response, query)
export function calculateOverallConfidence(relevantSections, query)
export function adjustConfidenceForQuery(baseConfidence, query)
export function calculateQualityScore(validation)
export function cleanAndValidateText(text)
export const INVALID_PATTERNS = [...]
```

**Purpose:** Validate and score response quality with hallucination detection

### 6. Similarity Calculator Utility
**File:** `src/scripts/modules/semantic-qa/utils/similarity-calculator.js`

**Functions migrated from chat-ml-worker:**
```javascript
export function calculateCosineSimilarity(embedding1, embedding2)
export function findSimilarChunks(questionEmbedding, cvChunks, maxChunks)
export function rankSectionsBySimilarity(sections, queryEmbedding)
export function applySimilarityThreshold(matches, threshold)
```

**Purpose:** Handle all similarity calculations and ranking

### 7. Prompt Builder Utility
**File:** `src/scripts/modules/semantic-qa/utils/prompt-builder.js`

**Functions migrated from chat-ml-worker:**
```javascript
export function createPrompt(question, cvContext, style, conversationContext)
export function buildEnhancedPrompt(question, fencedContext, options)
export function getStyleInstructions(style)
export function formatContextForPrompt(context)
```

**Purpose:** Build optimized prompts for the small LLM

### 8. Cache Manager Utility
**File:** `src/scripts/modules/semantic-qa/utils/cache-manager.js`

**Functions migrated from chat-ml-worker:**
```javascript
export function cacheEmbedding(text, embedding)
export function getCachedEmbedding(text)
export function cacheQueryResult(query, result)
export function getCachedQueryResult(query)
export function generateCacheKey(text)
export function clearCache()
```

**Purpose:** Handle all caching operations independently from workers

### 9. Simplified Coordinator
**File:** `src/scripts/modules/semantic-qa/dual-worker-coordinator.js`

**Simplified workflow:**
```javascript
class DualWorkerCoordinator {
  async processQuestion(question, cvChunks = [], options = {}) {
    // 1. Enhance query using query-processor
    const enhancedQuery = queryProcessor.preprocessQuery(question, options.context);
    
    // 2. Generate embedding using embedding worker
    const questionEmbedding = await this.generateEmbedding(enhancedQuery);
    
    // 3. Find similar chunks using similarity-calculator
    const similarChunks = similarityCalculator.findSimilarChunks(
      questionEmbedding, cvChunks, options.maxChunks
    );
    
    // 4. Build context using cv-context-builder
    const context = cvContextBuilder.buildCVContext(similarChunks);
    
    // 5. Create prompt using prompt-builder
    const prompt = promptBuilder.createPrompt(question, context, options.style);
    
    // 6. Generate response using text generation worker
    const response = await this.generateResponse(prompt, options);
    
    // 7. Validate response using response-validator
    const validatedResponse = responseValidator.validateResponseQuality(
      response, question
    );
    
    return validatedResponse;
  }
}
```

## Data Models

### Enhanced Worker Message Format
```javascript
// Text Generation Worker Messages
{
  type: 'generate',
  prompt: string,
  query: string,
  maxTokens: number, // capped at 60
  temperature: number, // capped at 0.3
  requestId: string
}

// Response with validation
{
  type: 'response',
  answer: string,
  query: string,
  validated: boolean,
  processingMetrics: {
    processingTime: number,
    promptLength: number,
    responseLength: number,
    validationPassed: boolean
  }
}
```

### Utility Function Interfaces
```javascript
// Query Processor
interface QueryProcessorResult {
  enhancedQuery: string;
  originalQuery: string;
  synonymsAdded: string[];
  contextKeywords: string[];
  adaptiveThreshold: number;
}

// CV Context Builder
interface CVContextResult {
  context: string;
  relevantSections: Array<{
    id: string;
    similarity: number;
    matchedKeywords: string[];
  }>;
  synthesisStrategy: 'single' | 'focused' | 'comprehensive' | 'comparative';
}

// Response Validator
interface ValidationResult {
  answer: string;
  confidence: number;
  qualityScore: number;
  validationFlags: string[];
  passed: boolean;
}
```

## Error Handling

### Worker Error Handling
- Enhanced workers maintain existing error handling patterns
- Add validation-specific error types for text generation worker
- Preserve embedding worker's robust error handling

### Utility Error Handling
- Each utility function includes input validation
- Graceful degradation for missing or invalid data
- Clear error messages for debugging

### Coordinator Error Handling
- Centralized error handling for worker communication
- Fallback strategies when utilities fail
- Comprehensive error logging and reporting

## Testing Strategy

### Unit Testing
```
test/semantic-qa/utils/
├── query-processor.test.js
├── cv-context-builder.test.js
├── response-validator.test.js
├── similarity-calculator.test.js
├── prompt-builder.test.js
└── cache-manager.test.js
```

**Test Coverage:**
- Each utility function tested independently
- Edge cases and error conditions covered
- Mock data for CV sections and embeddings
- Performance benchmarks for critical functions

### Integration Testing
Integration testing will be implemented later if needed based on system requirements.

### Migration Testing
- Verify all existing functionality preserved
- Compare outputs before and after refactoring
- Validate performance characteristics maintained
- Test edge cases from original workers

## Migration Strategy

### Phase 1: Create Utility Modules
1. Extract functions from chat-ml-worker.js into utility modules
2. Create comprehensive unit tests for each utility
3. Verify utilities work independently

### Phase 2: Enhance Workers
1. Add validation logic to optimized-ml-worker.js
2. Add CV integration to embedding-worker.js
3. Test enhanced workers independently

### Phase 3: Simplify Coordinator
1. Refactor dual-worker-coordinator.js to use utilities
2. Remove business logic, keep orchestration only
3. Test coordinator with new architecture

### Phase 4: Cleanup and Validation
1. Remove obsolete worker files
2. Update all integration points
3. Run comprehensive test suite
4. Performance validation

## Performance Considerations

### Memory Usage
- Utility modules are stateless, reducing memory overhead
- Worker consolidation reduces overall memory footprint
- Extract caching strategies into separate utility modules
- Workers receive cached data via function arguments
- Workers return data for cache storage after successful processing

### Processing Speed
- Function extraction should not impact performance
- Maintain existing optimization patterns
- Remove all performance monitoring and statistics to improve code readability

### Bundle Size
- Modular utilities enable better tree-shaking by allowing bundlers to eliminate unused code
- Remove duplicate code across workers
- Use ES6 named imports instead of default imports for better tree-shaking
- Avoid importing entire libraries when only specific functions are needed
- Structure utilities as pure functions to enable dead code elimination

## Compatibility

### Existing Integration Points
- Maintain existing coordinator API
- Preserve worker message formats where possible
- Ensure backward compatibility with current usage

### Future Extensibility
This section provides guidance for future development:
- Each utility module has a single responsibility, making it easy to add new features without affecting other components
- Well-defined function interfaces allow swapping implementations without breaking dependent code
- Pure functions in utilities make the system predictable and easier to extend