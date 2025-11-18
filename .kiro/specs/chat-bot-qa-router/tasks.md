# Implementation Plan

- [x] 1. Create EQA Worker for extractive question answering
  - Create `src/scripts/workers/eqa-worker.js` with Xenova distilbert-squad model
  - Implement message handlers for `initialize` and `extractAnswer` message types
  - Add model loading with progress callbacks for download tracking
  - Implement answer extraction with confidence scoring
  - Add error handling and timeout management
  - Add comprehensive logging: model loading, answer extraction, confidence scores, errors
  - _Requirements: 3.2, 6.4_

- [x] 2. Create Intent Classifier utility module
  - Create `src/scripts/modules/chat-bot/utils/intent-classifier.js`
  - Implement `classifyIntent(query)` function with fact-finding prefix detection
  - Add fact keyword detection for queries containing specific terms
  - Return classification result: `fact_retrieval` or `conversational_synthesis`
  - Add logging: query text, detected patterns, classification result, reasoning
  - _Requirements: 1.1, 1.5, 2.1_

- [x] 3. Implement Chat Bot QA Router core module
- [x] 3.1 Create router class structure and configuration
  - Create `src/scripts/modules/chat-bot/chat-bot-qa-router.js`
  - Implement constructor with configuration options (worker paths, thresholds, timeouts)
  - Add worker instance properties and state management
  - Implement request ID generation and pending requests map
  - Add logging: router initialization, configuration values, state changes
  - _Requirements: 5.1, 5.3_

- [x] 3.2 Implement worker initialization with optimized loading sequence
  - Implement `initialize(cvChunks)` method with 4-step initialization flow
  - Load embedding worker first (Step 1)
  - Implement parallel execution: context preparation + SmolLM/EQA worker loading (Steps 2-3)
  - Implement chunk embedding pre-computation (Step 4)
  - Add worker ready state tracking and timeout handling
  - Add logging: each initialization step start/complete, timing, worker ready states, chunk count
  - _Requirements: 3.1, 3.2, 3.4, 4.5_

- [x] 3.3 Create generic worker communication interface
  - Create `src/scripts/modules/chat-bot/utils/worker-communicator.js` utility
  - Implement `WorkerCommunicator` class that wraps a worker instance
  - Provide generic `sendMessage(type, data)` method with promise-based response
  - Implement timeout handling (configurable, default 5 seconds)
  - Add request ID generation and pending requests tracking
  - Implement error handling for worker communication
  - Add logging: message sent, request ID, response received, timeouts, errors
  - _Requirements: 3.4, 6.3_

- [x] 3.4 Implement worker message handlers using communicator interface
  - Instantiate `WorkerCommunicator` for each worker (embedding, text generation, EQA)
  - Set up message event listeners using the communicator interface
  - Handle worker-specific message types through the generic interface
  - Add worker-specific error handling
  - Add logging: worker type, message type, success/failure status
  - _Requirements: 3.4, 6.3_

- [x] 3.5 Implement query processing pipeline (Steps 5-7)
  - Implement query preprocessing using existing `query-processor` utility
  - Implement query embedding generation via embedding worker communicator
  - Implement similar chunk retrieval using `similarity-calculator` utility
  - Add performance timing for each step
  - Add logging: original query, enhanced query, embedding dimensions, similar chunks found, similarity scores, timing
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3.6 Implement intent-based routing logic (Step 8)
  - Integrate intent classifier into query processing flow
  - Route to fact retrieval path when intent is `fact_retrieval`
  - Route to conversational path when intent is `conversational_synthesis`
  - Add logging: intent classification result, routing decision, path taken
  - _Requirements: 1.1, 1.5, 2.1_

- [x] 3.7 Implement fact retrieval path (Step 9a)
  - Combine similar chunks into single context string
  - Send question and context to EQA worker using communicator interface
  - Implement confidence threshold check (0.3 minimum)
  - Implement fallback to conversational path on low confidence
  - Implement fallback on empty answer from EQA
  - Add logging: context length, EQA answer, confidence score, fallback triggers, timing
  - _Requirements: 1.2, 1.3, 6.1, 6.4_

