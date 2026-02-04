# CV Data Population Instructions

## Overview
You need to populate the `cv-data-template.json` file with real CV data to create a high-quality RAG (Retrieval-Augmented Generation) system for SmolLM2-135M-Instruct.

## Key Principles

### 1. **embeddingSourceText** - Most Important Field
This field is crucial for embedding generation. Make it:
- **Dense and keyword-rich** (50-500 characters)
- **Factual and specific** (no fluff words)
- **Optimized for semantic search**

**Good Example:**
```
"Serhii Hrudakov Frontend Team Lead Hexaware Bonfire dating app NX monorepo TypeScript React Jest Playwright SonarCloud Scrum team management 60% coding 40% leadership"
```

**Bad Example:**
```
"Serhii worked on a really interesting project where he was responsible for leading a team and building a great application using modern technologies."
```

### 2. **Keywords Array**
Include 3 types of keywords:
- **Primary**: Exact terms from CV (e.g., "React", "TypeScript", "Team Lead")
- **Secondary**: Related concepts (e.g., "frontend", "leadership", "testing")  
- **Contextual**: Use cases (e.g., "component architecture", "team management")

### 3. **Responses Object**
Write 3 different styles for each section:

**HR Style**: Professional, achievement-focused, metrics when possible
- Focus on: Impact, results, team leadership, business value
- Tone: Formal, structured
- Length: 20-200 characters

**Developer Style**: Technical, detailed, collaborative
- Focus on: Architecture, technologies, problem-solving, implementation
- Tone: Technical but conversational
- Length: 20-200 characters

**Friend Style**: Casual, enthusiastic, personal
- Focus on: Passion, learning journey, interesting aspects
- Tone: Informal, expressive, can use emojis
- Length: 20-200 characters

### 4. **Section Organization**

**Core Sections** (Priority 1):
- `main_profile`: Overall professional identity
- `contact_info`: Contact details and location

**Experience Sections** (Priority 1-2):
- One section per major project/role
- Use format: `company_project` (e.g., `hexaware_chatagent`)
- Include all projects from CV

**Skills Sections** (Priority 1-2):
- Group by domain: `frontend_stack`, `backend_stack`, `testing_tools`, `devops_tools`
- Extract from Skills section of CV

**Theme Sections** (Priority 2-3):
- Cross-cutting concepts: `leadership_style`, `problem_solving`, `learning_approach`
- Synthesize from multiple CV sections

**Personal Sections** (Priority 3-4):
- `engineering_passion`: From interests section
- `outdoor_activities`: Hobbies and activities
- `cultural_values`: Travel, diversity, teaching philosophy

## Step-by-Step Process

### Step 1: Read the CV Thoroughly
Understand the person's:
- Professional journey and progression
- Key technical skills and experience levels
- Leadership and management experience
- Personal interests and values
- Communication style and personality

### Step 2: Populate Core Sections First
Start with `main_profile` and `contact_info` as these are foundational.

### Step 3: Create Experience Sections
For each major project/role in the CV:
1. Create a section with format `company_project`
2. Extract key technologies, achievements, and responsibilities
3. Write compelling `embeddingSourceText`
4. Create persona-specific responses

### Step 4: Group Skills Logically
Don't just copy the skills list. Group related technologies:
- Frontend: React, TypeScript, CSS, etc.
- Backend: Node.js, APIs, databases, etc.
- Testing: Jest, Playwright, methodologies, etc.
- DevOps: Docker, CI/CD, cloud platforms, etc.

### Step 5: Create Thematic Sections
Look for patterns across projects:
- How does this person approach leadership?
- What's their problem-solving style?
- How do they learn and grow?

### Step 6: Add Personal Touch
Use the interests section to create engaging personal sections that show personality while remaining professional.

## Quality Checklist

Before submitting, verify:

✅ **All `[POPULATE: ...]` placeholders are replaced with real content**
✅ **embeddingSourceText is dense and keyword-rich (50-500 chars)**
✅ **Keywords include primary, secondary, and contextual terms**
✅ **All 3 response styles are distinct and appropriate**
✅ **relatedSections connect logically related content**
✅ **Priority levels reflect importance (1=highest, 5=lowest)**
✅ **Details objects contain structured, factual information**
✅ **No generic or template language remains**
✅ **Content accurately reflects the CV information**

## Common Mistakes to Avoid

❌ **Vague embeddingSourceText**: "He worked on various projects using different technologies"
❌ **Generic keywords**: Only using broad terms like "developer", "programming"
❌ **Identical responses**: All 3 styles saying the same thing
❌ **Missing connections**: Not using relatedSections to link relevant content
❌ **Template language**: Leaving placeholder text or generic descriptions

## Final Notes

- **Be specific**: Use exact project names, technologies, and achievements from the CV
- **Be authentic**: Capture the person's actual experience and personality
- **Be strategic**: Think about what questions users might ask and ensure the data supports good answers
- **Be consistent**: Maintain the same facts across all sections while varying the presentation style

The goal is to create a comprehensive, searchable knowledge base that allows the RAG system to provide accurate, contextual, and engaging responses about this person's professional background.