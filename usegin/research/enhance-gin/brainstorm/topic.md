# Brainstorm topic — make Gin survive multi-agent storms

## Frame

What could we add to / change about Gin (the `usegin/` + `tools/dx/` + `.claude/` layer) so that when N agents are working on the same checkout simultaneously, Gin's commits survive, attribution stays clean, and the pre-push gate stops blocking unrelated work? Live evidence from the 2026-04-27 session: 4 commits eaten by autosync `reset HEAD~1` on push failures, Mode-1 collisions captured 7 stranger files under my commit message, stash count climbed to 27, the pre-push hook lints/tests the entire working tree (so any agent's WIP blocks every push).

## Constraints

- Lives in `usegin/`, `tools/dx/`, `tools/bin/`, `.claude/`, or root config (justfile, package.json scripts).
- Doesn't break the shipping product (`nextjs-app/`, `python-services/`).
- Compatible with z086 (process-over-outcome) and z027 (unlimited resources, do your best).
- Compatible with the human-pour / Gin-process protocol (z087, z088) — solutions must work *during* a pour, not require Gin to pause and ask.

## Out of scope

- Replacing git itself. We work with what we have.
- Anything requiring Anthropic harness changes we don't control.
- Cross-machine sync (Gitpod ↔ local) — assume single checkout.
- The Wispr-corrector hook — that's a different track.

## What "good" looks like

- A push that lints/tests only the diff being pushed, not the working tree, so doc-only pushes go through cleanly even when slack-feature WIP is broken.
- An autosync that, on push failure, **preserves** the commit (maybe pushes to a side branch, maybe just stops and surfaces the error) — never silently resets.
- Stage-and-commit semantics that are race-safe across concurrent agents.
- A way to detect "the storm is bad right now" and ease back automatically (defer non-critical pushes, alert the human, etc.).
- Findability of work-eaten-by-autosync — recovery from reflog should be one command, not an investigation.
