---
id: z062
title: FRICTION: placement+thread to same target produces duplicate edge
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z022, ~z061]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

Calling `dx zettel add ... --placement z022 --thread z022` (which is the natural "this is downstream of z022 AND I want to cross-link it" gesture, on first read of the help text) produces two edges to the same target: `[↑z022, ~z022]`. (Verified: z044.)

The semantics are fuzzy. Is `↑z022` a strict superset of `~z022`? If so, the cross-edge is redundant and should be deduped. If they're independent kinds, the help text doesn't say so — and a typical user won't reason that way at the command line.

Proposed fix (one of):
1. Dedupe at write time: if `↑X` exists, drop any `~X`.
2. Reject at parse time: error with *"--placement <id> already implies a relationship; do not also pass --thread <same-id>."*

Either is fine; the current behavior (silent duplicate) is the worst.

Cross-cutting: this and z061 and z059 are all instances of the same root pattern — z062 (no input validation on the edge graph).
