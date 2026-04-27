# Zettelkasten — Effi Dev Team's Shared 2nd Brain

This is **not** a copy of Zettelkasten. It is a workspace where we figure out
what a shared 2nd brain for the team building Effi should look like, taking
the Zettelkasten *concept* (atomic, threaded, associative notes that mimic the
brain's own associative structure) as the starting point.

## Why

We experience a lot of friction. Knowledge, lessons, decisions, ideas, IDs,
"oh that's good", "oh that's bad" moments — they vanish into individual
sessions and individual heads. We want them captured, threaded, and
*associatively retrievable* — pull a wire here and find what's connected over
there.

## Two-sided design

**Producing.** As we work — humans and Claude — we should be able to drop a
*zettel* with very low friction. A zettel can be:

- an ID
- a lesson (good or bad)
- a thing to note
- something good we saw
- something bad we saw
- an idea, a frustration, a decision

Each zettel is **atomic** (one thought, standalone meaning) but **distilled
in light of its threaded neighbors** — its meaning sharpens by being placed
next to others.

**Consuming.** When we (or Claude) touch an area that has a *cluster* of
related zettels, the relevant zettels should *pop*. Pulling one wire reveals
the whole rope. Frustrations in DX → threaded back to every prior zettel that
contributed to the path that led there.

## Eventual goal

Effi gets an interface to manage *her own* 2nd brain, the same way.

## What lives here

- `principles/` — load-bearing principles for this work, written manually.
- `zettels/` — the atomic notes themselves. See `zettels/README.md` for
  threading conventions (placement vs cross-reference).
- `organizing-process.md` — the v0 manual loop UseGin runs to keep the
  graph tight. Forward-only; never delete; bump `version:` to distill
  (z039); clusters emerge, never imposed (z040).
- `gaps.md` — append-only log of things spotted during organizing that
  don't fit cleanly yet. Logging is the act; resolution is later.
- `RD/<manager>/whiteboard.md` — each R&D manager's working space. They are
  free to write anything else they want under their folder.

## Layout note

This folder lives at the repo root, alongside `experiments/`, intentionally
**aside from production code**. R&D and the eventual prototype both live
here.
