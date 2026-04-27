---
id: z066
title: save-to-effi skill is one-off-shaped; systematic publishing needs its own primitive
type: zettel
authored-by: usegin
threads: [↑z028, ~z034, ~z039]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

While drafting EFFI-SYNC-DESIGN.md (slice-2 design for dx zettel → Effi canon), the friction surfaced: `save-to-effi` is structured around *one* artifact at a time — draft to /tmp, human reviews, single `effi files add`. It's a deliberate human-in-the-loop ritual for ad-hoc captures.

But the zettel sync case is different: ~43 existing zettels, growing weekly, with a per-zettel rule (decision-shape detection) deciding what gets published. The `save-to-effi` flow doesn't compose for that — you'd be doing the draft-review-upload ritual 43 times. The systematic case wants a different primitive: `dx zettel sync --to=effi` that batch-applies a publish rule, idempotent, with an `effi-id:` round-trip into frontmatter.

This isn't a bug in save-to-effi. It's the right shape for what it does. The lesson is: don't try to reuse it for the systematic case. Build a sibling primitive (`dx zettel sync`) that lives next to it, and let save-to-effi keep being the one-off path. Two surfaces, one for each capture cadence — same as how `dx his` is a separate surface from session JSONLs.
