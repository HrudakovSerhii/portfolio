# Worker Consolidation and Refactoring Requirements

## Introduction

This specification outlines the consolidation of four existing ML workers into a simplified two-worker architecture with utility modules. The goal is to reduce code duplication, improve maintainability, and create a cleaner separation of concerns while maintaining all essential functionality for the semantic Q&A system.

## Glossary

- **Worker**: A Web Worker that runs ML models or processing in a separate thread
- **Coordinator**: The main orchestrator that manages communication between workers
- **Utility Module**: A focused module containing specific business logic functions
- **CV Data**: Curriculum Vitae data used for context in Q&A responses
- **Embedding**: Vector representation of text for semantic similarity calculations
- **Text Generation**: Process of creating natural language responses using LLM

## Requirements

### Requirement 1: Worker Architecture Simplification

**User Story:** As a developer, I want a simplified worker architecture so that the codebase is easier to maintain and understand.

#### Acceptance Criteria

1. THE System SHALL consolidate four existing workers into two specialized workers
2. THE System SHALL maintain one worker dedicated to embedding operations only
3. THE System SHALL maintain one worker dedicated to text generation operations only
4. THE System SHALL remove redundant functionality across workers
5. THE System SHALL preserve all essential functionality from existing workers

### Requirement 2: Utility Module Extraction

**User Story:** As a developer, I want business logic extracted into focused utility modules so that I can test and maintain individual functions independently.

#### Acceptance Criteria

1. THE System SHALL create a query-processor utility module for query enhancement
2. THE System SHALL create a cv-context-builder utility module for CV data processing
3. THE System SHALL create a response-validator utility module for quality validation
4. THE System SHALL create a similarity-calculator utility module for similarity operations
5. THE System SHALL create a prompt-builder utility module for LLM prompt construction
6. WHEN a utility module is created, THE System SHALL ensure it contains only related functions
7. THE System SHALL make each utility module independently testable

### Requirement 3: Enhanced Text Generation Worker

**User Story:** As a system, I want an optimized text generation worker so that I can produce high-quality, constrained responses from the small LLM.

#### Acceptance Criteria

1. THE System SHALL enhance optimized-ml-worker with validation logic from constrained-ml-worker
2. THE System SHALL implement strict response validation with hallucination detection
3. THE System SHALL cap maximum tokens at 60 for focused responses
4. THE System SHALL cap temperature at 0.3 for deterministic output
5. THE System SHALL validate responses start with first-person indicators
6. THE System SHALL filter responses containing invalid patterns
7. THE System SHALL return null for responses that fail validation

### Requirement 4: Coordinator Simplification

**User Story:** As a developer, I want a simplified coordinator so that the main business logic is easy to understand and maintain.

#### Acceptance Criteria

1. THE System SHALL reduce dual-worker-coordinator to orchestration logic only
2. THE System SHALL delegate all business logic to appropriate utility modules
3. THE System SHALL maintain clear separation between worker communication and business logic
4. THE System SHALL preserve all existing coordinator functionality through utilities
5. WHEN processing a question, THE System SHALL follow a clear step-by-step workflow using utilities

### Requirement 5: File Cleanup and Organization

**User Story:** As a developer, I want obsolete files removed and proper organization so that the codebase is clean and navigable.

#### Acceptance Criteria

1. THE System SHALL remove constrained-ml-worker.js after migrating functionality
2. THE System SHALL remove chat-ml-worker.js after migrating functionality
3. THE System SHALL organize utility modules in a utils subdirectory
4. THE System SHALL maintain embedding-worker.js with minimal enhancements
5. THE System SHALL create corresponding test files for each utility module

### Requirement 6: Functionality Preservation

**User Story:** As a user, I want all existing Q&A functionality preserved so that the system continues to work as expected.

#### Acceptance Criteria

1. THE System SHALL preserve all CV data processing capabilities
2. THE System SHALL preserve all query preprocessing and enhancement features
3. THE System SHALL preserve all response quality validation mechanisms
4. THE System SHALL preserve all similarity calculation and ranking features
5. THE System SHALL preserve all prompt building and style customization
6. THE System SHALL maintain compatibility with existing integration points

### Requirement 7: Testing Infrastructure

**User Story:** As a developer, I want comprehensive test coverage so that I can verify the refactored system works correctly.

#### Acceptance Criteria

1. THE System SHALL create unit tests for each utility module
2. THE System SHALL create integration tests for the simplified coordinator
3. THE System SHALL create tests for the enhanced text generation worker
4. THE System SHALL verify all migrated functionality works as expected
5. THE System SHALL maintain existing test compatibility where applicable