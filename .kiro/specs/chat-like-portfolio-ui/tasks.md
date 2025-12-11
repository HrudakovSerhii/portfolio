# Implementation Plan

- [x] 1. Create SCSS foundation and design system
  - Implement SCSS variables file with Claude-inspired color themes, spacing scale, typography system, and layout constants. Review existing variables files and make update to them instead of creating new files. Follow same process for next task items. Our goal is to re-use existing styles and add new when strictly necesary.
  - Create mixins file with responsive breakpoints, theme switching utilities, and glass effect for modals
  - Write CSS reset/normalize file for consistent cross-browser baseline
  - Build main.scss entry point that imports all partials in correct order
  - _Requirements: 13.1, 13.2, 13.6, 13.7_

- [x] 2. Build core HTML structure with templates
  - Create index.html with semantic structure including header, navigation panel, and main content area
  - Implement HTML template elements for section, action prompt, navigation item, loader, and modals
  - Add data attributes and ARIA labels for accessibility and JavaScript hooks
  - Include meta tags for responsive design and SEO
  - _Requirements: 3.1, 3.2, 4.1, 4.2, 12.1_

- [x] 3. Implement StateManager class
  - [x] 3.1 Create StateManager class with session storage interface
    - Write constructor that initializes from session storage or defaults
    - Implement getter and setter methods for userName, role, revealedSections, scrollPosition, language, and theme
    - Add utility methods: hasCompletedPersonalization(), hasRevealedAllSections(), clearAll()
    - _Requirements: 2.3, 16.4, 17.1, 17.2_
  
  - [x] 3.2 Add error handling for storage failures
    - Implement try-catch blocks around session storage operations
    - Create InMemoryStateManager fallback class for when storage is unavailable
    - Log warnings when falling back to in-memory state
    - _Requirements: 2.3, 17.1_

- [x] 4. Implement ContentMiddleware class
  - [x] 4.1 Create ContentMiddleware with JSON data source
    - Write constructor that accepts data source configuration
    - Implement async fetchSectionContent() method that retrieves role-based content
    - Add getActionPromptPlaceholder() method that returns placeholder text from section metadata
    - Implement getSectionMetadata() method for section configuration
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [x] 4.2 Create sample content.json with role-based data
    - Structure JSON with sections object containing hero, about, skills, experience, projects, and contact
    - Include metadata (title, icon, order) and content variants for each role (recruiter, developer, friend)
    - Add main_expertise array to skills section for placeholder generation
    - Provide sample text, image URLs, and aspect ratio classes for each section
    - _Requirements: 6.2, 11.4, 11.5_
  
  - [x] 4.3 Add error handling for content loading failures
    - Implement try-catch in fetchSectionContent() with fallback content
    - Return error content object when JSON fails to load or parse
    - Log errors with section context for debugging
    - _Requirements: 11.2_

- [x] 5. Implement AnimationEngine class
  - [x] 5.1 Create typewriter effect method
    - Write async typewriterEffect() that inserts characters one-by-one into element
    - Implement configurable speed parameter with default of 30ms per character
    - Check prefers-reduced-motion media query and skip animation if enabled
    - Return promise that resolves when animation completes
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  
  - [x] 5.2 Implement generative image component
    - Create createGenerativeImage() method that returns HTMLElement with placeholder, image, and badge
    - Add animated gradient background placeholder that displays immediately
    - Implement 500ms delay before starting image load
    - Apply blur and opacity transitions over 2000ms when image loads
    - Fade out and remove "Generating image..." badge after 1500ms
    - Skip animations when prefers-reduced-motion is enabled
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8_
  
  - [x] 5.3 Add animation configuration and utility methods
    - Define ANIMATION_CONFIG object with typewriter speeds and image timing
    - Implement shouldAnimate() method that checks prefers-reduced-motion
    - Create animateNavigationItem() for navigation link appearance
    - _Requirements: 8.4, 8.5_

