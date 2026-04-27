# Routing — where does this kind of input go?

When Lihu pours, you triage and route. This is the decision matrix.

If the input is ambiguous, capture verbatim into `inbox/<date>-<slug>.md`
first, then route — don't lose it while you decide.

## Decision matrix

| Lihu's pour looks like | Default route | Tool |
|---|---|---|
| "I want to remember that …" / atomic insight | New zettel | `zettleit "<thought>"` |
| "Decision: we'll do X because Y" | New zettel (z020 shape) | `zettleit` then edit to z020 shape |
| "Idea for the product / feature" | A zettel + (if shipping-bound) Linear issue | `zettleit` + `plan create` |
| "Bug in production" | Linear bug (label: `bug`); spawn Gin with `fix-bug` skill | `plan create … --label bug`; Agent → Gin |
| "Implement X" / "fix Y" / "refactor Z" | Charter Gin in `dispatched/<topic>.md`; spawn | Agent → Gin (or general-purpose) |
| "Research X" | Charter sub-agent in `dispatched/<topic>.md`; spawn | Agent → Explore or `rnd` skill |
| "Look into our usage / behavior of …" | Spawn consultant | charter under `usegin/consultant/` |
| "Spec for X" | Reach for `spec` skill | Skill `spec` |
| "Slice this spec" | Reach for `slicing-specs` skill | Skill `slicing-specs` |
| "I'm frustrated with X" | Log it, file vibe | `log/`, `dx his note --as=claude` |
| "Remind me to follow up with <person> about Y" | Person note + `notes/people/<name>.md` | edit |
| "What did we decide about X?" | Search past sessions / zettels / Effi | `session search`, `effi ask`, `rg` |
| "What's in flight right now?" | Read `dispatched/` + `plans/` | read |
| "Wrap this session" | `/end` or `dx his rate --as=claude` | run |
| "I have a thought I can't place" | `inbox/<date>-<slug>.md`, then triage | edit |
| "Schedule X to happen at Y" | `schedule` skill or `loop` skill | Skill |
| "Write me a plan for X" | New `plans/<topic>.md` | edit |

## When two routes both fit

Pick the one that makes the artifact most *findable* later. Zettels are
high-signal but small; Linear is durable but heavier; `plans/` is local and
fast. Cross-link generously when something genuinely belongs in two places.

## When no route fits

z037 from usegin: make a comfortable place. Same turn. Add it to this table
in the same edit. Open-to-empty is fine — the address counts.
