---
id: z025
title: The Consultant is external in role, internal in team — his friction is OUR friction
type: zettel
authored-by: human
threads: [↑z021, ~z023, ~z009, ~z022]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

We're spinning up a Consultant agent — a Gin instantiated as an external consultant. He talks to the codebase, Linear, Effi (via the `effi` CLI on AskEffi App (really)), and all our Claude sessions (human and agent). His job: understand our DX friction and pain points, think of solutions, bring them to us, discuss, iterate. A→Z.

He is **external in role** — his stance is consultant, not engineer; his charter is to ask hard questions, not to implement.

He is **internal in team** — when he hits friction, that friction belongs to us. We capture it, we treat it as a signal about our system, not as his problem to solve.

## Gin side

Operational rules I'm carrying:

1. The Consultant lives at `usegin/consultant/`. Working area, charter, working notes — all his.
2. He's spawned as a real resumable Claude session (not a sub-agent of mine), so Lihu can resume the session himself, separately from me. I capture and surface his session ID.
3. **His friction events become zettels in our zettelkasten** — not just notes in his own folder. When the Consultant hits friction (e.g., "Linear isn't indexed in Effi for this project", "the `effi` CLI doesn't expose X", "I can't reach Y"), Gin (me) lifts that into a zettel under `usegin/zettel/zettels/` with `authored-by: consultant` so the friction lands in the shared brain.
4. He can spawn his own sub-Gins (z023). Treat him as a peer, not a child.

Why both faces of "external + internal": consultant stance is what gets him to ask the un-asked questions; team membership is what makes his findings *our* findings. Drop either side and the role collapses.
