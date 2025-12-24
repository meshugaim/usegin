---
name: Working with Linear limits
handle: linear-limits
type: how-to
context: Current situation - Linear issue creation limit reached
---

# Working with Linear Limits

**Current situation:** We've hit Linear's free tier issue creation limit. Evaluating paid tier. Until resolved, using hybrid workflow below.

## What Still Works

| Command | Status |
|---------|--------|
| `plan list` | works |
| `plan show <id>` | works |
| `plan update <id>` | works |
| `plan start <id>` | works |
| `plan close <id>` | works |
| `plan search` | works |
| `plan create` | **blocked** |

## Temporary Workflow

1. **Existing issues**: Continue using `plan` CLI normally
2. **New work**: Capture in `docs/plan/plan.md`
3. **Detailed specs**: Write in `docs/plan/specs/`

## plan.md Structure

```markdown
## In Progress
- **ENG-XXX**: description
  - ENG-YYY: sub-issue

## To Capture
Ideas that would be Linear issues:
- feature idea → parent issue it belongs under

## Parked
Needs discussion before proceeding:
- idea → reason parked
```

## When Limits Resolve

Migrate items from `docs/plan/plan.md` to Linear via `plan create`, then remove from the file.
