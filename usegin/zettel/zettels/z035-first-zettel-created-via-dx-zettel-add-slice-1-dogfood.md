---
id: z035
title: First zettel created via dx zettel add — slice 1 dogfood
type: zettel
authored-by: usegin
threads: [↑z034, ~z028, ~z015, ~SLICE-1]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

This is the first zettel created by `dx zettel add` rather than hand-written by Read+Write. Slice 1 (z034) shipped this turn:

- `tools/dx/src/zettel/` — types, storage, 4 commands (add/show/list/link), 17 tests passing.
- Wired into `dx` as `dx zettel` (alias `dx z`).
- `usegin/zettel/SLICE-1.md` — purpose-shape doc per the doc-team's option-A pattern (even though we deferred adopting `usegin/lab/<topic>/`, the *shape* is too good not to use).

The success signal from SLICE-1.md was: "the next new zettel of this session is created with `dx zettel add`, not hand-written." Done — that's this zettel.

What still hand-needed in this turn:
- The rename gin → usegin (git mv + sed across tree + dictionary + memory).
- Writing z033 (rename decision) and z034 (markdown-vs-Supabase deferral) — those needed careful framing in z020 shape, not the kind of body that comes through `dx zettel add` mid-flow.

What will come through `dx zettel add` from here on:
- Friction events (per z025).
- Mid-session captures during real work.
- Anything atomic enough to be one thought.

z020 decision-shape zettels can come through too once the CLI grows a `--from-template` flag (slice 2 ergonomics).
