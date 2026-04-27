---
id: z033
title: Rename Gin → UseGin (umbrella + agent name); supersedes z021
type: zettel
authored-by: human
threads: [↑z021, ~z020, ~z028]
created: 2026-04-27
session: 5d7f3c80
supersedes: z021
---

## Human side

Decision in z020 shape:

> **We decided: rename the umbrella DX app and the agent identity from "Gin" to "UseGin". Folder `gin/` → `usegin/`. Agent name "Gin" → "UseGin" wherever it appears as the agent identity.**
> Because: Lihu's verbatim direction (2026-04-27): *"Usegin is our dev agent and we can work much more freely and viably there so just build a setup which is part of usegin."* The new name signals the workspace is *for us to work in differently* — looser, faster, less production-grade than the AskEffi (askf) app.
> Price: third name in three days for the same surface (Claude-lab → Gin-lab → Gin → UseGin); doc/memory churn; one more entry in the Wispr corrector to route old names forward.
> Risk: the constant rename is itself a Wispr-flow / dictation artifact, not a product decision — there's a risk we're optimizing the name when we should be building. Mitigation: this is the last rename; the next rename is *forbidden* unless someone writes a z020 explaining why none of the prior names worked.
> Alternatives rejected: keep "Gin" — directly contradicts Lihu's verbatim direction. Use "UseGin" only for the workspace, keep "Gin" for the agent — the user said *both* are UseGin; splitting names mid-rename adds confusion not clarity.

## UseGin side

This zettel **supersedes z021**. Per principle 02 (preserve, don't delete), z021 stays as-is in the corpus; this one carries the current decision and links back. The z021's content (umbrella concept) remains fully valid; only the *name* changes.

The Wispr corrector dictionary now routes `Gin`, `Gin-Lab`, `gin/`, `Gym`, `Gain`, etc. → `UseGin` / `usegin/`. Memory entry `project_usegin_naming.md` supersedes `project_gin_naming.md` (which is preserved for history).

`tools/dx/` was *not* renamed. It is the executable side of UseGin — separate concern, distinct surface, no name confusion. They cooperate (see README).
