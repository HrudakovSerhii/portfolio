# CV Utility Adaptations for Small LLM Models

## Overview

The CV utility modules have been adapted to work with the new hierarchical CV schema optimized for SmolLM2-135M-Instruct. The key focus is on efficient context management, communication style awareness, and priority-based retrieval.

## Key Adaptations

### 1. CV Context Builder (`cv-context-builder.js`)

#### New Features:
- **Hierarchical Section Processing**: Works with the new `core`, `experience`, `skills`, `themes`, and `personal` categories
- **Communication Style Detection**: Automatically detects HR, developer, or friend communication patterns from queries
- **Priority-Weighted Scoring**: Uses section priority (1-5) and confidence (0-1) for better relevance
- **Small LLM Optimization**: Limits context to 2 sections maximum to fit small model context windows

#### Key Functions:
- `findRelevantSectionsByKeywords()`: Enhanced with priority/confidence weighting
- `buildCVContext()`: Optimized for communication styles and small context windows
- `detectCommunicationStyle()`: Analyzes query patterns to determine appropriate response style
- `getFallbackResponse()`: Uses predefined response templates for low-confidence scenarios

### 2. Similarity Calculator (`similarity-calculator.js`)

#### New Features:
- **Weighted Similarity Calculation**: Combines embedding similarity with priority and confidence scores
- **Adaptive Thresholding**: Lower thresholds (0.3 vs 0.5) for small LLM permissiveness
- **Category Boosting**: Prioritizes `core` and `experience` sections
- **Retrieval Confidence**: Calculates overall confidence for fallback decisions

#### Key Functions:
- `findSimilarSections()`: Works with hierarchical CV structure and applies weighting
- `rankSectionsByWeightedSimilarity()`: Multi-factor ranking with metadata
- `applySimilarityThreshold()`: Adaptive thresholding with priority adjustments
- `calculateRetrievalConfidence()`: Overall confidence scoring for response quality

### 3. Context Formatter (`context-formatter.js`)

#### New Features:
- **Concise Context Generation**: Maximum 400 characters for small LLM context windows
- **Style-Aware Formatting**: Applies communication style to responses
- **Truncation Management**: Intelligent truncation while preserving key information
- **Metadata Generation**: Rich metadata for debugging and optimization

#### Key Functions:
- `buildContextString()`: Optimized context generation with length limits
- `calculateContextConfidence()`: Multi-factor confidence calculation
- `formatResponseWithStyle()`: Post-processing for communication style consistency
- `createContextMetadata()`: Comprehensive metadata for analysis

## Small LLM Optimizations

### Context Window Management
- **Maximum 2 sections** per query (vs 3-5 in larger models)
- **400 character limit** for context strings
- **Intelligent truncation** preserving essential information
- **Priority-based selection** ensuring most relevant content

### Communication Style Awareness
- **Automatic style detection** from query patterns
- **Style-specific responses** using pre-written templates
- **Fallback handling** with appropriate tone and language
- **Personality integration** for consistent character

### Performance Enhancements
- **Hierarchical processing** for efficient section traversal
- **Weighted scoring** combining multiple relevance factors
- **Adaptive thresholds** for better recall with small models
- **Confidence-based routing** to fallback responses

## Schema Integration

### New Data Structure Support
- **embeddingSourceText**: Dense, keyword-rich text for optimal retrieval
- **responseTemplates**: Pre-written fallback responses by communication style
- **personality.communication_style**: Style-specific tone and language guidelines
- **priority/confidence**: Section-level quality and importance scores

### Backward Compatibility
- Graceful handling of missing embeddings
- Default values for priority (3) and confidence (1.0)
- Fallback to developer style when style detection fails

## Usage Examples

```javascript
// Find relevant sections with communication style
const matches = findRelevantSectionsByKeywords(
  "What technologies do you use?", 
  cvData, 
  "developer"
);

// Build optimized context
const context = buildCVContext(matches, "developer", cvData);

// Format for small LLM
const contextString = buildContextString(
  matches, 
  "What technologies do you use?", 
  "developer",
  { maxContextLength: 400, conciseMode: true }
);
```

## Benefits for Small LLM Models

1. **Reduced Context Overhead**: Smaller, focused context windows
2. **Better Relevance**: Priority and confidence-based selection
3. **Style Consistency**: Communication-aware responses
4. **Graceful Degradation**: Fallback responses for low confidence
5. **Performance**: Optimized for 135M parameter model constraints

## Future Enhancements

- Dynamic context length based on query complexity
- Learning from user feedback to improve style detection
- Caching of frequently accessed sections
- A/B testing of different context strategies