- [x] 6. Implement TemplateService class
  - [x] 6.1 Create template cloning and rendering methods
    - Write renderSection() that clones section template and injects content data
    - Implement renderActionPrompt() that creates action prompt with placeholder
    - Add renderNavigationItem() that generates nav link with icon and title
    - Create renderLoader() and renderTypingIndicator() for loading states
    - _Requirements: 12.2, 12.3, 12.4, 12.5_
  
  - [x] 6.2 Implement modal rendering methods
    - Write renderPersonalizationModal() with name input and role buttons
    - Create renderRoleChangeModal() that shows role options with current role disabled
    - Apply glass effect styling to modal overlays
    - _Requirements: 2.1, 2.2, 16.1, 16.2, 16.3_
  
  - [x] 6.3 Add zig-zag layout logic to section rendering
    - Implement alternating left-right image positioning based on section index
    - Apply zig-zag-left or zig-zag-right CSS classes to section content
    - Ensure mobile layout always shows image above text
    - _Requirements: 7.4, 7.5_

- [ ] 7. Implement AppController class - Initialization
  - [x] 7.1 Create AppController constructor and init method
    - Instantiate StateManager, ContentMiddleware, TemplateService, and AnimationEngine
    - Write async init() that checks for existing state and either restores or shows personalization
    - Set up event listeners for theme toggle, language selector, and navigation toggle
    - Initialize theme based on stored preference or system default
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 17.2, 17.3_
  
  - [x] 7.2 Implement state restoration logic
    - Write async restoreState() that retrieves revealed sections from StateManager
    - Loop through revealed sections and render each without animations
    - Restore navigation items for all revealed sections
    - Restore scroll position after content renders
    - Show "Change Role" button if all sections were revealed
    - _Requirements: 17.3, 17.4, 17.5, 17.6_

- [x] 8. Implement AppController class - Personalization flow
  - [x] 8.1 Create personalization modal display and handling
    - Write showPersonalizationModal() that renders and displays the modal
    - Implement handlePersonalization() that stores name and role in StateManager
    - Hide personalization modal after role selection
    - Trigger first section revelation (Hero) after personalization
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 8.2 Implement initial Hero section revelation
    - Call revealSection() with 'hero' section ID after personalization
    - Add Hero navigation item with typewriter animation
    - Render Hero section content with role-based data
    - Display action prompt for next section (About)
    - _Requirements: 5.1, 5.2_

- [x] 9. Implement AppController class - Section revelation
  - [x] 9.1 Create section revelation orchestration
    - Write async revealSection() that accepts sectionId and optional customQuery
    - Display typing indicator while fetching content from ContentMiddleware
    - Render section using TemplateService with zig-zag layout logic
    - Apply typewriter animation to section text content
    - Add generative image component to section
    - Store revealed section in StateManager
    - _Requirements: 5.3, 5.4, 6.6, 6.7, 7.1, 7.2, 7.3, 15.1, 15.2, 15.3_
  
  - [x] 9.2 Implement action prompt interaction handling
    - Set up event listeners on action prompt input and button
    - Change button text from "Get to know [Section]" to "Ask" when input has value
    - Handle button click to trigger next section revelation
    - Pass custom query to revealSection() if input contains text
    - Display custom query as sub-header in section when provided
    - Remove action prompt after interaction
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 6.7, 7.2_
  
  - [x] 9.3 Add navigation item with typewriter effect
    - Render navigation item using TemplateService
    - Apply typewriter animation to navigation title
    - Insert navigation item into navigation panel
    - Set up click handler for navigation scrolling
    - _Requirements: 5.3, 5.5_
  
  - [x] 9.4 Display next action prompt or completion state
    - Check if current section is the last in SECTION_ORDER
    - If not last, render and display action prompt for next section
    - If last section, show "Change Role" button in header
    - _Requirements: 4.4, 5.6_

- [x] 10. Implement AppController class - Navigation
  - [x] 10.1 Create navigation click handling
    - Write handleNavigationClick() that scrolls to target section
    - Use smooth scroll behavior with 800ms duration
    - Update StateManager with new scroll position
    - Ensure navigation works regardless of how many sections are revealed
    - _Requirements: 10.2, 10.3_
  
  - [x] 10.2 Implement navigation panel toggle
    - Write toggleNavigationPanel() that switches between expanded and collapsed states
    - Update CSS classes to show/hide navigation titles
    - Maintain scroll position during toggle
    - Show tooltips on icon hover when collapsed
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 10.4_

