---
inclusion: always
---

# Git Commit Guidelines

## Commit Message Format

```
<type>: <subject>
- <description line 1>
- <description line 2>
<affected files>
```

## Commit Types

- **feat**: New features or functionality
- **fix**: Bug fixes
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic changes)
- **refactor**: Code refactoring without feature changes
- **chore**: Build process, dependency updates, or maintenance tasks

## Commit Rules

1. **Subject**: Under 50 characters, imperative mood
2. **Descriptions**: Max 2 sentences per bullet, focus on "what" and "why"
3. **Files**: List all modified files at end
4. **Scope**: Ensure commit scope matches actual changes
5. **Atomic**: Each commit should be a complete, independent unit of work

## Project-Specific Patterns

- Branch names match task files: `phase1-project-foundation` → `tasks/phase1-project-foundation.md`
- SCSS files use underscore prefix for partials: `_navigation.scss`
- Translation keys follow dot notation: `home.header.title.text`
- Static site structure: `src/` → `dist/` build output

## Examples

```
feat: Add responsive navigation menu
- Implemented mobile-first navigation with hamburger toggle
- Added SCSS breakpoints for tablet and desktop layouts
src/styles/_navigation.scss, src/scripts/navigation.js

chore: Setup build system with SCSS compilation
- Added npm scripts for watch mode and production builds
- Configured Sass compiler with minification for dist output
package.json, .gitignore
```

## Merge Request Guidelines

- Title matches completed task/branch name
- Include overview of major components, logic, and architectural changes
- List key files modified with brief description of changes