- [x] 3.8 Implement conversational synthesis path (Step 9b)
  - Apply similarity threshold filtering using `similarity-calculator`
  - Build CV context using `cv-context-builder` utility
  - Create prompt using `prompt-builder` utility with style and conversation context
  - Send prompt to SmolLM text generation worker using communicator interface
  - Add logging: filtered chunks count, context length, prompt length, generated response, timing
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 3.9 Implement response formatting and validation (Step 10)
  - Validate response using `response-validator` utility
  - Format response with answer, confidence, intent, method, and metrics
  - Add processing time calculation
  - Implement error response formatting
  - Add logging: validation result, final response format, total processing time, all metrics
  - _Requirements: 1.4, 2.5, 6.2_

- [x] 3.10 Implement cleanup and resource management
  - Implement `cleanup()` method to terminate workers
  - Clear pending requests on cleanup
  - Implement `getStatus()` method for monitoring
  - Add graceful shutdown handling
  - Add logging: cleanup initiated, workers terminated, pending requests cleared
  - _Requirements: 3.5_

- [x] 4. Integrate router into chat-bot.js
- [x] 4.1 Replace dual-worker-coordinator with chat-bot-qa-router
  - Update imports in `src/scripts/modules/chat-bot/chat-bot.js`
  - Replace `DualWorkerCoordinator` instantiation with `ChatBotQARouter`
  - Update configuration to include EQA worker path
  - Remove unused dual-worker-coordinator references (not file!)
  - _Requirements: 5.5_

- [x] 4.2 Update chat initialization flow
  - Modify `initializeChat()` method to use router's `initialize()` method
  - Pass CV chunks to router during initialization
  - Update loading progress tracking for 3 workers
  - Handle initialization errors appropriately
  - Add logging: initialization start, CV chunks count, router ready state, errors
  - _Requirements: 3.1, 3.5_

- [x] 4.3 Update message processing flow
  - Modify `processMessage()` to call router's `processQuery()` method
  - Pass conversation style and context to router
  - Update response handling to work with router response format
  - Preserve existing conversation manager integration
  - Add logging: user message, style, router response, confidence, method used
  - _Requirements: 5.5_

- [x] 4.4 Update cleanup and error handling
  - Call router's `cleanup()` method in `destroy()`
  - Update error handling to work with router error responses
  - Maintain existing fallback handler integration
  - _Requirements: 3.5, 6.3_

- [x] 5. Update loading progress indicator
  - Update progress bar calculation to reflect accurate model sizes
  - Implement weighted progress: Embedding (6%), EQA (18%), SmolLM (76%)
  - Ensure smooth progress without jumps during parallel loading
  - Test progress indicator with actual model download times
  - _Additional: Model sizes - SmolLM: 270MB, all-MiniLM-L6-v2: 23MB, distilbert-squad: 65MB_

- [ ] 6. Test and validate implementation
- [ ] 6.1 Manual testing with fact retrieval queries
  - Test queries with fact-finding prefixes ("what is", "how many", etc.)
  - Test queries with fact keywords ("email", "contact", "phone", etc.)
  - Verify EQA worker returns extracted answers with confidence scores via console logs
  - Verify response time < 2 seconds for fact queries via console logs
  - Review all logged steps for fact retrieval path
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 6.2 Manual testing with conversational queries
  - Test queries requiring synthesized narrative responses
  - Verify SmolLM worker generates coherent responses via console logs
  - Verify similarity threshold filtering works correctly via console logs
  - Verify response time < 3 seconds for conversational queries via console logs
  - Review all logged steps for conversational path
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 6.3 Manual testing of fallback scenarios
  - Test EQA low confidence fallback to conversational path via console logs
  - Test EQA empty answer fallback to conversational path via console logs
  - Test no relevant context found scenario via console logs
  - Test worker timeout handling via console logs
  - Test worker error handling via console logs
  - Review all logged fallback triggers and decisions
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6.4 Manual testing of initialization and cleanup
  - Test parallel worker loading performance via console logs
  - Test chunk embedding pre-computation via console logs
  - Test router cleanup and worker termination via console logs
  - Verify total initialization time < 10 seconds via console logs
  - Review all logged initialization steps and timing
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [ ] 6.5 Manual integration testing with chat-bot
  - Test end-to-end flow with various conversation styles
  - Test conversation context preservation via console logs
  - Test fallback handler integration via console logs
  - Verify UI updates correctly for both query types
  - Review complete flow logs from user input to UI response
  - _Requirements: 5.5_
