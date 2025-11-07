# Worker Consolidation and Refactoring Implementation Plan

## Overview

This implementation plan consolidates four ML workers into a streamlined two-worker architecture with modular utility functions. The approach focuses on separation of concerns, maintainability, and testability while preserving all existing functionality.

## Implementation Tasks

- [x] 1. Create utility modules structure and extract business logic
  - Create utils directory structure for semantic-qa module
  - Extract and modularize functions from existing workers
  - Implement pure functions with clear interfaces
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 1.1 Create query-processor utility module
  - Extract preprocessQuery, expandQueryWithSynonyms, normalizeQuery functions from chat-ml-worker.js
  - Extract extractContextKeywords and getAdaptiveThreshold functions
  - Implement as pure functions with input validation
  - _Requirements: 2.1, 2.7_

- [x] 1.2 Create cv-context-builder utility module
  - Extract findRelevantSectionsByKeywords and buildCVContext functions from chat-ml-worker.js
  - Extract createSearchText, groupSectionsByCategory, determineSynthesisStrategy functions
  - Implement CV data processing logic as pure functions
  - _Requirements: 2.2, 2.7_

- [x] 1.3 Create response-validator utility module
  - Extract validateResponseQuality, assessQueryRelevance, calculateOverallConfidence functions from chat-ml-worker.js
  - Extract cleanAndValidateText function and invalid patterns from constrained-ml-worker.js
  - Implement hallucination detection and quality scoring
  - _Requirements: 2.3, 2.7, 3.2_

- [x] 1.4 Create similarity-calculator utility module
  - Extract similarity calculation functions from chat-ml-worker.js
  - Implement findSimilarChunks, rankSectionsBySimilarity, applySimilarityThreshold functions
  - Create pure functions for cosine similarity calculations
  - _Requirements: 2.4, 2.7_

- [x] 1.5 Create prompt-builder utility module
  - Extract createPrompt, buildEnhancedPrompt, getStyleInstructions functions from chat-ml-worker.js
  - Implement formatContextForPrompt function for LLM optimization
  - Create style-specific prompt templates
  - _Requirements: 2.5, 2.7_

- [x] 1.6 Create cache-manager utility module
  - Extract caching functions from chat-ml-worker.js performance manager
  - Implement cacheEmbedding, getCachedEmbedding, cacheQueryResult functions
  - Create generateCacheKey and clearCache utility functions
  - _Requirements: 2.6, 2.7_

- [ ] 2. Enhance optimized-ml-worker with constrained generation
  - Integrate validation logic from constrained-ml-worker into optimized-ml-worker
  - Implement strict response constraints and hallucination detection
  - Remove performance monitoring code for cleaner implementation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 2.1 Add response validation to optimized-ml-worker
  - Integrate cleanAndValidateText function with invalid patterns array
  - Implement first-person response validation logic
  - Add response format validation and filtering
  - _Requirements: 3.2, 3.5, 3.6_

- [ ] 2.2 Implement constrained generation parameters
  - Cap maximum tokens at 60 for focused responses
  - Cap temperature at 0.3 for deterministic output
  - Add early_stopping parameter for better control
  - _Requirements: 3.3, 3.4_

- [ ] 2.3 Add validation error handling
  - Return null for responses that fail validation
  - Implement clear error messages for validation failures
  - Add validation metrics to response data
  - _Requirements: 3.7_

- [ ] 3. Enhance embedding-worker with CV data integration
  - Add CV data service integration for batch processing CV sections
  - Implement similarity threshold filtering capabilities
  - Maintain existing caching and batch processing features
  - _Requirements: 1.2, 6.1_

- [ ] 3.1 Add CV data processing methods
  - Implement processCVSections method for batch CV embedding generation
  - Add filterBySimilarityThreshold method for threshold-based filtering
  - Integrate with existing batch processing capabilities
  - _Requirements: 1.2, 6.1_

- [ ] 3.2 Maintain embedding worker functionality
  - Preserve all existing embedding generation and caching features
  - Ensure compatibility with current message handling patterns
  - Keep robust error handling and progress reporting
  - _Requirements: 6.1, 6.6_

- [ ] 4. Refactor dual-worker-coordinator to use utilities
  - Simplify coordinator to orchestration logic only
  - Integrate all utility modules for business logic processing
  - Remove embedded business logic and delegate to utilities
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 4.1 Implement simplified processQuestion workflow
  - Use query-processor for query enhancement
  - Use similarity-calculator for chunk matching
  - Use cv-context-builder for context creation
  - Use prompt-builder for LLM prompt construction
  - Use response-validator for quality validation
  - _Requirements: 4.2, 4.5_

