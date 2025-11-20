# Requirements Document

## Introduction

This document defines the requirements for a chat-like portfolio website that progressively reveals content through user interaction. The Portfolio System mimics a conversational AI interface where users unlock sections by engaging with action prompts or custom queries. Content personalizes based on user role (recruiter, developer, friend) and displays with typewriter-style animations similar to LLM text generation.

## Glossary

- **Portfolio System**: The complete web application including navigation, content sections, and interaction components
- **Navigation Panel**: The collapsible left sidebar containing links to portfolio sections
- **Section**: A content block containing a header, optional sub-header, text content, and image
- **Action Prompt**: An interactive component combining text input and button for section revelation
- **Content Middleware**: JavaScript service layer that retrieves content from data sources
- **Template Service**: JavaScript service that manages HTML template selection and injection
- **Typewriter Effect**: Character-by-character text rendering animation
- **Progressive Disclosure**: UI pattern where content reveals incrementally based on user actions
- **Role Personalization**: Content adaptation based on selected user type (recruiter, developer, friend)
- **Parallax Layer**: Background element placeholder for future parallax scrolling effects

## Requirements

### Requirement 1: Initial Loading Experience

**User Story:** As a visitor, I want to see a loading indicator when I first arrive at the portfolio, so that I know the page is preparing content for me.

#### Acceptance Criteria

1. WHEN the Portfolio System loads, THE Portfolio System SHALL display a centered loader component
2. WHILE resources are loading, THE Portfolio System SHALL hide all other interface elements
3. WHEN all page resources complete loading, THE Portfolio System SHALL hide the loader component
4. WHEN the loader hides, THE Portfolio System SHALL display the personalization interface

### Requirement 2: User Personalization

**User Story:** As a visitor, I want to enter my name and select my role, so that the portfolio content adapts to my interests.

#### Acceptance Criteria

1. WHEN resource loading completes, THE Portfolio System SHALL display a text input field for name entry
2. WHEN resource loading completes, THE Portfolio System SHALL display three role selection buttons labeled "recruiter", "developer", and "friend"
3. WHEN the user enters a name and clicks a role button, THE Portfolio System SHALL store the user name and selected role in session storage
4. WHEN the user selects a role, THE Portfolio System SHALL hide the personalization interface
5. WHEN the user selects a role, THE Portfolio System SHALL reveal the first navigation item with typewriter effect

### Requirement 3: Navigation Panel Structure

**User Story:** As a user, I want a persistent navigation panel with section links, so that I can quickly jump to different parts of the portfolio.

#### Acceptance Criteria

1. THE Portfolio System SHALL display a Navigation Panel on the left side of the viewport
2. THE Navigation Panel SHALL contain links for sections: Hero, About, Skills, Experience, Projects, and Contact
3. WHEN the Navigation Panel is collapsed, THE Navigation Panel SHALL display only section icons in a thin vertical strip
4. WHEN the Navigation Panel is collapsed and the user hovers over an icon, THE Navigation Panel SHALL display the section title in a tooltip
5. WHEN the Navigation Panel is expanded, THE Navigation Panel SHALL display both icons and section titles
6. THE Navigation Panel SHALL provide a toggle control to collapse or expand the panel

### Requirement 4: Header Layout

**User Story:** As a user, I want a clean header with essential controls, so that I can access settings without visual clutter.

#### Acceptance Criteria

1. THE Portfolio System SHALL display a header bar at the top of the viewport
2. THE Portfolio System SHALL display the portfolio owner name on the left side of the header
3. THE Portfolio System SHALL display theme and language controls on the right side of the header
4. WHEN all sections have been revealed, THE Portfolio System SHALL display a "Change Role" button in the header on the right side
5. THE header SHALL remain visible during page scrolling

### Requirement 5: Progressive Section Revelation

**User Story:** As a user, I want sections to appear one at a time as I interact with prompts, so that I experience a guided journey through the portfolio.

#### Acceptance Criteria

1. WHEN the user completes personalization, THE Portfolio System SHALL reveal the Hero section
2. WHEN the user completes personalization, THE Portfolio System SHALL add the "Hero" item to the Navigation Panel with typewriter effect
3. WHEN a section becomes visible, THE Portfolio System SHALL display an Action Prompt below that section
4. WHEN the user interacts with an Action Prompt, THE Portfolio System SHALL reveal the next section in sequence
5. WHEN the user interacts with an Action Prompt, THE Portfolio System SHALL add the corresponding navigation item with typewriter effect
6. THE Portfolio System SHALL follow the section order: Hero, About, Skills, Experience, Projects, Contact

### Requirement 6: Action Prompt Component

**User Story:** As a user, I want to either get default section information or ask specific questions, so that I can control the depth of information I receive.

