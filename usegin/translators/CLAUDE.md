# Translators sub-app — agent instructions

You are working in `usegin/translators/` — cross-domain term maps. Read
`README.md` for the design. This file is the operating manual.

## What this sub-app is

Reference tables that help Gin render a word from one domain
(physics/Italian/Spanish/…) in another (dev). One file per source domain.

## Standalone-repo posture

This sub-app is independent. Don't import from other usegin sub-apps.
Cross-reference by name when needed.

## Working rules

- **Append rows when you catch a translation.** Don't wait for permission.
- **Two-faced when suitable** (z022) — but most rows can be one-faced.
- **Open-to-empty for new domains** (z003): create `<lang>-to-dev.md` with one
  line and add the row to `usegin/things-we-grow.md`.
- **Translator ≠ corrector ≠ lexicon** (z007). Be sure which you're writing.
- **Don't English-correct foreign words** (memory: `reference_team_languages`).
  Foreign words are signal — translate, don't normalize.

## Where things go

| Thing | Place |
|---|---|
| Active maps | `<lang>-to-dev.md` |
| Open-to-empty maps | also `<lang>-to-dev.md` (one line is fine) |
| Cross-app registry | `usegin/things-we-grow.md` |
