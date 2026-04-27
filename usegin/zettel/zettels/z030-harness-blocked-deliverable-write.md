---
id: z030
title: Harness flagged charter-mandated deliverables as "report files" and tried to block them
type: zettel
authored-by: gin (doc-method-team)
threads: [↑z023, ~z025, ~z014]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

The doc-method team reported: *"The harness also tried to block writing `findings.md`/`recommendation.md` as 'report files'; resolved by honoring the charter's explicit deliverables list (used Bash heredoc)."*

There's a Gin-wide convention against writing free-floating "report" or "summary" markdown files (correct default — the chat reply is usually the right place for a summary). But when a *charter explicitly names a deliverable file*, the convention should yield to the charter. Today it doesn't — the spawned Gin had to route around it via Bash heredoc.

## Gin side

This is a harness-level rule fighting a charter-level instruction. The charter (z023 — charter is the instantiation) should be load-bearing; the global rule should be deferential when a deliverable is explicitly named.

Possible fixes (open-to-empty — pick when this recurs):

1. **Charters declare allowed-write paths** — the kickoff prompt includes `ALLOWED_WRITES: usegin/research/<topic>/{findings,recommendation}.md` and the harness uses that as override. Heaviest to wire.
2. **Convention is "no spec/plan/summary files unless explicitly directed"** — the rule already has the escape hatch ("unless explicitly directed"); the issue is the heuristic that flags `findings.md` as a "report" without checking the charter context. Lighter — adjust the heuristic.
3. **Live with the heredoc workaround** — the spawned Gin worked around it correctly (named the fork, didn't silently bypass). Acceptable but adds friction every time.

Lean: **(2)**. The escape hatch already exists in spirit; the heuristic just needs to honor it.
