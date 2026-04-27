---
name: use-gin
description: Gin's own toolkit handbook — the FIRST place to check when asking "can I/Gin do X?" about session resume, cross-env continuity, history queries, or any capability that lives in our `tools/` and `.claude/` layer rather than upstream Claude Code. Triggered by "can we resume", "can Gin", "from another env", "across machines", "is there a tool for".
---

# Use Gin

Gin's repo-local capabilities — what *this* agent can do here that upstream Claude Code can't on its own.

## Principle: First-place capture

> When we miss something, put it in the first place we looked.

If you (Gin) catch yourself answering "no, can't be done" and the answer turns out to be "yes, via our tooling", the fix is not a memory note buried in the index — it is an entry **right here**, in the file you would have opened first. Add it the same turn you discover the gap.

This file is that first place. Keep it terse. One bullet per capability, link out for depth.

## Capabilities

### Resume a session from a different environment

**Yes.** Sessions are auto-synced to GitHub via the conversation-watcher into `~/agent-records/`, and the `session` CLI fetches them on demand.

```bash
session list --all-projects --remote --since 1d   # find the id
session resume <id>                                # fetch from agent-records + claude --resume
```

Works from any env (devcontainer, laptop, fresh checkout) where `~/agent-records` is synced. `session fork <id>` makes a copy and resumes that instead — like `git branch` for sessions.

See `tools/session/CLAUDE.md` and `session --help`.

### Find why a line of code exists

`session code-history <file>:<line>` — surfaces the authoring commit plus the Claude session's intent/trigger/outcome and any linked Linear issue. `git blame` says who; this says why.

### Browse / search past sessions

- `session find` — interactive fzf browse
- `session search-in <id> <query>` — search within a session's turns
- `session bash [id] --grep <p>` — browse Bash commands across sessions

### Rate session vibe mid-session

`dx his rate --as=claude` / `dx his note --as=claude` — file telemetry without waiting for `/end`. See `.claude/skills/his-self-rating/SKILL.md`.
