# Design Document

## Overview

The Chat Bot QA Router is a streamlined orchestration module that implements intent-based routing for question-answering. It replaces the complex dual-worker-coordinator for the chatbot use case by providing a lean, performance-focused pipeline that routes queries to specialized workers based on intent classification. The system distinguishes between fact-retrieval questions (requiring extractive answers from EQA model) and conversational questions (requiring synthesized responses from SmolLM).

### Key Design Principles

- **Simplicity**: Minimal complexity, only essential logic for the 10-step flow
- **Performance**: Optimized for speed with parallel worker loading and efficient context retrieval
- **Intent-Based Routing**: Static keyword-based classification for deterministic, fast routing
- **Hybrid Approach**: Leverage each model's strengths (EQA for facts, SmolLM for synthesis)

## Architecture

### High-Level Flow

```
Initialization Phase:
    ↓
[1] Load Embedding Worker (priority)
    ↓
[2] Index & Chunk Context (parallel with step 3)
    ↓
[3] Load SmolLM & EQA Workers (parallel with step 2)
    ↓
[4] Pre-compute Embeddings for Chunks
    ↓
Query Processing Phase:
    ↓
[5] Preprocess User Query
    ↓
[6] Generate Query Embedding
    ↓
[7] Find Similar Chunks
    ↓
[8] Intent Classification ← ROUTER DECISION POINT
    ↓
    ├─→ [9a] Fact Retrieval Path
    │       - Combine chunks into context
    │       - Call EQA Worker
    │       - Extract answer span
    │
    └─→ [9b] Conversational Path
            - Apply similarity threshold
            - Build CV context
            - Create prompt
            - Call SmolLM Worker
            - Generate synthesized response
    ↓
[10] Return Response
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Chat Bot QA Router                      │
│  (chat-bot-qa-router.js)                                │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Intent Classifier (intent-classifier.js)      │    │
│  │  - Keyword-based classification                │    │
│  │  - Returns: fact_retrieval | conversational    │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Worker Manager                                 │    │
│  │  - Embedding Worker (existing)                 │    │
│  │  - Text Generation Worker (SmolLM, existing)   │    │
│  │  - EQA Worker (new, distilbert-squad)          │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Utility Modules (reuse existing)              │    │
│  │  - query-processor                             │    │
│  │  - similarity-calculator                       │    │
│  │  - cv-context-builder                          │    │
│  │  - prompt-builder                              │    │
│  │  - response-validator                          │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Chat Bot QA Router (Main Module)

**File**: `src/scripts/modules/chat-bot/chat-bot-qa-router.js`

**Responsibilities**:
- Orchestrate the 10-step query processing flow
- Manage worker lifecycle (initialization, communication, cleanup)
- Route queries based on intent classification
- Handle errors and fallbacks

**Public Interface**:

```javascript
class ChatBotQARouter {
  constructor(options = {})
  
  // Initialize router and all workers
  async initialize(cvChunks = [])
  
  // Process user query (main entry point)
  async processQuery(question, options = {})
  
  // Cleanup resources
  cleanup()
  
  // Get router status
  getStatus()
}
```

**Configuration Options**:

```javascript
{
  embeddingWorkerPath: './scripts/workers/embedding-worker.js',
  textGenWorkerPath: './scripts/workers/optimized-ml-worker.js',
  eqaWorkerPath: './scripts/workers/eqa-worker.js',
  maxContextChunks: 5,
  similarityThreshold: 0.3,
  eqaConfidenceThreshold: 0.3,
  timeout: 5000
}
```

### 2. Intent Classifier Utility

**File**: `src/scripts/modules/chat-bot/utils/intent-classifier.js`

**Responsibilities**:
- Analyze user query to determine intent
- Return classification: `fact_retrieval` or `conversational_synthesis`

**Interface**:

```javascript
/**
 * Classify user query intent
 * @param {string} query - User query
 * @returns {string} - 'fact_retrieval' | 'conversational_synthesis'
 */
export function classifyIntent(query)
```

**Classification Logic**:

```javascript
// Fact-finding prefixes (query starts with)
const factPrefixes = [
  "how many", "how much", "what is", "what's", "what are",
  "when did", "when was", "where is", "where did"
];

// Fact keywords (anywhere in query)
const factKeywords = [
  "email", "contact", "phone", "linkedin", "github",
  "years", "experience", "education", "degree"
];

