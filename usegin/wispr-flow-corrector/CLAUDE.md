# Wispr Flow Corrector sub-app — agent instructions

You are working in `usegin/wispr-flow-corrector/`. Read `README.md` for the
design. This file is the operating manual.

## What this sub-app is

A dictionary Gin reaches for when something looks weird in Wispr-dictated
input. First reach — before guessing semantically.

## Standalone-repo posture

This sub-app is independent. Don't import from other usegin sub-apps.

## Working rules

- **First reach** when input looks weird: scan `dictionary.md` before
  inferring.
- **Add when caught.** When you catch a mishearing repeating, add the row
  same-turn. No "I'll do it later" (z002). No PR — just commit.
- **Newest at the top** of each section.
- **Disambiguate context-dependent rules.** When `cell` could mean two things
  (zettel vs Zisser), the row's notes column says which context picks which.
- **Don't add speculative rules.** A row needs at least one observed
  mishearing.
- **Keep "syntax conventions" separate** — `_underscore_brackets_` and
  mid-sentence drift are not word substitutions; they are signals to interpret
  semantically (z004, z016).

## Where things go

| Thing | Place |
|---|---|
| Domain word substitutions | `dictionary.md` → `Domain words` |
| People-name substitutions | `dictionary.md` → `People` |
| Signals (not substitutions) | `dictionary.md` → `Syntax conventions` |
| Mid-sentence drift convention | `dictionary.md` → `Mid-sentence drift` |
