# Charter — Phase 3: integration-shape coverage (Wes)

Pour: `zisser/inbox/2026-05-04-non-sql-poc-data-items.md`
Plan: `zisser/plans/2026-05-04-non-sql-poc.md`
Synthesis: `experiments/poc-knowledge-store/1-storage/SYNTHESIS.md`
Predecessor: `zisser/dispatched/2026-05-04-non-sql-poc-phase2-skeleton-wes.md` (closed; demo green)

## Goal

Prove the "different models / multiple integrations" claim from
Lihu's pour. Add **two more kinds** to the same store + index — an
**email thread** and a **free-form note** — and extend the demo to
ask cross-kind questions that the SQL world today couldn't answer
without per-kind CTEs.

This operationalizes target scenarios #2 and #3 from `0-friction.md`:
- Adding a brand-new kind without touching any other kind.
- Cross-kind read: "what did Sarah say about pricing across emails,
  transcripts, and notes?"

## Read-first

1. `experiments/poc-knowledge-store/0-friction.md` — scenarios #2, #3
2. The just-shipped Phase 2 layout under `experiments/poc-knowledge-store/app/`
3. `experiments/poc-knowledge-store/app/kinds/fathom.ts` — the live
   precedent for how a kind ingestor looks; new kinds mirror its
   shape, no shared base class needed unless one earns its keep.

## Build

### Two new kinds

**Email thread** — `app/kinds/email_thread.ts`
- Input shape: `{ thread_id, subject, participants[], messages: [{ from, to, sent_at, body }] }`
- Output: one `.md` per thread with frontmatter
  `kind: email_thread`, `thread_id`, `subject`, `participants`,
  `first_sent`, `last_sent`, `message_count`. Body is the thread
  serialized as readable prose (`From: …  To: …  Sent: …\n\n<body>\n\n---\n…`).
- Fixture: `fixtures/email-pricing-thread.json` — a hand-crafted
  thread that **mentions the same pricing topic** as the Fathom
  transcript (so cross-kind retrieval has a real reason to fire).

**Free note** — `app/kinds/note.ts`
- Input shape: `{ author, created_at, title, body, tags[] }`
- Output: one `.md` per note. Frontmatter: `kind: note`, `author`,
  `created_at`, `title`, `tags`. Body is just the note text.
- Fixture: `fixtures/note-onboarding-thinking.md` — a free-text note
  that touches the **Drive-onboarding decision** so the cross-kind
  question can land. Author ≠ Lihu/Sarah on purpose, to test that
  retrieval doesn't anchor on speaker identity.

### Demo update — `app/demo.ts`

After ingest of all three fixtures (transcript + thread + note) and
index rebuild, ask **two new cross-kind questions** in addition to
the original three:

- `"What did we decide about pricing — across all sources?"` —
  expects **≥ 2 citations** with **distinct `kind` values** in
  `citations[]`. Demo fails if not.
- `"What's the latest thinking on Drive onboarding?"` — expects at
  least one citation from `kind: note` (the note is the freshest
  source) AND at least one from a different kind.

The literal-string FTS question stays in the suite.

### README update

Append a "Phase 3 — what this proved" section mapping back to
friction points:
- **#1** still holds: adding two kinds = two ingestor files + two
  fixtures. No schema, no migration. Show the diff size.
- **#2** sharpened: a *single* `search()` call returns mixed-kind
  hits in one shot — no per-kind CTE assembly.
- **#5** (identity/dedup): each kind picks its own external-ref
  field in frontmatter; no shared "external_id" column needed.

## Constraints

- Self-contained inside `experiments/poc-knowledge-store/`. Don't
  touch product directories.
- **No new dependencies** unless one is genuinely required. Use the
  existing `gray-matter`, `@lancedb/lancedb`, `ulid`, the existing
  embedder + chat-stub fallback.
- The store/index/chat layers MUST NOT need changes. If they do,
  that's a sign the kind ingestor is leaking abstraction — push it
  back into the kind file. (Heterogeneity in `kinds/`, uniformity in
  `store/`/`index/`/`chat/` is the architectural claim being
  defended.)
- Commit small + often. Push to main after each meaningful change.
- If `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` arrive in env mid-run,
  great — the existing fallback pattern picks them up, no charter
  change. If they don't, the existing stubs continue.
- Append to `NEEDS.md` and route around if a new auth/secret wall
  appears.

## Stop condition

`bun run app/demo.ts` exits 0 with all five questions green. The
two cross-kind questions return citations with distinct `kind`
values. README has a Phase 3 mapping-back section. Total
experiment LoC under 1500.

## Out of scope for Phase 3

- Phase 4: chat surface (REPL → web).
- Phase 5: side-by-side writeup + recorded walkthrough.
- Real provider connections (still synthetic — per Lihu's
  cadence-settled defaults).

## Dispatched

- when: 2026-05-04
- to: 1× general-purpose (Wes shape)
- run: background

## Returned

- when: 2026-05-04 (~4 min)
- agent: a3ccf73d08bb8420e

### Outcome
**Demo green, all 5 questions including both cross-kind.** Single
`search()` returns mixed-kind citations spanning all three kinds for
the cross-kind pricing question. 4 files added (2 ingestors + 2
fixtures, 213 LoC), 2 files modified (demo + README, +140/-26).
Total experiment LoC = 1081 (under 1500 cap).

### Architectural invariant — HELD
`git diff 735411272..HEAD -- app/store/ app/index/ app/chat/` is
empty. Heterogeneity stayed in `app/kinds/`. The "uniformity in
plumbing, heterogeneity in kinds" claim survived its first real
test.

### Commits (pushed to main)
- `113c2817b` kinds + fixtures
- `0948a50c3` demo (+ cross-kind questions)
- `cd9efbfc9` README mapping back to friction #1, #2, #5

### NEEDS rows
No new entries. Two existing open items (Anthropic + embedding key)
still apply — demo green in stub-mode + mock-embedder.

### Status: closed