// Check prefixes first, then keywords
// Default to conversational_synthesis
```

### 3. EQA Worker (New)

**File**: `src/scripts/workers/eqa-worker.js`

**Responsibilities**:
- Load distilbert-squad model from Xenova
- Perform extractive question answering
- Return answer span with confidence score

**Message Interface**:

```javascript
// Input message
{
  type: 'extractAnswer',
  question: string,
  context: string,
  requestId: string
}

// Output message
{
  type: 'answer',
  requestId: string,
  success: boolean,
  answer: string,
  confidence: number,
  error?: string
}
```

**Model Configuration**:

```javascript
{
  modelName: 'Xenova/distilbert-base-cased-distilled-squad',
  quantized: true
}
```

### 4. Worker Manager (Internal)

**Responsibilities**:
- Initialize all three workers in parallel
- Handle worker communication with request/response pattern
- Manage pending requests map
- Implement timeout handling

**Internal Methods**:

```javascript
async initializeWorkers()
async waitForWorkerReady(worker, workerType)
generateRequestId()
sendWorkerMessage(worker, message)
handleWorkerResponse(event)
```

## Data Models

### Query Processing Context

```javascript
{
  originalQuery: string,
  enhancedQuery: string,
  queryEmbedding: Float32Array,
  intent: 'fact_retrieval' | 'conversational_synthesis',
  similarChunks: Array<Chunk>,
  filteredChunks: Array<Chunk>,
  context: string,
  response: string,
  confidence: number,
  processingTime: number,
  metrics: Object
}
```

### CV Chunk

```javascript
{
  id: string,
  text: string,
  embedding: Float32Array,
  metadata: {
    category: string,
    priority: number,
    confidence: number,
    keywords: Array<string>
  }
}
```

### Intent Classification Result

```javascript
{
  intent: 'fact_retrieval' | 'conversational_synthesis',
  confidence: number,
  matchedPatterns: Array<string>,
  reasoning: string
}
```

### EQA Response

```javascript
{
  answer: string,
  confidence: number,
  startIndex: number,
  endIndex: number,
  processingTime: number
}
```

### Router Response

```javascript
{
  answer: string,
  confidence: number,
  intent: string,
  method: 'eqa' | 'generation',
  matchedChunks: Array<Chunk>,
  processingTime: number,
  metrics: {
    embeddingTime: number,
    retrievalTime: number,
    generationTime: number,
    totalTime: number
  }
}
```

## Processing Flow Details

### Step-by-Step Flow

**Initialization Phase** (One-time setup)

**Step 1: Load Embedding Worker First**
```javascript
// Load embedding worker with priority (needed for step 4)
await this.initializeEmbeddingWorker();
console.log('Embedding worker ready');
```

**Steps 2-3: Parallel Context Preparation & Worker Loading**
```javascript
// Run these in parallel for optimal performance
await Promise.all([
  // Step 2: Index and chunk CV data
  this.prepareContext(cvChunks),
  
  // Step 3: Load remaining workers
  Promise.all([
    this.initializeTextGenWorker(),
    this.initializeEQAWorker()
  ])
]);

console.log('Context prepared, all workers ready');
```

**Step 4: Pre-compute Chunk Embeddings**
```javascript
// Now that embedding worker is ready and chunks are prepared
await this.precomputeChunkEmbeddings(this.cvChunks);
console.log('Chunk embeddings pre-computed');
```

**Query Processing Phase** (Per-query execution)

**Step 5: Query Preprocessing**
```javascript
// Use existing query-processor utility
const enhancedQuery = queryProcessor.preprocessQuery(
  question,
  conversationContext
);
```

**Step 6: Generate Query Embedding**
```javascript
// Use embedding worker
const queryEmbedding = await this.generateEmbedding(enhancedQuery);
```

**Step 7: Find Similar Chunks**
```javascript
// Use similarity-calculator utility
const similarChunks = similarityCalculator.findSimilarChunks(
  queryEmbedding,
  this.cvChunks,
  this.config.maxContextChunks
);
```

**Step 8: Intent Classification**
```javascript
// Use intent-classifier utility
const intent = intentClassifier.classifyIntent(enhancedQuery);
```

**Step 9a: Fact Retrieval Path**
```javascript
if (intent === 'fact_retrieval') {
  // Combine chunks into single context
  const context = similarChunks
    .map(chunk => chunk.text)
    .join(' ');
  
  // Call EQA worker
  const result = await this.extractAnswer(enhancedQuery, context);
  
  // Check confidence threshold
  if (result.confidence < this.config.eqaConfidenceThreshold) {
    // Fallback to conversational path
    return this.processConversationalPath(...);
  }
  
  return result;
}
```

**Step 9b: Conversational Path**
```javascript
else {
  // Apply similarity threshold filtering
  const threshold = queryProcessor.getAdaptiveThreshold(enhancedQuery);
  const filteredChunks = similarityCalculator.applySimilarityThreshold(
    similarChunks,
    threshold
  );
  
  // Build CV context
  const cvContext = cvContextBuilder.buildCVContext(filteredChunks);
  
  // Create prompt
  const prompt = promptBuilder.createPrompt(
    enhancedQuery,
    cvContext,
    options.style || 'developer',
    conversationContext
  );
  
  // Generate response
  const result = await this.generateResponse(prompt);
  
  return result;
}
```

**Step 10: Return Response**
```javascript
// Validate and format response
const validatedResponse = responseValidator.validateResponseQuality(
  result,
  question
);

