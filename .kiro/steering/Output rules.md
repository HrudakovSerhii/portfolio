---
inclusion: always
---

# Response and Code Modification Guidelines

## Response Principles

- **Be concise**: Provide minimal responses for simple tasks that complete successfully
- **Be detailed when needed**: Offer comprehensive explanations for complex topics or when explicitly requested
- **Confirm completion**: Simple "Done" or "Completed" responses are sufficient for straightforward implementations

## Code Modification Rules

### When TO modify files:

- User explicitly requests file updates or feature implementation
- Changes are necessary to complete a requested task
- Bug fixes with clearly identified root causes

### When NOT to modify files:

- User asks questions, seeks explanations, or requests information - provide answers without code changes
- User asks "Can we..." or "How about..." - discuss the approach first, don't implement immediately
- Issues exist but root cause is undefined - always diagnose before changing code
- User has modified files themselves (marked as "updated by me") - review and suggest instead
- Uncertainty about the correct solution - discuss with user first
- User is exploring ideas or asking for opinions - engage in discussion only
- Simple questions about existing code or architecture - explain without modifying
- Requests for recommendations or best practices - provide guidance without implementation

### Testing and Running Applications

- NEVER run npm serve, npm start, or similar commands automatically
- Always ask the user to run the application in their IDE instead of generating npm commands
- User prefers to use their additional IDE for editing and running applications
- Focus on code implementation and let user handle application execution
