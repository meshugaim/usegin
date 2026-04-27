# Research sub-app — agent instructions

You are working in `usegin/research/`. Read `README.md` for what this is.
This file is the operating manual.

## What this sub-app is

Cross-cutting investigations — too big for a zettel, not yet a sub-app of
their own. One folder per topic.

## Standalone-repo posture

This sub-app is independent. Each topic folder is also semi-independent — it
can have its own README and conventions. Don't import from other usegin
sub-apps inside a topic folder; cross-reference by name.

## Working rules

- **Append-mostly.** Don't delete a topic folder when it concludes; write the
  conclusion and leave the trail.
- **Open-to-empty** (z003) — start the folder with one line, accumulate.
- **Spawn freely** (z023, z027). A research topic can spawn sub-Gins; each one
  needs a clear charter — vague charter, vague work.
- **Don't curate by "obvious relevance"** (memory:
  `feedback_cascade_scope_exploration`). Enumerate the question's edges first.
- **Lift conclusions out** — when a topic concludes, lift the recommendation
  into either a zettel, a new sub-app, or a Linear comment. Leave a closing
  note and an outbound link in the topic folder.

## Where things go

| Thing | Place |
|---|---|
| New topic | `<topic>/README.md` (one line is fine) |
| Working notes | `<topic>/<freeform>` |
| Manager whiteboards (when spawning sub-Gins) | `<topic>/RD/<manager>/whiteboard.md` |
| Concluded recommendation | `<topic>/CONCLUSION.md` plus outbound link |
