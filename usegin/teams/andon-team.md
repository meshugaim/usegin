---
name: andon-team
purpose: Empowered-watcher pattern. Worker ships; Watcher has halt-permission; Mark routes to fix when halted.
size: 2 (worker + watcher) + Mark
mode: live observer with halt-permission
created: 2026-04-27
---

## Members

- **Wes** (the worker — does the actual implementation)
- **Yohai** (the watcher — observes between phases, has halt-permission)
- **Mark** (router — when watcher halts, Mark decides the fix)

This generalizes our existing `companion` skill (long-running
observer) and `comptroller` agent. Adapted from Toyota Production
System's *andon cord* — any worker can stop the line if they see a
defect.

Per vibe-coding-SOTA R&D (April 2026), no commercial vibe tool ships
this pattern. Our `companion` is genuinely original.

## Operating mode

1. Mark spawns Wes for the next implementation step (per `cell` /
   `teamwork` shape).
2. Wes works. Each phase boundary (commit, file save, test run) is
   a checkpoint.
3. Yohai observes — reads the diff, the test output, the commit
   message, the working notes. He does **not** modify anything.
4. **Halt-permission.** If Yohai sees a four-axis fault (focus / code
   / process / fight signal), he files an audit at
   `usegin/comptroller/audits/<timestamp>-<topic>.md` and **pulls the
   andon cord** — returns up to Mark with a one-line halt reason.
5. Mark reads the audit, decides:
   - **Fix in place** — re-charter Wes with the gap.
   - **Pause and surface** — z026 dilemma to the human.
   - **Acknowledge and continue** — when the audit is yellow, not red.
6. Loop until done.

## Charter shape

Yohai's charter (per phase boundary):
> You are Yohai. The team just closed a phase. Read:
> - the commit / diff / test output
> - the whiteboard or working notes
> - the goal (named in <topic.md> or chat)
>
> Audit on four axes (focus / code quality / process / fight signal).
> Output `usegin/comptroller/audits/<timestamp>-<topic>.md`. Return
> a one-line summary up:
> - GREEN — "still focused, still clean, no drift"
> - YELLOW — "<one-line concern, citation>"
> - RED — "HALT: <one-line reason>"
>
> If RED, name the *minimum* fix that would unblock the team. Don't
> redesign — surface and stop.

## Output artifact

`usegin/comptroller/audits/<timestamp>-<topic>.md` per phase boundary,
plus the up-stream halt-or-continue signal Mark consumes.

## When to use this team

- Multi-step implementations (`cell`, `teamwork`, `tdd-execute`)
  where drift is a real risk.
- Long-running autonomous-vibe sessions (z091).
- Direct trigger: "use companion" / "spawn the watcher" / "audit
  between phases" / "andon".

## Common failure modes

- **Watcher modifies code.** Yohai *only* audits. He doesn't fix.
- **Mark ignores yellow.** Yellow accumulates → red. Mark must read
  every audit and respond, even if the response is "acknowledged".
- **Halts that are actually nits.** Yohai's bar for RED is "the team
  is silently degrading"; nits go in YELLOW.
- **No halt for fight signal.** If agents are fighting infra/hooks,
  that's RED — even if the work itself looks clean. Fights are
  leading indicators.
