---
name: writing-specs
description: This skill writes spec documents interactively. Triggered by "let's write a spec", "spec for XXX", "document this feature", or "create a spec".
---

# Writing Specs

Build specs collaboratively through understanding, questioning, and section-by-section refinement.

**Core principle:** Understand first, write second.

## Workflow

### 1. Understand

User brain-dumps ideas. You gather context:
- Related code in the repo
- Relevant docs (context7, web search)
- Open source repos for reference (add to `.gitignore`)

Don't write yet. Just understand.

### 2. Ask Questions

Use `AskUserQuestion` to clarify until aligned on what needs spec'd.

### 3. Propose Sections

Present section outline. Get approval or adjust.

### 4. Write Section by Section

Create `docs/thing.spec.md`. For each section:

| Step | Action                                         |
| ---- | ---------------------------------------------- |
| 1    | Write section to file                          |
| 2    | Commit and push to `main`                      |
| 3    | PAUSE - ask for feedback via `AskUserQuestion` |
| 4    | Edit if needed, commit again                   |
| 5    | Move to next section when approved             |

Git commits after every change = easy rollback, clear history, checkpoints.

## Spec Style

| Do                | Don't           |
| ----------------- | --------------- |
| Concise           | Fluff           |
| Informal          | Corporate speak |
| Focused           | Bloat           |
| Tables over prose | Walls of text   |
