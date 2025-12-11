# Requirements Document

## Introduction

The chat-bot feature is an intelligent CV assistant that runs entirely in the user's browser using machine learning models. It allows visitors to interact with Serhii's professional information through natural language queries, providing personalized responses based on the visitor's role (HR, Developer, or Friend). The system uses DistilBERT for semantic understanding and operates without requiring backend servers, ensuring privacy and fast response times.

## Requirements

### Requirement 1: Chat Interface Initialization

**User Story:** As a portfolio visitor, I want to click a "Chat" button to start an interactive conversation with Serhii's AI assistant, so that I can get personalized information about his professional background.

#### Acceptance Criteria

1. WHEN a user clicks the "Chat" button THEN the system SHALL display a loading message "Wait, I'm loading as fast as I can!"
2. WHEN the ML model is loading THEN the system SHALL show loading progress to the user
3. WHEN the model fails to load THEN the system SHALL display "Oops, sorry, we couldn't load Serhii to your browser :("
4. WHEN the model loads successfully THEN the system SHALL present conversation style selection options
5. IF the browser doesn't support required features THEN the system SHALL show the unsupported browser message

### Requirement 2: Conversation Style Selection

**User Story:** As a portfolio visitor, I want to select how I want to interact with the AI (as HR, Developer, or Friend), so that I receive responses appropriate to my context and needs.

#### Acceptance Criteria

1. WHEN the chat initializes THEN the system SHALL present three conversation style options: HR, Developer, Friend
2. WHEN a user selects HR style THEN the system SHALL use formal, professional language in all responses
3. WHEN a user selects Developer style THEN the system SHALL use conversational, technical language in responses
4. WHEN a user selects Friend style THEN the system SHALL use personality-driven, casual language with emojis
5. WHEN a style is selected THEN the system SHALL remember this choice throughout the session
6. WHEN the conversation starts THEN the system SHALL display an appropriate greeting based on selected style

### Requirement 3: Natural Language Query Processing

**User Story:** As a portfolio visitor, I want to ask questions about Serhii's experience in natural language, so that I can quickly find relevant information without browsing through traditional CV sections.

#### Acceptance Criteria

1. WHEN a user types a question THEN the system SHALL process it using DistilBERT semantic understanding
2. WHEN the system processes a query THEN it SHALL match the question to relevant CV sections using embeddings
3. WHEN a match is found THEN the system SHALL generate a response using the selected conversation style
4. WHEN multiple CV sections are relevant THEN the system SHALL combine information appropriately
5. IF no relevant information is found THEN the system SHALL trigger the fallback process

### Requirement 4: Contextual Conversation Memory

**User Story:** As a portfolio visitor, I want the AI to remember our previous conversation within the session, so that I can have a natural, flowing dialogue without repeating context.

#### Acceptance Criteria

1. WHEN a user asks a follow-up question THEN the system SHALL consider the last 5 questions and answers as context
2. WHEN generating responses THEN the system SHALL reference previous conversation when relevant
3. WHEN the conversation context becomes too large THEN the system SHALL maintain only the most recent 5 exchanges
4. WHEN a user starts a new topic THEN the system SHALL appropriately transition while maintaining context awareness
5. IF context helps clarify ambiguous questions THEN the system SHALL use it to provide better responses

### Requirement 5: Conversation Style Management

**User Story:** As a portfolio visitor, I want the option to restart the conversation with a different style, so that I can experience different interaction modes without refreshing the page.

#### Acceptance Criteria

1. WHEN in an active conversation THEN the system SHALL display a "Would you like to chat with different Serhii AI?" button
2. WHEN the user clicks the restart button THEN the system SHALL clear conversation history
3. WHEN restarting THEN the system SHALL present the conversation style selection again
4. WHEN a new style is selected THEN the system SHALL update all subsequent responses accordingly
5. WHEN restarting THEN the system SHALL maintain the loaded model without reloading

### Requirement 6: Fallback Handling and Email Contact

**User Story:** As a portfolio visitor, I want to get help when the AI doesn't understand my question, so that I can still get the information I need through direct contact with Serhii.

#### Acceptance Criteria

1. WHEN the system cannot understand a question THEN it SHALL ask the user to rephrase using style-appropriate language
2. WHEN the user rephrases and the system still cannot understand THEN it SHALL offer email contact option
3. WHEN offering email contact THEN the system SHALL request user's name and email address
4. WHEN user provides contact details THEN the system SHALL generate a mailto link with pre-filled subject and body
5. WHEN generating the email THEN it SHALL include the original question, conversation context, and user details
6. IF the user doesn't want to provide email THEN the system SHALL allow continuing the conversation

### Requirement 7: CV Data Management

**User Story:** As the portfolio owner, I want the system to access comprehensive information about my professional background, so that visitors can get detailed and accurate responses about my experience, skills, and projects.

#### Acceptance Criteria

1. WHEN the system initializes THEN it SHALL load structured CV data including experience, education, skills, and projects
2. WHEN CV data is loaded THEN it SHALL include pre-computed embeddings for semantic matching
3. WHEN generating responses THEN the system SHALL access appropriate CV sections based on query matching
4. WHEN multiple data points are relevant THEN the system SHALL synthesize information coherently
5. IF CV data is missing or corrupted THEN the system SHALL handle gracefully with appropriate error messages

### Requirement 8: Performance and Browser Compatibility

**User Story:** As a portfolio visitor, I want the chat system to work efficiently in my browser without requiring additional installations, so that I can have a smooth interaction experience.

#### Acceptance Criteria

1. WHEN the model loads THEN it SHALL complete within reasonable time limits (target: under 30 seconds)
2. WHEN processing queries THEN response time SHALL be under 3 seconds for typical questions
3. WHEN running THEN the system SHALL not significantly impact browser performance
4. WHEN detecting unsupported browsers THEN the system SHALL provide clear messaging about limitations
5. IF memory constraints are reached THEN the system SHALL manage resources appropriately

### Requirement 9: Privacy and Security

**User Story:** As a portfolio visitor, I want assurance that my conversations remain private and secure, so that I can freely ask questions without privacy concerns.

#### Acceptance Criteria

1. WHEN processing conversations THEN all data SHALL remain in the user's browser
2. WHEN the session ends THEN conversation data SHALL be cleared from memory
3. WHEN using email fallback THEN user contact information SHALL only be used for the mailto link
4. WHEN storing temporary data THEN it SHALL not persist beyond the browser session
5. IF the user closes the chat THEN all conversation data SHALL be immediately cleared