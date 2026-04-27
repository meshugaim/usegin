# Organizing Gaps

Things spotted during organizing passes that don't fit cleanly. Append-only log. Don't fix in this file — log here, fix in zettels/process when ripe.

Format: `## YYYY-MM-DD — short title` then a paragraph. Cite zettel ids. No status field, no priority — when something here gets resolved, write the resolution as its own dated entry below the original (forward-only; original stays).

---

## 2026-04-27 — Duplicate `id: z032` in front-matter

Two files claim id z032: `z032-be-laconic.md` (front-matter `id: z032`, also exists as `z036-be-laconic.md` with same `id: z032` — likely a leftover from the gin→usegin rename) and `z032-coord-and-doc-decisions.md`. The CLI's id-allocator (which gave us z037 here) reads the highest filename id, but front-matter ids are not unique. Effect today: minor — humans see two zettels labeled z032 in the body. Effect later: any retrieval that joins by `id` will collide.

Not fixed in this pass because the resolution touches multiple files and the right shape (renumber? supersede one?) isn't obvious without reading both fully. Logging here so the next pass can pick it up.

## 2026-04-27 — Front-matter format is not yet uniform

`z032-be-laconic.md` uses `date:` and `related:` at the top level; the convention in `zettels/README.md` is `created:` + `threads:` (with `↑`/`~` prefixes). This is rename-residue from before the convention firmed up. A distillation pass over the older zettels (z001–z020-ish) is the natural moment to harmonize. Not urgent.

## 2026-04-27 — `version:` field not yet present anywhere

z039 introduces version-bumps as the unit of distillation, but no existing zettel has a `version:` field. Convention-wise, absent = `version: 1`. The first real distillation is the moment to start writing the field — no need to backfill.

## 2026-04-27 — `dx zettel add` raced when two writers fired together

z038 logs the slice-1 known-limitation #1 firing in the wild. Not a process gap per se, but worth threading from here so future organizing passes that touch zettel ids see the prior incident. Resolution lives in slice 2 of `dx zettel`.
