# WHITEBOARD — Slack autonomous run, 2026-04-28 night

**Front door:** `CLOSE.md` (the six decisions; D5 in flight, D6 = interactive).
**Cadence override:** Lihu went to sleep, said "progress as much as you can,
leave [ORIA] holes." Single-agent autonomous until D5.1 lands. Whiteboard is
the source of truth for what's in-flight, blocked, and queued.

This file is append-mostly. Tasks move between sections; notes never get
deleted, only struck-through.

---

## Lihu's punch list (when you wake up)

Total reading time: ~20 minutes. Total decision count: 9 charter questions
plus a few marketplace `[ORIA]` flags.

### Charters waiting on you (read in this order)

1. **`D5.1-charter-session-wt.md`** — 5 questions (~5 min). Q1-Q5 are the
   posture call on per-session worktrees. Once answered, an autonomous Gin
   builds it in a half-day; that unblocks parallel autonomous-vibe forever.
   *Lean:* Q1=(c) opt-in autonomous-only · Q2=(a) `.worktrees/<id>/`
   · Q3=(b) auto-rebase + manual gc · Q4=(a) gradual ramp · Q5=(a) build now.

2. **`c4-spec.md`** — 4 questions (~5 min). Q1-Q4 are about Slack message
   ingestion (the next big slice). *Lean:* Q1=(b) bounded backfill at install
   · Q2=(a) capture reactions in `raw` · Q3=(c) defer UI to C7 · Q4=(b) ship
   C4 after the demo.

### Marketplace `[ORIA]` items (3 unresolved)

In `usegin/research/slack-marketplace/security-questionnaire.md`:

- **§7 IR runbook** — ENG-4241 is Backlog. Either ship a 1-2 page runbook
  before submission, or pick the "informal escalation, runbook on roadmap"
  framing for the questionnaire.
- **§7 breach SLA** — confirm exact wording in the live customer DPA.
- **§2 Railway transport** — Railway internal-network encryption posture
  needs verification at the infra layer if a reviewer asks.
- **§5 D1 orphan-blob** — verify Slack data path isn't covered by the D1
  finding before submission.

(All renamed from `[LIHU UNKNOWN]` to `[ORIA]` for consistency this turn.)

### Marketplace patch SLA

In §10 of the same file: if a reviewer asks for a written patch-SLA, we don't
have one. Either commit a number ("critical patched within 7 days") or
declare informal-on-roadmap.

---

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

- [x] (next commit) — CLOSE.md § D5 updated: tripwire layer landed at
      `2d85a2828`, charter ready for the structural layer.
- [x] (next commit) — z109 captured: "a partial tikur fix is still an
      unfixed tikur — name the layers." Sharpens the self-tripwire rule.

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
