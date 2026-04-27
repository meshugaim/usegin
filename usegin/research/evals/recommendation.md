# Evals R&D — Recommendation for Lihu

**Round:** closed 2026-04-27. Read `SYNTHESIS.md` first (~5 min), then this (~5 min). Drill into individual whiteboards only when a specific dilemma needs deeper context — pointers in SYNTHESIS.md.

The round confirms Oria's "v0 by tomorrow" claim is real: the substrate exists, the runner is the missing piece. Three calls below need you. Two are load-bearing (R1 — sequencing, R2 — auto-promote line). One is not yet load-bearing but shapes v1 (R3 — judge cost mix at scale).

After the three calls, the default sequence (R4) is what I'd ship if you green-light all three Leans without changes.

---

## R1 — Sequencing: Gin-skill-evals first, or Effi-product-evals first?

**Decision needed:** which corpus does v0 ship against tomorrow?

**Options:**
- **A — Gin-first.** v0 = `dx evals run` walking `.claude/skills/*/evals/evals.json` (5 existing cases). Live-replay via headless-claude + single Opus judge. ~6h of code on existing infra. Effi-product evals follow in v1 (mid-week) once `dx evals harvest` is built.
- **B — Effi-first.** v0 = trace-replay over hand-picked Effi `is_error=TRUE` sessions (5 cold-start cases pulled by hand from the conversations bucket). Structural battery from `effi-session-audit/references/pitfalls.md` as scorer; judge optional at v0. ~1.5–2 days of code (trace-replay harness + structural extractor).
- **C — Both in parallel.** Two surfaces shipped together at v0; doubles scope; "by tomorrow" slips to "by Wednesday."

**Lean: A (Gin-first), with B as a fast-follow no later than Friday 2026-05-01.**

**Why:**
- The meeting trigger was Effi-product context — Guy's "we'll never prioritize the whole evals story" was about Effi prompts, not Gin skills. **B is the answer to the question Oria heard.**
- But the only surface with the data already shaped is Gin. Effi sessions exist in the `conversations` bucket but the case envelope (`{source_uri, turn_range, expected_shape}`) doesn't exist yet, and the per-case `expected_shape` annotation is the labor that pushes past tomorrow.
- A ships the *substrate* (CLI, runner, judge call, result-surface, two-faces dx+skill, sub-app folder) by tomorrow against the Gin corpus. B reuses every piece of A's substrate against Effi cases two days later.
- The risk of doing only A: you wake up to "evals shipped, but for Gin not Effi" — meeting promise unmet. Mitigation: tomorrow's standup naming is "evals substrate shipped, Effi corpus lands by Friday."
- The risk of doing only B: "by tomorrow" slips, the substrate ships against the harder corpus first, and Gin-skill-evals (the cheap, high-frequency one) gets crowded out.
- The risk of C: the by-tomorrow promise breaks; the substrate gets two opinions baked in (Gin's live-replay + Effi's trace-replay) before either has earned its design.

**Price (of A):** Effi protection waits ~3 days. Lihu has to communicate "substrate first, your corpus by Friday" to the team.

**Risk if A is wrong:** if the meeting promise was specifically "Effi evals by tomorrow," A is insufficient and the right call is B with the Effi-only-trace-replay shape (no live runs, no judge — just structural assertions over the existing JSONLs). That ships by tomorrow too, just less general.

**For you to weigh:** what did Oria *actually* mean? If "I can build the eval framework by tomorrow," A is right. If "I can run evals against Effi by tomorrow," B is right. The answer encodes which audience the v0 first serves: the team's internal-tooling itch (A) or the team's customer-quality concern (B).

---

## R2 — Auto-promotion bright line for `dx evals iterate`

**Decision needed:** when `dx evals iterate` (the autonomous "let Claude run on it" loop) finds a winner, can it write to the real artifact, or only to the sandbox?