- [x] 11. Implement AppController class - Role change
  - [x] 11.1 Create role change modal and handling
    - Write showRoleChangeModal() that renders modal with glass overlay
    - Display three role buttons with current role visually disabled
    - Implement handleRoleChange() that updates role in StateManager
    - Close modal after new role selection or on outside click/escape key
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.9_
  
  - [x] 11.2 Implement state reset on role change
    - Clear all revealed sections except Hero from StateManager
    - Remove all section elements from DOM except Hero
    - Reset navigation panel to show only Hero item
    - Fetch and render Hero content with new role
    - Display action prompt for About section to restart flow
    - _Requirements: 16.5, 16.6, 16.7, 16.8_

- [x] 12. Implement AppController class - Theme and language
  - [x] 12.1 Create theme switching functionality
    - Write handleThemeChange() that updates theme in StateManager
    - Apply theme CSS classes to root element
    - Update CSS custom properties for theme colors
    - Persist theme preference to session storage
    - _Requirements: 13.5_
  
  - [x] 12.2 Create language switching functionality
    - Write handleLanguageChange() that updates language in StateManager
    - Reload visible content with new language (placeholder for future i18n)
    - Update header controls to reflect current language
    - Persist language preference to session storage
    - _Requirements: 14.3, 14.4_

- [x] 13. Style header component
  - Create _header.scss with fixed positioning and z-index
  - Style owner name on left with appropriate typography
  - Style theme toggle, language selector, and change role button on right
  - Implement responsive layout for mobile screens
  - Add smooth transitions for button hover states
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 13.1, 13.2_

- [x] 14. Style navigation panel component
  - Create _navigation.scss with fixed left positioning
  - Implement expanded state with 16rem width showing icons and titles
  - Implement collapsed state with 4rem width showing only icons
  - Style navigation items with hover effects and active states
  - Add tooltip styling for collapsed state icon hover
  - Implement smooth width transition between states
  - Style toggle control button
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 13.1, 13.2_

- [x] 15. Style section component
  - Create _section.scss with max-width container and padding
  - Style section header with title and optional query sub-header
  - Implement zig-zag grid layout for desktop with 50% width columns
  - Implement vertical stack layout for mobile
  - Style content-image container with 70% max-width and rounded corners
  - Style content-text with readable font size and line height
  - Add parallax-layer placeholder with absolute positioning
  - **Issues encountered:** Navigation panel was covering section content. Fixed by updating `.main-content` selector in `_main.scss` to add responsive `margin-left` that accounts for navigation panel width (expanded: 16rem, collapsed: 4rem). Mobile has no margin as nav overlays.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.9, 13.1, 13.2, 13.3_

- [x] 16. Style action prompt component
  - Create _action-prompt.scss with input and button layout
  - Style text input with placeholder styling and max-length indicator
  - Style action button with hover and active states
  - Implement responsive layout for mobile screens
  - Add focus states for accessibility
  - _Requirements: 6.1, 6.3, 6.4, 13.1, 13.2_

- [x] 17. Style modal components
  - Create _modal.scss with glass effect overlay
  - Style personalization modal with centered layout
  - Style role selection buttons with hover and disabled states
  - Implement modal animations for show/hide
  - Add backdrop blur effect for glass morphism
  - Style close button and outside-click overlay
  - _Requirements: 2.1, 2.2, 16.1, 16.2, 16.3, 16.9, 13.1, 13.2_

- [x] 18. Style loader components
  - Create _loader.scss with centered positioning
  - Implement initial page loader with spinner animation
  - Style typing indicator for content generation state
  - Add pulsing animation for loading states
  - _Requirements: 1.1, 15.1, 15.4, 13.1, 13.2_

- [x] 19. Create animation utilities
  - Create _animations.scss with keyframe definitions
  - Implement typewriter cursor blink animation
  - Add fade-in and fade-out animations
  - Create pulse animation for loaders
  - Add slide-in animations for modals
  - Define smooth scroll behavior
  - _Requirements: 8.1, 8.2, 9.4, 13.1, 13.2_

