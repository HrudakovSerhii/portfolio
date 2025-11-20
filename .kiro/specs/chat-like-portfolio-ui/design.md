# Design Document: Chat-Like Portfolio UI

## Overview

The Chat-Like Portfolio UI transforms a traditional portfolio website into an interactive, conversational experience that mimics AI chat interfaces. The system progressively reveals content sections as users engage with action prompts, creating a guided narrative journey through the portfolio owner's professional story. Content personalizes based on the visitor's role (recruiter, developer, or friend), and all interactions feature smooth typewriter animations and generative image loading effects.

The architecture prioritizes maintainability through a middleware pattern that decouples content retrieval from UI rendering, enabling future integration with chatbot APIs without UI changes. The design follows Claude's visual language with clean spacing, professional typography, and a collapsible navigation system.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    index.html                          │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │   Header    │  │  Navigation  │  │   Content   │  │  │
│  │  │  Component  │  │    Panel     │  │   Sections  │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ▲                                  │
│                           │                                  │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │              Application Controller                    │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  State Manager (Session Storage Interface)       │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Animation Engine (Typewriter + Image Effects)   │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Template Service (HTML Template Management)     │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Content Middleware (Data Abstraction Layer)     │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ▲                                  │
│                           │                                  │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │              Data Layer                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │  content.json│  │translations/ │  │  Session   │  │  │
│  │  │  (role-based)│  │  (i18n)      │  │  Storage   │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App Root
├── Loader Component (initial)
├── Personalization Modal
│   ├── Name Input
│   └── Role Selection Buttons
├── Header
│   ├── Owner Name
│   └── Controls
│       ├── Theme Toggle
│       ├── Language Selector
│       └── Change Role Button (conditional)
├── Navigation Panel
│   ├── Toggle Control
│   └── Section Links (progressive)
│       ├── Icon
│       ├── Title (expanded mode)
│       └── Tooltip (collapsed mode)
├── Main Content Area
│   └── Sections (progressive)
│       ├── Section Header
│       ├── Sub-header (conditional)
│       ├── Parallax Layer (placeholder)
│       ├── Content Grid
│       │   ├── Image Container
│       │   │   ├── Placeholder
│       │   │   ├── Image Element
│       │   │   └── Generation Badge
│       │   └── Text Content
│       └── Action Prompt
│           ├── Text Input
│           └── Action Button
└── Role Change Modal (conditional)
    ├── Glass Overlay
    └── Role Selection Buttons
```

## Components and Interfaces

### 1. State Manager

**Purpose:** Manages application state and session storage persistence.

**Interface:**
```javascript
class StateManager {
  // Initialize from session storage or defaults
  constructor()
  
  // User state
  getUserName(): string | null
  setUserName(name: string): void
  
  getRole(): 'recruiter' | 'developer' | 'friend' | null
  setRole(role: string): void
  
  // Section revelation state
  getRevealedSections(): string[]
  addRevealedSection(sectionId: string): void
  resetRevealedSections(): void
  
  // Scroll position
  getScrollPosition(): number
  setScrollPosition(position: number): void
  
  // Language and theme
  getLanguage(): string
  setLanguage(lang: string): void
  
  getTheme(): 'light' | 'dark'
  setTheme(theme: string): void
  
  // Utility
  hasCompletedPersonalization(): boolean
  hasRevealedAllSections(): boolean
  clearAll(): void
}
```

**Storage Schema:**
```javascript
{
  userName: string,
  role: 'recruiter' | 'developer' | 'friend',
  revealedSections: ['hero', 'about', 'skills', ...],
  scrollPosition: number,
  language: 'en' | 'es' | ...,
  theme: 'light' | 'dark'
}
```

### 2. Content Middleware

**Purpose:** Abstracts content retrieval to enable future chatbot integration.

**Interface:**
```javascript
class ContentMiddleware {
  constructor(dataSource)
  
  // Fetch section content based on role and query
  async fetchSectionContent(
    sectionId: string,
    role: string,
    customQuery?: string
  ): Promise<SectionContent>
  
  // Get placeholder text for action prompts
  getActionPromptPlaceholder(sectionId: string): string
  
  // Get section metadata
  getSectionMetadata(sectionId: string): SectionMetadata
}
```

**Data Types:**
```javascript
interface SectionContent {
  sectionId: string
  title: string
  text: string
  imageUrl: string
  imageAlt: string
  aspectRatio: string // CSS class like 'aspect-video'
}

