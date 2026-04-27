---
id: z050
title: Slice-2 schema deviations from the v1 sketch — id text, kind text, edges plural
type: zettel
authored-by: usegin
threads: [~z034, ~z028]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
Designing slice 2 surfaced four named deviations from `usegin/zettel/RD/deep-graph-professor/schema-sketches/v1-postgres.sql`. Recording them so the migration's header comment doesn't have to re-derive the reasoning, and so a future reader doesn't read the deviations as drift.

1. **`id` is `text` (`z003`), not `uuid`.** The slice-1 storage layer, the 40 existing markdown filenames, and every `dx zettel show z3` invocation key on the `z###` form. Switching to uuids in the DB would force a parallel id-mapping table and break the CLI's short-id ergonomics. The `z###` is already a stable, human-meaningful pk.

2. **`kind` is free-form `text` (defaulting `'note'`), not the sketch's enum.** Existing zettel frontmatter has no `kind` field. Classifying 40 zettels by hand to seed the enum is out of scope for slice 2. The enum + backfill is its own follow-up; reserving the column shape now would lock us into the sketch's enum values before we know if they survive contact with the corpus.

3. **Table is `zettel_edges` (plural), not `zettel_edge`.** House style across `supabase/migrations/`.

4. **Edge `kind` values match slice-1 vocabulary (`placement`, `cross`), not the sketch's (`links_to`, `thread_continues`, `thread_branches`).** The slice-1 markdown parser already speaks placement/cross. Translating in both directions at the sync boundary would be silent technical debt; matching the existing word is cheaper.

None of these reverse a decision in z028 or the whiteboard — the substrate, the AGE-promotion-friendly shape, and the no-RLS stance all hold. They're surface adjustments where the markdown reality of slice 1 outvotes the greenfield sketch.
