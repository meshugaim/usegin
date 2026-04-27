# Sam — evidence-driven prioritizer

> Priming: Evidence-driven — weight Confidence by `From:` convergence count from brainstorm.

## Method

Convergence weighting applied as a Confidence delta on top of a base 1-5 score (where base is "textbook primitive" judgment):

- **5/5 convergent** (i01, i06, i24): +2 to Confidence
- **4/5 convergent** (i02, i07, i20, i35): +1
- **3/5 convergent** (i11, i16, i19): +0.5
- **2/5 convergent** (i08, i09, i12, i17, i26, i27, i29, i30, i44): unchanged
- **single-source**: -1 (raw "one head, one idea" — independent agreement is the test)

Confidence is capped at 5. The other four criteria (Impact / Effort / Strategic / Reversibility) are scored straight against the brainstorm text. **Total = sum of 5.** Convergence shows up as confidence-pull, not as a hidden override of the rest. When it overrides anyway (Strategic/Effort big enough), I name it in Notes.

Conflict pairs (i49 ⊕ i51, i21 ⊕ i22, i48 vs i01-05) ranked strictly. i46 skipped (merged). i42 surfaced as meta-position below table.

## Ranking

| Rank | Idea | Title | Imp | Eff | Conf | Strat | Rev | Total | Rationale |
|---|---|---|---|---|---|---|---|---|---|
| 1 | i06 | Autosync never resets | 5 | 5 | 5 | 5 | 5 | 25 | 5/5 convergence (+2 → capped at 5). Single-line deletion closes the entire 4-commit-loss class observed this session. Reflog evidence is direct. Composes under everything else. The most-impactful single-line change in the pool. |
| 2 | i01 | Pre-push gates the diff, not the tree | 5 | 5 | 5 | 5 | 5 | 25 | 5/5 convergence (+2 → cap). z095's exact root cause; doc-only push blocked this session. Path-filter is straightforward. Anchor of cluster A. |
| 3 | i20 | `dx ship` wrapper as sanctioned write path | 4 | 5 | 5 | 5 | 5 | 24 | 4/5 convergence (+1 → cap). Load-bearing seam — without it, cluster A/B/F/H fixes scatter. 30-line wrapper, additive. Lifts every other idea in the top 10. |
| 4 | i17 | PostToolUse-tracked authored-set | 5 | 5 | 4 | 5 | 5 | 24 | 2/5 raw, no boost. But it's the *noun* every Mode-1 fix needs (i16 verb, i23 intent assembly, i18 trailer, i40 attribution, i45 v0). Hooks already settled infra. Convergence undersells it because ideators framed it as i16's prereq, not its own win. **Override: ranked higher than 2/5 would imply.** |
| 5 | i35 | `dx recover` menu | 5 | 5 | 5 | 4 | 5 | 24 | 4/5 convergence (+1 → cap). All four lost commits this session were in reflog already — bottleneck was investigation, not infrastructure. Read-mostly, ends in cherry-pick. Ship v0 reflog-only. |
| 6 | i07 | `gin/orphan/<sha>` side-branch on push fail | 5 | 5 | 5 | 5 | 4 | 24 | 4/5 convergence (+1 → cap). Durable remote survival beats local "leave it alone" (containers rebuild). One extra `git push` line. Composes with i06, i20. Reversibility 4 because new server-side ref namespace is mildly sticky. |
| 7 | i05 | Skip TS/test for docs-only pushes | 5 | 5 | 4 | 4 | 5 | 23 | Single-source -1, base 5 → 4. But this session's marketplace-docs and zettel pushes were docs-only — i05 is the cheapest gate fix for the most-common case. 10 lines. **Override: ranked higher than single-source would imply** because impact on observed pain is direct. |
| 8 | i24 | Storm-mode as first-class state | 4 | 5 | 5 | 5 | 4 | 23 | 5/5 convergence (+2 → cap). Policy hub. State itself is cheap (config key + reader). Reversibility 4 — once subsystems read mode, removing it requires de-wiring. Earns spine slot but Impact 4 (not 5) because it's plumbing — value materializes through i25/i26/i27/i39. |
| 9 | i19 | `Agent-Session: <sid>` trailer on every commit | 4 | 5 | 4 | 5 | 5 | 23 | 3/5 convergence (+0.5 → 4 rounded). Cheapest defense-in-depth; survives Mode-1 + Mode-2. Trailer-only v0 (reversible); defer author-name. Unblocks i32, i29, i30. |
| 10 | i16 | Explicit-path adds; ban `git add -A` | 5 | 5 | 4 | 5 | 4 | 23 | 3/5 convergence (+0.5 → 4 rounded). Verb to i17's noun. One-line change kills Mode-1 at the git-command layer. Reversibility 4 because audit + lint rule sticks. |
| 11 | i38 | Loud telemetry before destructive op | 4 | 5 | 4 | 5 | 5 | 23 | Single-source -1, base 5 → 4. Absorbs i10. Surface complement to i06 — protects against future regression of i06. **Override up: ranked above many higher-convergence ideas** because (a) cheap, (b) regression-detector for i06, (c) directly addresses z086 "invisible failure is worse." |
| 12 | i02 | Pre-push in clean ephemeral worktree | 4 | 4 | 5 | 4 | 5 | 22 | 4/5 convergence (+1 → cap). Strict superset of i01's correctness. Effort 4 (perf-prereq for shared `node_modules`). v1 to i01's v0 — ship i01 first, evolve here when path-filter leaks on cross-file types. |
| 13 | i26 | `dx wait-for-clean-tree` | 4 | 5 | 4 | 5 | 4 | 22 | 2/5 unchanged. ~10 lines. Cheapest "defer push during storm" primitive. Named explicitly in z095. Auto-invocation needs i20+i24 already in flight. |
| 14 | i39 | R/A/G storm gauge in status line | 4 | 5 | 3 | 5 | 5 | 22 | Single-source -1, base 4 → 3. Wires storm-mode into the surface every agent already sees. Telemetry-only blast radius. Strong Strategic Fit (same data as i24/i25/i41). |
| 15 | i31 | Five-rule etiquette doc | 4 | 5 | 3 | 5 | 5 | 22 | Single-source -1, base 4 → 3. Convention-as-code (z086). Useful alone; the doc *is* the spec for i29/i32/i17 enforcement. Docs-only blast radius. |
| 16 | i25 | `dx storm-status` one-line readout | 4 | 5 | 3 | 5 | 5 | 22 | Single-source -1, base 4 → 3. Cheap "what's the weather" lookup. Wires into status-line and i24 mode-derivation. |
| 17 | i18 | `Autosync-stranger-files:` trailer | 4 | 5 | 3 | 4 | 5 | 21 | Single-source -1. Failsafe assuming Mode-1 still happens; even with i16+i17, FS anomalies will surprise. Audit trail in `git log --grep`. |
| 18 | i32 | PreToolUse hook blocks cross-sid resets | 4 | 5 | 3 | 5 | 4 | 21 | Single-source -1. Behavioral guard against confused-agent manual `git reset`. Different vector from autosync (i06). Hard prereq i19. |
| 19 | i36 | `dx commit-eats` SQLite log | 4 | 4 | 3 | 5 | 5 | 21 | Single-source -1. Lossy events → durable telemetry. Counter is regression-detector for i06. SQLite cost = 4. |
| 20 | i37 | Hash-chain stash naming | 3 | 5 | 3 | 5 | 5 | 21 | Single-source -1. This session climbed to 27 stashes — opaque. Idempotent rename. Coexists with old-style. |
| 21 | i27 | Side-branch by default at storm-level ≥ 2 | 4 | 5 | 3 | 5 | 4 | 21 | 2/5 unchanged. In a storm, `main` is read-mostly. Pairs i07 (reactive) with i27 (proactive). Prereq i20+i24. |
| 22 | i08 | Tombstone-and-revive | 4 | 4 | 3 | 4 | 5 | 20 | 2/5 unchanged. Soft-delete defense-in-depth atop i06. Bundle with i35+i36 (refiner-02 recommendation). |
| 23 | i10 | Last-words log | 4 | 5 | 2 | 4 | 5 | 20 | Single-source -1, base 3 → 2. Mostly absorbed by i38. Strongest as complement; weakens once i06 lands (nothing to record). Still ship for belt-and-suspenders. |
| 24 | i43 | Cron-driven storm-metrics digest | 3 | 5 | 3 | 4 | 5 | 20 | Single-source -1. Direct clone of working `dx his digest`. Patterns surface across sessions. Prereq i36+i38. |
| 25 | i12 | Per-session `GIT_INDEX_FILE` | 4 | 5 | 3 | 4 | 4 | 20 | 2/5 unchanged. Subsumed by i11; useful as ship-today v0 with zero FS reshuffle. Reversibility 4 (env var sticks in tooling). |
| 26 | i41 | Push-readiness 0-100 score | 3 | 5 | 2 | 5 | 5 | 20 | Single-source -1, base 3 → 2. Numerical input to i33/i20. Useful but redundant with i39 unless we want a number-vs-color split. Prereq i24. |
| 27 | i11 | Per-agent worktree at session start | 5 | 4 | 3 | 5 | 3 | 20 | 3/5 convergence (+0.5 → 3 rounded). Git's native answer; solves Mode-1 + z095 in one move. Effort 4 (worktree shim + cleanup-on-end). Reversibility 3 (FS layout becomes load-bearing). High Impact pulls it up despite middling cost. |
| 28 | i23 | Push by declared intent | 4 | 4 | 3 | 5 | 4 | 20 | Single-source -1. Cheap retrofit on i17 + intent-labels. Removes "diff = working tree" ontology cheaply, without i44/i45. Prereq i17. |
| 29 | i09 | CAS push loop with `--force-with-lease` | 4 | 4 | 3 | 4 | 3 | 18 | 2/5 unchanged. CAS is textbook safe-write. **Doctrinally gated** by CLAUDE.md "NEVER force-push" — needs explicit carve-out before this can ship. Reversibility 3 (changes central push semantic). |
| 30 | i33 | 30s cancellation window | 3 | 4 | 2 | 4 | 5 | 18 | Single-source -1. Tension with z086 friction-loop. Right only at storm-level ≥ 2 (chain with i24). |
| 31 | i40 | `dx tree-tail` with attribution | 3 | 4 | 2 | 5 | 5 | 19 | Single-source -1. Telemetry-only. Watching the storm beats guessing. Prereq i17 for attribution. |
| 32 | i29 | `dx claim <prefix>` lockfile | 3 | 5 | 3 | 4 | 4 | 19 | 2/5 unchanged. Smallest sharded-storm primitive. Pairs with i31. Prereq i19. |
| 33 | i30 | Pre-touch pub/sub narration | 3 | 5 | 3 | 4 | 4 | 19 | 2/5 unchanged. Coordinates *before* commit. Companion to i40. Prereq i19. |
| 34 | i34 | Asymmetry framing (humans push, Gins propose) | 3 | 5 | 3 | 5 | 4 | 20 | Single-source -1, base 4 → 3. Principle, not idea. Justifies i20/i21/i33 architecturally. Recommend hoist as cluster-G preamble. |
| 35 | i04 | Whole-tree lint, filter errors to diff | 3 | 5 | 3 | 3 | 5 | 19 | Single-source -1. "Least surgery" answer. Edge case (tsgo crash on stranger file = no `file:line` to filter) is real — i01 v1 needed anyway. Subsumed once i01/i02 land. |
| 36 | i03 | `git stash -u` 5-line wrapper | 3 | 5 | 2 | 3 | 5 | 18 | Single-source -1, base 3 → 2. Ship-today form. Concern: stashing during active storm could itself collide. Behind a toggle. Subsumed by i02. |
| 37 | i28 | Cap concurrent agents at 1 | 3 | 5 | 2 | 2 | 5 | 17 | Single-source -1. Premise conflict with i11/i13/i14. Worth keeping as the Q "do we want parallelism?" — but Strategic Fit 2: brainstorm topic explicitly assumes multi-agent storms. Lean: keep as gate-not-default. |
| 38 | i21 | `gin-commitd` daemon (single-writer) | 3 | 3 | 3 | 4 | 4 | 17 | 2/5 unchanged. Backend variant of i20. Try i20+i01+i07 first; escalate if races persist. Conflicts with i22 — i21 wins on simpler model. |
| 39 | i15 | Scratch-tree workspaces | 3 | 3 | 2 | 3 | 3 | 14 | Single-source -1. Substitute (weaker) for i11 — reinvents worktrees with raw FS copies. Prefer i11. |
| 40 | i22 | Outbox: agents commit local, worker drains | 3 | 3 | 2 | 3 | 2 | 13 | Single-source -1. Mental-model shift; conflicts with i21 (pick one — i21 wins). Decoupling is real but cost > benefit at our scale. |
| 41 | i14 | Read-only checkout + propose-via-PR | 3 | 2 | 2 | 3 | 2 | 12 | Single-source -1. Serializes the storm into a line — but the queue *is* the bottleneck. Broker overhead. Subsumed by i11 + i20. |
| 42 | i13 | Per-agent microVM | 4 | 1 | 2 | 3 | 1 | 11 | Single-source -1. Maximal isolation; conflicts with topic.md scope. Escalation tier — pick only if i11+i12 leak. |
| 43 | i48 | Replace pre-push with post-push CI | 3 | 3 | 2 | 2 | 3 | 13 | Single-source -1. Conflicts with i01-05 — frames them as wrong-layer. Picks the *layer*; needs main-CI fast enough that revert windows are tolerable. Today CI is 3-5 min — too slow. Park behind i01. |
| 44 | i45 | Append-only event log; tree is projection | 4 | 1 | 2 | 4 | 1 | 12 | Single-source -1. i17 is v0 of this; walking i17 → i45 is plausible. Storage growth concern. Long-horizon. |
| 45 | i47 | Use `jj` as agent's git surface | 3 | 1 | 2 | 3 | 1 | 10 | Single-source -1. **Doctrinally borderline** ("no replacing git" — jj uses git refs). Retraining cost large. Hold pending human ruling. |
| 46 | i51 | Kill `main` in agent layer — topic-graph | 3 | 1 | 2 | 3 | 1 | 10 | Single-source -1. Conflicts with i49. Branch-per-topic is clean; merge automation, CI cost, deploy story all open. Long-horizon. |
| 47 | i49 | `main-human` / `main-gin` two histories | 3 | 1 | 2 | 2 | 1 | 9 | Single-source -1. Conflicts with i51 (i51 wins on cleaner model — no reconcile job). History bifurcation is sticky. |
| 48 | i44 | CRDT-backed virtual filesystem | 4 | 1 | 1 | 2 | 1 | 9 | 2/5 unchanged. Vision, not try-this-Tuesday. North star justifying i11/i12/i17. Research-track only. |
| 49 | i50 | Git as cache; intent log canonical | 4 | 1 | 1 | 3 | 1 | 10 | Single-source -1. Deepest reframing; highest upside if it lands. Even unbuilt, the framing changes how we think about i06-i10. Research-track. |
| 50 | i42 | Telemetry-first; defer cluster B | 2 | 5 | 2 | 1 | 5 | 15 | **See meta-position below.** Single-source -1. Sequencing posture, not idea. Strategic Fit 1 because it gates ALL of cluster B on cluster I — and the 4-commit loss this session is *direct* evidence; we don't need a week of telemetry to know `git reset HEAD~1` ate work. Reject the gating; accept the ethos (ship i38/i39/i43 in parallel with i06, not before it). |

