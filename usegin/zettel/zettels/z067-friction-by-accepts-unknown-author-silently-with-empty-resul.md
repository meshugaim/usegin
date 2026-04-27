---
id: z067
title: FRICTION: --by accepts unknown author silently with empty result and exit 0
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z062]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

`dx zettel list --by zzznope` returns no rows and exits 0. Indistinguishable from "this author exists but has written nothing." The CLI should know the legal author set (the registry exists implicitly: `human`, `usegin`, `consultant`, plus legacy `gin` and `gin (doc-method-team)` discovered in real data) and reject unknowns OR at minimum print to stderr `note: no zettels by author "zzznope" (known authors: human, usegin, consultant, gin, ...)`.

Smaller note: legacy authors (`gin`, `gin (doc-method-team)`) work as `--by` filters but aren't in the help text. Worth either:
- documenting the actual author set as it exists,
- or migrating the legacy zettels' `authored-by` field to current names (z033 — rename gin → usegin), with `originally-authored-by:` preserving history.

Severity: low. Symptom of the same root pattern as z061/z063: silent acceptance of inputs that should be flagged.
