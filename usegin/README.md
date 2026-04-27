# Gin — the DX app

**Gin** is the agent that works in this repo (memory: `project_gin_naming.md`, ENG-5378). Gin is also the **umbrella DX app** — the place where everything related to our development experience lives. Tools, conventions, sub-features, sub-apps. Gin owns its own house.

The earlier `gin-lab/` folder was absorbed: its meta surface (correctors, translators, registries) sits at this top level. There is no separate "lab" anymore — the umbrella IS the lab plus the sub-apps. (See `zettel/zettels/z021`.)

## Sub-apps

- **`zettel/`** — the team's shared 2nd brain. Atomic, threaded, two-sided notes. Sub-app, not the umbrella. Tracking issue ENG-5379.
- **`consultant/`** — external-consultant agent's working area. Sub-app. He's external in role, internal in team (`zettel/zettels/z025`).
- **`research/`** — cross-cutting research that doesn't belong to any one sub-app. Each topic is its own folder.

## Cross-cutting tools (accumulate-as-we-go)

- **`things-we-grow.md`** — the master registry for accumulate-by-use artifacts. Add a row when you notice friction caused by a missing one.
- **`wispr-flow-corrector/dictionary.md`** — word-level corrections for Wispr Flow misheardings. Gin manages it.
- **`translators/`** — cross-domain term maps. `physics-to-dev.md` is open-to-empty; per-language translators ditto until friction appears.

## Conventions

- **Two faces when suitable** (`zettel/zettels/z022`): anything in Gin can have two faces — human-facing and Gin-facing — wherever the artifact is consumed by both. Don't force two faces where one suffices.
- **Open-to-empty** (`zettel/zettels/z003`): an empty file at a real address is a valid artifact. Create the address before you have the content.
- **Accumulate-as-we-go**: nothing is built once and shipped. Use grows the artifact.
- **Gin owns the "how"** (`zettel/zettels/z014`): folder location, naming, structure are Gin's calls; semantics are Lihu's.
- **Pre-game manual** (`zettel/zettels/z015`): only systematize what we've done by hand at least once.
- **Decision shape** (`zettel/zettels/z020`): "We decided X because Y. Price is Z. Risk W. Alternatives rejected: …" — emitted by Gin without being asked.

## Tracking

We do **not** Linear-everything for Gin (`zettel/zettels/z024`). Linear is the spine for shipped product. Gin's own work uses lighter, code-adjacent forms. The exact form is being researched — see `research/documentation-method/`.
