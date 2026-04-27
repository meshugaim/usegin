---
name: qa-team
purpose: Stress-test a new artifact (skill / agent / spec / system) from four orthogonal angles before it is trusted in real use.
size: 4
mode: parallel-independent
created: 2026-04-27
---

## Members

- **Tim** (testing priming: "exercise the routing matrix end-to-end; expected vs actual; where do they diverge")
- **Ivan** (investigative priming: "hunt for ambiguity, contradiction, dead references, undefined behavior; the seams not the happy paths")
- **John** (failure-mode priming: "list the ways this breaks in the wild; first-week failures, concurrency, feature traps, dependency surface")
- **Cal** (direction priming: "question the premise; is the artifact solving a real problem; would the rejected alternative have been better; was this premature")

The four are deliberately orthogonal — covering correctness (Tim),
internal coherence (Ivan), operational risk (John), and strategic
direction (Cal). Cross-cutting convergence across testers is the
strongest signal.

## Operating mode

- All four spawn in **one batched response** — multiple Agent calls in
  one message.
- **No sync.** Testers do NOT read each other's files mid-run.
  Independence is what lets convergence be diagnostic — when 3 of 4
  hit the same issue from different angles, that's high-confidence
  signal.
- Each writes to `/tmp/qa-<persona>/` (sandboxed) plus a one-page
  findings file at `/tmp/qa-<persona>.md`.
- The artifact under test is **read-only** for testers — no
  modifications to the repo. Findings live in `/tmp/` until the
  orchestrator decides what to do with them.
- Each tester returns ≤200 words (verdict + top 2-3 findings). Detail
  in the file.

## Charter shape (per tester)

The skill's charter template carries:
- read-first list (the artifact's top docs, ≤6 files)
- the persona's priming (one of the four above)
- working rules: read-only-in-repo, sandboxed-to-/tmp, no-git,
  no-sub-agents (z029)
- findings file shape (verdict + ranked findings + "what got right")
- ≤200-word return summary

## Output artifacts

- `/tmp/qa-<persona>.md` — one per tester (4 total).
- Orchestrator synthesis: a cross-cut summary noting **convergence**
  (≥2 testers raised the same issue from different angles) and
  **dispersion** (issue raised by only one tester — lower confidence).

## When to invoke

- New skill is written and not yet used → run qa-team before first use.
- New agent / persona / team is built → run qa-team before adoption.
- Spec is finished and not yet implemented → run qa-team to surface
  ambiguities before slicing.
- Existing artifact has been failing in production → run qa-team to
  catalog failure modes (paired with `tikur` for incident-specific RCA).

## Not for

- Code review of a diff — that's `code-review` (Ron's slot).
- Bug investigation — that's `fix-bug` (Ivan's solo slot).
- Idea generation — that's `brainstorm-team` (Poll/Din/Johan's slot).
- Post-incident root cause — that's `tikur-team`.

## Composition rationale

Why these four and not Ron/Wes/Sam? Ron reviews diffs (correctness of
implementation, not artifact direction). Wes implements (executor,
not evaluator). Sam synthesizes (last step, after the testers have
produced raw signal). The qa-team is **upstream of implementation** —
it's "do we trust this artifact yet?" not "is this code right?"
