---
description: Rate this Claude session on custom params (accuracy, focus, etc.)
---

The user is rating this session. Their args follow the `/rate` invocation.

Run the `session-rate` CLI with the args verbatim and report the result.

```bash
session-rate <args>
```

Shorthand keys (others pass through as-is): `g`=general, `co`=conciseness, `a`=accuracy, `e`=efficiency, `cl`=clearness, `f`=focus, `t`=thoroughness. Values 1..10. Trailing free-text words become the note.

Examples:
- `/rate a=8,co=7,f=9` — three ratings, no note
- `/rate accuracy=9 efficiency=8 "stayed on track"` — two ratings + note
- `/rate t=10 was great` — one rating + note

This is a fire-and-forget action: just run the CLI, echo its one-line confirmation back to the user, and stop. Don't ask follow-up questions, don't summarize the session, don't suggest more ratings.

Storage: `~/.claude/session-ratings/ratings.jsonl` (append-only JSONL, one record per invocation).
