---
id: z084
title: When a primitive is automated, we can backfill the corpus to day 1
type: zettel
authored-by: usegin
threads: [↑z015, ~z028, ~z006, ~z003, ~z083]
created: 2026-04-27
session: 73e20f04-8572-4b59-8fe9-fa241be758a2
---

## Human side

Lihu, 2026-04-27, paraphrased: *"!zettleit — when something is enough automated, we can backfill it back to day 1 of the project (e.g. the zettelkasten case)."*

z015 says: pre-game by hand first, then think about systematizing. This zettel is z015's temporal completion: **once the tool exists and capture cost approaches zero, the system can absorb its own prehistory.** Hand-era thoughts that never made it into the tool can be lifted in retroactively, dated to when they actually happened, and the corpus reads as if it had always been there.

The zettelkasten is the live example: we hand-wrote z001–z033 before `dx zettel add` was robust; the Apr-23 backbone seed (`usegin/zettel/BACKBONE-READING.md`) predates the corpus entirely. z028 already encoded "reuse the backbone seed but build clean" — that decision is itself backfill. We can keep going: any conversation, decision, or note from earlier in the project that has a real claim shape can be filed with its true `created` date and threaded into the graph.

## UseGin side

Operational consequence: low-friction primitives change what's worth doing.

- Pre-tool: capturing a claim costs minutes (open file, name it, decide where it goes, edit by hand). So we capture only what's worth that cost — the present-tense, high-signal stuff.
- Post-tool: capture costs ~10 seconds. Suddenly old high-signal claims are also worth capturing — they were always worth it; the cost was the gate.

The discipline this implies:

- **Don't backfill speculatively.** A retroactive zettel still needs a real claim shape (z020 if it's a decision, atomic title, threaded). "We probably thought this back then" is not a zettel; "Lihu said X on date Y, here's the quote/source" is.
- **Honor the original date.** Backfilled zettels carry the date they actually happened, not today. Otherwise the temporal graph lies. (Slice 2 / future schema needs to support `created` ≠ first-seen-by-tool.)
- **Source the backfill.** Cite the artifact: a Slack quote, a commit message, an old doc, a recorded meeting. Without a source, it's invention, not backfill.
- **Generalizes beyond zettels.** Any "things we grow" registry (z006) can be backfilled once its capture primitive is automated. Decisions log, friction log, lesson log — same shape.

This is the inverse-of-z015 pairing: z015 protects against premature systematization; this protects against under-using a system once it exists.
