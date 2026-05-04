# Charter — Phase 5: side-by-side writeup + recorded walkthrough (Wes)

Pour: `zisser/inbox/2026-05-04-non-sql-poc-data-items.md`
Plan: `zisser/plans/2026-05-04-non-sql-poc.md`
Predecessor: `zisser/dispatched/2026-05-04-non-sql-poc-phase4-repl-wes.md`
(closed; multi-turn REPL works; demo green on 7/7)

## Goal

Close the PoC arc with **decision-grade output Lihu can scan in <5
minutes** and call Adopt / Iterate / Drop on. Two artifacts:

1. **`experiments/poc-knowledge-store/VERDICT.md`** — single-page
   side-by-side: each Phase-0 friction point → what the PoC does
   instead, evidence (file/line citations), honest residual cost.
2. **`experiments/poc-knowledge-store/WALKTHROUGH.md`** — annotated
   transcript of a real REPL session against the live demo, marked up
   with "this turn beats friction #N because…" callouts.

No video. Lihu reads faster than he watches; markdown is the right
shape. Asciinema can come later if he wants the recorded form.

## Read-first

1. `experiments/poc-knowledge-store/0-friction.md` (the 10 friction
   points + 3 target scenarios — the bar)
2. `experiments/poc-knowledge-store/README.md` (the per-phase
   "what this proved" sections — already most of the raw material)
3. `experiments/poc-knowledge-store/1-storage/SYNTHESIS.md` (the
   storage decision rationale — needed for the runner-up section)
4. `experiments/poc-knowledge-store/app/demo.ts` (to know what the
   green demo actually proves)

## Build

### `VERDICT.md` shape (≤ 700 words, decision-grade)

```
# PoC verdict — markdown-on-disk + LanceDB for project knowledge bag

## TL;DR — what we'd do
[2 lines: Adopt / Iterate / Drop recommendation + the one strongest
reason. Be honest about uncertainty. The PoC has 1 project + 3
fixtures; the recommendation is for *the substrate shape*, not a
migration plan.]

## Side-by-side — current Effi vs the PoC

| Friction (from `0-friction.md`) | Current Effi | PoC behaviour | Evidence |
|---|---|---|---|
| #1 per-kind migration tax | 112/372 migrations | `mkdir <kind>/` + 1 ingestor file | `app/kinds/email_thread.ts` (71 LoC) added zero migrations |
| #2 hand-merged read | `get_data_summary` parallel CTEs | one `search()` returns mixed-kind | `app/index/search.ts:N` — single query path |
| #4 extracted_text retrofit | per-table `extracted_text` migrations | body IS the extracted text | every `.md` in `data/` |
| #5 dedup keys per kind | per-table UNIQUE + composite | each kind picks its own frontmatter ref | `email_thread.ts` `thread_id`; `fathom.ts` `meeting_id` |
| #6 RLS per kind | per-table policy | folder-scoped (PoC scope only) | OUT OF SCOPE — see "honest residual" |
| #7 org→workspace touches every kind | schema migration per table | rename a top-level dir | demonstrated as a `mv` in walkthrough |
| #8 DB+GFS dual store | replication pipeline | one store; index is derived | `app/index/rebuild.ts` rebuilds from disk |
| #9 bucket+table per kind | per-kind boilerplate | `.md` carries body inline | n/a — proven by absence |
| #10 team's own skip-schema instinct | slack-ingest-poc routed around | this PoC IS that routing-around | three precedents converge: `usegin/zettel/`, slack-ingest-poc, this |

## What the PoC did NOT prove (honest residual)

[3-5 bullets: RLS at scale, embedding cost at corpus scale, real
provider connections, multi-writer concurrency, search latency at
10⁵+ items, production migration cost. Be specific.]

## Runner-up notes (from SYNTHESIS.md)

[2 sentences each on JSONB-on-Postgres (the boring-correct control)
and Mongo (would have removed the schema friction at a service-cost).
This is where Lihu sees the alternatives if he wants to reconsider.]

## Reproduction

```
cd experiments/poc-knowledge-store && bun install && bun run app/demo.ts
# or, for the chat:
bun run app/repl.ts
```

Demo cost: zero (stub mode + mock embedder). Real-key cost is bounded
by `NEEDS.md`.

## Recommendation

[Adopt / Iterate / Drop. One paragraph, with a "yes-if" and "no-if"
clause so Lihu can match against current state.]
```

### `WALKTHROUGH.md` shape (≤ 800 words)

Run a real `bun run app/repl.ts` session. Capture the transcript
verbatim. After each turn, insert a `> ` callout block:

```
> **What this turn proves:** friction #N — <one-line evidence>.
> The current Effi path would have required <ceremony>; here it cost <nothing>.
```

Cover:
- Turn 1: a single-kind question (proves friction #2, #4 — body IS text, one read path)
- Turn 2: a cross-kind question (proves friction #2 sharper, #1 by counterexample — adding the email kind cost a file)
- Turn 3: a follow-up that needs context (proves the storage substrate is conversation-shape-neutral)
- Turn 4: a literal-string question (proves FTS path independent of embeddings — friction #8 by analogy: index is derived, swap embedder anytime)
- Turn 5 (mock): how a *new kind* would land — show `mkdir + add ingestor file + bun run`. Don't actually add a kind for the walkthrough; sketch it as "what this would look like" to keep scope contained.

End with a single "what Lihu sees" paragraph.

### Update the main `README.md`

- Add a one-line "see VERDICT.md and WALKTHROUGH.md" pointer at the
  top.
- The per-phase "what this proved" sections stay (they're the
  granular receipts).

## Constraints

- **No new code** unless a tiny script is needed to capture the REPL
  transcript cleanly (e.g., a 10-line `app/walkthrough-fixture.ts`
  that pipes scripted input through the REPL). If you need it, OK.
  Otherwise capture by running and pasting.
- Self-contained inside `experiments/poc-knowledge-store/`.
- Architectural invariant from prior phases still applies — no
  changes to `app/store/`, `app/index/`, `app/kinds/`.
- Commit + push after each artifact lands (one commit for VERDICT.md,
  one for WALKTHROUGH.md + README pointer).
- ≤ 1500 LoC total experiment budget — these are docs, no code budget
  pressure.
- If anything blocks: append to `NEEDS.md` and route around.

## Stop condition

- `VERDICT.md` ≤ 700 words, contains the table + recommendation + honest residual + reproduction.
- `WALKTHROUGH.md` ≤ 800 words, captures a real REPL session with per-turn friction-callouts.
- README has the pointer.
- All committed and pushed.
- Demo still green (regression check: `bun run app/demo.ts`).

## Out of scope (deliberately)

- Asciinema/video recording (Lihu reads faster).
- Actual production migration plan (the verdict frames whether
  to even start one).
- Real provider connections.
- Phase 6+ — there isn't one. This closes the PoC arc.

## Dispatched

- when: 2026-05-04
- to: 1× general-purpose (Wes shape)
- run: background

## Returned

(filled when agent returns)
