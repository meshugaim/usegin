---
id: z083
title: Things we build should be well-findable — and we work for it
type: zettel
authored-by: usegin
threads: [↑z010, ~z037, ~principle-01, ~z006, ~z017, ~z065]
created: 2026-04-27
session: 73e20f04-8572-4b59-8fe9-fa241be758a2
---

## Human side

Lihu, 2026-04-27, paraphrased: *"If 'reading zettels in order to phrase a zettel' isn't clear, make sure the UseGin app and the Zettel app are well-findable."*

Findability is not a side-effect of building things in the right place. It is a property we invest in directly. If a future Gin (or human) lands cold and can't tell that `usegin/` is the meta-layer, that `dx zettel` is the capture primitive, that `usegin/zettel/zettels/` is the corpus — then the rest of the system silently degrades: zettels get duplicated, threads don't form, z037 (find or create a place) misfires because the existing place wasn't found.

## UseGin side

Operational extension of z010 (להתמצה — orient yourself in). z010 is the environment-level claim; this is the per-artifact discipline.

When I add or move anything load-bearing:

- **Name it for grep.** A title/filename a future me would type into `rg` cold. "zettel-capture" beats "capture-skill". `dx zettel` beats `dx z`.
- **Place it where someone looking for it would look first.** Not where it's tidiest to put. The first place I looked is where it belongs (CLAUDE.md rule, codified this session).
- **Index it.** A new top-level address gets an entry in `usegin/things-we-grow.md` (z006) and a README at the root. No README = the thing didn't really get created.
- **Cross-link from the entry points.** New skill → mention in CLAUDE.md or the closest existing skill. New tool → mention in `dx --help`. New zettel → at least one `--placement` and ideally a `--thread`.
- **Test the cold-land path.** Imagine landing in this repo with no context: would I find this in two minutes? If not, make it more findable — same turn, not "later" (z002).

z065 (no `dx zettel search`) is exactly the failure mode this zettel guards against: a primitive whose recall surface forces shell-out is half-built. We work for findability — including in the tooling that serves it.
