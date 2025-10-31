# HTML Template System

This directory contains the template system for generating HTML pages with shared header and footer components.

## Structure

```
src/templates/
├── header.html           # Shared header template with placeholders
├── footer.html           # Shared footer template
├── pages/               # Page-specific content templates
│   ├── index.template.html
│   ├── about.template.html
│   ├── projects.template.html
│   └── contact.template.html
└── README.md
```

## How It Works

1. **Templates**: Each page has a content template in `pages/` directory
2. **Placeholders**: Header template uses `{{PLACEHOLDER}}` syntax for dynamic content
3. **Build Script**: `scripts/build-html.cjs` combines header + content + footer
4. **Output**: Generated HTML files are written to `src/pages/`

## Available Placeholders

### Page Information

- `{{PAGE_NAME}}` - Page identifier (home, about, projects, contact)
- `{{PAGE_URL}}` - Relative URL for the page
- `{{PAGE_TITLE}}` - Page title for `<title>` tag
- `{{STRUCTURED_DATA}}` - JSON-LD structured data (home page only)

### Navigation States

- `{{HOME_ACTIVE}}` - Active class for home navigation
- `{{ABOUT_ACTIVE}}` - Active class for about navigation
- `{{PROJECTS_ACTIVE}}` - Active class for projects navigation
- `{{CONTACT_ACTIVE}}` - Active class for contact navigation
- `{{HOME_ARIA_CURRENT}}` - ARIA current attribute for home
- `{{ABOUT_ARIA_CURRENT}}` - ARIA current attribute for about
- `{{PROJECTS_ARIA_CURRENT}}` - ARIA current attribute for projects
- `{{CONTACT_ARIA_CURRENT}}` - ARIA current attribute for contact

## Build Commands

```bash
# Build HTML from templates
npm run build:html

# Watch templates for changes (requires nodemon)
npm run watch:html

# Full development with HTML watching
npm run dev
```

## Adding New Pages

1. Create content template in `src/templates/pages/newpage.template.html`
2. Add page configuration to `scripts/build-html.cjs` in the `pages` object
3. Run `npm run build:html` to generate the page

## Benefits

- **DRY Principle**: Header and footer are defined once
- **Consistency**: All pages use the same navigation structure
- **Maintainability**: Changes to header/footer apply to all pages
- **SEO**: Each page gets proper meta tags and structured data
- **Accessibility**: Consistent navigation states and ARIA attributes
