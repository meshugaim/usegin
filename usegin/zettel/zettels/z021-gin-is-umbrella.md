---
id: z021
title: Gin is the umbrella DX app; "Gin-Lab" as a separate name was retired
type: zettel
authored-by: human
threads: [↑z017, ~z014, ~z022, ~z024]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

Gin is the agent. Gin is *also* the DX app — the umbrella where everything related to our development experience lives. Tools, conventions, sub-features, sub-apps. Gin owns its own house.

Sub-apps so far:

- `zettel/` — the team 2nd brain. Sub-app, not the umbrella.
- `consultant/` — external-consultant agent's working area. Sub-app.
- `research/` — cross-cutting research that doesn't belong to any one sub-app.

Cross-cutting tools (correctors, translators, registries) live at the umbrella's top level — they're for *all* sub-apps.

## Gin side

The earlier `gin-lab/` folder was absorbed into `gin/` the same day it was created (z017). Two reasons:

1. The "lab" in `gin-lab` was implicitly a *separate* surface; with Zettel, Consultant, Research as sub-apps we needed a real umbrella. "Gin" is that umbrella; the lab-shaped artifacts are just the umbrella's tools.
2. One name is easier to think with than two. Per principle 01, fewer concepts to navigate is friction we lower.

Files moved cleanly via `git mv` so the trajectory (principle 02) is preserved in git history. All path references updated. The `Wispr corrector` got the `GynLab → Gin (umbrella)` entry so future Wispr-mistakes route to the new name.
