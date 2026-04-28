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
- [!] D5.1 — build `dx session-wt` (per-session worktree). **Blocked on
      Lihu posture call** (CLOSE.md § D5: how Oria's interactive work
      coexists with agent worktrees). I can write the build-charter as
      `[ORIA]`-hole spec → next task.
- [ ] D5.1-spec — author build-charter for `dx session-wt` with the posture
      questions surfaced; no code, just the spec Lihu reads cold.

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

- [ ] read `recommendation.md` and `SYNTHESIS.md` for the existing C4
      architecture decisions (already converged in the round).
- [ ] read existing `data_items` schema + ingestion pipeline (what
      Drive/Linear ingestion does today) to map Slack onto the same shape.
- [ ] author spec at `usegin/research/slack-integration/c4-spec.md` —
      acceptance criteria + open questions as `[ORIA]` holes.
- [ ] slicing-specs decomposition once spec is approved (post-Lihu).
- [ ] tdd-impl-plan for slice 1 (post-Lihu).

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