**Options:**
- **A — Sandbox-only, always.** Iterate writes only to `usegin/evals/sandbox/`; produces `winner.diff` + `decision.md`; human applies via `git apply` after reading. **Zero auto-promotion.**
- **B — Auto-promote within `usegin/**` and `.claude/skills/**`; sandbox-only outside.** Production prompts (Effi `python-services/agent_api/prompts/`) stay sandbox-only. Gin's own skills/prompts auto-promote with a 24h watch window — a follow-up `dx evals run` against the now-promoted artifact must clear the same threshold or `dx evals revert <auto-promote-id>` is auto-suggested in `#usegin-evals`.
- **C — Auto-promote anywhere.** Trust the three walls (PreToolUse hook + reviewer + cheat-detector). Human reviews via Slack notification + Linear comment, async.

**Lean: B.**

**Why:**
- Matches the existing repo invariant. `usegin/CLAUDE.md` already enforces "production code is what stays out of `usegin/`" — the bright line *exists*; B re-uses it for the new "what can Claude auto-modify" question.
- Effi prompts are customer-impacting; iterate them in sandbox, hand Lihu the diff before deploy. Gin's own skills are not customer-impacting; auto-promotion is the unlock that makes Oria's "let Claude run on it overnight" actually mean what it sounds like — wake up to a better `morning-brief` SKILL.md, not to a folder of diffs to apply by hand.
- A is the safe default but kills the differentiator. The whole "let Claude iterate" pitch evaporates if every winning mutation needs a human keypress.
- C is correct in the limit (when the three walls have *earned* trust through field hours), but premature today. We don't have enough iterate-runs under our belt to know how often the cheat-detector misses Goodharts.

**Price:** B requires a glob-list classifier in `dx evals iterate` config (`auto_promote_globs: ["usegin/**", ".claude/skills/**", ".claude/agents/**"]`) and the 24h watch-window scheduler. Both are small additions to v0 if we want them; both are easily deferred to v1 if v0 needs to stay tight.

**Risk:** the cheat-detector misses a Goodhart and an auto-promoted skill silently degrades real-world skill recall. Mitigations: (a) the 24h watch window catches it within a day; (b) every auto-promotion produces a Slack notification with diff + score — if Lihu sees the notification and the diff looks suspicious, manual revert is one command.

**For you to weigh:** how comfortable are you waking up to a `usegin/zettel/zettels/` skill that's been mutated by Haiku overnight? B says yes within `usegin/`, no outside; A says no everywhere; C says yes everywhere. The answer encodes how much trust the three walls have *earned* (vs. been *granted*).

---

## R3 — Judge cost mix at scale (not load-bearing for v0; shapes v1)

**Decision needed:** what's the budget posture for judge calls at v1 (when case-count > 50)?

**Options:**
- **A — Judge-heavy.** Every case gets N=3 rotated-rubric judges + structural battery. Best signal on faithfulness/intent. ~$60–180/run for 200 cases × 3 runs. Sustainable for nightly cron, painful for every-prompt-iteration sweep.
- **B — Structural-heavy.** Judge only on the 20% of cases that fire a structural flag or diverge from baseline. ~10× cheaper. Blind to confabulation that uses real citations and passes structure.
- **C — Tiered.** Full structural + cheap (single Haiku) judge always; expensive (N=3 Opus rotated-rubric) judge only on flagged cases. Middle road; rotates 5% of "passing" cases through the expensive judge as Goodhart sanity.

**Lean: C, but only after v0 ships and we have actual cost data.**

