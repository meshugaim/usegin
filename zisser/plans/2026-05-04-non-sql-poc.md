# Plan — non-SQL PoC for project "data items" (small Effi, big breath)

> **Status (2026-05-04 evening):** Phase 0 + Phase 1 closed. Storage
> decision = **markdown-on-disk + LanceDB hybrid** — see
> `experiments/poc-knowledge-store/1-storage/SYNTHESIS.md`. Phase 2
> walking skeleton dispatching next.


> Lihu, 2026-05-04: *"prove that the SQL concept... gives us a lot of
> friction with all the data items... do a small PoC of a small EFI
> with small projects, small data, a different model, no SQL... you
> should choose what you think is more suitable to the messy world,
> trying to enter some place, some storage, and to have an LLM reading
> from it... you have two weeks."*

Pour: `zisser/inbox/2026-05-04-non-sql-poc-data-items.md`

## Status: open-to-empty

This plan is a **scaffold awaiting Lihu's answer to two ↑'s** before
R&D dispatch. See "Open ↑ before dispatch" below. Defaults are noted so
the work can proceed even without an answer.

---

## 1. The hypothesis to be tested

**Friction claim**: shoehorning heterogeneous "stuff Effi should know
about a project" into SQL tables introduces ceremony that scales badly
with kind-of-data. Symptoms:

- Each new kind of data item ⇒ migration + types + RLS + service +
  serializer.
- Heterogeneous shapes (an email thread, a Fathom transcript, a Drive
  doc, a Slack channel digest, a hand-typed note) don't share columns.
- LLMs prefer to read documents/blobs over joining tables.
- Soft-deletes, FKs, reconnect-row-revival, and the "SoT vs. cache"
  anxiety multiply.

**Frictionless target**: a single store where each "data item" is a
self-contained doc with metadata, an LLM can read across the bag with
no schema knowledge, and adding a new kind is zero-ceremony.

The PoC's job: **operationalize the alternative on a small Effi clone
with a few real-shaped integrations and demonstrate the friction
removed on concrete examples sourced from current Effi pain.**

---

## 2. Shape of the deliverable

- **Runnable demo**: standalone `experiments/poc-knowledge-store/`
  (per `feedback_experiment_isolation`). Small chat that answers
  project questions over a knowledge bag of mixed-shape data items.
- **Side-by-side note**: 1-page writeup mapping concrete current-Effi
  friction points to "what this PoC does instead."
- **Decision-grade output**: enough that Lihu/Oria/Nitsan can call
  Adopt / Iterate / Drop on the storage approach.

NOT in scope: production code edits, migrations, customer data,
re-platforming the real Effi, deployments anywhere.

---

## 3. Phases (defaulted; will dispatch once cadence is settled)

| # | Phase | Deliverable | Where |
|---|---|---|---|
| 0 | Friction inventory | Concrete list of SQL-shaped friction points pulled from real Effi sessions + the in-flight Zettel R&D track (z028 wrestled with this for the sub-app) | `experiments/poc-knowledge-store/0-friction.md` |
| 1 | Storage-options R&D (parallel angles) | Comparative writeup: doc store (Mongo/Couch/Firestore), markdown-files-on-disk, embedding+blob, structured-block (Notion-like), JSONB-on-Postgres as control | `experiments/poc-knowledge-store/1-storage.md` |
| 2 | Storage decision + walking skeleton | One picked store + smallest-possible "ingest one item, ask one question" loop | `experiments/poc-knowledge-store/app/` |
| 3 | Integration-shape coverage | 2–3 representative integrations: email thread, Fathom-style transcript, free-form note (and Drive doc if cheap) — synthetic data with real *shapes* by default | `experiments/poc-knowledge-store/integrations/` |
| 4 | Small Effi chat | Tiny chat surface that reads across the bag for a chosen project; deliberate friction-equivalent scenarios to showcase the gap | `experiments/poc-knowledge-store/chat/` |
| 5 | Side-by-side writeup + demo | 1-pager + recorded walkthrough; Adopt/Iterate/Drop call presented with reasoning | `experiments/poc-knowledge-store/README.md` |

Each phase fits in 1–3 days. Two-week budget covers the lot with
slack for iteration.

---

## 4. Tooling picks (defaulted)

- **Models**: Sonnet 4.6 for the small-Effi chat; Haiku 4.5 for any
  ingest-time synthesis; no Opus loops in the PoC.
- **Substrate language**: Bun + TypeScript for the chat surface (matches
  monorepo defaults), Python for any ingest-side experiments.
- **Sub-agents**: parallel Explore/Plan for Phase 0 + 1 (rnd skill
  shape); Wes for skeleton work in Phase 2 onwards; Ron for review at
  each phase boundary.

---

## 5. Cadence + needs (settled 2026-05-04)

Lihu, 2026-05-04: *"I don't care that much about checkpoints. Whenever
you feel we are drifting, or you lack resources, or you need my input,
stop and ask. Your agents can always work on thinking, R&D, even
experiments... gather [needs] aside and let the team work
asynchronously... I can imagine a world where you say the experiment
is ready, just give me auth here, auth there."*

**Cadence**: async by default. No scheduled checkpoints. Stop only on
drift / blocked-on-Lihu / blocked-on-secrets.

**Needs queue**: a single living list at
`experiments/poc-knowledge-store/NEEDS.md` (created Phase 0). Any
agent that hits an auth/secret/connection wall **appends a row instead
of stalling** and routes around. Zisser surfaces the list to Lihu on
inflection or when it grows past trivial.

**Defaulted (A → cadence above; B + C below):**

- **B — integration realism**: synthetic data with real shapes.
  Real wires only when a specific friction can't be shown without
  them; auth requests batch into NEEDS.md.
- **C — friction anchor**: brief Effi-session audit (≤ ½ day,
  `effi-session-audit` skill) → build against real pain.**
---

## 6. Tmunat matzav (situation picture, ahead of any hatmaz)

- **What is**: AskEffi is mid-stream on a Zettel R&D track for a
  team-2nd-brain (z028, ENG-5379) and an in-flight e2e-external-services
  plan that already inventories the integration surface. The new PoC
  sits *adjacent* to both — it is **not** the Zettel sub-app, and it is
  **not** the e2e suite, but it borrows their context.
- **Why it matters now**: Lihu's hypothesis-test framing ("prove SQL
  gives friction") suggests a real moment of doubt about the storage
  shape — the PoC is decision-quality input, not exploration for its
  own sake.
- **Risk to flag**: the team has prior art on this question (Notion-style
  blocks, doc stores, JSONB-on-Postgres) that the PoC should
  *consume*, not re-derive. Phase 1 must read z028 + any prior
  decisions before opening fresh angles, or we waste a week.

No hatmaz called. The cadence question is the only one that meaningfully
shapes my next 2 weeks; the others I can default safely.
