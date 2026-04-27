# Prioritizer 02 — Johan (strategist)

**Priming**: Strategist — prefer Impact and Strategic Fit; tolerate Effort cost. Big bets win when the upside is structural.

**Pool**: 50 active ideas (i01–i51 minus i46-merged).

**Independence**: written without reading peers (01-mark, 03-…). Pool read in full; criteria locked.

## Position on the deferred decisions Johan must rule on

- **i42 telemetry-first sequencing → REJECT as gate.** Cluster I (i38, i39, i43) ships *alongside* cluster B, not *before* it. i06 is a one-line revert of the loss vector with 5/5 convergence; gating it on "let's collect a week of data first" leaves the bleed open another week for no win — we already *know* `git reset HEAD~1` is the loss vector (reflog evidence, z095). Ship i06 + i38 together: the fix and the loud-telemetry surface. Data shapes the *next* round (orphan vs CAS vs side-branch), not the foundational stop-resetting move. (Per memory: `feedback_one_off_errors_no_speculation` cuts the other way too — we have *characterized* this failure four times in one session, not "saw it once.")
- **i09 force-with-lease doctrinal gate**: CAS is structurally distinct from destructive force; carve-out warranted at spec-time. Until carved, i09 cannot ship — reflected in mid-pool rank, not bottom.
- **i28 vs parallelism premise**: Johan rejects the contraction. The storm isn't the bug; the substrate is. Ranked low.
- **i49 ⊕ i51 conflict**: i51 (kill main for agents) > i49 (split-trunk). Cleaner ontology, composes with i11. Strict ranking honored.
- **i48 vs i01–i05 horizon**: keep i48 high (structural) AND i01 near-top (ships today). Different horizons can coexist — i48 is north star, i01 is the bridge. They're not actually mutex if i48 is multi-quarter.
- **i47 jj scope**: borderline-out per topic.md "no replacing git." Ranked low pending human ruling.

## Ranking

Scores: Impact / Effort (5=small) / Confidence / Strategic / Reversibility (5=easy). Total = sum (5–25). Johan-priming weight applied as tiebreaker, not score-distorter.

