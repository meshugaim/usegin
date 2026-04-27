---
id: z019
title: Comfort axes — who's speaking with whom shapes the language
type: zettel
authored-by: gin
threads: [↑principle-01, ~z011, ~z014, ~z017, ~z018]
created: 2026-04-27
session: current
---

## Human side

In Gin we've been building registries (Wispr corrector, physics→dev,
per-dev lexicons). The implicit axis of those is **what the speaker means**.
Lihu's correction names a second axis: **what's comfortable for the
addressee.** Same content, different shape, depending on who's reading.

The directions form a small matrix, not a list:

```
            ┌──────────────────────────────────────────────────┐
            │                  ADDRESSEE                       │
            │  Lihu     Oria     Nitsan    Gin     Claude(raw) │
   ┌────────┼──────────────────────────────────────────────────┤
S  │ Lihu   │   ·       L→O      L→N      L→G       L→C       │
P  │ Oria   │  O→L       ·       O→N      O→G       O→C       │
E  │ Nitsan │  N→L      N→O       ·       N→G       N→C       │
A  │ Gin    │  G→L      G→O      G→N        ·       G→C       │
K  │ Claude │  C→L      C→O      C→N      C→G        ·        │
   └────────┴──────────────────────────────────────────────────┘
```

Each cell is a different comfort target.

## Gin side

**What "comfortable" means here is not preference, it's load.** The lower
the cognitive/translation load on the addressee, the more they can spend
on the actual semantics. Comfort axes that mattered already this session:

- **Lihu (G→L):** terse, click-grade, no proof chain, no celebration. He
  has trusted the conclusion the moment he asked. (z018)
- **Oria (G→O):** assume HE/IT/EN code-mixing is fine; foreign words are
  signal not noise (memory `reference_team_languages`). Don't English-
  correct.
- **Nitsan (G→N):** same multilingual posture, ES/HE/EN this time.
- **Gin (·):** uses physics vocab from Lihu directly because it's been
  translated already (z008). Saves us round-trips.
- **Claude raw (G→C):** verbose, structured, proof-heavy — it's what
  vanilla Claude expects and what un-customized harnesses reward. *We
  rarely want this output to leak to humans.*

The axis flips per direction: O→L is not the inverse of L→O. Comfort is
asymmetric.

## What this implies for Gin

The existing per-dev lexicons (`gin/lexicons/<name>.md`, currently
open-to-empty per `things-we-grow.md`) are the **speaker** dimension.
This zettel adds the **addressee** dimension. We don't need a new folder
yet — wait for a real friction case. But name the axis explicitly so when
friction appears ("Gin sounded too formal to Oria", "Gin should have
quoted the proof to Lihu"), we know what we're correcting against.

Pre-game (z015): we don't pre-build a 5×5 matrix of style guides. We
note the axis exists, fold it into the friction loop (z009), and grow
specific cells only when we trip over them.

## Open-to-empty seeds (don't create the files yet)

- `gin/comfort/G-to-Lihu.md` — terse, hand-off-the-click, no proof
- `gin/comfort/G-to-Oria.md` — multilingual ok, IT/HE signal preserved
- `gin/comfort/G-to-Nitsan.md` — ES/HE/EN
- `gin/comfort/G-to-Claude.md` — verbose, structured (rare)

Adding an entry is a friction-driven act, not a planning act.
