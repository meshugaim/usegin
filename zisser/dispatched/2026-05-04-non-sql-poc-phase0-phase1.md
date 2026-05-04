# Charter — non-SQL PoC, Phase 0 (friction audit) + Phase 1 (storage R&D)

Pour: `zisser/inbox/2026-05-04-non-sql-poc-data-items.md`
Plan: `zisser/plans/2026-05-04-non-sql-poc.md`
Cadence: async. Agents stop only on drift / missing resource / missing
auth. Auth-asks → `experiments/poc-knowledge-store/NEEDS.md` (append,
never stall).

## Goal

Phase 0 anchors what "friction" we're solving — concrete and citable.
Phase 1 lays out the candidate storage shapes side-by-side so Phase 2
can pick. Both phases are R&D only — no production-code edits, no
`nextjs-app/`, no `python-services/`, no migrations.

## Phase 0 — friction audit (1 agent, general-purpose)

### Goal
Produce a concrete, citable list of friction-points where current
Effi's SQL/tabular model creates ceremony that maps poorly to "stuff
we want Effi to remember about a project."

### Read-first
1. `usegin/zettel/zettels/z028-zettel-app-foundational-decisions.md`
   (and any neighboring z02[5-9] / z03[0-9] zettels touching storage /
   schema / blocks / docs).
2. `usegin/oria-crazy-space/slack-ingest-poc/` — prior parallel-store
   PoC; harvest learnings.
3. Recent Supabase migrations under `supabase/migrations/` whose name
   touches projects / knowledge / data items / attachments.
4. The "data-items" surface in `nextjs-app/lib/` and
   `python-services/` (read-only).

### Optional probe
Try `effi --profile oria@askeffi.ai:prod ask "where do users hit
friction with what Effi remembers about a project"` — if profile auth
fails, append to NEEDS.md and continue without.

### Deliverable
`experiments/poc-knowledge-store/0-friction.md` with sections:

- **Hypothesis restated** (≤4 lines)
- **Concrete friction points** — numbered list. Each: 1-line claim, 1
  current-codebase or zettel citation, 1-line "why SQL caused this."
  Aim 6–10 items.
- **Heterogeneity examples** — 4–6 distinct "kinds of data item" Effi
  is being asked to remember (email thread, Fathom transcript, Drive
  doc, Slack channel digest, hand-typed note, decision record). For
  each: shape sketch (3–5 fields) and what it'd take to add a *new*
  kind under SQL today.
- **PoC target scenarios** — ≥3 specific user-facing scenarios the PoC
  must demonstrate frictionless on. Concrete ("ingest this
  Fathom-shaped transcript and answer 'what did we decide about X' in
  the chat") — not abstract.
- **Open ↑ for Lihu** — anything genuinely ambiguous, ≤3 items.

### Constraints
- Read-only on the codebase. No edits to product directories.
- ≤800 words. Distill, don't enumerate.
- If a probe needs auth → NEEDS.md, continue.

## Phase 1 — storage-options R&D (5 angles, parallel)

Each angle is **one agent**, one file. All five run in parallel.
**Synthesis** is Zisser's job once they return — agents do NOT
cross-read each other's drafts.

Each agent's deliverable shape (≤500 words):

```
# <Approach name> — <one-line shape>

## Heterogeneity-fit
How does it handle mixed shapes (email thread vs transcript vs note)?

## LLM-read-fit
How does an LLM read across the bag? (full-doc retrieval, embeddings,
filtering, what's the natural query path?)

## Zero-ceremony-add
What does adding a new *kind* of data item cost? (Schema? Code?
Migration? None?)

## Library candidates
Bun/TypeScript ecosystem first. Note Python alternatives if cheap.
Specific names + a 1-line install/run note.

## Ops profile
Where does it run (in-process / sidecar / managed cloud)?
Persistence shape. Cost shape.

## Friction it removes
Cite Phase-0 friction points by number where possible.

## Friction it introduces
The honest tradeoff column.

## Verdict (1–3 sentences)
Fit for "small Effi over project knowledge bag."
```

### Angles (one agent each)

| # | Angle | Champion candidates | File |
|---|---|---|---|
| A | Document store | MongoDB / CouchDB / Firestore — pick one champion + briefly compare | `1-storage/A-doc-store.md` |
| B | Markdown-files-on-disk + frontmatter | filesystem-as-DB; ripgrep + tantivy / lunr for query | `1-storage/B-markdown-fs.md` |
| C | Embedding-first store | Chroma / Qdrant / LanceDB / Weaviate — pick champion | `1-storage/C-embedding.md` |
| D | Structured blocks (Notion-API-like) | Yjs / Tinybase / Loro / Automerge — block-with-typed-children | `1-storage/D-structured-blocks.md` |
| E | Control — JSONB-on-Postgres | Supabase JSONB; single `data_items` table with one jsonb col + a few index keys | `1-storage/E-jsonb-control.md` |

### Constraints (all angles)
- No code yet — research + comparison docs only.
- Cite specific library versions if known; install commands; rough
  bundle/footprint.
- Don't read each other's drafts — independence is the point.
- If any probe / sandbox needs auth → NEEDS.md, continue.

## Stop condition

All six files (`0-friction.md` + 5 storage angles) land in the
experiment tree. Zisser writes
`1-storage/SYNTHESIS.md` cross-cutting the angles, picks the
storage shape for Phase 2, and only then surfaces back to Lihu —
unless something hits NEEDS.md or a drift signal fires earlier.

## Dispatched

- when: 2026-05-04
- to: 6× general-purpose, parallel, background
- expected back: same session (research-only, no implementation)

## Returned

All 6 agents returned same session, parallel.

### Phase 0 — friction audit (a6adca7e0eada4076)
- file: `experiments/poc-knowledge-store/0-friction.md` (798 words)
- 10 concrete friction points, 6 heterogeneity examples, 3 target
  scenarios. Smoking gun: `get_data_summary` hand-merges per-kind
  CTEs because no "all items in this project" relation exists.
- 112 of 372 Supabase migrations touch data-item plumbing.
- 2 ↑ for Lihu (tenancy scope; seed-corpus realism). NEEDS.md empty.

### Phase 1A — doc store (a027e235086566665)
- file: `1-storage/A-doc-store.md` — Mongo champion (Atlas hybrid).
  Honest cost: two stores, FK drift, Atlas lock-in for easy hybrid.

### Phase 1B — markdown-fs (a53263a736e937753)
- file: `1-storage/B-markdown-fs.md` — strong fit; `usegin/zettel/`
  precedent proves the shape. Pair with sidecar embedding index when
  semantic recall bites.

### Phase 1C — embedding (a62e24fc044247ba2)
- file: `1-storage/C-embedding.md` — LanceDB champion: embedded TS,
  hybrid (vector+BM25+filter) in one query, zero sidecar.

### Phase 1D — structured blocks (ac01c7e45dfba94de)
- file: `1-storage/D-structured-blocks.md` — BlockNote JSON; CRDT
  opt-in when concurrent-write actually lands.

### Phase 1E — JSONB control (ac9a6d492fdfa492b)
- file: `1-storage/E-jsonb-control.md` — boring-correct; wins on
  RLS-for-free, loses on LLM-read-fit (hand-built librarian).

### Synthesis + decision
- file: `1-storage/SYNTHESIS.md`
- **Phase 2 substrate: B + C hybrid** — markdown-on-disk as SoT,
  LanceDB as derived retrieval index. D contributes block-shape as a
  body convention (no CRDT). A and E are runners-up.
- Closed; Phase 2 walking skeleton next.
