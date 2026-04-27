# Prioritizer 01 — Mark (pragmatic)

## Priming
Pragmatic — prefer Effort over Impact when tied. Ship 5 small wins over 1 big bet. Sequence over parallelism when uncertain. Tight charters; surface decisions, not options.

## Position on i42 (telemetry-first sequencing)
**Reject as a hard gate; partially accept as discipline.** i06 is a one-line behavior change with 5/5 convergence and reflog-evidence — gating it on a week of telemetry sacrifices known certain wins for unknown shape-data. We already have the loss vector named (reset on push-fail), so deleting it is ship-now. *However*, telemetry (i38, i36, i39) ships in parallel — not after — so the *next* round of cluster B (i07/i08/i09 shape-of-fix) is data-driven. Telemetry-first is right for "design the unknown"; cluster B's biggest move is known.

## Position on i09 (force-with-lease doctrinal gate)
**Rank assuming carve-out is NOT yet granted.** I keep i09 mid-pack on its mechanical merit (CAS is correct primitive) but penalize Effort and Reversibility because the doctrinal gate is real blocking work and changes a load-bearing semantic. Mark surfaces the decision (carve-out yes/no?) rather than ranking dependent on it. If carve-out lands, i09 jumps ~10 ranks; absent that, it sits behind i06+i07 which solve 80% of the same loss class without touching the force-push doctrine.

## Ranking

