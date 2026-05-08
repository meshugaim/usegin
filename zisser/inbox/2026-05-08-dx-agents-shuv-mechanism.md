---
date: 2026-05-08
captured_by: Azisa (sub-Zisser)
parent_principle: zisser/principles/08-shuv-and-gizra.md
status: deferred — picks-up-when chartered
---

# `dx agents` — Shu"v single-pane (Move 3)

A DX subcommand that gives any Zisser (or human) the single picture
of "where are the forces, what are their missions" called for by
principle 8.

## Inputs

1. `zisser/dispatched/*.md` frontmatter — the canonical registry.
   Filter on `status: in-flight`.
2. `~/.claude/projects/-workspaces-test-mvp/*.jsonl` — live session
   files; a session with mtime within `expected_duration` of now is
   *active*. Cross-reference with the registry; sessions active *not*
   in registry are an `unregistered in-flight` row (Shu"v gap).
3. `tools/bin/session list --all-projects` — sessions running in
   sibling Gins / other devcontainers. Same registry cross-check.
4. (cross-env) `~/agent-records/` — synced JSONLs from other envs;
   sessions there with recent mtime indicate an in-flight peer in
   another devcontainer. This is what would have caught the
   2026-05-08 Doppler peer.

## Output shape

Three sections: in-flight, recently-returned, seams-flagged. Each
in-flight row carries: charter path, sector summary, parent session
id, duration budget, elapsed.

## Why deferred

Move 1 (registry conventions) + Move 2 (a `zisser/bin/in-flight`
read-only script) is enough to fix the immediate Shu"v gap inside
this monorepo. Move 3 is the cross-env story and the integrated UX —
real work; charter through Wes when picked up.

## Charter sketch (when chartered)

- Goal: a `dx agents` command that prints the three sections above.
- Input: `zisser/dispatched/`, JSONLs (project + cross-project),
  `~/agent-records/` mtime scan.
- Output: human-readable summary; `--json` for programmatic use.
- TDD: pure parsers (frontmatter, jsonl mtime, registry-vs-session
  diff) tested in unit; integration is a fixture-directory walk.
- Constraints: read-only; no daemon; no IPC.
