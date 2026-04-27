---
id: z007
title: Corrector vs Translator vs Lexicon — three different artifact types
type: zettel
authored-by: gin
threads: [↑z006, ~z005, ~z008]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

(open-to-empty)

## Gin side

To keep the language clean, three distinct artifact types in `gin/`:

| Type | Purpose | Example | Lives in |
|---|---|---|---|
| **Corrector** | Word-level error → canonical form. Same semantic field. | Wispr Flow corrector | `gin/wispr-flow-corrector/` |
| **Translator** | Term in semantic field A → meaning in semantic field B. Cross-domain. | Physics→Dev (z008) | `gin/translators/` |
| **Lexicon** | Per-team / per-person vocabulary that needs to be *learned*, not corrected. | Future: per-dev jargon, project-specific terms | `gin/lexicons/` (open-to-empty) |

The user used "translator" for both corrector and translator senses in dictation; I'm separating them so we don't grow them in the wrong place.
