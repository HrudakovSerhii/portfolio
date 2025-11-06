# Semantic Q&A Analyzer Feature

## Overview
Build a semantic question-answering system that uses a tiny analyzer model to convert large context into embeddings, find relevant chunks, and provide structured responses using fenced context.

## Core Components

### 1. Embedding Service
- Use `Xenova/distilbert-base-uncased` or similar lightweight model
- Convert text chunks into numeric embeddings
- Implement semantic similarity search
- Cache embeddings for performance

### 2. Context Chunker
- Split large context into manageable chunks
- Preserve semantic boundaries (sentences, paragraphs)
- Maintain metadata for each chunk (source, type, relevance)

### 3. Similarity Matcher
- Find 1-3 most semantically similar chunks to user question
- Use cosine similarity or similar metric
- Rank results by relevance score

### 4. Context Fencer
- Structure relevant chunks into fenced format:
  ```
  * Fact: [Structured fact from context]
  * Fact: [Another relevant fact]
  * Question: [User's question]
  * Answer: [Expected response format]
  ```

### 5. Q&A Engine
- Strong system prompt with clear rules
- Constrained responses based only on provided context
- Fallback for insufficient information

## Technical Requirements

### Dependencies
- `@xenova/transformers` for the analyzer model
- Web Workers for non-blocking processing
- IndexedDB for embedding cache

### Performance Targets
- < 500ms for embedding generation
- < 100ms for similarity search
- < 50MB memory footprint for model

### Integration Points
- Extend existing chat-bot system
- Work with current CV data structure
- Maintain compatibility with WebLLM fallback

## Implementation Plan

### Phase 1: Core Embedding Service
- [ ] Set up Xenova transformer model
- [ ] Implement text chunking algorithm
- [ ] Create embedding generation pipeline
- [ ] Add similarity search functionality

### Phase 2: Context Processing
- [ ] Build context fencing system
- [ ] Implement structured fact extraction
- [ ] Create relevance scoring
- [ ] Add metadata preservation

### Phase 3: Q&A Integration
- [ ] Design system prompt template
- [ ] Implement constrained response logic
- [ ] Add fallback handling
- [ ] Create response validation

### Phase 4: Performance Optimization
- [ ] Add embedding caching
- [ ] Optimize chunk size and overlap
- [ ] Implement lazy loading
- [ ] Add performance monitoring

## File Structure
```
src/scripts/modules/semantic-qa/
├── embedding-service.js       # Core embedding functionality
├── context-chunker.js         # Text chunking and processing
├── similarity-matcher.js      # Semantic search implementation
├── context-fencer.js          # Structured context formatting
├── qa-engine.js              # Question answering logic
└── semantic-qa-manager.js    # Main orchestrator

src/scripts/workers/
└── embedding-worker.js       # Web Worker for model processing

test/
├── embedding-service.test.js
├── semantic-qa.test.js
└── semantic-qa-integration.html
```

## Success Criteria
- Accurate answers based only on provided context
- Fast response times (< 1 second total)
- Clear "I don't know" responses when context insufficient
- Seamless integration with existing chat system
- Minimal impact on bundle size and performance

## Example Usage
```javascript
const qaSystem = new SemanticQAManager();
await qaSystem.initialize();

const context = "Serhii has been working with React for 4+ years. He is a Senior Product Manager...";
const question = "Does Serhii have experience with React?";

const answer = await qaSystem.askQuestion(question, context);
// Expected: "Yes, Serhii has been working with React for 4+ years."
```