**Why:**
- v0 (per A's pick) uses a single Opus judge call per case — the cost question doesn't bite at 5 cases. We won't know the right v1 mix without 2 weeks of v0 data.
- C is the right shape *in principle* (structural is too cheap not to run on everything; expensive judge is too expensive to run on everything; the cases worth deep-judging are the ones structure already noticed as anomalous). But "in principle" without data is over-engineering.
- B's blindness to "passes structural, low-judge-priority" is a real Goodhart vector — the agent could learn to satisfy structure while degrading on judge dimensions.

**Price:** C's two-tier result aggregation + flag-triage rules + 5% rotation sanity-sample. ~1 day of design + code.

**Risk:** none at v0 (defer the decision). At v1, picking the wrong mix wastes ~$40–150/run.

**For you to weigh:** is $60/day for the daily Effi suite acceptable? If yes, A is fine for v1 too. If you want every-PR evals on Effi, C is mandatory. Cadence drives the answer more than coverage does.

---

## R4 — Default sequence (if you green-light all three Leans without changes)

If R1=A, R2=B, R3=C-when-data-justifies, the round produces this build sequence:

| When | Slice | Output | Hours |
|---|---|---|---|
| **Tomorrow** | **v0 substrate (Gin-first).** `dx evals run` glob-walks `.claude/skills/*/evals/evals.json`; subprocess `claude -p` per case; single Opus judge against `assertions[]`; commits per-case JSONL + run summary .md to `usegin/evals/gin/runs/<ts>-<sha>-<slug>/`. New `usegin/evals/` sub-app skeleton (README, CLAUDE.md, charter.md, `framework/` + `effi/` + `gin/` sub-trees per F's tree). New `evals` skill that triggers `dx evals run`. | shippable | ~6 |
| **Wed–Thu** | **Harvester + Effi-corpus seed.** `dx evals harvest --source effi --is-error --since 14d` stages candidates from the `conversations` bucket; one-by-one promote 5 hand-labeled cases into `usegin/evals/effi/cases/`. Trace-replay scorer (mode 1 — assert structural properties on existing JSONLs); first 8 of the 20 structural assertions from `effi-session-audit/pitfalls.md` (S01–S08, the cheapest ones); judge optional at this slice. | Effi v0 | ~14 |
| **Fri** | **Auto-iterate Director.** `dx evals iterate <artifact>` ports `tdd-execute`'s 3-wall isolation onto a `cell` of N stateless Haiku workers; PreToolUse hook locks `cases/` + `scorers/`; auto-promote within `usegin/**` + `.claude/skills/**` (R2 lean B); sandbox-only for `python-services/agent_api/prompts/`. Slack post on regression to `#usegin-evals`. | "let Claude run on it" | ~10 |
| **Following week** | **Calibration + scaling.** Weekly 10-case Lihu spot-check (`dx evals calibrate`); first Cohen's κ measurement (gate: ≥0.6); start tracking case-count toward 50 (Anthropic's floor); if cost crosses ~$30/day, stand up R3 tier-C scorer mix. | sustainable | ~12 |

Total to "evals are real" = ~42h spread over 7 days. v0 demo-able tomorrow.

**Friction follow-ups** (named in SYNTHESIS, not blocking R4 but worth filing as Linear sub-issues or zettels in the same week): (1) `dx evals harvest` is a missing primitive; (2) Linear bug issues lack `claude_session_id` cross-links; (3) `dx his` ratings are write-only as eval-source today; (4) `cell` defaults to git worktrees — `iterate` wants `cp -r` sandbox; (5) no inter-rater capture infra for the Lihu calibration loop; (6) Yohai (comptroller) audits sessions while evals score them — name the distinction.

---

## What this round did NOT decide

- **Whether `dx evals` ships as TS (matches `dx slack`, `dx zettel`, etc.) or Python (matches `python-services/`).** D leaned TS; E sketched it under `tools/dx/src/evals/`. Default for v0: TS, mirrors the rest of `tools/dx/src/`.
- **Where the eval-runner Claude lives.** TS subprocess for v0 (mirrors `multi-turn-headless-claude` shape); lift to Python sidecar only if eval volumes demand it.
- **Whether `#usegin-evals` is a real Slack channel.** Defaults to `#usegin` with `[evals]` subject prefix if not.
- **Charter authoring for `iterate` mutation hints.** Starts as Lihu authoring 1–2 hint files; `consult` proposes new ones based on what worked.
- **Cross-env resume for `dx evals iterate --resume <id>`.** The use-gin invariant requires it; the obvious answer is git-tracked `iterate-runs/<id>/state.json` with sandboxes thrown away. Defer to first cross-env need.

These are pointers Lihu can pick up later without re-running the round.
