# Technology Stack

## Core Technologies
- **HTML5**: Semantic markup structure
- **SCSS**: CSS preprocessing for maintainable styles
- **Vanilla JavaScript**: No frameworks, lightweight functionality
- **JSON**: Translation and content data storage

## Build System
- **Node.js & npm**: Package management and build scripts
- **Sass compiler**: SCSS to CSS compilation
- **Static hosting**: Designed for GitHub Pages deployment

## Development Tools
- **Git**: Version control
- **Live Server**: Local development server
- **VS Code**: Recommended editor with extensions

## Common Commands
```bash
# Install dependencies
npm install

# Development with watch mode
npm run watch

# Build for production
npm run build

# Serve locally
npm run serve
```

## Architecture Patterns
- **Modular structure**: Separate concerns (styles, scripts, content)
- **Static routing**: No client-side routing framework
- **Component-based SCSS**: Organized stylesheets by component
- **Translation system**: Key-value pairs with structured naming (page.view.component.content)

## Performance Considerations
- Vanilla JS for minimal bundle size
- SCSS compilation with minification
- Optimized images and assets
- Static generation for fast loading