interface SectionMetadata {
  id: string
  title: string
  icon: string // Icon identifier
  order: number
}
```

**JSON Structure (Initial Implementation):**
```json
{
  "sections": {
    "hero": {
      "metadata": {
        "title": "Hero",
        "icon": "home",
        "order": 1
      },
      "content": {
        "recruiter": {
          "text": "...",
          "imageUrl": "/assets/images/hero-recruiter.jpg",
          "imageAlt": "...",
          "aspectRatio": "aspect-video"
        },
        "developer": { ... },
        "friend": { ... }
      }
    },
    "skills": {
      "metadata": {
        "title": "Skills",
        "icon": "code",
        "order": 3,
        "main_expertise": ["React", "TypeScript", "Node.js"]
      },
      "content": { ... }
    }
  }
}
```

### 3. Template Service

**Purpose:** Manages HTML template cloning and content injection.

**Interface:**
```javascript
class TemplateService {
  // Get template by ID and populate with data
  renderSection(sectionData: SectionContent, isZigZagLeft: boolean): HTMLElement
  
  renderActionPrompt(sectionId: string, placeholder: string): HTMLElement
  
  renderNavigationItem(sectionMetadata: SectionMetadata): HTMLElement
  
  renderLoader(): HTMLElement
  
  renderTypingIndicator(): HTMLElement
  
  renderPersonalizationModal(): HTMLElement
  
  renderRoleChangeModal(currentRole: string): HTMLElement
}
```

**HTML Template Structure:**
```html
<!-- Section Template -->
<template id="section-template">
  <section class="portfolio-section" data-section-id="">
    <div class="parallax-layer"></div>
    <div class="section-header">
      <h2 class="section-title"></h2>
      <p class="section-query"></p>
    </div>
    <div class="section-content">
      <div class="content-image"></div>
      <div class="content-text"></div>
    </div>
  </section>
</template>

<!-- Action Prompt Template -->
<template id="action-prompt-template">
  <div class="action-prompt">
    <div class="prompt-input-wrapper">
      <input type="text" class="prompt-input" placeholder="" maxlength="150">
      <button class="prompt-button"></button>
    </div>
  </div>
</template>

<!-- Navigation Item Template -->
<template id="nav-item-template">
  <a href="#" class="nav-item" data-section-id="">
    <span class="nav-icon"></span>
    <span class="nav-title"></span>
  </a>
</template>
```

### 4. Animation Engine

**Purpose:** Handles typewriter effects and image loading animations.

**Interface:**
```javascript
class AnimationEngine {
  constructor(stateManager)
  
  // Typewriter effect for text
  async typewriterEffect(
    element: HTMLElement,
    text: string,
    speed?: number
  ): Promise<void>
  
  // Create generative image component
  createGenerativeImage(
    src: string,
    alt: string,
    aspectClass: string
  ): HTMLElement
  
  // Check if animations should be disabled
  shouldAnimate(): boolean
  
  // Animate navigation item appearance
  async animateNavigationItem(element: HTMLElement): Promise<void>
}
```

**Animation Configuration:**
```javascript
const ANIMATION_CONFIG = {
  typewriter: {
    defaultSpeed: 30, // milliseconds per character
    navigationSpeed: 50,
    fastSpeed: 15
  },
  image: {
    placeholderDelay: 500,
    transitionDuration: 2000,
    badgeFadeDelay: 1500
  },
  scroll: {
    behavior: 'smooth',
    duration: 800
  }
}
```

### 5. Application Controller

**Purpose:** Orchestrates all components and manages application flow.

**Interface:**
```javascript
class AppController {
  constructor()
  
  // Initialization
  async init(): Promise<void>
  
  // Personalization flow
  showPersonalizationModal(): void
  handlePersonalization(name: string, role: string): void
  
  // Section revelation
  async revealSection(sectionId: string, customQuery?: string): Promise<void>
  
  // Navigation
  handleNavigationClick(sectionId: string): void
  toggleNavigationPanel(): void
  
  // Role change
  showRoleChangeModal(): void
  handleRoleChange(newRole: string): void
  
  // State restoration
  async restoreState(): Promise<void>
  
