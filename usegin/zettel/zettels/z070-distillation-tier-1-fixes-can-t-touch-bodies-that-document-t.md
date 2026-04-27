---
id: z070
title: Distillation Tier-1 fixes can't touch bodies that document the form being fixed
type: zettel
authored-by: usegin
threads: [↑z039, ~z015, ~z038]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
During distillation pass 001 I hit a clean class of false-Tier-1 finding: a zettel whose front-matter is non-canonical (e.g. `threads: [↑22]`, no z-prefix or zero-pad) AND whose body explicitly says "testing the short-id form". Mechanically the front-matter is a typo. Semantically it is the test fixture. Fixing it = vandalizing the test.

The distillation loop's tier split (mechanical vs semantic) implicitly assumes the body and front-matter are independent. They aren't, when the zettel exists to *test* the front-matter. We need either: (a) a `kind: test-fixture` field that excludes a zettel from corpus-shape lints; (b) a separate `zettels/_test-fixtures/` location `dx zettel add --test` writes to; (c) accept that `dx zettel add` should never have written test artifacts to the production corpus in the first place (root cause).

Lean: (c) at the tool layer + (a) for the residue we already have. Captured here so a future distiller doesn't re-hit the same wall and skip the friction-naming step (z009 — friction is information).
