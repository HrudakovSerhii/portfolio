# Performance Optimization Strategy

## Performance Budget

### Target Metrics
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Input Delay (FID)**: < 100ms
- **Total Bundle Size**: < 100KB (gzipped)

### Resource Limits
- **HTML**: < 15KB per page
- **CSS**: < 30KB (compressed)
- **JavaScript**: < 50KB (compressed)
- **Images**: < 500KB total per page
- **Fonts**: < 100KB total

## CSS Optimization

### Critical CSS Strategy
```scss
// Critical CSS (inline in <head>)
// - Above-the-fold styles
// - Layout structure
// - Typography basics
// - Navigation styles

// Non-critical CSS (loaded async)
// - Below-the-fold components
// - Animations
// - Hover states
// - Print styles
```

### SCSS Compilation Strategy
```json
{
  "build:styles:critical": "sass src/styles/critical.scss dist/critical.css --style=compressed",
  "build:styles:main": "sass src/styles/styles.scss dist/styles.css --style=compressed",
  "build:styles": "npm run build:styles:critical && npm run build:styles:main"
}
```

### CSS Loading Pattern
```html
<!-- Critical CSS inline -->
<style>
  /* Critical above-the-fold styles */
</style>

<!-- Non-critical CSS async -->
<link rel="preload" href="styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="styles.css"></noscript>
```

## JavaScript Optimization

### Loading Strategy
```html
<!-- Essential JS - defer -->
<script src="app.js" defer></script>

<!-- Non-essential JS - async -->
<script src="analytics.js" async></script>

<!-- Conditional loading -->
<script>
  if ('IntersectionObserver' in window) {
    // Load advanced features
  } else {
    // Load polyfill or fallback
  }
</script>
```

### Code Splitting Approach
```javascript
// Core functionality (always loaded)
// - Translation system
// - Navigation
// - Form handling

// Lazy-loaded modules
// - Project filtering
// - Image galleries
// - Contact form validation
```

### Module Pattern
```javascript
// app.js - Main entry point
import { Navigation } from './modules/navigation.js';
import { Translation } from './modules/translation.js';

// Lazy load heavy features
const loadProjectFilter = () => import('./modules/project-filter.js');
const loadContactForm = () => import('./modules/contact-form.js');
```

## Image Optimization

### Lazy Loading Implementation
```javascript
// Native lazy loading with fallback
const images = document.querySelectorAll('img[loading="lazy"]');

if ('loading' in HTMLImageElement.prototype) {
  // Native lazy loading supported
  images.forEach(img => {
    img.src = img.dataset.src;
  });
} else {
  // Fallback to Intersection Observer
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        imageObserver.unobserve(img);
      }
    });
  });
  
  images.forEach(img => imageObserver.observe(img));
}
```

### Responsive Images Strategy
```html
<!-- Hero image with art direction -->
<picture>
  <source media="(min-width: 768px)" 
          srcset="hero-desktop.webp" 
          type="image/webp">
  <source media="(min-width: 768px)" 
          srcset="hero-desktop.jpg" 
          type="image/jpeg">
  <source srcset="hero-mobile.webp" 
          type="image/webp">
  <img src="hero-mobile.jpg" 
       alt="Hero image" 
       loading="eager">
</picture>

<!-- Project thumbnails -->
<img src="project-thumb-300w.webp"
     srcset="project-thumb-300w.webp 300w,
             project-thumb-600w.webp 600w"
     sizes="(min-width: 768px) 300px, 100vw"
     alt="Project screenshot"
     loading="lazy">
```

## Font Optimization

### Font Loading Strategy
```html
<!-- Preload critical fonts -->
<link rel="preload" 
      href="fonts/inter-regular.woff2" 
      as="font" 
      type="font/woff2" 
      crossorigin>

<!-- Font display strategy -->
<style>
  @font-face {
    font-family: 'Inter';
    src: url('fonts/inter-regular.woff2') format('woff2');
    font-display: swap; /* Show fallback, then swap */
    font-weight: 400;
  }
</style>
```

### Font Fallback Stack
```scss
$font-primary: 'Inter', 
               -apple-system, 
               BlinkMacSystemFont, 
               'Segoe UI', 
               Roboto, 
               sans-serif;
```

## Build Process Optimization

### Asset Pipeline
```json
{
  "scripts": {
    "build:clean": "rm -rf dist && mkdir -p dist",
    "build:html": "cp -r src/pages/* dist/",
    "build:styles": "sass src/styles/styles.scss dist/styles.css --style=compressed",
    "build:scripts": "terser src/scripts/app.js -o dist/app.js -c -m",
    "build:images": "npm run optimize:images",
    "build:copy": "cp -r src/translations dist/ && cp -r src/assets dist/",
    "build": "npm run build:clean && npm run build:html && npm run build:styles && npm run build:scripts && npm run build:images && npm run build:copy"
  }
}
```

### Image Optimization Pipeline
```bash
# WebP conversion
cwebp -q 85 src/assets/images/original.jpg -o dist/assets/images/optimized.webp

# JPEG optimization
jpegoptim --max=85 --strip-all dist/assets/images/*.jpg

# PNG optimization
optipng -o7 dist/assets/images/*.png
```

## Caching Strategy

### Static Assets
```html
<!-- Long-term caching for versioned assets -->
<link rel="stylesheet" href="styles.css?v=1.0.0">
<script src="app.js?v=1.0.0"></script>

<!-- Or use build hash -->
<link rel="stylesheet" href="styles.abc123.css">
```

### Service Worker (Future Enhancement)
```javascript
// Cache static assets
const CACHE_NAME = 'portfolio-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/app.js',
  '/translations/en.json'
];
```

## Monitoring & Measurement

### Performance Metrics
```javascript
// Core Web Vitals measurement
new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    console.log('LCP:', entry.startTime);
  }
}).observe({entryTypes: ['largest-contentful-paint']});

// Custom metrics
performance.mark('navigation-start');
// ... navigation code
performance.mark('navigation-end');
performance.measure('navigation', 'navigation-start', 'navigation-end');
```

### Lighthouse CI Integration
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
```

## Progressive Enhancement

### Feature Detection
```javascript
// Check for modern features
const supportsWebP = () => {
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/webp').indexOf('webp') > -1;
};

const supportsIntersectionObserver = 'IntersectionObserver' in window;
const supportsCustomProperties = CSS.supports('color', 'var(--test)');
```

### Graceful Degradation
```css
/* Fallback for older browsers */
.hero {
  background: #1a1a1a; /* Fallback */
  background: var(--primary-dark, #1a1a1a); /* Modern */
}

/* Progressive enhancement */
@supports (display: grid) {
  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}
```