  // Theme and language
  handleThemeChange(theme: string): void
  handleLanguageChange(lang: string): void
}
```

## Data Models

### Section Order Configuration

```javascript
const SECTION_ORDER = [
  { id: 'hero', title: 'Hero', icon: 'home' },
  { id: 'about', title: 'About', icon: 'user' },
  { id: 'skills', title: 'Skills', icon: 'code' },
  { id: 'experience', title: 'Experience', icon: 'briefcase' },
  { id: 'projects', title: 'Projects', icon: 'folder' },
  { id: 'contact', title: 'Contact', icon: 'mail' }
]
```

### Role Types

```javascript
const ROLES = {
  RECRUITER: 'recruiter',
  DEVELOPER: 'developer',
  FRIEND: 'friend'
}
```

### Theme Configuration

```javascript
const THEMES = {
  light: {
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#1a1a1a',
    textSecondary: '#666666',
    border: '#e0e0e0',
    accent: '#2563eb'
  },
  dark: {
    background: '#1a1a1a',
    surface: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    border: '#404040',
    accent: '#3b82f6'
  }
}
```

## Error Handling

### Error Types and Strategies

**1. Content Loading Errors**
- **Scenario:** JSON file fails to load or parse
- **Strategy:** Display friendly error message, offer retry button
- **Fallback:** Show minimal static content with contact information

**2. Session Storage Errors**
- **Scenario:** Browser blocks session storage or quota exceeded
- **Strategy:** Continue with in-memory state, warn user about no persistence
- **Fallback:** Disable state restoration features gracefully

**3. Animation Errors**
- **Scenario:** Animation frame requests fail or timeout
- **Strategy:** Skip animations and show content immediately
- **Fallback:** Respect prefers-reduced-motion setting

**4. Template Errors**
- **Scenario:** Template element not found in DOM
- **Strategy:** Log error
- **Fallback:** Error message

**5. Image Loading Errors**
- **Scenario:** Image URL returns 404 or fails to load
- **Strategy:** Show placeholder with icon, log error
- **Fallback:** Continue with text-only section layout. Text position remain in a zig-zag pattern.

### Error Handling Implementation

```javascript
class ErrorHandler {
  static handleContentError(error, sectionId) {
    console.error(`Content error for ${sectionId}:`, error)
    return {
      title: 'Content Unavailable',
      text: 'We're having trouble loading this section. Please try again later.',
      imageUrl: '/assets/images/placeholder.svg'
    }
  }
  
  static handleStorageError(error) {
    console.warn('Session storage unavailable:', error)
    // Continue with in-memory state
    return new InMemoryStateManager()
  }
  
  static handleAnimationError(error, element, content) {
    console.warn('Animation error:', error)
    // Show content immediately
    element.textContent = content
  }
}
```

## Testing Strategy

### Unit Testing

**Components to Test:**
1. **StateManager**
   - Session storage read/write operations
   - State validation and defaults
   - Clear and reset operations

2. **ContentMiddleware**
   - JSON parsing and data retrieval
   - Role-based content selection
   - Error handling for missing data

3. **TemplateService**
   - Template cloning accuracy
   - Data injection correctness
   - HTML structure validation

4. **AnimationEngine**
   - Typewriter timing calculations
   - Animation skip logic for reduced motion
   - Image loading sequence

**Testing Approach:**
- Use Jest for feature logic testing
- Dom related logic use snapshots for test rendered templates and layouts
- Test error conditions and edge cases
- Validate accessibility features

### Integration Testing - ON REQUEST.

**User Flows to Test:**
1. **First-time visitor flow**
   - Load → Personalization → Hero reveal → Progressive disclosure

2. **Returning visitor flow**
   - Load → State restoration → Continue from saved position

3. **Role change flow**
   - Complete sections → Change role → Reset and restart

4. **Navigation flow**
   - Click nav items → Scroll to sections → Maintain state

5. **Reduced motion flow**
   - Enable prefers-reduced-motion → Verify instant reveals

**Testing Tools:**
- Manual testing in multiple browsers
- Lighthouse for performance and accessibility
- Browser DevTools for responsive design
- Session storage inspection

### Performance Testing

**Metrics to Monitor:**
1. **Initial Load Time**
   - Target: < 2 seconds on 3G connection
   - Measure: Time to interactive

2. **Animation Performance**
   - Target: 60 FPS during typewriter effects
   - Measure: Frame rate during animations

3. **Memory Usage**
   - Target: < 50MB for full session
   - Measure: Heap size over time

4. **Bundle Size**
   - Target: < 100KB total JavaScript (minified)
   - Measure: Production build size

**Optimization Strategies:**
- Lazy load images with Intersection Observer
- Debounce scroll and resize handlers
- Use CSS transforms for animations
- Minimize DOM manipulations during typewriter effect

## SCSS Architecture

### File Structure

```
src/styles/
├── _variables.scss          # Theme colors, spacing, typography
├── _mixins.scss             # Reusable style patterns
├── _reset.scss              # CSS reset/normalize
├── main.scss                # Main entry point
├── components/
│   ├── _header.scss         # Header component styles
│   ├── _navigation.scss     # Navigation panel styles
│   ├── _loader.scss         # Loading indicators
│   ├── _modal.scss          # Modal overlays
│   ├── _action-prompt.scss  # Action prompt component
│   └── _section.scss        # Section layout and content
├── layouts/
│   ├── _grid.scss           # Grid system for sections
│   └── _responsive.scss     # Breakpoint definitions
└── utilities/
    ├── _animations.scss     # Animation keyframes
    └── _helpers.scss        # Utility classes
