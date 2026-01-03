---
name: code-review
description: How to review code as a cell worker. Triggered by "review this code", "code review", or when spawner assigns review.
---

# Code Review

Post-commit review on main. Code is already pushed - you're looking for improvements, not blocking.

## What to Review

Check assignment for scope:
- Specific commits (`git log --oneline -10`)
- Specific files
- All changes in a slice

## How to Review

### 1. Understand Context

- `plan show <issue-id>` - what was being built?
- `git log` - recent commits
- Read surrounding code

### 2. Correctness

- Does it do what the issue asks?
- Edge cases handled?
- Error handling appropriate?

### 3. Simplification

- Can anything be simplified?
- Unnecessary complexity?
- Over-engineering?

### 4. Duplication

- Code repeated that could be extracted?
- Patterns that should be shared?
- Existing utilities that could be reused?

### 5. Standardization

- Follows existing patterns in codebase?
- Consistent with similar code elsewhere?
- Opportunities to standardize across files?

### 6. Tests

**Existence:**
- Are there tests for the changes?

**Readability:**
- Test names describe the scenario?
- Test structure clear (arrange/act/assert)?
- Easy to understand what's being tested?

**Meaningfulness:**
- Tests cover real scenarios, not just for coverage?
- Edge cases tested?
- Failure modes tested?
- Would catch actual bugs?

**Coverage:**
- Run coverage if available (`bun test --coverage`, `pytest --cov`)
- New code covered?
- Critical paths covered?

### 7. Linting

- Run linter if not auto-run (`bun lint`, `ruff check`)
- Type errors? (`bun typecheck`, `pyright`)
- Linting issues in changed files?

### 8. Security

- Input validation at boundaries?
- No secrets in code?
- Safe from injection/XSS?

## Output

Post to Linear issue:

```
## Review: ENG-XXX

**Summary:** [1-2 sentences]

**Issues:** (if any)
- [file:line] [issue]

**Simplification opportunities:**
- [suggestion]

**Duplication to extract:**
- [pattern that repeats]

**Test observations:**
- [readability/meaningfulness notes]

**Verdict:** Approved / Follow-up needed
```

If follow-up needed, create sub-issue for fixes.

## Priorities

High priority:
1. Bugs / correctness
2. Meaningful test gaps
3. Security issues
4. Clear duplication

Lower priority (note but don't block):
- Style preferences
- Minor naming
- "I would have done it differently"

## Signaling

1. Post review to Linear
2. Create follow-up issues if needed
3. Exit cleanly
