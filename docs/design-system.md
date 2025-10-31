# Design System Foundation

## Color Palette

### Primary Colors
```scss
$primary-dark: #1a1a1a;      // Main dark background
$primary-light: #ffffff;     // Main light text/background
$accent-blue: #0066cc;       // Links and CTAs
$accent-green: #00cc66;      // Success states
```

### Secondary Colors
```scss
$gray-100: #f8f9fa;         // Light backgrounds
$gray-200: #e9ecef;         // Borders, dividers
$gray-300: #dee2e6;         // Disabled states
$gray-600: #6c757d;         // Secondary text
$gray-800: #343a40;         // Dark text
```

### Semantic Colors
```scss
$success: #28a745;          // Success messages
$warning: #ffc107;          // Warning states
$error: #dc3545;            // Error states
$info: #17a2b8;             // Info messages
```

## Typography System

### Font Families
```scss
$font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Font Sizes & Weights
```scss
// Headings
$h1-size: 3rem;             // 48px - Hero titles
$h2-size: 2.5rem;           // 40px - Section titles
$h3-size: 2rem;             // 32px - Subsection titles
$h4-size: 1.5rem;           // 24px - Card titles
$h5-size: 1.25rem;          // 20px - Small headings
$h6-size: 1rem;             // 16px - Labels

// Body text
$body-large: 1.125rem;      // 18px - Lead text
$body-base: 1rem;           // 16px - Base text
$body-small: 0.875rem;      // 14px - Small text
$body-xs: 0.75rem;          // 12px - Captions

// Font weights
$weight-light: 300;
$weight-regular: 400;
$weight-medium: 500;
$weight-semibold: 600;
$weight-bold: 700;
```

## Spacing System

### Base Unit: 8px
```scss
$space-1: 0.25rem;          // 4px
$space-2: 0.5rem;           // 8px
$space-3: 0.75rem;          // 12px
$space-4: 1rem;             // 16px
$space-5: 1.25rem;          // 20px
$space-6: 1.5rem;           // 24px
$space-8: 2rem;             // 32px
$space-10: 2.5rem;          // 40px
$space-12: 3rem;            // 48px
$space-16: 4rem;            // 64px
$space-20: 5rem;            // 80px
$space-24: 6rem;            // 96px
```

## Breakpoints

### Mobile-First Approach
```scss
$breakpoint-sm: 576px;      // Small devices
$breakpoint-md: 768px;      // Medium devices (tablets)
$breakpoint-lg: 992px;      // Large devices (desktops)
$breakpoint-xl: 1200px;     // Extra large devices
$breakpoint-xxl: 1400px;    // Ultra wide screens
```

## Component Patterns

### Buttons
```scss
// Primary button
.btn-primary {
  background: $accent-blue;
  color: $primary-light;
  padding: $space-3 $space-6;
  border-radius: 6px;
  font-weight: $weight-medium;
  transition: all 0.2s ease;
}

// Secondary button
.btn-secondary {
  background: transparent;
  color: $accent-blue;
  border: 2px solid $accent-blue;
  padding: $space-3 $space-6;
  border-radius: 6px;
}
```

### Cards
```scss
.card {
  background: $primary-light;
  border-radius: 12px;
  padding: $space-6;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}
```

### Grid System
```scss
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 $space-4;
}

.grid {
  display: grid;
  gap: $space-6;
  
  &--2-col {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
  
  &--3-col {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }
}
```

## Animation & Transitions

### Standard Transitions
```scss
$transition-fast: 0.15s ease;
$transition-base: 0.2s ease;
$transition-slow: 0.3s ease;

// Common animations
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
```

## Accessibility

### Focus States
```scss
.focus-visible {
  outline: 2px solid $accent-blue;
  outline-offset: 2px;
}
```

### Color Contrast
- All text meets WCAG AA standards (4.5:1 ratio minimum)
- Interactive elements have clear hover/focus states
- Color is not the only way to convey information