```

### Design Tokens (Variables)

```scss
// _variables.scss

// Colors - Light Theme
$color-bg-light: #ffffff;
$color-surface-light: #f5f5f5;
$color-text-light: #1a1a1a;
$color-text-secondary-light: #666666;
$color-border-light: #e0e0e0;
$color-accent-light: #2563eb;

// Colors - Dark Theme
$color-bg-dark: #1a1a1a;
$color-surface-dark: #2d2d2d;
$color-text-dark: #ffffff;
$color-text-secondary-dark: #a0a0a0;
$color-border-dark: #404040;
$color-accent-dark: #3b82f6;

// Spacing (Claude-inspired)
$spacing-xs: 0.5rem;    // 8px
$spacing-sm: 0.75rem;   // 12px
$spacing-md: 1rem;      // 16px
$spacing-lg: 1.5rem;    // 24px
$spacing-xl: 2rem;      // 32px
$spacing-2xl: 3rem;     // 48px
$spacing-3xl: 4rem;     // 64px

// Typography
$font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
$font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;

$font-size-xs: 0.75rem;   // 12px
$font-size-sm: 0.875rem;  // 14px
$font-size-base: 1rem;    // 16px
$font-size-lg: 1.125rem;  // 18px
$font-size-xl: 1.25rem;   // 20px
$font-size-2xl: 1.5rem;   // 24px
$font-size-3xl: 2rem;     // 32px

$line-height-tight: 1.25;
$line-height-normal: 1.5;
$line-height-relaxed: 1.75;

// Layout
$header-height: 4rem;
$nav-width-expanded: 16rem;
$nav-width-collapsed: 4rem;
$content-max-width: 1200px;

// Transitions
$transition-fast: 150ms ease;
$transition-base: 250ms ease;
$transition-slow: 400ms ease;

// Border radius
$radius-sm: 0.375rem;
$radius-md: 0.5rem;
$radius-lg: 0.75rem;
$radius-xl: 1rem;
$radius-2xl: 1.5rem;

// Z-index layers
$z-base: 1;
$z-nav: 10;
$z-header: 20;
$z-modal-overlay: 30;
$z-modal-content: 31;

// Breakpoints
$breakpoint-mobile: 640px;
$breakpoint-tablet: 768px;
$breakpoint-desktop: 1024px;
$breakpoint-wide: 1280px;
```

### Mixins

```scss
// _mixins.scss

// Responsive breakpoints
@mixin mobile {
  @media (max-width: #{$breakpoint-mobile - 1px}) {
    @content;
  }
}

@mixin tablet {
  @media (min-width: $breakpoint-tablet) {
    @content;
  }
}

@mixin desktop {
  @media (min-width: $breakpoint-desktop) {
    @content;
  }
}

// Theme support
@mixin theme-light {
  --color-bg: #{$color-bg-light};
  --color-surface: #{$color-surface-light};
  --color-text: #{$color-text-light};
  --color-text-secondary: #{$color-text-secondary-light};
  --color-border: #{$color-border-light};
  --color-accent: #{$color-accent-light};
}

@mixin theme-dark {
  --color-bg: #{$color-bg-dark};
  --color-surface: #{$color-surface-dark};
  --color-text: #{$color-text-dark};
  --color-text-secondary: #{$color-text-secondary-dark};
  --color-border: #{$color-border-dark};
  --color-accent: #{$color-accent-dark};
}

