---
name: save-to-effi
description: Save durable session knowledge to the team's Effi project canon (via `effi files add`) so it becomes available to future Effi queries. Use mid- or end-of-session when you've produced a summary, decision record, design note, workflow write-up, or similar synthesis worth preserving as project data. Triggered by phrases like "save to effi", "save this to the project", "add to effi canon", "capture this for effi", "pin to effi". Depends on the `dogfooding-effi` skill for CLI mechanics (auth, profile, linked project).
---

# Save to Effi

Turn something you produced in this session — a summary, a decision, a design note — into a file in the team's Effi project canon, so later Effi queries can cite it.

CLI mechanics (profile, auth, which project is linked) live in the `dogfooding-effi` skill. Invoke that skill if the preflight below surfaces anything unexpected.

## 1. Preflight

Before drafting anything, verify the pipe works and you're pointed at the right project:

```bash
effi status           # must show the linked project as "AskEffi App (really)"
effi files list       # what's already in canon
```

If auth is stale or the wrong project is linked, stop and resolve that first — don't draft into a broken pipe.

## 2. Frame the capture

Angles that tend to produce useful canon — suggestions, not rules. You and the user decide together what's worth capturing and from what frame:

- **Project** — decisions, status, context
- **Product** — how a feature works, constraints, rationale
- **Workflow** — how we do X
- **User** — user-facing behavior, UX decisions

Ask the user which frame they want, or propose one and let them redirect.

## 3. Draft

Write the draft to `/tmp/effi-drafts/<slug>.md` with a descriptive slug — Effi surfaces files by name, so `email-splitter-no-llm-decision.md` beats `notes.md`.

Show the user the path and a one-line summary of what you wrote. Do not upload yet.

## 4. User reviews

The user opens the draft in their editor, edits freely, and tells you when to proceed. Wait for explicit go.

## 5. Upload

```bash
effi files add /tmp/effi-drafts/<slug>.md
# add --external if the user flagged this as external-facing
```

Confirm it landed:

```bash
effi files list | head
```

## Common pitfalls

<!-- Seed this section with learnings as the skill gets used. Each pitfall: one-line symptom, one-line cause, one-line guidance. -->
