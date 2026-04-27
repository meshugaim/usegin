---
id: z038
title: Concurrent dx-zettel-add race observed in the wild — slice 1 known limitation #1 fired
type: zettel
authored-by: usegin
threads: [↑z034, ~z036, ~SLICE-1, ~z028]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

Slice 1's `usegin/zettel/SLICE-1.md` Known Limitation #1 was: *"two simultaneous `dx zettel add` calls on the same machine could race on `nextId()`. Acceptable for slice 1 (single-author, low rate)."*

It fired in the same turn it was written. Another UseGin instance wrote `z032-be-laconic.md` while this session was building slice 1 — both picked id `z032`. I had already committed `z032-coord-and-doc-decisions.md` earlier, so on disk we ended up with two zettels claiming `z032`.

Resolution applied:
- Renamed `z032-be-laconic.md` → `z036-be-laconic.md` (mine kept its number because committed first; convention: first-committed wins, second renumbers up).
- Frontmatter rewritten to UseGin's standard shape: `id` updated, `related` → `threads` with `~` prefix, added `type` / `authored-by` / `created` / `session`. `renamed-from: z032` preserves the original id (principle 02).

What this teaches:
1. The race is not rare even with one author per machine, because we use parallel sub-Gin instances.
2. Slice 1 workaround until slice 2: `dx zettel add` should `git pull --rebase` first, then re-run `nextId`. Cheap, captures peer work. Worth a small follow-up.
3. The `renamed-from` frontmatter key is a candidate convention — every renumber records its original id so the trajectory is greppable.