| Rank | Idea-id | Title (short) | Impact | Effort | Confidence | Strategic | Reversibility | Total | Rationale (≥2 criteria referenced) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | i06 | Autosync never resets | 5 | 5 | 5 | 5 | 5 | 25 | "Single-line deletion closes the entire loss class — Effort 5 + Impact 5 is Mark's dream tile; 5/5 convergence pins Confidence." |
| 2 | i05 | Skip pre-push for docs-only pushes | 4 | 5 | 5 | 4 | 5 | 23 | "10-line bash check — highest Effort/Impact ratio in pool. Ships today, fixes 90% of zettel/docs pushes; Reversibility trivial." |
| 3 | i01 | Pre-push gates the diff | 5 | 4 | 5 | 5 | 5 | 24 | "z095's exact root cause; 5/5 convergence drives Confidence; Effort small (≤1 day). Strategic anchor for cluster A — i02 is its v1." |
| 4 | i31 | Five-rule etiquette doc | 3 | 5 | 4 | 5 | 5 | 22 | "Markdown file — Effort 5; Strategic 5 because it's the *spec* for i17/i29/i32 enforcement primitives. Convention-as-code (z086)." |
| 5 | i17 | PostToolUse touched-set | 4 | 5 | 5 | 5 | 5 | 24 | "Effort small, hooks are settled infra; Strategic 5 (load-bearing noun for i16, i18, i23, i40). Closes Mode-1 hole that i16 alone leaves." |
| 6 | i16 | Ban `git add -A` | 4 | 5 | 5 | 4 | 5 | 23 | "One-line verb to i17's noun; Effort tiny; Confidence high (3/5 convergence). Kills Mode-1 at git-command layer." |
| 7 | i19 | Agent-Session trailer | 4 | 5 | 5 | 5 | 4 | 23 | "Trailer-only v0 (per refiner note) keeps Reversibility easy; Strategic 5 — substrate for i32, i36, i40. Cheapest defense-in-depth, 3/5 convergence." |
| 8 | i07 | Side-branch on push fail | 5 | 5 | 4 | 5 | 5 | 24 | "1-line `git push` extra; Effort 5; Impact 5 (durable remote survival beats fragile local). 4/5 convergence; pairs trivially with i06." |
| 9 | i20 | `dx ship` wrapper | 4 | 5 | 5 | 5 | 5 | 24 | "30-line wrapper — Effort 5; Strategic 5 (the seam where cluster A/B/F compose). Ship empty first; backends slot in. 4/5 convergence." |
| 10 | i35 | `dx recover` menu | 4 | 5 | 5 | 4 | 5 | 23 | "Reflog already has the data — Effort 5, ships v0 today; 4/5 convergence on Confidence. Collapses minutes of forensics into seconds." |
| 11 | i26 | `dx wait-for-clean-tree` | 3 | 5 | 5 | 4 | 5 | 22 | "10 lines of bash; Effort 5; cheapest 'defer push during storm' primitive. Composes with i20+i24 for auto-invocation." |
| 12 | i37 | Hash-chain stash naming | 3 | 5 | 4 | 4 | 5 | 21 | "Naming convention — Effort 5, fully reversible (old stashes coexist). 27-stash mess this session shows the need; modest Impact alone." |
| 13 | i38 | Loud telemetry pre-destructive | 4 | 5 | 4 | 5 | 5 | 23 | "3-4 emit calls — Effort 5; Strategic 5 (refuse-to-be-silent z086). Protects against future i06 regressions; absorbs i10 mechanism." |
| 14 | i04 | Whole-tree lint, filter errors | 3 | 5 | 4 | 3 | 5 | 20 | "10 lines of grep — Effort 5; least-surgery answer to z095. Confidence 4 because tsgo crashes lack file:line; not full closure." |
| 15 | i03 | Stash-pop pre-push wrapper | 3 | 5 | 3 | 3 | 5 | 19 | "5-line bash; Effort 5. Confidence 3 — stashing during storm could itself collide. Ship-today form, behind toggle. Inferior to i01 long-term." |
| 16 | i02 | Pre-push in clean worktree | 4 | 4 | 5 | 5 | 5 | 23 | "Strict superset of i01 correctness; 4/5 convergence. Effort 4 (perf needs node_modules symlink). Ships after i01 if path-filtering leaks." |
| 17 | i25 | `dx storm-status` readout | 3 | 5 | 5 | 4 | 5 | 22 | "Cheap query — Effort 5; feeds i24 mode-derivation and i39 gauge. Strategic 4 because it's plumbing not policy." |
| 18 | i24 | Storm-mode as state | 4 | 4 | 5 | 5 | 5 | 23 | "5/5 convergence; Strategic 5 (policy hub for cluster F). Effort 4 — state is small but detection signals accumulate. Ship behind default=normal." |
| 19 | i39 | Three-color storm gauge | 3 | 5 | 4 | 4 | 5 | 21 | "Status-line script + queries — Effort 5. Visibility wired into surface every Gin sees. Strategic 4 — same data as i24/i41." |
| 20 | i41 | Push-readiness 0-100 score | 3 | 5 | 4 | 4 | 5 | 21 | "Computed-on-demand from i24 signals — Effort 5. Numerical decision support; gate inside i20. Same data as i39, different presentation." |
| 21 | i32 | PreToolUse blocks cross-sid resets | 4 | 5 | 4 | 4 | 5 | 22 | "One PreToolUse hook reading `git log -1` — Effort 5. Catches manual reset vectors i06 doesn't (different vector, same failure)." |
| 22 | i18 | Stranger-files trailer | 3 | 5 | 4 | 4 | 4 | 20 | "Failsafe — Effort 5, but assumes Mode-1 still happens after i16+i17. Reversibility 4 (commit messages are forever)." |
| 23 | i08 | Tombstone-and-revive | 4 | 3 | 4 | 5 | 5 | 21 | "Defense-in-depth atop i06; Strategic 5 (sharpens i35 menu). Effort 3 — wrapper + revive command. 2/5 convergence undersells it (refiner note)." |
| 24 | i36 | `dx commit-eats` SQLite log | 3 | 3 | 4 | 5 | 5 | 20 | "Effort 3 (schema + hooks + commands); Strategic 5 (post-i06 regression detector + counter for storm-status)." |
| 25 | i43 | Cron digest of storm metrics | 3 | 5 | 5 | 4 | 5 | 22 | "Direct clone of `dx his digest` — Effort 5, Confidence 5. Modest Impact alone but free leverage on existing tooling." |
| 26 | i27 | Side-branch when storm-level≥2 | 3 | 5 | 4 | 4 | 5 | 21 | "Branch convention + draft PR — Effort 5; pairs with i20+i24. 2/5 convergence; main becomes read-mostly during storms." |
| 27 | i29 | `dx claim <prefix>` lockfile | 3 | 4 | 4 | 4 | 5 | 20 | "Lockfile + 1 hook — Effort 4. Sharded storm beats undifferentiated one. Needs i19 sid; pairs with i31 etiquette." |
| 28 | i10 | Last-words diff log | 3 | 5 | 4 | 3 | 5 | 20 | "File-write hook — Effort 5. Strategic 3 because i06 makes this rarely fire; refiner note flags absorption by i38." |
| 29 | i30 | Pre-touch narration pub/sub | 3 | 4 | 3 | 4 | 5 | 19 | "Append-only file + tail — Effort 4. Coordinates before commit (z087/z088 generalized). Confidence 3 — agent adoption uncertain." |
| 30 | i40 | `dx tree-tail` stream | 3 | 3 | 4 | 4 | 5 | 19 | "Watch FS + map paths to sids — Effort 3. Side-terminal observability; depends on i17 for attribution. Telemetry-only Impact." |
| 31 | i12 | Per-session GIT_INDEX_FILE | 3 | 5 | 5 | 3 | 5 | 21 | "One env var — Effort 5; subsumed by i11 if i11 ships. Strategic 3 because it's a stop-gap, not a v1." |
| 32 | i11 | Per-agent worktree | 4 | 4 | 4 | 4 | 4 | 20 | "Worktrees are git-native — Effort 4. Solves Mode-1 + z095 in one move. Mark hesitates on cascade: shared node_modules, ports, ~/.dx/ all leak." |
| 33 | i34 | Asymmetry framing | 2 | 5 | 5 | 5 | 5 | 22 | "Principle, not idea — Effort 5 (the framing is free). Strategic 5 (justifies i20/i21/i33). Standalone Impact low; refiner suggests hoist." |
| 34 | i23 | Push by declared intent | 3 | 3 | 3 | 4 | 5 | 18 | "Cheap retrofit on i17 + intent labels — Effort 3. Removes 'diff = working tree' ontology; Confidence 3 (UX of intent-labels untested)." |
| 35 | i33 | 30s cancellation window | 3 | 3 | 3 | 3 | 5 | 17 | "State machine + sibling notif — Effort 3. Tension with z086 friction-loop (refiner note). Probably right only at storm≥2 — adds latency." |
| 36 | i09 | CAS push loop | 4 | 3 | 4 | 4 | 2 | 17 | "Doctrinal gate (CLAUDE.md NEVER force-push) blocks shipping; Reversibility 2 (changes central push semantic). Mid-pack pending carve-out decision." |
| 37 | i28 | Cap concurrent agents at 1 | 3 | 5 | 3 | 2 | 5 | 18 | "Counter at agent-spawn — Effort 5. Strategic 2 — premise-conflict with i11/i13/i14 and the pour-and-process protocol. Surfaces a meta-question, not a fix." |
| 38 | i48 | Post-push CI as only gate | 4 | 3 | 3 | 3 | 3 | 16 | "Conflicts (partial) with i01–i05; needs revert-on-red automation. Effort 3, Reversibility 3 (gate level easy, automation sticky). Wrong-horizon for round 1." |
| 39 | i21 | `gin-commitd` daemon | 3 | 3 | 4 | 4 | 4 | 18 | "Daemon + socket + retry — Effort 3. Backend variant of i20 (redundant if i20+i01+i07 suffice). 2/5 convergence." |
| 40 | i22 | Outbox worker drain | 3 | 3 | 3 | 3 | 3 | 15 | "Conflicts-with i21 (same wrapper-backend slot). Effort 3, Reversibility 3 (mental-model shift). Single-source. Pick i21 if cluster E backend is needed." |
| 41 | i14 | Read-only checkout + PR queue | 3 | 2 | 3 | 3 | 2 | 13 | "Broker + queue + agent retraining — Effort 2. Changes commit→push shape; Reversibility 2. i11 + serialization is a heavier reframing." |
| 42 | i15 | Scratch-tree workspaces | 2 | 2 | 3 | 2 | 2 | 11 | "Reinvents worktrees with raw FS copies — refiner says prefer i11. Effort 2; Strategic 2 (substitute for stronger i11)." |
| 43 | i47 | jj as agent git surface | 3 | 1 | 3 | 2 | 1 | 10 | "Conflicts-with i20/i21 if interpreted as replace-not-wrap; needs human ruling. Every hook needs jj equivalent — Effort 1, Reversibility 1." |
| 44 | i13 | Per-agent microVM | 4 | 1 | 3 | 2 | 1 | 11 | "Conflicts-with topic.md scope (single checkout). 1+ weeks; image pipeline; auth model. Effort 1, Reversibility 1 — escalation tier only." |
| 45 | i45 | Append-only event log | 4 | 1 | 2 | 3 | 1 | 11 | "Every Edit/Write must hit log atomically — Effort 1. Reversibility 1 (removing log loses history). Stepping stone to i44; vision tier." |
| 46 | i49 | Two histories main-human/main-gin | 3 | 1 | 2 | 2 | 1 | 9 | "Conflicts-with i51 (mutual exclusion). 1+ weeks; reconcile UX; deploy ref decision. Effort 1, Reversibility 1. Mark picks i51 over i49 — see notes." |
| 47 | i51 | Kill main in agent layer | 4 | 1 | 2 | 3 | 1 | 11 | "Branch-per-topic + merge automation — Effort 1, Reversibility 1. Higher Strategic than i49 (cleaner ontology) but still cluster-K horizon." |
| 48 | i44 | CRDT-backed VFS | 4 | 1 | 1 | 3 | 1 | 10 | "Multi-quarter; off-the-shelf CRDTs are document-not-tree — Effort 1, Confidence 1. North star for smaller moves; not try-this-Tuesday (refiner)." |
| 49 | i50 | Git as cache of intent | 4 | 1 | 1 | 3 | 1 | 10 | "1+ months; canonical intent-log definition; projection pipeline. Effort 1, Confidence 1. Refiner: research-track only." |
| 50 | i42 | Telemetry-first sequencing | 2 | 5 | 3 | 2 | 5 | 17 | "Posture not artifact — Effort 5 as discipline. Strategic 2 because it gates i06 (5/5 convergence) on data we don't yet need. Rejected as hard gate (see position above)." |

