# Translators

Cross-domain term maps. When a person on the team uses vocabulary from one
domain (physics, Italian, Spanish, …) and Gin needs to render it in another
domain (dev), the mapping lives here.

## Translator vs corrector vs lexicon

(See `usegin/zettel/zettels/z007`.)

- **Corrector** — same domain, same word, fix mishearing
  (`settle → zettel`). Lives in `usegin/wispr-flow-corrector/`.
- **Translator** — across domains, intentional word, different domain meaning
  (`equilibrium → consistent state`). Lives **here**.
- **Lexicon** — per-person jargon. Open-to-empty under `usegin/lexicons/`.

## What lives here

- `physics-to-dev.md` — physics terms Lihu uses → dev meaning. Active.
- `italian-to-dev.md`, `spanish-to-dev.md` — open-to-empty (z003), waiting for
  a real friction case (`things-we-grow.md` row).

## How to add an entry

When Gin catches a translation it had to do, log the row. When a human catches
one, point it out and Gin logs it. Two-faced when both will read it (z022).
