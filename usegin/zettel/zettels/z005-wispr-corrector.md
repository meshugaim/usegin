---
id: z005
title: Wispr Flow corrector — accumulates word-level mistakes, NOT a translator
type: zettel
authored-by: human
threads: [↑z006, ~z004, ~z007]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

We use Wispr Flow team-wide. It mishears words. The fix isn't a translator (Hebrew→English / language→language). It's a **corrector** — a per-team dictionary of the *specific words* Wispr keeps mangling, with the intended canonical form.

Whenever I (or anyone) catch a mistake, the word goes into the dictionary. Accumulate-as-we-go. Gin should *manage* the dictionary — when something looks weird in Wispr-dictated input, Gin reaches for the corrector first, before assuming the human meant what was literally typed.

## Gin side

Built at `usegin/wispr-flow-corrector/dictionary.md`. Seeded from this session's actually-observed corruptions:

- `settle` / `settles` → `zettel` / `zettels`
- `Cloud` → `Claude` / `Gin` (context-dependent — see z012)
- `GynLab` / `Gynn` / `Ginn` / `Eun` → `Gin`
- `Oriana` → `Oria`
- `Liu` → `Lihu`
- `_underscore_brackets_` → not a substitution — see z004 for the convention.

Distinct from translators (z007, z008). A corrector replaces wrong-word-with-right-word. A translator maps one semantic field to another.

I (Gin) own the corrector. When a dictated message contains a likely Wispr corruption I didn't catch, Lihu adds it to the dictionary — or tells me to, and I add it. Either path produces the same artifact.