## Meta-position on i42

**Sam rejects i42's gating clause; accepts its ethos.**

i42 says: ship cluster I (telemetry) for one week before touching cluster B (autosync fix). The rationale is z086 process-over-outcome — let data shape the fix.

The data already exists. This session's reflog is direct evidence: 4 commits eaten by `git reset HEAD~1` on push-rejection. Mode-1 captured 7 stranger files. Stash count 27. We don't have *theories* about which collisions happen most — we have one transcript, one reflog, and 5/5 ideator convergence on i06 as the load-bearing fix. Telemetry would refine *which secondary* fixes (orphan vs tombstone vs CAS) come next; it would not change i06.

Gating cluster B on cluster I would mean shipping a week with the destructive recovery still active to "study" it. That fights the evidence we have.

**Lean: parallel-not-serial.** Ship i06 + i01 immediately (week 1). Ship i38 + i39 + i36 alongside (week 1-2) so we have telemetry for cluster B's *secondary* shaping (which orphan-naming, what tombstone retention, etc.). i42 as written drops in rank to #50 because Strategic Fit is 1 — it gates the highest-convergence pick (i06) on a cluster I that has no contradicting evidence to wait for.

If i42 had said "ship i38 before deciding between i07 vs i08 vs i09," I'd score it higher. But "don't change autosync v1" is too strong given direct loss evidence.

