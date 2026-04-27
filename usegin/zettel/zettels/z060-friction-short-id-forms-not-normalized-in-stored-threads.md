---
id: z060
title: FRICTION: short-id forms not normalized in stored threads
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z022]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

`dx zettel show` accepts `3`, `z3`, `z003` interchangeably — great. But `dx zettel add --placement 22` and `--placement z22` persist the raw user input as `↑22` and `↑z22` in frontmatter, instead of canonical `↑z022`. (Verified: z046 stores `[↑22]`, z047 stores `[↑z22]`.)

Why it matters:
- The threading graph is now polysemic: `z022`, `z22`, and `22` all mean the same node, but tools can't tell without normalizing every read.
- `dx zettel show` round-trip is fine for the canonical form, but any consumer of the JSON `threads[].to` gets the raw user typing.
- The principle is: short forms in input, canonical forms in storage. We already do this for the *file id* (the file is named `z046-...md`, not `22-...md`); the threads should follow.

Proposed fix: at edge construction time (in both `add` and `link`), call the same `parseZettelId(input) -> "zXXX"` normalizer that `show` already uses, then store. Non-zettel labels (ENG-5379, D1, principle-01) pass through untouched as today.

Severity: medium. Doesn't lose data; introduces silent inconsistency that compounds.