// Glass effect for modals
@mixin glass-effect {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

// Smooth scrolling container
@mixin smooth-scroll {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
```

### Component Example: Section Layout

```scss
// components/_section.scss

.portfolio-section {
  position: relative;
  padding: $spacing-3xl $spacing-lg;
  max-width: $content-max-width;
  margin: 0 auto;
  
  @include desktop {
    padding: $spacing-3xl $spacing-2xl;
  }
  
  // Parallax layer placeholder
  .parallax-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    pointer-events: none;
  }
  
  .section-header {
    margin-bottom: $spacing-xl;
    
    .section-title {
      font-size: $font-size-3xl;
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: $spacing-sm;
    }
    
    .section-query {
      font-size: $font-size-lg;
      color: var(--color-text-secondary);
      font-style: italic;
    }
  }
  
  .section-content {
    display: grid;
    gap: $spacing-xl;
    align-items: center;
    
    @include mobile {
      grid-template-columns: 1fr;
    }
    
    @include desktop {
      grid-template-columns: 1fr 1fr;
    }
    
    // Zig-zag layout
    &.zig-zag-left {
      .content-image {
        @include desktop {
          order: 1;
        }
      }
      .content-text {
        @include desktop {
          order: 2;
        }
      }
    }
    
    &.zig-zag-right {
      .content-image {
        @include desktop {
          order: 2;
        }
      }
      .content-text {
        @include desktop {
          order: 1;
        }
      }
    }
  }
  
  .content-image {
    display: flex;
    justify-content: center;
    align-items: center;
    
    img, .image-container {
      max-width: 70%;
      height: auto;
      border-radius: $radius-2xl;
    }
  }
  
  .content-text {
    font-size: $font-size-lg;
    line-height: $line-height-relaxed;
    color: var(--color-text);
    
    p {
      margin-bottom: $spacing-md;
    }
  }
}
```

## Accessibility Considerations

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Tab order follows logical content flow
- Focus indicators clearly visible
- Escape key closes modals

### Screen Reader Support
- Semantic HTML structure (nav, section, article)
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic content
- Alt text for all images

### Motion Preferences
- Respect `prefers-reduced-motion` media query
- Provide instant content reveal option
- Disable parallax effects when motion reduced

### Color Contrast
- Maintain WCAG AA contrast ratios (4.5:1 for text)
- Test both light and dark themes
- Don't rely solely on color for information

### Focus Management
- Trap focus within modals
- Return focus to trigger element on modal close
- Announce section changes to screen readers

## Future Enhancements

### Phase 2: Chatbot Integration

**Architecture Changes:**
```javascript
class ChatbotMiddleware extends ContentMiddleware {
  constructor(apiEndpoint, apiKey) {
    super()
    this.api = new ChatbotAPI(apiEndpoint, apiKey)
  }
  
  async fetchSectionContent(sectionId, role, customQuery) {
    const prompt = this.buildPrompt(sectionId, role, customQuery)
    const response = await this.api.generateContent(prompt)
    return this.parseResponse(response)
  }
  
  buildPrompt(sectionId, role, customQuery) {
    // Construct prompt with context
  }
}
```

**Image Selection via Embeddings:**
- Generate embeddings for user queries
- Match against pre-computed image embeddings
- Select most relevant image from library
- Fallback to section default images

### Phase 3: Parallax Effects

**Implementation Strategy:**
- Add scroll event listener with throttling
- Calculate scroll progress per section
- Apply CSS transforms to parallax layers
- Use `will-change` for performance
- Disable on mobile and reduced motion

### Phase 4: Advanced Personalization

**Features:**
- Remember user preferences across sessions
- A/B test different content variations
- Analytics for section engagement
- Custom section ordering based on role
- Dynamic content recommendations

## Design Decisions and Rationales

### 1. Session Storage vs Local Storage
**Decision:** Use session storage for state persistence
**Rationale:** Portfolio visits are typically single-session experiences. Session storage provides appropriate scope without long-term data retention concerns.

### 2. Middleware Pattern
**Decision:** Abstract content retrieval behind middleware interface
**Rationale:** Enables future chatbot integration without UI refactoring. Separates data concerns from presentation logic.

### 3. HTML Templates vs JavaScript Rendering
**Decision:** Use native HTML `<template>` elements
**Rationale:** Better performance than string concatenation, cleaner separation of structure and logic, easier to maintain.

### 4. Character-by-Character Insertion
**Decision:** Insert characters directly into container vs separate elements
**Rationale:** Simpler implementation, better performance, easier to maintain. Individual character elements add unnecessary DOM overhead.

### 5. Progressive Disclosure
**Decision:** Reveal sections one at a time vs all at once
**Rationale:** Creates engaging narrative flow, reduces cognitive load, encourages exploration, mimics conversational AI experience.

### 6. Zig-Zag Layout
**Decision:** Alternate image-text positioning on desktop
**Rationale:** Creates visual rhythm, prevents monotony, guides eye movement, common portfolio pattern.

### 7. Complete State Reset on Role Change
**Decision:** Reset to Hero section vs maintain revealed sections
**Rationale:** Clearer UX, consistent with initial experience, emphasizes content personalization, avoids confusion with disabled states.

### 8. SCSS Over CSS-in-JS
**Decision:** Use SCSS for styling
**Rationale:** Aligns with project's vanilla JavaScript approach, better performance (no runtime), easier theming with variables, familiar to most developers.
