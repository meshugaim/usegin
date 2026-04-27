---
name: red-blue-purple
purpose: Adversarial-then-synthesis. Red attacks, Blue defends, Purple synthesizes a balanced read.
size: 3
mode: sequential-with-synthesis
created: 2026-04-27
---

## Members

- **John** (red — failure-mode-level attack)
- **Cal** (red — direction-level attack; optional, when scope is in
  question)
- **Johan** (blue — defends the direction; builds why-this-works
  arguments)
- **Sam** (purple — reads both, synthesizes the balanced read +
  z026 dilemmas)

## Operating mode

Two patterns — pick by stakes:

**Pattern A — sequential (default).**
1. Spawn John (and optionally Cal) on the artifact. They write
   `<root>/red/<name>.md` — failure modes / direction concerns.
2. Spawn Johan with the red files visible. He writes `<root>/blue.md`
   — defenses + counter-arguments.
3. Spawn Sam with both red and blue visible. He writes `<root>/purple.md`
   — synthesis + z026 dilemmas.

**Pattern B — parallel-then-debate (high stakes).**
1. Spawn John + Johan in parallel, each writing their corner without
   reading the other.
2. Spawn a debate round: each reads the other and writes one revision
   (≤1 round; we don't loop).
3. Sam synthesizes purple.

## Charter shape

Red charter:
> You are John (or Cal). Read the artifact at <path>. Surface failure
> modes (direction concerns) with concrete: what breaks, when, price,
> blast radius. No solutions; only surface. Output: <root>/red/<name>.md.

Blue charter:
> You are Johan. Read the red findings at <root>/red/. Defend the
> direction. Build why-this-works arguments. Counter the concrete
> failure modes with concrete mitigations. Output: <root>/blue.md.

Purple charter:
> You are Sam. Read red + blue. Distill: which failure modes are real
> and have valid mitigations? Which mitigations are weak? What's
> genuinely unresolved? Output: <root>/purple.md with z026 dilemmas
> for unresolved.

## Output artifact

`<root>/red/<name>.md` (per attacker) + `<root>/blue.md` +
`<root>/purple.md` (synthesis with z026 dilemmas).

## When to use this team

- Driven by `security-review` and `ultrareview` (multi-agent cloud
  review).
- High-stakes spec or PR where one-pass review misses adversarial
  cases.
- Direct trigger: "red-team this" / "stress-test the direction" /
  "what would kill this idea".

## Common failure modes

- **Letting Johan answer John in real-time.** Pattern A prevents this
  by sequencing; Pattern B caps at one debate round. Looping breaks
  independence.
- **Synthesizer becomes a third voter.** Sam reflects what red and
  blue actually said; he doesn't add a third opinion.
- **Skipping z026 dilemmas.** If purple resolves everything, you
  under-used the team — surface what's genuinely unresolved.
