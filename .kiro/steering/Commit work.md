---
inclusion: always
---

# Git Commit Guidelines

## Commit Message Format

When generating commit messages, follow this structured format:

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
- **test**: Adding or updating tests
- **chore**: Build process, dependency updates, or maintenance tasks

## Rules

1. **Branch verification**: Always ask for branch name if not provided
2. **Subject line**: Keep under 50 characters, use imperative mood
3. **Descriptions**: Maximum 2 sentences per bullet point, focus on "what" and "why"
4. **File listing**: Include all modified files at the end
5. **Scope clarity**: Ensure commit scope matches the actual changes

## Template Structure

```
<type>: <concise subject in imperative mood>
- <what was changed and why - max 2 sentences>
- <additional context if needed - max 2 sentences>
<file1.ext>, <file2.ext>, <folder/file3.ext>
```

## Examples

```
feat: Add responsive navigation menu
- Implemented mobile-first navigation with hamburger toggle
- Added SCSS breakpoints for tablet and desktop layouts
src/styles/_navigation.scss, src/scripts/navigation.js

docs: Update project setup instructions
- Added Node.js version requirements and installation steps
- Included troubleshooting section for common build issues
README.md, package.json
```
