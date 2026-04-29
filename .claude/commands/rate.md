---
description: Rate this Claude session 1..100 — Claude leads a short in-chat picker if no args, or files the rating immediately if args are given.
---

The user (or Claude) is filing a how-is-session rating. The user's input after `/rate` is `$ARGUMENTS`.

# Two modes

## Mode A — args given (`$ARGUMENTS` is non-empty): file immediately, no questions

Examples of arg shapes the user may type: `80`, `vibe=85 focus=70`, `g=80,a=92,co=70`, `ttm=80 was too verbose`, `75 vibe=90 felt great`.

Rules:
- A bare integer 1..100 with no `key=` (e.g. `80`) is the **general** score → translate to `general=80`.
- Other tokens are passed through to `dx his rate --as=human` verbatim. Trailing non-`key=val` words are the note.
- Run:

  ```bash
  dx his rate --as=human <args-translated>
  ```

- Echo the one-line confirmation. Done. Do NOT ask follow-ups. Do NOT summarize the session.

## Mode B — no args (`$ARGUMENTS` is empty): lead a short in-chat picker

You are the picker. Walk the user through it conversationally — every step has a default so they can answer with one keystroke or just "skip". Keep it tight: 4 messages max, no preamble, no closing summary.

**Step 1 — general score (always):** Ask exactly:

> How was the session? **1..100** — or just press Enter for `80`.

Wait for their reply. If they reply empty / "skip" / "ok" / "default" → use `80`. If they reply a number → that's the general score. If they reply something like `80 felt fine`, parse the number as the score and the rest as the note (skip step 4).

**Step 2 — more aspects (optional):** Ask exactly:

> More aspects? Reply with keys (e.g. `vibe focus accuracy`) or `n` to skip. Aliases ok: `v` `f` `a` `co` `e` `cl` `t` `fhc` `fcd` `frt` `gac` `gcs` `gio` `ttm` `und_h` `und_c` `ang` `fru` `pat` `sd` `thrash` `c_eff`. Full list: `dx his aspects`.

If they reply a list of keys → ask for each one's score in a single message:

> `vibe = ?  focus = ?  accuracy = ?` — reply on one line, e.g. `90 70 85`. Empty / `skip` for any score = drop it.

If they reply `n` / empty / `skip` → move on.

**Step 3 — personal aspect (optional):** Ask exactly:

> Want to add a personal aspect (your own key)? Reply `key=score` (e.g. `meeting_overhead=40`) or `n` to skip.

Resolve aliases via `dx his aspects` if the key matches an existing one.

**Step 4 — note (optional):** Ask exactly:

> One-line note? Or Enter to skip.

Then file:

```bash
dx his rate --as=human general=<n> [aspect=n …] [personal=n] <note words>
```

Echo the one-line confirmation. Done.

# Aspect cheatsheet

`g`=general, `v`=vibe, `f`=focus, `a`=accuracy, `co`=conciseness, `e`=efficiency, `cl`=clearness, `t`=thoroughness, `ttm`=talked_too_much, `und_h`=understood_human, `und_c`=understood_claude, `f_hc`=friction_human_claude, `f_ci`=friction_claude_infra, `f_cd`=friction_claude_devenv, `f_rt`=friction_running_tests, `g_ac`=gap_app_vs_code, `g_cs`=gap_code_vs_spec, `g_io`=gap_intent_vs_outcome, `ang`=anger, `fru`=frustration, `pat`=patience, `sd`=self_doubt, `thrash`=tool_thrashing, `c_eff`=claude_efficiency.

Storage: SQLite at `~/.claude/dx-his/his.db` — submissions accumulate, never overwrite.