## Convergence overrides — called out

### Ranked LOWER than convergence would suggest

- **i24 (5/5)** — ranked #8. Convergence is 5/5 (cap on Confidence) but Impact is 4 not 5: storm-mode state is *plumbing*. Value materializes through i25/i26/i27/i39. The state itself, in isolation, doesn't kill a class of failure the way i01/i06 do. Three 5/5 picks form the spine; i24 is the policy hub *for* that spine, not co-equal with it.
- **i02 (4/5)** — ranked #12. v1 to i01's v0. Effort drops to 4 because shared `node_modules` perf-prereq is real. Ship after i01.
- **i11 (3/5)** — ranked #27. Convergence pulls it up half a tier, but Reversibility is 3 (FS layout becomes load-bearing) and Effort 4 (cleanup-on-end is fiddly). Beats single-source ideas around it, but doesn't crack top 20 because i17 + i20 + i12 cover most of its surface area cheaper.

### Ranked HIGHER than convergence would suggest

- **i17 (2/5)** — ranked #4. Single-source-adjacent, but it's the *noun* every Mode-1 fix needs. Ideators framed it as i16's prereq rather than its own win, which under-counts convergence. Strategic Fit 5 plus textbook simplicity (PostToolUse hook + jsonl) makes Total 24.
- **i05 (single-source)** — ranked #7. -1 confidence applied, base 5 → 4. But direct hit on this session's most-common pain (docs-only pushes blocked). Cheap, surgical. Strategic Fit 4 because it's the early-exit before i01's slow path.
- **i38 (single-source)** — ranked #11. -1 applied. But it's the regression-detector for i06 — without telemetry on destructive ops, we won't know when i06's protection drifts. Strategic Fit 5 promotes it past several 2-3/5 ideas.
- **i34 (single-source)** — ranked #34. Principle more than idea, but Strategic Fit 5 because it justifies the entire cluster-E architecture. Tied with i30/i29 above many 2/5 picks despite -1.

