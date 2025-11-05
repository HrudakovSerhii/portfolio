# Chat-Bot CV Data Structure

This directory contains the structured CV data used by the AI chat-bot to provide intelligent responses about Serhii's professional background.

## Files

- **`cv-data.json`** - Main CV data with sections, responses, and personality definitions
- **`cv-schema.json`** - JSON schema for data validation
- **`validate-cv-data.js`** - Validation utility script
- **`README.md`** - This documentation file

## Data Structure Overview

### Metadata
Contains version information, update timestamps, and embedding model details.

### Sections
Organized into categories (experience, skills, projects, education, personal):
- **Keywords**: Array of terms for semantic matching
- **Embeddings**: Pre-computed DistilBERT embeddings (null initially, computed at runtime)
- **Responses**: Three conversation styles (HR, Developer, Friend)
- **Details**: Structured information (years, level, technologies, etc.)
- **Related Sections**: Cross-references to related content

### Personality
Defines communication traits, values, and style-specific behavior:
- **Traits**: Core personality characteristics
- **Values**: Professional values and priorities
- **Work Style**: Approach to work and collaboration
- **Communication Style**: Detailed style definitions for each conversation mode

### Response Templates
Fallback responses for various scenarios:
- **No Match**: When no relevant information is found
- **Low Confidence**: When matches are uncertain
- **Fallback Request**: When asking user to rephrase
- **Email Fallback**: When directing to direct contact

## Conversation Styles

### HR Style
- **Tone**: Professional, structured, achievement-focused
- **Language**: Formal business language
- **Focus**: Accomplishments, metrics, professional growth
- **Use Case**: Recruiters, hiring managers, formal evaluations

### Developer Style
- **Tone**: Technical, collaborative, solution-oriented
- **Language**: Conversational with technical depth
- **Focus**: Technical details, problem-solving approaches, tools
- **Use Case**: Technical interviews, peer discussions, code reviews

### Friend Style
- **Tone**: Casual, enthusiastic, story-telling
- **Language**: Informal, expressive, uses emojis
- **Focus**: Personal experiences, learning journey, passion
- **Use Case**: Networking, casual conversations, personal connections

## Usage

### Validation
Run the validation script to check data integrity:
```bash
node src/data/chat-bot/validate-cv-data.js
```

### Adding New Sections
1. Choose appropriate category (experience, skills, projects, etc.)
2. Create unique section ID following pattern: `category_name`
3. Add relevant keywords for semantic matching
4. Write responses for all three conversation styles
5. Include detailed information in the `details` object
6. Add related sections for cross-referencing
7. Run validation to ensure structure compliance

### Response Guidelines

#### HR Responses
- Use professional language and formal tone
- Focus on achievements, metrics, and business impact
- Highlight leadership, teamwork, and professional growth
- Include specific numbers and accomplishments when possible

#### Developer Responses
- Use technical terminology appropriately
- Focus on problem-solving approaches and technical decisions
- Mention specific tools, frameworks, and methodologies
- Share insights about technical challenges and solutions

#### Friend Responses
- Use casual, conversational language with emojis
- Share personal experiences and learning stories
- Express enthusiasm and passion for technology
- Include relatable anecdotes and personal insights

## Embedding Integration

The `embeddings` field in each section is initially `null` and will be populated at runtime by the ML Worker using DistilBERT. The embeddings enable semantic similarity matching between user queries and CV content.

### Embedding Process
1. ML Worker loads DistilBERT model
2. Processes keywords and response text for each section
3. Generates 768-dimensional embeddings
4. Caches embeddings for query matching

## Maintenance

### Regular Updates
- Update `lastUpdated` in metadata when making changes
- Increment `totalSections` when adding new sections
- Ensure all three conversation styles are updated consistently
- Run validation after any structural changes

### Content Guidelines
- Keep responses authentic and accurate
- Maintain consistent personality across styles
- Update technical details as skills evolve
- Ensure keywords accurately represent content

### Performance Considerations
- Limit response length to maintain chat flow
- Use clear, concise language for better user experience
- Optimize keywords for common query patterns
- Balance detail with readability