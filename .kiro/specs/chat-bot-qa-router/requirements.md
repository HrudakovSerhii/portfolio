# Requirements Document

## Introduction

This feature implements a hybrid question-answering router for the chatbot that intelligently routes user queries to specialized workers based on intent classification. The system distinguishes between fact-retrieval questions (requiring extractive answers) and conversational questions (requiring synthesized responses), routing each to the appropriate ML model to improve answer quality and reduce hallucinations.

## Glossary

- **Chat Bot QA Router**: The main orchestration module that manages the question-answering pipeline from query preprocessing through response generation
- **Intent Classifier**: A utility function that analyzes user queries to determine whether they require fact retrieval or conversational synthesis
- **EQA Worker**: A web worker that loads and executes the distilbert-squad model for extractive question answering
- **Text Generation Worker**: The existing SmolLM worker that generates conversational responses
- **Embedding Worker**: The existing worker that generates vector embeddings for semantic similarity search
- **Context Chunks**: Segmented pieces of CV data with pre-computed embeddings used for semantic retrieval
- **Similarity Calculator**: Utility that computes cosine similarity between query embeddings and context chunk embeddings
- **Fact Retrieval Query**: A user question seeking specific factual information (e.g., email, years of experience, contact details)
- **Conversational Query**: A user question requiring synthesized narrative responses (e.g., "Tell me about management style")

## Requirements

### Requirement 1

**User Story:** As a chatbot user, I want fact-based questions to return precise extracted answers, so that I receive accurate information without hallucinations

#### Acceptance Criteria

1. WHEN the user submits a query starting with fact-finding keywords ("what is", "how many", "when did"), THE Chat Bot QA Router SHALL classify the intent as "fact_retrieval"
2. WHEN the intent is classified as "fact_retrieval", THE Chat Bot QA Router SHALL route the query to the EQA Worker with relevant context chunks
3. WHEN the EQA Worker processes a fact retrieval query, THE EQA Worker SHALL return an extracted answer span from the provided context
4. THE Chat Bot QA Router SHALL return the extracted answer to the user interface within 2 seconds of query submission
5. WHERE the query contains fact-related keywords ("email", "contact", "phone", "linkedin"), THE Intent Classifier SHALL classify the intent as "fact_retrieval"

### Requirement 2

**User Story:** As a chatbot user, I want conversational questions to receive natural synthesized responses, so that I get comprehensive narrative answers about complex topics

#### Acceptance Criteria

1. WHEN the user submits a query that does not match fact-retrieval patterns, THE Intent Classifier SHALL classify the intent as "conversational_synthesis"
2. WHEN the intent is classified as "conversational_synthesis", THE Chat Bot QA Router SHALL route the query to the Text Generation Worker with filtered context chunks
3. WHEN the Text Generation Worker processes a conversational query, THE Text Generation Worker SHALL generate a coherent narrative response based on the provided context
4. THE Chat Bot QA Router SHALL apply similarity threshold filtering to context chunks before passing them to the Text Generation Worker
5. THE Chat Bot QA Router SHALL return the synthesized response to the user interface within 3 seconds of query submission

### Requirement 3

**User Story:** As a chatbot system, I want to efficiently manage three specialized workers, so that I can process queries with optimal performance and minimal resource usage

#### Acceptance Criteria

1. WHEN the Chat Bot QA Router initializes, THE Chat Bot QA Router SHALL load the Embedding Worker, Text Generation Worker, and EQA Worker
2. THE EQA Worker SHALL load the Xenova/distilbert-base-cased-distilled-squad model from remote source
3. THE Chat Bot QA Router SHALL reuse the same Embedding Worker for all query embedding generation
4. WHEN a worker fails to load, THE Chat Bot QA Router SHALL log the error and provide a fallback error message to the user
5. THE Chat Bot QA Router SHALL terminate workers gracefully when the chatbot is closed or page is unloaded

### Requirement 4

**User Story:** As a chatbot system, I want to preprocess user queries and retrieve relevant context efficiently, so that workers receive optimal input for generating accurate responses

#### Acceptance Criteria

1. WHEN the user submits a query, THE Chat Bot QA Router SHALL preprocess the query to enhance it for better semantic matching
2. WHEN the preprocessed query is ready, THE Chat Bot QA Router SHALL generate an embedding vector using the Embedding Worker
3. WHEN the query embedding is generated, THE Chat Bot QA Router SHALL use the Similarity Calculator to find the top-k most similar context chunks
4. THE Similarity Calculator SHALL compute cosine similarity between the query embedding and all pre-computed chunk embeddings
5. THE Chat Bot QA Router SHALL retrieve at least 5 relevant context chunks for each query

### Requirement 5

**User Story:** As a developer, I want the router to have a streamlined architecture without unnecessary complexity, so that the system is maintainable and performs efficiently for the PoC chatbot

#### Acceptance Criteria

1. THE Chat Bot QA Router SHALL implement only the essential logic required for the 10-step query processing flow
2. THE Chat Bot QA Router SHALL not include configuration management, model switching, or other "good-to-have" features present in the dual-worker-coordinator
3. THE Chat Bot QA Router SHALL expose a single public method for processing user queries
4. THE Chat Bot QA Router SHALL use existing utility modules (similarity-calculator, prompt-builder) without modification
5. THE Chat Bot QA Router SHALL be implemented as a standalone module independent of the dual-worker-coordinator

### Requirement 6

**User Story:** As a chatbot user, I want the system to handle edge cases gracefully, so that I receive helpful responses even when the ideal answer cannot be generated

#### Acceptance Criteria

1. WHEN the EQA Worker returns an answer with confidence below 0.3, THE Chat Bot QA Router SHALL fall back to the Text Generation Worker
2. WHEN no relevant context chunks are found above the similarity threshold, THE Chat Bot QA Router SHALL return a message indicating insufficient information
3. WHEN a worker times out after 5 seconds, THE Chat Bot QA Router SHALL return an error message to the user
4. WHEN the EQA Worker returns an empty answer, THE Chat Bot QA Router SHALL fall back to the Text Generation Worker
5. THE Chat Bot QA Router SHALL log all fallback events for debugging and monitoring purposes
