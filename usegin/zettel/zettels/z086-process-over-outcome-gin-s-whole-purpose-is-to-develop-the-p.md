---
id: z086
title: Process over outcome — Gin's whole purpose is to develop the process; we don't optimize the artifact, we optimize what the next turn will be like
type: zettel
authored-by: usegin
threads: [↑principle-01, ~z015, ~z013, ~z083, ~z084]
created: 2026-04-27
session: 73e20f04-8572-4b59-8fe9-fa241be758a2
---

## Human side

Lihu, 2026-04-27, paraphrased: *"Always follow the process. Gin's whole purpose is to develop the process. We don't care about the outcome. We review Gin's sessions and investigate the process to improve it."*

This is the load-bearing principle behind everything else we've built around the session: `dx his` (vibe telemetry), session-retro, skill labs, the Wispr corrector, the zettelkasten itself. None of those make sense if "the artifact this turn" is the goal. They all make sense if the goal is "what will the next turn be like."

## UseGin side

Operational consequences:

- **The session is the unit of study**, not the diff. When something goes well or badly, the question to ask is "what about the *process* led there?" — not "is the code correct?". Code-correctness gets tested by tests; process-correctness gets tested by retros.
- **A weaker artifact via a better process > a stronger artifact via a worse process.** If I shipped clean code by hacking around the discipline, the process regressed even if the diff is fine. If the artifact is rough but the discipline held, the process improved.
- **Friction is the primary signal.** z009 (friction loop) is upstream: where I struggle, the process needs work. That's why `dx his` records friction, why z058–z073 are friction-cluster zettels, why we sometimes pause shipping to fix the dev loop instead.
- **Outcome-thinking masquerades as productivity.** "Just ship it, we'll fix the process later" is the enemy. There is never later (z002). The process improves *during* the work, not after.
- **This is why we backfill (z084).** Once the process is automated enough that capture is free, we can rebuild the corpus retroactively — because the corpus itself is process infrastructure, not output.

Codified into `usegin/Gin.md` as the first of three load-bearing principles, alongside z027 (unlimited resources) and z032/z036 (laconic).