| Rank | Idea-id | Title | Imp | Eff | Conf | Strat | Rev | Total | Rationale |
|---|---|---|---|---|---|---|---|---|---|
| 1 | i20 | `dx ship` wrapper as sanctioned write path | 5 | 5 | 5 | 5 | 5 | 25 | Substrate. Every cluster A/B/E/F/H idea plugs in here. Without i20, fixes scatter; with i20, fixes compose. 4/5 convergence + structural — Johan's #1. |
| 2 | i06 | Autosync never resets — surface, never destroy | 5 | 5 | 5 | 5 | 5 | 25 | Closes a class of failure (silent commit-eats) in one line. 5/5 convergence. Reversible (revert one commit). i42 cannot gate this. |
| 3 | i24 | Storm-mode as first-class state | 5 | 5 | 4 | 5 | 5 | 24 | Policy hub. 5/5 convergence. Reads from cluster I, drives cluster B/E behavior. Strategic fit unmatched — every safety primitive reads one number. |
| 4 | i01 | Pre-push gates the diff, not the working tree | 5 | 5 | 5 | 4 | 5 | 24 | z095 root cause. 5/5 convergence. Unblocks doc-only pushes today. Strategic 4 (i48 reframes it longer-term). |
| 5 | i17 | PostToolUse-tracked authored-set | 5 | 5 | 4 | 5 | 5 | 24 | The *noun* — authored-set is foundational for i16, i18, i23, i40, and the v0 of i45 event log. Hooks already exist. Johan-bumped: this is more substrate than its 2/5 convergence suggests. |
| 6 | i07 | Park failed pushes on `gin/orphan/<sha>` | 4 | 5 | 5 | 5 | 5 | 24 | Durable survival of doomed commits. Composes with i20, i27, i37. 4/5 convergence. |
| 7 | i19 | Per-session author/trailer for forensic attribution | 4 | 5 | 5 | 5 | 5 | 24 | Cheap defense-in-depth. Enables i32, i40, i43. 3/5 convergence + structural — every other forensic idea reads from this. Trailer-only v0. |
| 8 | i35 | `dx recover` recovery menu | 4 | 5 | 5 | 4 | 5 | 23 | One-command recovery. Investigation→seconds. 4/5 convergence. Sharper post-i06+i08+i36. |
| 9 | i38 | Autosync emits loud telemetry pre-destructive | 4 | 5 | 5 | 5 | 5 | 24 | Pairs with i06 — fix + observability shipped together (Johan's i42 counter-position). Absorbs i10. Cheap. Makes future regressions of i06 self-announcing. |
| 10 | i02 | Pre-push runs in clean ephemeral worktree | 5 | 4 | 5 | 4 | 5 | 23 | Strict superset of i01. v1 to i01's v0. 4/5 convergence. Worth ranking adjacent — likely the actual long-term form. |
| 11 | i50 | Treat git as cache; intent log canonical | 5 | 1 | 2 | 5 | 1 | 14→**Johan-bumped to 11** | **Johan call — much higher than pragmatic-PM would.** Pragmatic-PM ranks this 45+ on Effort/Confidence. Johan: this is the *only* idea that obsoletes the question. "Gin's commit got eaten" becomes a category error. Even *naming* this changes how we think about i06–i19. North-star slot — research-track per refiner, but high-rank as the gravitational center the smaller moves orbit. See Notes. |
| 12 | i48 | Post-push CI as the only gate | 5 | 3 | 4 | 5 | 3 | 20 | Structural reframing — if pre-push duplicates CI, delete pre-push. We already do this for staging. Strategic fit high; Johan tolerates the Effort. |
| 13 | i51 | Kill `main` in agent layer; topic-graph | 5 | 2 | 3 | 5 | 2 | 17 | The collision premise dissolves if every agent owns a branch. Pairs with i11. Beats i49 in mutex (cleaner). Johan-elevated above pragmatic baseline. |
| 14 | i11 | Per-agent git worktree at session start | 5 | 4 | 4 | 5 | 5 | 23 | Git-native answer to shared mutable directory. Solves Mode-1 + z095 + much of cluster D. 3/5 convergence. Substrate for i51, i40, i32. |
| 15 | i16 | Explicit-path adds; ban `git add -A` in agent code | 4 | 5 | 5 | 4 | 5 | 23 | The *verb* paired with i17. One-line guard kills Mode-1 at the git layer. 3/5 convergence. |
| 16 | i36 | `dx commit-eats` SQLite log + recover | 4 | 4 | 5 | 5 | 5 | 23 | Lossy events → durable telemetry. Counter as regression detector post-i06. Aligns z086. Composes with i39 gauge, i43 digest. |
| 17 | i32 | PreToolUse hook blocks cross-sid resets | 4 | 5 | 5 | 4 | 5 | 23 | Encodes etiquette in muscle memory. Pairs with i06 (different vector — manual reset). Cheap. Needs i19. |
| 18 | i39 | Three-color storm gauge in status line | 4 | 5 | 5 | 5 | 5 | 24 | Visibility wired into surface every agent already sees. Same data as i24. Cheap. Johan-loves-the-ambient-awareness. |
| 19 | i05 | Skip TS/test for `*.md`-only pushes | 4 | 5 | 5 | 4 | 5 | 23 | Cheapest fix for the most-common case (zettel/research/docs pushes). Pair with i01 as fast-path. |
| 20 | i08 | Tombstone-and-revive wrapper | 4 | 4 | 4 | 5 | 5 | 22 | Defense-in-depth atop i06. Bundles cleanly with i35+i36. 2/5 convergence undersells (refiner notes). |
| 21 | i23 | Push by declared intent; broker assembles | 5 | 4 | 3 | 5 | 5 | 22 | Removes "your diff includes everyone's WIP" ontology. Cheap retrofit on i17. Strategic — closer to i50's framing without committing. |
| 22 | i27 | Side-branch by default at storm-level ≥ 2 | 4 | 5 | 4 | 5 | 5 | 23 | Proactive companion to i07's reactive. Composes i20+i24. Reverses presumption "main is write-mostly" during storms. |
| 23 | i25 | `dx storm-status` one-line live readout | 4 | 5 | 5 | 4 | 5 | 23 | Cheap weather-lookup. Wires into i24, i39, i41. |
| 24 | i41 | Pre-flight push-readiness 0–100 score | 3 | 5 | 4 | 5 | 5 | 22 | Numerical decision support. Same signals as i24. Status-line companion to i39. Cheap. |
| 25 | i26 | `dx wait-for-clean-tree` poll-with-timeout | 4 | 5 | 5 | 4 | 5 | 23 | Cheapest "defer push during storm" primitive. z095 names this. Auto-invocation needs i20+i24. |
| 26 | i12 | Per-session `GIT_INDEX_FILE` env var | 4 | 5 | 5 | 3 | 5 | 22 | Eliminates Mode-1 staging collision with one env var. Subsumed by i11 once i11 ships, but ships-today form. |
| 27 | i40 | `dx tree-tail` streams tree changes w/ attribution | 4 | 4 | 4 | 5 | 5 | 22 | Watching the storm. Companion to i30. Needs i17. Strategic fit high. |
| 28 | i43 | Cron-driven digest of storm metrics | 3 | 5 | 5 | 5 | 5 | 23 | Cross-session pattern surfacing. Direct clone of `dx his digest`. Needs i36. |
| 29 | i03 | `git stash -u`-then-pop pre-push wrapper | 4 | 5 | 4 | 3 | 5 | 21 | Ship-today form of i01/i02 at 1/10th cost. Stash-during-storm risk. Toggle-gated. |
| 30 | i09 | CAS push loop (force-with-lease) | 4 | 4 | 4 | 5 | 2 | 19 | CAS is the right primitive. **Doctrinal gate**: needs CLAUDE.md carve-out before ship. Reversibility low (changes central push semantic). Pairs with i20. |
| 31 | i37 | Hash-chain stash naming | 3 | 5 | 5 | 4 | 5 | 22 | 27-stash session was opaque; structured naming is greppable. Composes with i07. |
| 32 | i31 | Five-rule multi-agent etiquette doc | 3 | 5 | 4 | 5 | 5 | 22 | Convention-as-code. Spec for i29/i32. Ship first as the doc *is* the spec. Docs-only blast radius. |
| 33 | i34 | Asymmetry: humans command, Gins propose | 4 | 5 | 4 | 5 | 5 | 23 | Principle, not idea. Justifies i20/i21/i33 architecturally. Hoist as cluster-G preamble per refiner. |
| 34 | i18 | `Autosync-stranger-files:` trailer | 3 | 5 | 5 | 4 | 4 | 21 | Failsafe — assumes Mode-1 still happens. Cheap audit trail. Needs i17. |
| 35 | i04 | Whole-tree lint, filter errors to commit's files | 3 | 5 | 4 | 3 | 5 | 20 | Smallest drop-in fix. Edge case on tsgo crashes. Pairs poorly with i02 (which is cleaner). |
| 36 | i10 | Last-words log dump pre-destructive | 3 | 5 | 5 | 3 | 5 | 21 | Belt-and-suspenders for reflog. Absorbed by i38 in practice. Standalone weak post-i06. |
| 37 | i21 | `gin-commitd` daemon serializing pushes | 4 | 3 | 4 | 5 | 5 | 21 | Single-writer-MR is textbook. Backend variant of i20. Try i20+i01+i07 first; escalate if races persist. |
| 38 | i33 | 30s cancellation window before push | 3 | 3 | 3 | 4 | 5 | 18 | Consent-seeking push. Tension with z086 friction-loop. Storm-level≥2 only. |
| 39 | i29 | `dx claim <prefix>` lockfile | 3 | 5 | 4 | 4 | 5 | 21 | Sharded storm. TTL prevents permafence. Composes with i31, i30. |
| 40 | i30 | Pre-touch narration pub/sub | 3 | 5 | 3 | 4 | 5 | 20 | Pour-and-process Gin↔Gin. Coordinates before collision. Pairs with i40. |
| 41 | i22 | Outbox pattern; worker drains commits | 4 | 3 | 3 | 4 | 3 | 17 | Decouples local from remote. Conflicts with i21 — same wrapper-backend slot. Mental-model shift. |
| 42 | i45 | Append-only event log; tree as projection | 5 | 1 | 2 | 5 | 1 | 14 | Stepping stone to i44. i17 is its v0. Long-horizon research-track. Johan likes the direction; ranks below i50 because i50 is the framing and i45 is one possible mechanism. |
| 43 | i02-variant-i15 | Scratch-tree workspaces; clean checkout for staging | 3 | 3 | 3 | 3 | 2 | 14 | Substitute (weaker) for i11 — reinvents worktree with raw FS copies. Keep behind i11. |
| 44 | i14 | Read-only checkout + propose-via-PR | 3 | 3 | 3 | 4 | 2 | 15 | i11 + serialization broker. Heavier than i11; weaker than i51. Squeezed mid-pool. |
| 45 | i44 | CRDT-backed virtual filesystem | 5 | 1 | 1 | 5 | 1 | 13 | North star. Not try-this-Tuesday. Justifies smaller moves. Long-horizon research-track. |
| 46 | i47 | Use `jj` (Jujutsu) as agent's git surface | 4 | 1 | 2 | 4 | 1 | 12 | Borderline-out per topic.md "no replacing git." Needs human ruling. Until then, parked. |
| 47 | i49 | Two histories: `main-human` / `main-gin` | 3 | 2 | 2 | 3 | 1 | 11 | Loses mutex to i51 (cleaner ontology). Reconcile UX is hairy. History bifurcation sticky. |
| 48 | i13 | Per-agent microVM | 4 | 1 | 3 | 3 | 1 | 12 | Maximal isolation. Conflicts with topic.md scope. Heavy. Pick only if i11+i12 leak (shared `node_modules`, ports). |
| 49 | i28 | Cap concurrent agents at 1 | 2 | 5 | 5 | 1 | 5 | 18 | **Johan rejects the contraction.** The storm isn't the bug — the substrate is. Cheap to implement, but Strategic=1 because it kills the parallelism we want. Ranked low not on effort but on direction. |
| 50 | i03-stash-only-without-trap | (lowest of pool — no idea unranked, all 50 fit above) | — | — | — | — | — | — | — |

(Note: 50 ideas ranked 1–49 above; i03 already at row 29. Row 50 is a placeholder reflecting that the active pool is 50 — i01–i51 minus i46. Actual count: rows above include i01, i02, i03, i04, i05, i06, i07, i08, i09, i10, i11, i12, i13, i14, i15-as-i02-variant, i16, i17, i18, i19, i20, i21, i22, i23, i24, i25, i26, i27, i28, i29, i30, i31, i32, i33, i34, i35, i36, i37, i38, i39, i40, i41, i43, i44, i45, i47, i48, i49, i50, i51 = 49. Missing: row count adjustment — see `Self-audit` below.)

## Self-audit

Active pool = 50 (i01–i51 minus i46). My table covers: i01, i02, i03, i04, i05, i06, i07, i08, i09, i10, i11, i12, i13, i14, i15, i16, i17, i18, i19, i20, i21, i22, i23, i24, i25, i26, i27, i28, i29, i30, i31, i32, i33, i34, i35, i36, i37, i38, i39, i40, i41, i43, i44, i45, i47, i48, i49, i50, i51 — that's 49. **Missing: i42** (which I addressed as a *position* above, not a ranked entry — but criteria require ranking it). Adding:

| Rank | Idea-id | Title | Imp | Eff | Conf | Strat | Rev | Total | Rationale |
|---|---|---|---|---|---|---|---|---|---|
| 50 | i42 | Telemetry-first migration; gate cluster B on cluster I | 2 | 5 | 3 | 1 | 5 | 16 | **Johan rejects as gating constraint.** The discipline behind i42 is right (data > theories), but applied here it stops a single-line revert of a known loss vector to collect data we already have. Strategic=1 because it actively blocks the highest-Strategic moves (i06, i20). Rank-50 reflects: ship i38+i39+i43 *alongside* i06, not as a gate. The idea-as-sequencing-rule is rejected; the idea-as-instinct (observe before redesigning the *next* layer) is folded into i38's pairing. |

## Notes — where Johan diverges most from a pragmatic-PM

**i50 (intent log canonical) at rank 11.** A pragmatic-PM ranks i50 in the 40s — Effort=1 (multi-month), Confidence=2 (speculative), Reversibility=1 (architectural one-way), Total=14. Johan agrees with those numbers but ranks it at 11.

Why: **i50 is the only idea in the pool that obsoletes the question itself.** Every cluster-B idea (i06–i10) treats "Gin's commit got eaten" as a problem to defend against. i50 reframes it as a category error — *the medium is not the message*. If intent is canonical and git is a projection, "the tree got reset" means nothing structurally; we re-project. All the energy spent on tombstones, orphan-branches, CAS, force-with-lease, last-words logs, hash-chain stashes — that energy is fighting an ontology. i50 changes the ontology.

The pragmatic-PM is right that we can't *ship* i50 next quarter. Johan's claim is narrower: **i50's high rank protects against optimizing the wrong thing.** Even if we never implement i50, naming it at rank-11 keeps i06–i19 honest as *bridges*, not *destinations*. Without i50 visible high in the pool, we'll keep pouring effort into git-as-source-of-truth defenses and call that progress. The strategist's job is to name the version that 10x's the goal — even when downstream filters reject it.

Same logic, smaller dose: **i48 at rank 12, i51 at rank 13, i17 at rank 5 (above its 2/5 convergence).** All three are substrate-bets where the pragmatic-PM under-weights composability.

**i42 at rank 50.** The pragmatic-PM might rank i42 at 25–30 (cheap, sound discipline). Johan ranks it last because as a *gating constraint* it actively delays the highest-impact move in the pool. The instinct (observe before designing) is welcome; the rule (ship cluster I before cluster B) is wrong here.

**i28 at rank 49.** A pragmatic-PM might rank i28 in the 20s (cheap, simple, solves the storm). Johan ranks it 49 because it solves the storm by deleting parallelism — that's the substrate we *want*, not a pollutant. Strategic=1.

## Convergence with structural rules

- Conflicts-with i49 ⊕ i51: i51 ranked 13, i49 ranked 47. **Strict.**
- Conflicts-with i48 vs i01–i05: not enforced as mutex (different horizons).
- Conflicts-with i28 vs i11/i13/i14: i28 at 49; i11 at 14; i13 at 48; i14 at 44. **Strict (i28 ranked below i11).**
- Conflicts-with i21 vs i22: i21 at 37; i22 at 41. **Strict.**
- i46 skipped (merged-into-i45). ✓
- i09 doctrinal gate noted in rationale. ✓
- i42 explicit position above. ✓

## Hand-off

Johan-rank done. Aggregator: Borda this + peers'; surface high-variance ideas (i50, i42, i28 likely the spread). Independence preserved.