## Conflicts ruled

- **i21 vs i22** — i21 wins (#38 vs #40). Single-writer-multiple-reader is simpler than outbox+DLQ at our scale.
- **i49 vs i51** — i51 wins (#46 vs #47). Branch-per-topic avoids reconcile-job complexity.
- **i48 vs i01-05** — i01-05 win at the front (top 7 has i01, i05). i48 ranked #43 — too dependent on fast main-CI.
- **i28 vs i11/i13/i14** — premise-conflict held in scope. i28 #37 (kept as gate-not-default), i11 #27 (assumes parallelism, wins on cost).

## Notes for Sam (synthesis)

The 7 high-convergence picks (i01, i06, i24, i02, i07, i20, i35) all land in my top 12 — convergence-weighting is honored at the spine level. The reorderings that matter:

- **i17 jumped to #4** despite 2/5 because Strategic Fit is the multiplier convergence missed.
- **i05 and i38** outranked several 2/5 picks because of direct evidence (i05) and regression-detector role (i38).
- **i42 ranked #50** as a deliberate rejection of the telemetry-first gating; Sam-as-evidence-driven says the evidence is already in.

Recovery-bundle (i08 + i35 + i36) ranks 22 / 5 / 19 — split because Effort and Confidence differ, but Sam recommends shipping them as one product surface.

i46 skipped (merged into i45).

The ordering pulls cluster B + cluster A + cluster E (i06, i01, i20, i07) into round 1; cluster D (i17, i16, i19) into round 1 alongside; cluster F (i24, i25, i26, i27) in round 2; cluster H (i35, i08, i36) in round 1-2 as recovery-bundle; cluster J/K parked.
