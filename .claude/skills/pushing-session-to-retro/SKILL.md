---
name: pushing-session-to-retro
description: Push current session to CI for retro analysis. Triggered by "/retro", "push session for retro", or "retro this session".
---

# Push Session to Retro

Push the current session to CI for automated retro analysis.

## Steps

1. Find the current session file (most recently modified `.jsonl` in project dir)
2. Push it using the script:

```bash
bun retro/src/push-session.ts <session.jsonl>
```

## Session Location

Sessions live in `~/.claude/projects/<project-hash>/`:
- Main session: `<uuid>.jsonl`
- Subagents: `agent-*.jsonl`

Find the most recent:
```bash
ls -t ~/.claude/projects/*/*.jsonl | grep -v agent- | head -1
```

## What Happens Next

1. Script creates branch `retro/sessions/<date>-<short-id>`
2. CI workflow triggers on push
3. `session-retro` skill runs analysis
4. GitHub issues created with `retro` label

## Dry Run

Preview without pushing:
```bash
bun retro/src/push-session.ts <session.jsonl> --dry-run
```