- [ ] 4.2 Integrate cache-manager with coordinator
  - Use cache-manager for all caching operations
  - Pass cached data to workers via function arguments
  - Store worker results using cache-manager after successful processing
  - _Requirements: 4.1, 4.3_

- [ ] 4.3 Maintain worker communication patterns
  - Preserve existing worker message formats and error handling
  - Keep clear separation between orchestration and business logic
  - Ensure backward compatibility with current integration points
  - _Requirements: 4.4, 6.6_

- [ ] 5. Create comprehensive unit tests for utilities
  - Create test files for each utility module with full coverage
  - Test edge cases and error conditions for all functions
  - Verify pure function behavior and input validation
  - _Requirements: 7.1, 7.4_

- [ ] 5.1 Create query-processor tests
  - Test query preprocessing, synonym expansion, and normalization
  - Test context keyword extraction and adaptive threshold calculation
  - Verify edge cases with empty or invalid inputs
  - _Requirements: 7.1, 7.4_

- [ ] 5.2 Create cv-context-builder tests
  - Test CV section keyword matching and context building
  - Test synthesis strategy determination and section grouping
  - Verify handling of missing or malformed CV data
  - _Requirements: 7.1, 7.4_

- [ ] 5.3 Create response-validator tests
  - Test response quality validation and confidence calculation
  - Test hallucination detection with invalid patterns
  - Verify quality scoring and relevance assessment
  - _Requirements: 7.1, 7.4_

- [ ] 5.4 Create similarity-calculator tests
  - Test cosine similarity calculations and chunk ranking
  - Test similarity threshold filtering and section matching
  - Verify handling of different embedding dimensions
  - _Requirements: 7.1, 7.4_

- [ ] 5.5 Create prompt-builder tests
  - Test prompt construction for different styles and contexts
  - Test context formatting and style instruction generation
  - Verify prompt optimization for small LLM constraints
  - _Requirements: 7.1, 7.4_

- [ ] 5.6 Create cache-manager tests
  - Test embedding and query result caching functionality
  - Test cache key generation and cache clearing operations
  - Verify cache size limits and eviction policies
  - _Requirements: 7.1, 7.4_

- [ ] 6. Test enhanced workers independently
  - Create tests for enhanced optimized-ml-worker validation features
  - Test embedding-worker CV integration capabilities
  - Verify worker message handling and error responses
  - _Requirements: 7.2, 7.4_

- [ ] 6.1 Test enhanced text generation worker
  - Test constrained generation parameters and validation logic
  - Test hallucination detection and response filtering
  - Verify error handling for validation failures
  - _Requirements: 7.2, 7.4_

- [ ] 6.2 Test enhanced embedding worker
  - Test CV data processing and batch embedding generation
  - Test similarity threshold filtering functionality
  - Verify compatibility with existing embedding operations
  - _Requirements: 7.2, 7.4_

- [ ] 7. Test simplified coordinator integration
  - Test complete question processing workflow using utilities
  - Verify worker communication and message handling
  - Test error handling and fallback mechanisms
  - _Requirements: 7.3, 7.5_

- [ ] 7.1 Test coordinator workflow integration
  - Test end-to-end question processing with all utilities
  - Verify proper data flow between utilities and workers
  - Test error propagation and handling across components
  - _Requirements: 7.3, 7.5_

- [ ] 7.2 Verify functionality preservation
  - Compare outputs before and after refactoring for consistency
  - Test all existing coordinator API endpoints and methods
  - Verify backward compatibility with current usage patterns
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.5_

- [ ] 8. Clean up obsolete files and finalize structure
  - Remove constrained-ml-worker.js and chat-ml-worker.js files
  - Update import statements and file references
  - Verify clean file organization and proper module structure
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8.1 Remove obsolete worker files
  - Delete constrained-ml-worker.js after verifying functionality migration
  - Delete chat-ml-worker.js after confirming all features preserved
  - Update any remaining references to removed files
  - _Requirements: 5.1, 5.2_

- [ ] 8.2 Verify file organization and imports
  - Ensure utils directory structure is properly organized
  - Verify all ES6 named imports are correctly configured
  - Test that tree-shaking works properly with modular structure
  - _Requirements: 5.3, 5.4, 5.5_

- [ ] 8.3 Final integration verification
  - Run complete test suite to verify all functionality works
  - Test integration points with existing system components
  - Verify performance characteristics are maintained
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_