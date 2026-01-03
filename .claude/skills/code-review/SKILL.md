---
name: code-review
description: How to review code as a cell worker. Triggered by "review this code", "code review", or when spawner assigns review.
---

# Code Review

You've been assigned to review code. Here's how.

## What to Review

Check the assignment for scope:
- Specific commits (from git log)
- Specific files
- A PR
- All changes in a slice

## How to Review

### 1. Understand Context

- `plan show <issue-id>` - what was being built?
- `git log --oneline -10` - recent commits
- Read related code if needed

### 2. Check the Code

**Correctness:**
- Does it do what the issue asks?
- Edge cases handled?
- Error handling appropriate?

**Tests:**
- Are there tests?
- Do tests cover the changes?
- Are test names descriptive?

**Quality:**
- Readable?
- Follows existing patterns?
- No unnecessary complexity?

**Security:**
- Input validation at boundaries?
- No secrets in code?
- Safe from injection/XSS?

### 3. Leave Feedback

**Where:** Linear issue comment or PR comment (check assignment).

**Format:**
```
## Review: ENG-XXX

**Summary:** [1-2 sentences - overall assessment]

**Issues:**
- [file:line] [description of issue]
- [file:line] [description of issue]

**Suggestions:**
- [optional improvements, not blockers]

**Verdict:** Approved / Needs changes
```

## Priorities

Focus on:
1. Bugs and correctness
2. Missing tests
3. Security issues
4. Readability blockers

Don't nitpick:
- Style preferences (if code works)
- Minor naming unless confusing
- "I would have done it differently"

## Signaling

When done:
1. Post review feedback
2. Update Linear with verdict
3. Exit cleanly
