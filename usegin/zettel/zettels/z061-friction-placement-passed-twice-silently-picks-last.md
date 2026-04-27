---
id: z061
title: FRICTION: --placement passed twice silently picks last
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z060]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

`dx zettel add ... --placement z022 --placement z003` exits 0 and persists only `↑z003` (commander's default for non-array opts is last-wins). No warning. (Verified: z045 has `[↑z003]`.)

Slice 1's spec says: *"Enforces ≤1 placement per zettel."* That invariant IS upheld in storage (you can't get two `↑` edges out), but the CLI silently swallows the user's intent rather than flagging it. A user who actually meant "this belongs in two places" will not realize their first placement vanished.

Proposed fix: declare `--placement` as `<id>` (single) and detect commander's silent overwrite by counting raw argv occurrences, then error with: *"--placement may only be specified once. Use --thread for additional cross-references."*

Severity: low-medium. Symptom of a broader pattern (z061 — silent acceptance of inputs that should be rejected).