## Notes for orchestrator (Sam)

- **Decisions on `Conflicts-with`:**
  - **i49 ⊕ i51**: i51 ranked higher (47 vs 46 by Total but both bottom-tier; i51 has cleaner ontology — branch-per-topic vs history-bifurcation. Mark prefers killing the shared `main` over splitting it because reconcile-job UX in i49 is itself a storm vector.)
  - **i28 vs i11/i13/i14**: i28 ranked above i14/i13/i15 but below i11 (i11=32, i28=37, i14=41, i13=44, i15=42). Mark's read: parallelism is the topic's frame; i28 questions the frame and earns Strategic 2 for that, but Effort 5 keeps it on the board as a surface-the-decision tile.
  - **i21 vs i22**: i21 ranked higher (39 vs 40) — daemon is more conventional than outbox; same wrapper-backend slot.
  - **i01 vs i48**: i01 ranked far higher (3 vs 38) — local gate fix beats delete-the-gate at this horizon; revisit if pre-push and main-CI converge.
  - **i47**: ranked low (43) pending human ruling on "no replacing git" — borderline read but high blast-radius mental-model shift.

- **Ideas Mark couldn't rank cleanly (≤3):**
  - **i09**: doctrinal gate dominates the score; mid-pack only because Mark won't pre-rule on the carve-out.
  - **i42**: meta-sequencing tile is awkward — scored as a tile but its real role is as a position (rejected).
  - **i34**: principle, not idea — Mark held it at 33 because Strategic 5 boosts it, but Impact 2 reflects it ships nothing alone.