- [x] 20. Implement responsive layouts
  - Create _responsive.scss with mobile-first breakpoints
  - Adjust header layout for mobile screens
  - Modify navigation to overlay on mobile
  - Change section grid to vertical stack on mobile
  - Adjust spacing and typography for smaller screens
  - Test all components at mobile, tablet, and desktop breakpoints
  - _Requirements: 7.5, 13.2_

- [ ] 21. Add accessibility features
  - Implement keyboard navigation for all interactive elements
  - Add ARIA labels to icon-only buttons and navigation items
  - Create ARIA live regions for dynamic content announcements
  - Implement focus trap for modals
  - Add focus indicators with sufficient contrast
  - Test with screen reader (VoiceOver or NVDA)
  - Verify tab order follows logical content flow
  - _Requirements: 3.4, 8.5, 9.8_

- [ ] 22. Implement error handling
  - Add error boundaries in AppController for graceful degradation
  - Implement content loading error handling with retry mechanism
  - Add session storage error handling with in-memory fallback
  - Handle animation errors by skipping to instant display
  - Implement image loading error handling with placeholder
  - Add user-friendly error messages for all failure scenarios
  - _Requirements: 11.2_

- [ ] 23. Create application entry point
  - Create main.js that imports all classes and initializes AppController
  - Add DOMContentLoaded event listener to start application
  - Implement error handling for initialization failures
  - Add console logging for debugging during development
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 24. Add sample assets and placeholder images
  - Create placeholder images for all six sections (hero, about, skills, experience, projects, contact)
  - Add three variants per section for different roles (18 images total)
  - Include error placeholder image for failed loads
  - Add icon assets for navigation items
  - Optimize images for web delivery
  - _Requirements: 7.3, 9.1_

- [ ]* 25. Write unit tests for core classes
  - [ ]* 25.1 Test StateManager
    - Write tests for session storage read/write operations
    - Test state validation and default values
    - Test utility methods (hasCompletedPersonalization, hasRevealedAllSections)
    - Test error handling for storage failures
    - _Requirements: 2.3, 17.1_
  
  - [ ]* 25.2 Test ContentMiddleware
    - Write tests for JSON parsing and data retrieval
    - Test role-based content selection logic
    - Test error handling for missing or malformed data
    - Test placeholder generation from metadata
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ]* 25.3 Test AnimationEngine
    - Write tests for typewriter timing calculations
    - Test shouldAnimate() with prefers-reduced-motion
    - Test image loading sequence and timing
    - Test animation skip logic
    - _Requirements: 8.1, 8.2, 8.5, 9.8_
  
  - [ ]* 25.4 Test TemplateService
    - Write snapshot tests for rendered templates
    - Test data injection correctness
    - Test zig-zag layout class application
    - Test error handling for missing templates
    - _Requirements: 12.2, 12.3, 12.4_

- [ ] 26. Optimize performance
  - Implement lazy loading for images using Intersection Observer
  - Add debouncing to scroll and resize event handlers
  - Minimize DOM manipulations during typewriter animations
  - Optimize CSS with will-change for animated elements
  - Minify JavaScript and CSS for production build
  - Test performance with Lighthouse (target: >90 score)
  - _Requirements: 9.7_

- [ ] 27. Test cross-browser compatibility
  - Test in Chrome, Firefox, Safari, and Edge
  - Verify session storage works in all browsers
  - Test responsive layouts on actual mobile devices
  - Verify animations work smoothly across browsers
  - Test keyboard navigation in all browsers
  - Fix any browser-specific issues
  - _Requirements: 1.1, 2.3, 8.1, 9.1_

- [ ] 28. Create documentation
  - Write README with project overview and setup instructions
  - Document JSON content structure and how to add new sections
  - Create guide for customizing themes and colors
  - Document animation configuration options
  - Add inline code comments for complex logic
  - Create developer guide for future chatbot integration
  - _Requirements: 11.6, 13.4_
