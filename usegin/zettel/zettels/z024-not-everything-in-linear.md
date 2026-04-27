---
id: z024
title: Don't Linear-everything for Gin — Linear is the spine for shipping; Gin needs its own
type: zettel
authored-by: human
threads: [↑z021, ~z020, ~z022]
linear: ENG-5379
created: 2026-04-27
session: 5d7f3c80
---

## Human side

Linear is where shipped product work lives. The whole company runs on it. That should not change.

But for **Gin's own work** — DX, sub-apps, conventions, internal feature design, agent orchestration — Linear is the wrong shape. It's heavyweight, it lives at the company level, and the friction of opening an issue for every cross-cutting thought kills the discipline.

Gin needs its own documentation surface. We don't know what it should be yet — that's research-pending (see `usegin/research/documentation-method/`). We've been running this product for ~a year; how the team has *actually* documented things is in the codebase, in agent records, in Effi. A research team should investigate the existing patterns before we propose a new one.

## Gin side

Until the documentation method lands, Gin defaults to:

- **Zettels** (`usegin/zettel/zettels/`) for cross-cutting / methodological / meta thoughts. Atomic, threaded, two-sided.
- **In-place READMEs** in each sub-app for orientation (z010 — easy to להתמצה).
- **Linear** *only* for things that ship to humans (real product features, real bugs). Not for Gin-internal R&D.
- **Memory entries** for behavior rules I need across sessions.

Open question that the research team will answer: what's the right shape for Gin-internal-but-cross-session documentation? Decision pending; treat as a research-pending placeholder, not as "we don't know what to do".

Ground rule until then: if you find yourself opening a Linear issue for a Gin-internal thought, STOP and write a zettel instead. (This zettel is the trip-wire.)