- **Criteria-conflict moments:**
  - **i11**: Impact 4 + Strategic 4 say "ship", but Effort 4 + Reversibility 4 + cascade-cost (shared node_modules, ports, ~/.dx/) pulled it down to rank 32. Mark's bias (Effort over Impact when tied) earned its keep here.
  - **i08, i36**: Effort 3 fights Strategic 5. Mark held them mid-pack because the small-wins ahead (i17, i19, i31, i20) compose to deliver most of i08+i36's value at Effort 5.
  - **i24**: 5/5 convergence vs Effort 4. Mark scored Confidence 5 honoring convergence but ranked at 18 because i06+i05+i01+i17 ship faster and harder.

- **Most under-rated by Mark's own priming:**
  - **i08 (rank 23)** — tombstone-and-revive. Mark's pragmatic bias scores Effort 3 down, but the refiner note ("2/5 undersells it") and the safety-margin atop i06 argue for rank ~12-15. If Mark's bias were neutral, this jumps ahead of i37, i26, i43. Surfacing it for Sam in case the aggregate wants a courage-correction.

## Mark's recommended Round 1 charter (pre-aggregate hint)

Ship **i06 + i05 + i01 + i17 + i16 + i19 + i31 + i20 + i07 + i35** in that order, in one week. That's 10 small Effort-5 wins that close the silent-loss class, kill Mode-1, ship doc-only pushes, and stand up the wrapper seam where everything else slots in. Cluster F (storm-mode) and i08/i36 (recovery sharpening) are Round 2 once telemetry lands.
