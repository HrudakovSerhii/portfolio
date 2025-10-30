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

## Merge Request Template

```
### Overview
[Brief description of what was accomplished and the main purpose]

### Key Features Implemented
- [Feature 1 with brief description]
- [Feature 2 with brief description]
- [Feature 3 with brief description]

### Technical Stack
- [Technology 1] - [Purpose/role]
- [Technology 2] - [Purpose/role]
- [Technology 3] - [Purpose/role]

### Files Added/Modified
- [file/path] - [Brief description of changes]
- [file/path] - [Brief description of changes]
- [directory/] - [Brief description of contents]

### Build System
```
[Command examples with descriptions]
```

### Quality Assurance
- ✅ [Quality check 1]
- ✅ [Quality check 2]
- ✅ [Quality check 3]
```
