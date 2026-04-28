# WHITEBOARD — Slack autonomous run, 2026-04-28 night

**Front door:** `CLOSE.md` (the six decisions; D5 in flight, D6 = interactive).
**Cadence override:** Lihu went to sleep, said "progress as much as you can,
leave [ORIA] holes." Single-agent autonomous until D5.1 lands. Whiteboard is
the source of truth for what's in-flight, blocked, and queued.

This file is append-mostly. Tasks move between sections; notes never get
deleted, only struck-through.

---

## Status legend

- `[ ]` queued
- `[~]` in flight (this turn)
- `[x]` done (with commit SHA)
- `[!]` blocked — needs Lihu / external (named below)
- `[?]` open question for next pace check

---

## Live tasks

### Track A — Tikur lekach + tripwire (D5 immediate fix)

- [x] `2d85a2828` — wire `check-staging-drift.sh` into `.husky/pre-commit`,
      add `snapshot-staged.sh` helper, document multi-Gin-safe commit recipe
      in `use-gin` SKILL.md.
- [x] `46f36da5d` — D5.1 build-charter (`D5.1-charter-session-wt.md`)
      with 5 `[ORIA]` posture questions. Reads cold; once answered,
      build is ~half-day single-session.
- [!] D5.1-build — blocked until Lihu answers Q1-Q5 in the charter.

### Track B — Marketplace prep (ENG-5417)

- [x] `8a326eb2d` — security-questionnaire §3 (Events receiver shipped
      under ENG-5409) and §10 (Phase-3 dependency scanning landed). 2 of
      6 `[LIHU UNKNOWN]` resolved.
- [!] §7 IR runbook (ENG-4241 Backlog) — needs Lihu drafting OR an
      explicit "informal" stance for the questionnaire.
- [!] §7 breach SLA — exact DPA wording, only Lihu can confirm.
- [!] §2 Railway in-transit encryption posture — needs verification at
      infra layer (Railway dashboard or staff confirmation).
- [!] §5 D1 orphan-blob gap re Slack data — needs reading the D1 finding
      against the Slack-data path; non-trivial without security context.
- [ ] sweep `submission-checklist.md` and `review-blockers.md` for the
      remaining `[LIHU UNKNOWN]` / `[PROCESS]` / `[DATE]` placeholders;
      flip to `[ORIA]` shape and consolidate into the appendix.

### Track C — C4 spec (Events ingestion → message data items)

Per CLOSE.md "the next slice is C4": Events route already receives messages
(ENG-5409 shipped); the missing layer is *persisting them as data items so
Effi can answer questions about Slack messages*.

- [x] (next commit) — `c4-spec.md`: acceptance criteria A1-A9, slice
      decomposition C4.1-C4.5, four `[ORIA]` posture questions
      (backfill story, reactions in `raw`, failure visibility,
      ship-before-or-after-demo).
- [!] slicing-specs decomposition — blocked on Q1-Q4 of c4-spec.
- [!] tdd-impl-plan for C4.1 — blocked on slicing.

### Track D — Housekeeping

- [ ] update CLOSE.md § D5 to reflect that the immediate tripwire landed
      (was "system-fix-deferred"; now the loose layer is live, structural
      fix still pending).
- [ ] zettel: capture the lesson that "the prior tikur identified the
      tripwire as 'lands this turn' and the tripwire-wiring step was the
      one missing — a tikur whose system change was *partly* shipped is
      still partly unshipped." Threads ↑z097, the 2026-04-28 tikur record,
      and the new self-tripwire rule in the tikur skill.

---

## Done log (commit chain this run)

| SHA | What |
|---|---|
| `2d85a2828` | Hook wiring + snapshot helper + use-gin doc |
| `8a326eb2d` | Marketplace questionnaire §3 + §10 |

---

## Notes for the next pace check

- D5.1-spec next; that's the highest-leverage `[ORIA]` deliverable left
  (one read by Lihu unblocks parallel autonomous-vibe forever).
- After D5.1-spec, decide whether to start C4 spec (no env-var dependency)
  or housekeeping (close-out + zettel).
- All commits are landing clean on origin/main; tripwire has not fired
  (single-agent run, snapshot mechanism is currently silent).
