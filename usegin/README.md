# UseGin — our DX app and our dev agent

**UseGin** is the agent that works in this repo and the umbrella DX app — the workspace where everything related to our development experience lives. Tools, conventions, sub-features, sub-apps. UseGin owns its own house.

UseGin is the new name. Earlier names this absorbed (in supersession order): "Claude lab" → "Gin lab" → "gin-lab/" → "gin/" → **`usegin/`**. Each rename was preserved in git history per principle 02. Reasoning trail: zettels `z021` (gin became umbrella) and `z033` (gin became usegin); memory entry `project_usegin_naming.md`. The agent inside the umbrella is also called UseGin — the name unifies workspace and identity.

## Sub-apps

- **`zettel/`** — the team's shared 2nd brain. Atomic, threaded, two-sided notes. Sub-app, not the umbrella. Tracking issue ENG-5379.
- **`consultant/`** — external-consultant agent's working area. Sub-app. He's external in role, internal in team (`zettel/zettels/z025`).
- **`research/`** — cross-cutting research that doesn't belong to any one sub-app. Each topic is its own folder.

## Cross-cutting tools (accumulate-as-we-go)

- **`things-we-grow.md`** — the master registry for accumulate-by-use artifacts. Add a row when you notice friction caused by a missing one.
- **`wispr-flow-corrector/dictionary.md`** — word-level corrections for Wispr Flow misheardings. UseGin manages it.
- **`translators/`** — cross-domain term maps. `physics-to-dev.md` is open-to-empty; per-language translators ditto until friction appears.

## Peer agent: Zisser

`zisser/` (repo root, peer to `usegin/`) is **Lihu's chief-of-staff agent** —
the orchestrator he tells everything to. Zisser is for Lihu's whole life;
UseGin is the dev agent for AskEffi. They are peers and call each other:

- Lihu → Zisser → UseGin when Lihu wants a dev change.
- UseGin → Zisser when UseGin needs Lihu's life-context or wants to surface
  something into the broader thread.

Spawnable as a sub-agent via `.claude/agents/zisser.md`. See `zisser/README.md`.

## Runtime surface

`tools/dx/` is the executable side of UseGin — the `dx` CLI you actually run. New surface this slice: `dx zettel` (see `usegin/zettel/SLICE-1.md`). Existing: `dx his`, the dx feature toggles. UseGin (the markdown workspace) and `tools/dx/` (the executable) together = the full DX app.

## Capabilities handbook

`.claude/skills/use-gin/SKILL.md` is the agent-facing first-stop for "can UseGin do X?" — session resume across envs, code-history, vibe telemetry, and so on. When a capability is missed and the answer turns out to exist in our tooling, the entry lands in that file the same turn (see memory: `feedback_first_place_we_looked.md`).

## Conventions

- **Two faces when suitable** (`zettel/zettels/z022`): anything in UseGin can have two faces — human-facing and UseGin-facing — wherever the artifact is consumed by both. Don't force two faces where one suffices.
- **Open-to-empty** (`zettel/zettels/z003`): an empty file at a real address is a valid artifact. Create the address before you have the content.
- **Accumulate-as-we-go**: nothing is built once and shipped. Use grows the artifact.
- **UseGin owns the "how"** (`zettel/zettels/z014`): folder location, naming, structure are UseGin's calls; semantics are Lihu's.
- **Pre-game manual** (`zettel/zettels/z015`): only systematize what we've done by hand at least once.
- **Decision shape** (`zettel/zettels/z020`): "We decided X because Y. Price is Z. Risk W. Alternatives rejected: …" — emitted by UseGin without being asked.

## Tracking

We do **not** Linear-everything for UseGin (`zettel/zettels/z024`). Linear is the spine for shipped product. UseGin's own work uses lighter, code-adjacent forms. The exact form is being researched — see `research/documentation-method/` (decision deferred per `zettel/zettels/z032` until ENG-5381's pgvector substrate dry-runs).