#### Acceptance Criteria

1. THE Action Prompt SHALL display a text input field and an action button
2. WHERE the section is Skills, THE Action Prompt SHALL populate the input placeholder with values from the "main_expertise" key in the Skills JSON object
3. WHEN the text input is empty, THE Action Prompt SHALL display button text as "Get to know [Section Name]"
4. WHEN the text input contains characters, THE Action Prompt SHALL change button text to "Ask"
5. THE Action Prompt SHALL restrict text input to a maximum character limit to prevent overly long queries
6. WHEN the user clicks the button with empty input, THE Portfolio System SHALL request default section content from Content Middleware
7. WHEN the user clicks the button with text input, THE Portfolio System SHALL request personalized content from Content Middleware using the input as query context

### Requirement 7: Section Layout and Structure

**User Story:** As a user, I want sections with clear headers and balanced image-text layouts, so that content is easy to read and visually appealing.

#### Acceptance Criteria

1. THE Portfolio System SHALL display each section with a header element using the section name
2. WHEN the user submits custom input via Action Prompt, THE Portfolio System SHALL display the user input as a sub-header in a paragraph element below the section header
3. THE Portfolio System SHALL display each section with two content items: an image and text content
4. WHERE the viewport is desktop size, THE Portfolio System SHALL arrange image and text items in a zig-zag layout alternating left-right positions
5. WHERE the viewport is mobile size, THE Portfolio System SHALL arrange image above text in vertical layout
6. THE Portfolio System SHALL allocate a maximum of 50 percent of section width to each content item
7. THE Portfolio System SHALL size images to 70 percent of their container dimensions
8. THE Portfolio System SHALL allow image aspect ratios to vary by content
9. THE Portfolio System SHALL include a Parallax Layer placeholder element in each section for future parallax effects

### Requirement 8: Typewriter Animation Effect

**User Story:** As a user, I want text to appear character-by-character like AI generation, so that the portfolio feels interactive and engaging.

#### Acceptance Criteria

1. WHEN a navigation item appears, THE Portfolio System SHALL render the item text character-by-character with configurable interval timing
2. WHEN section text content appears, THE Portfolio System SHALL render the content character-by-character with configurable interval timing
3. THE Portfolio System SHALL set default animation interval to a comfortable reading speed
4. THE Portfolio System SHALL allow animation speed configuration for future adjustments
5. IF the user has "prefers-reduced-motion" enabled, THEN THE Portfolio System SHALL display text instantly without animation

### Requirement 9: Image Loading Effect

**User Story:** As a user, I want images to appear with a generation effect, so that the experience feels cohesive with the text animations.

#### Acceptance Criteria

1. WHEN an image container renders, THE Portfolio System SHALL display a placeholder with animated gradient background
2. WHEN the placeholder displays, THE Portfolio System SHALL begin loading the image source with a 500 millisecond delay
3. WHILE the image loads, THE Portfolio System SHALL display a "Generating image..." badge overlay on the container
4. WHEN the image completes loading, THE Portfolio System SHALL transition the image from blurred and transparent to sharp and opaque over 2000 milliseconds
5. WHEN the image transition completes, THE Portfolio System SHALL fade out and remove the generation badge after 1500 milliseconds
6. THE Portfolio System SHALL apply rounded corners and aspect ratio classes to image containers
7. THE Portfolio System SHALL implement lazy loading for images to optimize performance
8. IF the user has "prefers-reduced-motion" enabled, THEN THE Portfolio System SHALL display images immediately without blur, opacity transitions, or generation badges

### Requirement 10: Scrolling and Navigation Interaction

**User Story:** As a user, I want to scroll freely and use navigation links at any time, so that I can explore content at my own pace.

#### Acceptance Criteria

1. THE Portfolio System SHALL allow vertical scrolling through all revealed sections
2. WHEN the user clicks a navigation link, THE Portfolio System SHALL scroll to the corresponding section
3. THE Portfolio System SHALL enable navigation link clicks regardless of how many sections are currently revealed
4. THE Portfolio System SHALL maintain scroll position when the Navigation Panel toggles between collapsed and expanded states

### Requirement 11: Content Middleware Architecture

**User Story:** As a developer, I want a middleware layer for content retrieval, so that I can easily swap data sources without changing UI code.

#### Acceptance Criteria

1. THE Content Middleware SHALL provide a promise-based API for content requests
2. WHEN the Portfolio System requests content, THE Content Middleware SHALL return a promise that resolves with section content
3. WHERE the initial implementation is active, THE Content Middleware SHALL retrieve content from a JSON file
4. THE Content Middleware SHALL support role-based content selection using the user's selected role
5. THE Content Middleware SHALL structure JSON data with content variants per role (recruiter, developer, friend)
6. THE Content Middleware SHALL be designed to allow future replacement with a chatbot API without UI changes