return {
  answer: validatedResponse.answer,
  confidence: validatedResponse.confidence,
  intent,
  method: intent === 'fact_retrieval' ? 'eqa' : 'generation',
  matchedChunks: filteredChunks,
  processingTime: Date.now() - startTime,
  metrics: { ... }
};
```

## Error Handling

### Error Types and Strategies

**Worker Initialization Errors**:
```javascript
try {
  await this.initializeWorkers();
} catch (error) {
  console.error('Worker initialization failed:', error);
  throw new Error('WORKER_INIT_FAILED');
}
```

**Worker Timeout**:
```javascript
const timeout = setTimeout(() => {
  reject(new Error('Worker timeout'));
}, this.config.timeout);

// Clear timeout on success
```

**Low Confidence EQA Response**:
```javascript
if (result.confidence < this.config.eqaConfidenceThreshold) {
  console.log('EQA confidence too low, falling back to generation');
  return this.processConversationalPath(question, similarChunks, options);
}
```

**Empty Answer from EQA**:
```javascript
if (!result.answer || result.answer.trim().length === 0) {
  console.log('EQA returned empty answer, falling back to generation');
  return this.processConversationalPath(question, similarChunks, options);
}
```

**No Relevant Context Found**:
```javascript
if (filteredChunks.length === 0) {
  return {
    answer: "I don't have enough information to answer that question.",
    confidence: 0,
    intent,
    method: 'fallback'
  };
}
```

### Fallback Strategy

```
EQA Low Confidence → Conversational Path
EQA Empty Answer → Conversational Path
No Context Found → Generic "No Information" Response
Worker Error → Error Message to User
Worker Timeout → Timeout Error Message
```

## Testing Strategy

### Unit Tests

**Intent Classifier Tests**:
- Test fact-finding prefix detection
- Test fact keyword detection
- Test conversational query classification
- Test edge cases (empty query, special characters)

**Router Core Logic Tests**:
- Test worker initialization
- Test query preprocessing
- Test embedding generation
- Test similarity calculation
- Test intent-based routing
- Test response formatting

**EQA Worker Tests**:
- Test model loading
- Test answer extraction
- Test confidence scoring
- Test error handling

### Integration Tests

**End-to-End Flow Tests**:
- Test fact retrieval path with sample queries
- Test conversational path with sample queries
- Test fallback from EQA to generation
- Test timeout handling
- Test worker cleanup

**Performance Tests**:
- Measure query processing time
- Measure worker initialization time
- Measure embedding generation time
- Verify response time < 2s for fact queries
- Verify response time < 3s for conversational queries

### Test Data

**Fact Retrieval Queries**:
```javascript
[
  "What is Serhii's email?",
  "How many years of experience does he have?",
  "What's his LinkedIn profile?",
  "When did he graduate?",
  "What is his phone number?"
]
```

**Conversational Queries**:
```javascript
[
  "Tell me about his management style",
  "Describe his technical expertise",
  "What projects has he worked on?",
  "How does he approach problem solving?",
  "What are his key strengths?"
]
```

## Performance Considerations

### Optimization Strategies

**Parallel Worker Loading**:
```javascript
// Load all workers simultaneously
await Promise.all([
  this.initializeEmbeddingWorker(),
  this.initializeTextGenWorker(),
  this.initializeEQAWorker()
]);
```

**Embedding Caching**:
- Reuse existing cache-manager utility
- Cache query embeddings
- Pre-compute chunk embeddings

**Context Optimization**:
- Limit to top 5 similar chunks for fact retrieval
- Apply stricter threshold for conversational (top 2-3 chunks)
- Minimize context size for faster processing

**Request Batching**:
- Use existing batch embedding generation for chunks
- Single embedding request per query

### Performance Targets

**Initialization Phase** (one-time cost):
- **Embedding Worker Load**: < 3s
- **Context Preparation**: < 1s (parallel with step 3)
- **SmolLM & EQA Worker Load**: < 7s (parallel with step 2)
- **Chunk Embedding Pre-computation**: < 2s
- **Total Initialization**: < 10s

**Query Processing Phase** (per-query):
- **Query Preprocessing**: < 50ms
- **Embedding Generation**: < 200ms
- **Similarity Calculation**: < 100ms
- **EQA Answer Extraction**: < 1s
- **SmolLM Generation**: < 2s
- **Total Fact Query**: < 2s
- **Total Conversational Query**: < 3s

## Integration Points

### Chat Bot Integration

**Replace dual-worker-coordinator**:
```javascript
// Old approach
this.semanticQA = new DualWorkerCoordinator({ ... });
await this.semanticQA.processQuestion(question, cvChunks, options);

