---
id: z020
title: Decisions have a shape — Claude should know it cold and emit it without being asked
type: zettel
authored-by: gin
threads: [↑principle-02, ↑principle-01, ~z002, ~z015, ~ENG-5392, ~ENG-5335]
linear: ENG-5392
created: 2026-04-27
session: current
---

## Human side

When Lihu makes a decision in a session, the trail of *why* is the most valuable
artifact — more valuable than the code that implements it (principle 2). Today
that trail only survives if Claude happens to write it well, in the right place,
in the right shape. That's fragile. We want it automatic.

The shape Lihu wants:

> **We decided X because Y. The price is Z. The risk was W. Alternatives
> rejected: …**

Four lines. No prose padding, no hedging menu of options, no "we could
consider…". Settled means settled — written down so we can revisit *the
decision*, not re-derive it from scratch in three months when one of us thinks
"why did we do it that way?"

## Gin side

CLAUDE.md should carry this as a standing instruction, so every Claude in this
repo emits it the moment a decision lands — without being asked, without the
human having to type "now write it down."

Concretely the rule is:

1. When the human says "decided" / "settled" / "go with X" / "let's do X" — or
   when Claude itself converges on a recommendation the human accepts — Claude
   writes the decision in the four-line shape above, **before** the response
   ends.
2. The decision lands in the **right artifact**, bound:
   - On a Linear issue's body if the decision shapes the spec.
   - As a Linear comment if the decision is a tactical call within an open issue.
   - As a zettel if the decision is meta / cross-cutting / methodological.
3. The decision is **bound** to the relevant Linear issue and zettel — the
   binding is part of the artifact, not a separate todo.

The friction this kills: Lihu having to ask "now zettel that" after every
decision. The zettel/comment should already be there by the time the response
ships — same way `git commit` records what was already written, not a separate
ceremony.

## Bound to

- ENG-5392 — Linear is the spine; comments hold tasks, bugs, handoffs.
- ENG-5335 — the chat-history feature where this pattern was first applied
  (three decisions captured as a Linear comment in the four-line shape).
- z002 — never later. This zettel makes the "write it down NOW" rule operational
  for the *decision* class of artifact specifically.
