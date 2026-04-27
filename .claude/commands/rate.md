---
description: Rate this Claude session on custom params (1..100). Both human and Claude can use this.
---

The user (or Claude) is filing a how-is-session rating. Their args follow the `/rate` invocation.

Run `dx his rate --as=human` with the args verbatim and report the result.

```bash
dx his rate --as=human <args>
```

Shorthand keys (others pass through as-is): `g`=general, `co`=conciseness, `a`=accuracy, `e`=efficiency, `cl`=clearness, `f`=focus, `t`=thoroughness, `v`=vibe, `ang`=anger, `fru`=frustration, `und_h`=understood_human, `und_c`=understood_claude, `ttm`=talked_too_much, `f_hc`=friction_human_claude, `f_ci`=friction_claude_infra, `f_cd`=friction_claude_devenv, `f_rt`=friction_running_tests, `g_ac`=gap_app_vs_code, `g_cs`=gap_code_vs_spec, `g_io`=gap_intent_vs_outcome.

Run `dx his aspects` to list everything. Values 1..100. Trailing free-text words become the note.

Examples:
- `/rate v=80,a=92,co=70` — three ratings, no note
- `/rate vibe=85 friction_running_tests=20 stayed on track` — two ratings + note
- `/rate ttm=80 was too verbose` — one rating + note

This is a fire-and-forget action: just run the CLI, echo its one-line confirmation back to the user, and stop. Don't ask follow-up questions, don't summarize the session, don't suggest more ratings.

Storage: SQLite at `~/.claude/dx-his/his.db` — submissions accumulate, never overwrite.
