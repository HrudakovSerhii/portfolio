# Project Structure

## Root Directory
```
/
├── src/                    # Source files
├── dist/                   # Build output
├── tasks/                  # Project documentation and phases
├── node_modules/           # Dependencies
├── package.json           # Project configuration
└── README.md              # Project overview
```

## Source Directory (`/src`)
```
src/
├── pages/                 # HTML page files
├── styles/                # SCSS stylesheets
├── scripts/               # JavaScript modules
├── assets/                # Images, fonts, and other static assets
└── translations/          # JSON translation files
```

## Naming Conventions
- **Files**: Use kebab-case (e.g., `main-navigation.scss`)
- **CSS Classes**: Use BEM methodology (e.g., `.header__title--large`)
- **JavaScript**: Use camelCase for variables and functions
- **Translation Keys**: Use dot notation (e.g., `home.header.title.text`)

## File Organization
- **SCSS**: Organize by component, use partials with underscore prefix
- **JavaScript**: Create utility modules for reusable functionality
- **Translations**: One JSON file per language (e.g., `en.json`, `es.json`)
- **Assets**: Group by type in subdirectories (images/, fonts/, icons/)

## Translation System Structure
Translation keys follow the pattern: `page.view.component.content`

Examples:
- `home.header.title.text` → "Portfolio"
- `main.content.portfolio.name` → "John Doe"
- `contact.form.submit.button` → "Send Message"

## Build Output (`/dist`)
- Compiled CSS from SCSS
- Minified JavaScript
- Optimized assets
- Production-ready HTML files

### Performance Focus:

- Prioritize vanilla JavaScript over frameworks
- Optimize for static hosting and fast loading
- Minimize dependencies and bundle size

## Quality Assurance

- Always verify syntax and functionality before completing tasks
- Test responsive design considerations
- Ensure accessibility compliance
- Validate translation key consistency across language files