// New approach
this.qaRouter = new ChatBotQARouter({ ... });
await this.qaRouter.processQuery(question, options);
```

**Update chat-bot.js**:
```javascript
async initializeChat() {
  // Load CV data
  await this.cvDataService.loadCVData();
  this.cvChunks = this.cvDataService.prepareCVChunks();
  
  // Initialize router
  this.qaRouter = new ChatBotQARouter({
    embeddingWorkerPath: './scripts/workers/embedding-worker.js',
    textGenWorkerPath: './scripts/workers/optimized-ml-worker.js',
    eqaWorkerPath: './scripts/workers/eqa-worker.js'
  });
  
  await this.qaRouter.initialize(this.cvChunks);
}

async processMessage(message) {
  const context = this.conversationManager.getContext();
  const result = await this.qaRouter.processQuery(message, {
    style: this.currentStyle,
    context
  });
  
  this.handleRouterResponse(result);
}
```

### Utility Module Reuse

**Existing modules to reuse**:
- `query-processor.js` - Query preprocessing and enhancement
- `similarity-calculator.js` - Cosine similarity and chunk ranking
- `cv-context-builder.js` - Context formatting
- `prompt-builder.js` - Prompt construction for SmolLM
- `response-validator.js` - Response quality validation
- `cache-manager.js` - Embedding caching

**No modifications needed** - these utilities are already modular and can be used as-is.

## Security Considerations

### Input Validation

```javascript
// Validate query input
if (!question || typeof question !== 'string') {
  throw new Error('Invalid query input');
}

if (question.length > 1000) {
  throw new Error('Query too long');
}
```

### Worker Sandboxing

- Workers run in isolated contexts
- No access to main thread DOM
- Limited to message passing interface

### Model Security

- Models loaded from trusted CDN (Xenova)
- No user-provided model paths
- Quantized models for reduced attack surface

## Monitoring and Debugging

### Logging Strategy

```javascript
// Log key decision points
console.log('[ChatBotQARouter] Intent classified:', intent);
console.log('[ChatBotQARouter] Similar chunks found:', chunks.length);
console.log('[ChatBotQARouter] EQA confidence:', confidence);
console.log('[ChatBotQARouter] Fallback triggered:', reason);
```

### Metrics Collection

```javascript
{
  totalQueries: number,
  factRetrievalQueries: number,
  conversationalQueries: number,
  eqaFallbacks: number,
  avgResponseTime: number,
  avgConfidence: number,
  errorCount: number
}
```

### Debug Mode

```javascript
if (window.isDev) {
  console.log('[ChatBotQARouter] Debug info:', {
    query: question,
    intent,
    chunks: similarChunks.map(c => c.id),
    confidence,
    processingTime
  });
}
```

## Future Enhancements (Out of Scope)

- Machine learning-based intent classification
- Multi-turn conversation context for EQA
- Hybrid responses (EQA + generation)
- Confidence calibration based on user feedback
- A/B testing framework for routing strategies
- Advanced caching strategies (LRU, TTL)
- Model switching based on query complexity
