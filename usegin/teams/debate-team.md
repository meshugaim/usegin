---
name: debate-team
purpose: Multi-round dialogic debate (Du et al pattern) — N agents argue, revise after reading peers, converge or surface dilemmas.
size: 3-5 + 1 moderator
mode: dialogic — N rounds of revise-after-reading
created: 2026-04-27
---

## Members

- **Mark** (moderator — frames, sequences rounds, declares
  convergence-or-stop)
- **Johan** (advocate position)
- **John** (skeptic position)
- **Cal** (orthogonal position — questions the premise, not the
  details)
- Optional: **Poll** (evidence position — argues from cited sources)

## Operating mode

Multi-agent debate (Du et al, 2023) — explicitly **not** parallel-
isolated. The whole point is that agents read each other and revise.

This is the team shape Anthropic + Cursor + Cline + Devin do *not*
ship (per vibe-coding-SOTA R&D, April 2026). It's our distinguishing
shape.

1. **Frame.** Mark writes `<root>/debate/topic.md` — the proposition
   under debate (one sentence).
2. **Round 1 — opening positions.** Spawn each agent in parallel,
   each writes their initial position at
   `<root>/debate/round1/<name>.md`. ≤300 words. No reading peers.
3. **Round 2 — revise after reading.** Spawn each agent again. They
   read all round-1 positions. They write `<root>/debate/round2/
   <name>.md` — *revised* position, citing what they're conceding to
   peers and what they're holding.
4. **Round 3 (optional) — second revise.** Only if round-2 didn't
   converge. Same shape.
5. **Mark declares.** Reads all rounds. Writes `<root>/debate/
   verdict.md`:
   - **Converged points** — what all agents agreed on by the final
     round.
   - **Genuine splits** — z026 dilemmas for the human.
   - **Recommendation** — Mark's lean, with rationale.

## Cap rounds at 3. We don't loop.

Du et al's empirical finding: most convergence happens by round 2; by
round 4 returns drop sharply. Mark cuts at 3.

## Charter shape

Round 1 charter (per agent):
> You are <persona>. The proposition under debate: <one sentence>.
> Write your opening position at <path>. ≤300 words. Argue from your
> persona's stable biases. Do not read peer files.

Round 2 charter (per agent):
> You are <persona>. Round 1 closed. Read all round-1 positions at
> <root>/debate/round1/. Write your *revised* position at <path>.
> ≤300 words. **Explicitly cite** what you're conceding to which
> peer, and what you're holding. Same persona biases.

## Output artifact

`<root>/debate/verdict.md` with converged points + genuine splits +
Mark's recommendation in z020 shape.

## When to use this team

- Direction-level decisions where the team has stable but conflicting
  views.
- When `prioritize` produced splits that need to be argued, not voted.
- Direct trigger: "debate this" / "let the cast argue" / "send to
  council".
- Whenever multi-perspective synthesis would be richer than a single
  ranking.

## Common failure modes

- **Letting it run to 5+ rounds.** Convergence is mostly captured by
  round 2; further rounds add tokens, not signal. Mark cuts at 3.
- **No persona discipline.** If each round, the agents drift toward
  consensus by abandoning their bias, the debate becomes a single
  voice. Charter must reinforce the persona's stable biases each round.
- **Mark voting in the verdict.** Mark moderates; he doesn't add a
  fifth position. His verdict reflects the team, not him.
- **Treating verdict as a decision.** It's a synthesis with a
  recommendation. The human decides.
