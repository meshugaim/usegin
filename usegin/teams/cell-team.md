---
name: cell-team
purpose: Long-running implementation via spawner-led + sequential workers + per-step review.
size: 1 spawner + N workers + 1 reviewer
mode: spawner-led, sequential
created: 2026-04-27
---

## Members

- **Mark** (spawner — reads whiteboard, charters next step, verifies,
  commits, updates whiteboard, repeats)
- **Wes × N** (one per step — implements)
- **Ron** (reviewer — per-step audit before Mark commits)

Optional: **Tim** (verifier — independent reproduction when stakes are
high) and **Yohai** (watcher — andon-team layered on top for long
runs).

## Operating mode

Sequential by default. Each Wes builds against committed code from
the previous step.

1. Mark reads whiteboard / RESUME.md.
2. Mark plans next step.
3. Mark spawns Wes with a tight charter (read-first, mandate, scope,
   deliverable, stop condition).
4. Wes works, commits no — returns the diff intent to Mark.
5. Ron reviews the diff (not the summary).
6. (Optional) Tim verifies independently.
7. Mark commits, pushes, updates whiteboard.
8. Loop.

## Output artifact

The whiteboard (e.g. `usegin/research/<topic>/RESUME.md`) plus the
committed diffs.

## When to use this team

- Driven by the `cell` skill.
- Multi-step implementation that fits one director-coordinated track
  (not a multi-track build — that's `teamwork`).
- Direct trigger: "use cell pattern" / "spawn workers" / "long-running
  implementation".

## Common failure modes

- **Spawner stops verifying mid-loop.** Mark must read the diff every
  step.
- **Skipping Ron at the "trivial" step.** No step is trivial enough to
  skip review (memory: feedback_red_reviews).
- **Parallelizing what's actually sequential.** Each Wes must build
  against the *committed* code from the previous step.
