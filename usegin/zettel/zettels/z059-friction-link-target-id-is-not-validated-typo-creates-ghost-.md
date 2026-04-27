---
id: z059
title: FRICTION: link target id is not validated — typo creates ghost edge
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z058]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

`dx zettel link z003 999` returned "Linked z003 ~ 999" with exit 0 and persisted `~999` into z003's threads frontmatter. There is no zettel `z999`. The reverse — `dx zettel link 999 z003` — is rejected cleanly because the *source* file must exist to be edited; but the target is treated as an opaque label with no existence check.

Why it matters: a typo (`z029` vs `z209`, `z038` vs `z308`) silently creates a dangling pointer in a real zettel. We use threads as the retrieval graph (z040 — clusters emerge from threading); broken edges weaken every downstream feature (auto-pop, distillation, list-by-cluster).

Subtlety: the existing convention permits non-zettel targets (`~ENG-5379`, `~D1`, `~principle-01`, `~zettel-custom-future`) — so the validator can't reject anything that doesn't match `z\d{3}`. Proposed rule:
- if target matches `z\d{1,3}` (any zettel-shaped id), require the file to exist.
- otherwise (non-zettel label) accept as-is.

Severity: high. Same operation that strips blank lines (z058) also lets you write garbage into the graph.
