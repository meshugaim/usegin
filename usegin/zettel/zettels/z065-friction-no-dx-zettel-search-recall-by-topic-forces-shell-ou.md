---
id: z065
title: FRICTION: no dx zettel search — recall-by-topic forces shell-out to rg or grep on list
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z040, ~z028]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty — though SLICE-1.md acknowledges this gap explicitly: *"no `dx zettel search` yet. `rg` against `usegin/zettel/zettels/` is the workaround."*)

## UseGin side

Flow 2 simulated: *"I remember we decided not to use Linear for Gin docs but I forget the zettel."* The fastest paths I found:

1. `dx zettel list | grep -i linear` — works, found z024 in one shot. But it only matches the *title*; bodies are invisible.
2. `rg -l -i linear usegin/zettel/zettels/` — searches bodies. Found 10 hits including z024.

Neither is `dx zettel search`. The friction is real but spec'd-as-deferred (slice 2 with pgvector), so this zettel is here to:
1. Confirm the gap is felt within minutes of real use, not just theoretically.
2. Suggest a slice-1.5 stopgap that costs ~10 lines: `dx zettel search <substring>` that does the equivalent of `rg -l -i <q> usegin/zettel/zettels/ | dx zettel show ...`. No embeddings, no Supabase — literal substring match on title+body, returns ranked-by-title-hit-first list.

The case for the stopgap: every recall flow this session ended in shell-out. That's 41 zettels in. At 200 zettels with no search, the brain is unbrowseable.

Severity: high in pain, low in surprise (spec acknowledged it). The slice-1.5 stopgap is cheap.
