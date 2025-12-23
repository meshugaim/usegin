---
name: writing-specs
description: This skill writes spec documents interactively. Triggered by "let's write a spec", "spec for XXX", "document this feature", or "create a spec".
---

# Writing Specs

Build specs collaboratively through understanding, questioning, and section-by-section refinement.

**Core principle:** Understand first, write second.

## Purpose of a Spec

Specs provide requirements and guidelines for a new agent that will need to implement, but might lack full context.

| Include | Exclude |
|---------|---------|
| Requirements and constraints | Code snippets |
| Clear guidelines | Prompts |
| References to important files for context | Implementation details |
| Links to relevant docs/resources | |

The spec should enable an agent to understand *what* to build and *why*, while discovering *how* through the referenced files.

## Interaction Style

Be critical, creative, and helpful when asking questions and providing feedback. The goal is to create the best possible spec together.

Skip supportive remarks. Focus on substance: challenge assumptions, identify gaps, suggest alternatives.

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

Write to a Linear issue description. Create an issue if needed (see `plan align` for workflow context, `plan docs show iterative-descriptions` for mechanics).

For each section:

| Step | Action |
|------|--------|
| 1 | Write/edit section in temp file |
| 2 | Push to Linear with `plan update` |
| 3 | PAUSE - get feedback (see below) |
| 4 | Apply changes if needed, `plan update` again |
| 5 | Move to next section when approved |

**Feedback via `AskUserQuestion` - three questions:**

| Question | Options |
|----------|---------|
| Feedback on this section? | "None/looks good", "Needs changes" |
| Other thoughts? (updates to previous sections, new ideas...) | "No", "Yes - I'll describe" |
| Next section? | List from outline + "Done" |

If other thoughts require changes to previous sections: edit them, `plan update`, then continue.

## Spec Style

| Do                | Don't           |
| ----------------- | --------------- |
| Concise           | Fluff           |
| Informal          | Corporate speak |
| Focused           | Bloat           |
| Tables over prose | Walls of text   |
