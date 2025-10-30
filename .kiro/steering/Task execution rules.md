---
inclusion: always
---

# Task Execution Rules

## Atomic Development Approach

### Commit Strategy

- Make small, logical changes in each response rather than complete feature implementations
- Create atomic commits that can be cherry-picked independently
- Each commit should represent a single, complete unit of work
- Commit files immediately after creating or significantly modifying them

### Change Management

- **File Creation**: Commit new files with initial implementation as separate commits
- **File Updates**: If editing an existing file during issue resolution, commit the file beforehand
- **Dependencies**: Ensure each commit has no hidden dependencies on uncommitted changes

### Quality Standards

- Maintain comprehensive change history for future maintainers
- Each commit should clearly explain the "what" and "why" of changes
- Prioritize atomic commits over large feature commits

## Task Completion Protocol

### Before Task Completion

1. Verify all changes are committed atomically
2. Ensure no uncommitted dependencies exist
3. Test that each commit works independently

### Task Finalization

- When task is complete with no additional changes needed
- Request user approval for merge request creation
- Provide clear summary of all atomic changes made

## Code Quality Requirements

- Follow established project structure and naming conventions
- Maintain consistency with existing codebase patterns
- Ensure all changes align with the vanilla JS, SCSS, and static site architecture
- Validate syntax and functionality before committing
