# Running Effective Retros

Tips for spawning retro agents from liaison mode.

## Session ID Gotcha

Subagents have their own session IDs. To retro on the *parent* session, pass it explicitly:

```bash
# Capture before spawning
export PARENT_SESSION=$CLAUDE_SESSION_ID
```

Then include in the retro agent's prompt:
```
Retro on session: <parent-session-id>
```

## The `session` CLI

Have the retro agent run `session --help` first to learn available flags.

**Key flags:**
- `--subagents` - includes subagent transcripts (usually want this)
- `--format narrative` - human-readable output (default)
- `--tool-input` - shows what was passed to tools

**Example command:**
```bash
session <session-id> --format narrative --subagents
```

## When to Spawn Retros

Use judgment. Good triggers:
- Phase of work completed
- Something felt off
- User asked
- Before context handoff

Don't retro every micro-task. The goal is learning, not ceremony.