### Requirement 12: Template Service Architecture

**User Story:** As a developer, I want a template service to manage HTML structure, so that section rendering is maintainable and consistent.

#### Acceptance Criteria

1. THE Template Service SHALL use HTML template elements for section structure definitions
2. WHEN the Portfolio System needs to render a section, THE Template Service SHALL clone the appropriate template
3. WHEN the Template Service clones a template, THE Template Service SHALL inject content data into the cloned elements
4. WHEN the Template Service completes injection, THE Template Service SHALL insert the populated template into the target container
5. THE Template Service SHALL provide methods for selecting templates by section type

### Requirement 13: Visual Styling and Theme

**User Story:** As a user, I want the portfolio to use Claude-inspired styling, so that the interface feels familiar and professional.

#### Acceptance Criteria

1. THE Portfolio System SHALL apply color themes inspired by Claude chat interface
2. THE Portfolio System SHALL use spacing and layout patterns consistent with Claude chat interface
3. THE Portfolio System SHALL size text content for optimal readability
4. THE Portfolio System SHALL allow font family configuration for future customization
5. THE Portfolio System SHALL support theme switching via header controls
6. THE Portfolio System SHALL organize SCSS files with dedicated stylesheets per component template or layout
7. THE Portfolio System SHALL maintain a minimal codebase by avoiding redundant styles and using SCSS variables for shared values

### Requirement 14: Translation and Localization Support

**User Story:** As a user, I want to view the portfolio in my preferred language, so that I can understand content in my native language.

#### Acceptance Criteria

1. WHERE future implementation is active, THE Portfolio System SHALL retrieve content using translation keys from a translations JSON file
2. WHERE future implementation is active, THE Portfolio System SHALL store only content identifiers in the role-based JSON structure
3. THE Portfolio System SHALL provide language selection via header controls
4. WHEN the user changes language, THE Portfolio System SHALL update all visible content to the selected language

### Requirement 15: Loading State During Content Generation

**User Story:** As a user, I want to see a typing indicator while content loads, so that I know the system is processing my request.

#### Acceptance Criteria

1. WHEN the Content Middleware promise is pending, THE Portfolio System SHALL display a typing-in-progress loader component
2. WHEN the Content Middleware promise resolves, THE Portfolio System SHALL hide the typing-in-progress loader
3. WHEN the Content Middleware promise resolves, THE Portfolio System SHALL begin the typewriter animation for the returned content
4. THE typing-in-progress loader SHALL visually indicate that content generation is in progress

### Requirement 16: Role Change and State Reset

**User Story:** As a user, I want to change my role and see different personalized content, so that I can experience the portfolio from different perspectives.

#### Acceptance Criteria

1. WHEN the user clicks the "Change Role" button, THE Portfolio System SHALL display a modal overlay with glass effect above the content
2. WHEN the role selection modal displays, THE Portfolio System SHALL show three role buttons: "recruiter", "developer", and "friend"
3. WHEN the role selection modal displays, THE Portfolio System SHALL visually indicate the currently selected role as disabled
4. WHEN the user clicks a non-selected role in the modal, THE Portfolio System SHALL update the stored role in session storage
5. WHEN the user selects a new role, THE Portfolio System SHALL close the modal
6. WHEN the user selects a new role, THE Portfolio System SHALL reset all revealed sections to only show the Hero section
7. WHEN the user selects a new role, THE Portfolio System SHALL reset the Navigation Panel to show only the Hero item
8. WHEN the user selects a new role, THE Portfolio System SHALL restart the progressive disclosure flow with the new role's content
9. WHEN the user clicks outside the modal or on a close control, THE Portfolio System SHALL close the modal and return to the previous UI state without changes

### Requirement 17: State Persistence and Page Reload

**User Story:** As a user, I want the portfolio to remember my progress when I reload the page, so that I don't have to start over.

#### Acceptance Criteria

1. WHEN the user reveals a section, THE Portfolio System SHALL store the revealed section state in session storage
2. WHEN the Portfolio System loads and session storage contains user name and role, THE Portfolio System SHALL skip the initial personalization interface
3. WHEN the Portfolio System loads with stored state, THE Portfolio System SHALL restore all previously revealed sections
4. WHEN the Portfolio System loads with stored state, THE Portfolio System SHALL restore all corresponding navigation items
5. WHEN the Portfolio System loads with stored state, THE Portfolio System SHALL restore the user's scroll position
6. WHEN the Portfolio System loads with stored state and all sections were revealed, THE Portfolio System SHALL display the "Change Role" button in the header
7. IF session storage contains no state, THEN THE Portfolio System SHALL display the initial personalization interface
