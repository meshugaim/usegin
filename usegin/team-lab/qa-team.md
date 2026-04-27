# qa-team — Team Lab

## Intent

Make pre-trust evaluation of a new artifact a repeatable team move.
Without a named lifecycle, "let me check this before using it" collapses
into either a one-pass review (one perspective, low coverage) or a
sprawling unscoped audit (high cost, hard to act on).

The team exists because we've done ad-hoc QA-shaped things in this repo
multiple times — review of a new skill before adoption, sanity check on
a spec before slicing, "is this scaffolding ready" check on a new
agent — each time re-deriving who to spawn and what they should do.
Codifying the four-orthogonal-angles shape unlocks signal-via-convergence:
when 3 of 4 testers hit the same issue from different angles, the issue
is real, not perspective-dependent.

The team sits **upstream of first-use** of the artifact and **downstream
of completion**. It is the gate between "we built it" and "we use it."

Success means: a qa-team round runs end-to-end (charter → spawn → wait →
synthesize → decide) without the orchestrator re-deriving the lifecycle,
with each tester returning ≤200 words, and with the cross-cut synthesis
naming convergent and divergent findings explicitly.

## Success Signals

When retroing a session that used this team, a good session looks like:

### Framing (the artifact under test)
- [ ] One-sentence statement of what's being tested
- [ ] Read-first list ≤6 files — testers shouldn't drown in repo context
- [ ] Explicit boundary: what is in-scope to evaluate, what isn't

### Spawning + independence
- [ ] All four testers fired in **one** batched response (parallel)
- [ ] No tester read another tester's file mid-run
- [ ] Each charter included the persona-specific priming, not just the
      generic "evaluate this"
- [ ] Each charter explicitly forbade modifying the artifact under test

### Per-tester output
- [ ] ≤200-word return summary (verdict + top findings)
- [ ] Findings file in `/tmp/qa-<persona>.md` with ranked findings
- [ ] Verdict picked from a finite set (ready / needs-fix / needs-rework /
      premature) — not free-form
- [ ] Each tester named at least one thing the artifact got *right* (not
      just failure-mode dump)

### Synthesis
- [ ] Convergence explicitly named: which findings ≥2 testers hit
- [ ] Dispersion explicitly named: which findings only one tester hit
- [ ] Cross-cut verdict reflects convergence weight, not most-confident
      single-tester verdict

### Post-run
- [ ] Findings either (a) folded back into the artifact via fixes,
      (b) accepted as known risk with explicit memo, or (c) trigger a
      decision to defer / reject the artifact. No findings get silently
      shelved.
- [ ] `/tmp/qa-*` cleaned up after synthesis
- [ ] Whatever lab gaps the testers found in the lab pattern itself
      (meta) get added to the relevant lab file the same turn

## Failure modes to watch for

- **Tester collapse** — testers all say the same thing because the
  artifact is so obviously bad that all four angles converge on
  "broken". Lower signal value; consider whether the artifact was
  ready for QA at all.
- **Tester divergence** — every tester reports a different verdict with
  no overlap. Sign that the artifact is so under-defined that each
  tester is evaluating a different thing. Often signals z015 violation
  (premature systematization).
- **Cal-overreach** — Cal questioning premise so hard that Tim/Ivan/John
  findings get drowned out. Synthesis must keep the layers separate:
  direction questions (Cal) are upstream of correctness questions
  (Tim/Ivan/John).
- **John-doom** — John's failure-mode list is so long it reads as
  "don't ship anything." The retro should distinguish "first-session
  blockers" (act on) from "second-year edge cases" (note and move on).

## When NOT to invoke this team

- The artifact is a one-off (single-use spike, throwaway) — QA cost
  doesn't amortize.
- The artifact has already been used in production successfully — QA is
  for pre-trust, not post-trust. Use `tikur-team` for incidents and
  `team-retro` for after-the-fact evaluation.
- The artifact is a code change inside a well-tested codebase — that's
  `code-review` + `worker-reviewer`, not qa-team.

## Lineage

First run: 2026-04-27 against `zisser/` (the chief-of-staff agent built
that day). All four testers converged on "doc-internal contradictions
between principle 1, CLAUDE.md, and inbox/README.md", and Ivan caught
a dead reference to `decisions/`. Cal alone called the whole build
premature (z015 violation). The cross-cutting convergence pattern
proved diagnostic — the qa-team itself worked.
