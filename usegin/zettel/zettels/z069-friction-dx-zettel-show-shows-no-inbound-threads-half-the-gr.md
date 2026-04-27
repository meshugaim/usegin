---
id: z069
title: FRICTION: dx zettel show shows no inbound threads — half the graph is invisible
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z040]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty — SLICE-1 known-limitations: *"`dx zettel show` doesn't yet display in-bound threads (only outgoing). Slice 2 with the graph backend gets this for free."*)

## UseGin side

Felt this in Flow 3. After adding z044 with `--placement z022`, I have no way to ask z022 "who points at you?" without `rg "z022" usegin/zettel/zettels/`. The zettel I'm reading shows me where it points but not what points at it.

This matters more than slice-1 acknowledged: the *cluster* (z040) IS the inbound set. A zettel without its inbound view is half-visible. For a 2nd brain whose retrieval is "land on a node, walk neighbors," missing one direction halves the retrieval surface.

Slice-1.5 stopgap (cheap, no graph backend needed): `dx zettel show <id> --inbound` does a single `grep -l "z044" zettels/*.md` pass and lists ids. ~5 lines. Saves the rg shell-out for the most common follow-up question after `show`.

Severity: medium. Spec'd-as-deferred, so noting rather than blocking — but the cheap stopgap should land before slice 2 to keep the brain useful in the interim.
