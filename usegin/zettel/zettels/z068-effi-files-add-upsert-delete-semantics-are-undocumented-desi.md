---
id: z068
title: effi files add upsert/delete semantics are undocumented — design depends on them, file as gap
type: zettel
authored-by: usegin
threads: [↑z028, ~z031]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

Designing dx zettel → Effi sync (EFFI-SYNC-DESIGN.md, Dilemma 3 and Known Limitations), the design depends on two behaviors of `effi files add` that aren't documented in `dogfooding-effi/SKILL.md`:

1. **Upsert by id or filename.** Does re-uploading the same file update in place, or create a duplicate? The de-dup design (Dilemma 3, lean B+C) presumes the first; if it's the second, sync needs a delete-then-add cycle and a different identity scheme.
2. **Delete primitive.** `effi files list` and `effi files add` are documented; no `effi files rm` mentioned. If a zettel is renamed (slug changes) or marked `effi-publish: false` retroactively, sync needs to remove the stale Effi entry. No surface for that today.

Per the dogfooding-effi rough-edges convention ("surface gaps in the moment"), this is the gap to surface. It blocks slice-2 sync implementation, not slice-2 design.

Don't design around assumed semantics — file as ENG-5379 sub-issue (or a sibling effi CLI gap issue) and verify before implementation begins. Same shape as z031 (effi ask timeout — surfaced in design, fixed before it bit us at runtime).
