# Prioritization — John (risk-conscious / pessimist)

> **Priming**: Risk-conscious — prefer Confidence and Reversibility. Name failure modes before commitment.

## Method

- All 5 criteria scored 1–5 per `criteria.md`; **Total = sum** (5–25).
- Priming weight: in tie-breaks, Reversibility > Confidence > Strategic > Effort > Impact.
- One-way ideas (i44, i45, i47, i50) penalized heavily on Reversibility; Confidence capped at 2 unless implementation is textbook.
- Cluster J + cluster K reframings get extra scrutiny — failure mode named in rationale.
- i42 (telemetry-first) explicitly upranked: measure before mutating reduces blind-deploy risk.
- Conflicts-with pairs ranked strictly, no ties.

## Ranking

| Rank | Idea-id | Title | Impact | Effort | Confidence | Strategic | Reversibility | Total | Rationale |
|---|---|---|---|---|---|---|---|---|---|
| 1 | i06 | Autosync never resets | 5 | 5 | 5 | 5 | 5 | 25 | The bleeding stops here. Single-line revert; if it misbehaves, one commit reverts. **Failure mode named**: push-fail commits accumulate locally — that is *visible* failure, not silent loss. Reversibility (5) + Confidence (5) make this John's #1. (Impact + Reversibility) |
| 2 | i38 | Loud telemetry before destructive ops | 4 | 5 | 5 | 5 | 5 | 24 | Pure-additive observability. Cannot make anything worse. **Failure mode**: telemetry noise — bounded, mutable. (Reversibility + Confidence) |
| 3 | i31 | Five-rule etiquette doc | 3 | 5 | 5 | 5 | 5 | 23 | Docs-only blast radius; `rm` reverts. **Failure mode**: agents ignore docs — no worse than today. (Reversibility + Confidence) |
| 4 | i19 | Agent-Session trailer (trailer-only v0) | 4 | 5 | 5 | 5 | 4 | 23 | Forensic attribution; trailer-only is reversible (forever-fact author-name is NOT — explicitly v0-trailer). **Failure mode named**: trailer parsing breaks if format drifts — write a parser test. (Confidence + Reversibility) |
| 5 | i17 | PostToolUse touched-set | 4 | 5 | 5 | 5 | 5 | 24 | Hooks settled infra; jsonl append is bulletproof. Provides the noun for i16/i23/i40. **Failure mode**: hook misses an Edit (concurrency) — at-most-once log, recoverable from reflog. (Confidence + Strategic) |
| 6 | i01 | Pre-push gates the diff, not tree | 5 | 5 | 4 | 5 | 5 | 24 | Closes z095 root cause. **Failure mode named**: cross-file type errors not in diff slip through — mitigated by i02 v1. Confidence 4 (not 5) because path-filtering tsgo is leaky on transitive imports. (Impact + Reversibility) |
| 7 | i05 | Skip TS/test for docs-only pushes | 4 | 5 | 5 | 4 | 5 | 23 | Tightest scope — `*.md`-only path. **Failure mode**: glob too loose lets shell scripts through — pin to `*.md` not `usegin/**`. (Confidence + Reversibility) |
| 8 | i35 | `dx recover` menu | 4 | 5 | 5 | 4 | 5 | 23 | Read-mostly until cherry-pick; user can abort. **Failure mode**: cherry-pick conflicts — surfaces, doesn't destroy. (Reversibility + Confidence) |
| 9 | i25 | `dx storm-status` readout | 3 | 5 | 5 | 4 | 5 | 22 | Read-only query. Cannot break anything. **Failure mode**: stale signals → wrong color — bounded harm. (Reversibility + Confidence) |
| 10 | i26 | `dx wait-for-clean-tree` | 3 | 5 | 5 | 4 | 5 | 22 | 10-line poll. **Failure mode**: timeout while storm persists — surfaces, doesn't act. (Reversibility + Confidence) |
| 11 | i42 | Telemetry-first, design fix from data | 4 | 5 | 4 | 5 | 5 | 23 | **Strong John pick.** Measure-before-mutate is exactly the discipline that reduces blind-deploy risk. **Failure mode named**: a week of waiting while loss continues — mitigated by shipping i06 + i38 in parallel (those are themselves observability-friendly). Confidence 4 (not 5) because process commitments slip. See "i42 position" below. (Strategic + Reversibility) |
| 12 | i10 | Last-words diff log | 3 | 5 | 5 | 4 | 5 | 22 | File-write hook; trivially reversible. **Failure mode**: disk fills — needs retention cap, called out in refiner notes. (Reversibility + Confidence) |
| 13 | i37 | Hash-chain stash naming | 3 | 5 | 4 | 4 | 5 | 21 | Old stashes coexist; additive. **Failure mode**: name collisions on identical (sid,parent,intent) — hash makes near-impossible. (Reversibility) |
| 14 | i39 | Three-color storm gauge | 3 | 5 | 4 | 5 | 5 | 22 | Status-line only; pure surface. **Failure mode**: gauge wrong → human ignores — bounded. (Reversibility + Strategic) |
| 15 | i41 | Push-readiness 0-100 score | 3 | 5 | 4 | 4 | 5 | 21 | Read-only computation. **Failure mode**: bad heuristic → false confidence — must publish formula, not opaque score. (Reversibility) |
| 16 | i43 | Cron digest of storm metrics | 3 | 5 | 5 | 4 | 5 | 22 | Direct clone of `dx his digest`. **Failure mode**: noisy mail — bounded by cron cadence. (Confidence + Reversibility) |
| 17 | i12 | Per-session `GIT_INDEX_FILE` | 4 | 5 | 5 | 4 | 5 | 23 | Git-native primitive; one env var. **Failure mode**: tools that bypass `GIT_INDEX_FILE` (uncommon) leak — auditable. (Confidence + Reversibility) |
| 18 | i20 | `dx ship` wrapper | 4 | 5 | 4 | 5 | 5 | 23 | Additive; raw `git push` still works. **Failure mode**: agents bypass wrapper — enforce via PreToolUse block on raw push. Confidence 4 because empty wrapper does nothing — value is in what it composes. (Strategic + Reversibility) |
| 19 | i07 | Push to `gin/orphan/<sha>` on fail | 4 | 5 | 4 | 4 | 5 | 22 | Side-branch survives. **Failure mode named**: orphan branch namespace pollutes `gh branch list` — needs retention/GC policy at spec. (Reversibility + Impact) |
| 20 | i36 | `dx commit-eats` SQLite log | 4 | 4 | 5 | 4 | 5 | 22 | Telemetry only after i06 ships. **Failure mode**: SQLite corruption — recoverable, but adds dependency. (Confidence + Reversibility) |
| 21 | i16 | Ban `git add -A` in agent code | 4 | 5 | 5 | 4 | 5 | 23 | One-line lint rule. **Failure mode**: legitimate bulk-add use case — carve-out by directory. (Confidence + Reversibility) |
| 22 | i03 | `git stash -u` wrapper | 3 | 5 | 4 | 3 | 4 | 19 | 5 lines of bash. **Failure mode named** (refiner already flagged): stash-pop conflict during multi-agent storm leaves tree in surprising state — needs `trap` on EXIT. Confidence 4 because the trap is the load-bearing piece. (Reversibility) |
| 23 | i04 | Whole-tree lint, filter to diff | 3 | 5 | 3 | 3 | 5 | 19 | **Failure mode named**: tsgo crash on stranger file produces no `file:line:col` — runner exits nonzero, gate still blocks. Confidence 3 because the unhappy path is the common path in a storm. (Reversibility) |
| 24 | i02 | Pre-push in clean ephemeral worktree | 5 | 4 | 4 | 5 | 5 | 23 | Strict superset of i01. **Failure mode**: `node_modules` symlink goes wrong → false fails. Confidence 4 (perf prereq is real). (Impact + Strategic) |
| 25 | i08 | Tombstone wrapper on resets | 4 | 3 | 4 | 4 | 5 | 20 | Defense-in-depth. **Failure mode**: tombstone-write fails → destructive op refused → caller stuck. Mitigation: refusal must surface clearly. (Reversibility) |
| 26 | i32 | PreToolUse hook blocking cross-sid resets | 4 | 5 | 4 | 4 | 5 | 22 | Reads commit trailer. **Failure mode**: no trailer (legacy commit) → policy ambiguous; needs default. (Confidence + Reversibility) |
| 27 | i18 | `Autosync-stranger-files:` trailer | 3 | 5 | 4 | 4 | 4 | 20 | Trailer in commit message — corpus-touching but reversible (corpus blast radius lowers Reversibility to 4). **Failure mode**: noisy commit messages. (Confidence) |
| 28 | i11 | Per-agent git worktree | 5 | 4 | 4 | 5 | 4 | 22 | Git-native. **Failure mode named**: shared `node_modules`, ports, `~/.dx/`, dev-server PIDs collide across worktrees — isolation is incomplete. Reversibility 4 because cleanup-on-end must work or stale worktrees pile up. (Impact + Strategic) |
| 29 | i24 | Storm-mode as first-class state | 5 | 4 | 4 | 5 | 5 | 23 | 5/5 convergence; policy hub. **Failure mode named**: detection signals lie (e.g., a forgotten background script keeps tree dirty → permanent paranoid mode) — manual override required. Confidence 4. (Strategic + Reversibility) |
| 30 | i29 | `dx claim <prefix>` lockfile | 3 | 4 | 3 | 4 | 5 | 19 | TTL prevents permanent fence. **Failure mode named**: TTL too short → claim expires mid-edit; too long → dead agent fences peers. Confidence 3 — TTL tuning is hard. (Reversibility) |
| 31 | i30 | Pre-touch narration pub/sub | 3 | 4 | 3 | 4 | 5 | 19 | Append-only file tail. **Failure mode**: agents announce intent but proceed regardless → noise without coordination. Confidence 3. (Reversibility) |
| 32 | i40 | `dx tree-tail` stream | 3 | 3 | 4 | 4 | 5 | 19 | Telemetry only. **Failure mode**: FS-watch missing events on busy storm → incomplete picture. (Reversibility) |
| 33 | i34 | Asymmetry framing | 2 | 5 | 5 | 4 | 5 | 21 | Principle, free to adopt. **Failure mode**: principle without primitives → talk-only. Impact 2 because it's framing, not action. (Reversibility) |
| 34 | i27 | Side-branch by default at storm-level≥2 | 3 | 4 | 3 | 4 | 5 | 19 | **Failure mode**: `main` starves of work in chronic-storm — needs human-or-bot integration step. Confidence 3. (Reversibility) |
| 35 | i33 | 30s cancellation window | 3 | 3 | 3 | 3 | 5 | 17 | **Failure mode named**: 30s wait IS friction (z086) on every push; sibling notification channel doesn't exist yet → window is silent. Confidence 3. Only OK at storm≥2. (Reversibility) |
| 36 | i23 | Push by declared intent | 3 | 3 | 3 | 4 | 4 | 17 | Cheap retrofit on i17. **Failure mode**: agent misdeclares intent → wrong files in commit — same risk as today. Confidence 3. (Reversibility) |
| 37 | i09 | CAS push loop with `--force-with-lease` | 4 | 3 | 3 | 4 | 2 | 16 | **Failure mode named — large blast radius**: CAS race-window between read and lease-check still admits stomping a sibling's pushed-but-not-yet-pulled commit if seen-sha is stale. **Doctrinal gate** (CLAUDE.md "NEVER force-push") is unresolved. Reversibility 2: changes central push semantic; rollback means re-teaching every agent. Confidence 3 — CAS is textbook but our context (multi-agent autosync racing) is not the textbook. (Reversibility — heavily penalized) |
| 38 | i14 | Read-only checkout + PR queue | 3 | 2 | 3 | 3 | 2 | 13 | **Failure mode named**: broker becomes single point of failure; PR-queue starvation under load. Reversibility 2 — agent retraining is sticky. (Reversibility) |
| 39 | i15 | Scratch-tree workspaces | 3 | 3 | 2 | 3 | 2 | 13 | **Failure mode named**: tools/dev-server can't find files outside repo root → invisible breakage. Reinvents i11 with raw FS copies. Reversibility 2 — agents now run from `~/scratch/`. Prefer i11. (Confidence + Reversibility) |
| 40 | i48 | Replace pre-push with post-push CI | 4 | 3 | 3 | 3 | 2 | 15 | **Failure mode named — production blast radius**: `main` becomes broken-by-default until revert; revert-on-red automation can race with the next commit. Touches *production* contract for `main`. Reversibility 2 once revert automation is baked in. Confidence 3 — works for staging but main has different semantics. (Reversibility — heavily penalized) |
| 41 | i28 | Cap concurrent agents at 1 | 4 | 5 | 4 | 2 | 5 | 20 | **Failure mode**: kills the parallelism the team needs. Strategic fit 2 — premise conflict with i11/i13/i14 and the topic frame. Reversible (counter is one config). Listed mid-pack because cheap+reversible but premise-fight. (Reversibility) |
| 42 | i22 | Outbox: agents commit local, worker drains | 3 | 3 | 3 | 3 | 3 | 15 | **Failure mode named**: DLQ fills silently; mental-model shift means agents lose "did my work land?" feedback loop. Reversibility 3 — wrapper can re-route, but agents adapted to outbox semantic. Conflicts with i21. (Reversibility) |
| 43 | i21 | `gin-commitd` daemon | 3 | 3 | 3 | 3 | 4 | 16 | **Failure mode named**: daemon crashes silently → all agents block; socket auth/cleanup; lifecycle bugs. Confidence 3 — daemon ops are a known pit. Pick over i22 because lifecycle is reversible (point wrapper at in-process). (Reversibility) |
| 44 | i13 | Per-agent microVM | 4 | 1 | 3 | 3 | 2 | 13 | **Failure mode named**: 1+ week build, image drift, devcontainer parity, network plumbing — each a recurring failure source. Conflicts with topic.md scope ("single checkout"). Reversibility 2 — VM-per-agent is sticky once tooling assumes it. (Reversibility — heavily penalized) |
| 45 | i47 | Use jj as agent's git surface | 3 | 1 | 2 | 2 | 1 | 9 | **Failure mode named — large blast radius**: every agent's git muscle memory must retrain; every hook needs a jj-equivalent; `dx ship` rewrites; team's `git` workflow on top of jj refs is read-OK but write-paths get weird. Borderline-conflicts with topic.md "no replacing git". Reversibility 1 — once tooling assumes jj, reverting loses it. Confidence 2 — jj is real but our context is not. (Reversibility — heavily penalized) |
| 46 | i45 | Append-only event log; tree as projection | 4 | 1 | 2 | 3 | 1 | 11 | **Failure mode named — large blast radius + cluster J scrutiny**: every Edit/Write must hit log atomically — concurrent replay must converge or history corrupts. Storage growth unbounded. Reversibility 1 — removing log loses history; this is *one-way*. Confidence 2 — event-sourcing is textbook but our concurrent-edit shape is not. (Reversibility — heavily penalized) |
| 47 | i44 | CRDT virtual filesystem | 5 | 1 | 1 | 2 | 1 | 10 | **Failure mode named — cluster J scrutiny**: off-the-shelf CRDTs are document-CRDTs, not file-tree-CRDTs; mapping to git is *unsolved*. Multi-quarter build with no escape hatch. Reversibility 1 — data migration sticks. Confidence 1 — speculative. North-star, not action item. (Reversibility — heavily penalized) |
| 48 | i49 | Two histories (main-human / main-gin) | 3 | 1 | 2 | 2 | 1 | 9 | **Failure mode named — production blast radius**: deploy-target rethink; reconcile job becomes critical infra; conflict UX is unsolved; history bifurcation is sticky. Reversibility 1. Conflicts with i51 — pick one if cluster K becomes implementable. Pick over i51 because keeps `main` shape. (Reversibility — heavily penalized) |
| 49 | i51 | Kill `main` in agent layer | 3 | 1 | 2 | 2 | 1 | 9 | **Failure mode named — production blast radius**: branch-per-topic spawn protocol, merge automation, CI cost story (CI-per-branch), deployment policy — each its own large unknown. Reversibility 1. Mutually exclusive with i49. Ranked just under i49 because deployment story is even less defined. (Reversibility — heavily penalized) |
| 50 | i50 | Git as cache; intent log canonical | 5 | 1 | 1 | 2 | 1 | 10 | **Failure mode named — top-3 highest blast radius in pool**: 1+ month build with no MVP; "what is intent" is undefined; story for human edits is missing; production + telemetry + corpus all touched simultaneously. Reversibility 1 — one-way at the architectural level. Confidence 1 — speculative. Refiner's own note says "research-track only." Last in John's ranking. (Reversibility — heavily penalized) |

## Notes

### Top 3 highest-blast-radius ideas (John's risk flags)

1. **i50 — Git as cache; intent log canonical**
   - **What'll break**: Production deploys, telemetry pipelines, and corpus history all reorganize around a not-yet-defined "intent" abstraction. If intent-projection-to-git diverges, recovery is undefined. If projection has bugs, lost commits get *re-lost* by a buggy replay. Human-direct git edits become second-class without a clear story.
   - **Blast radius**: production + telemetry + corpus.
   - **Reversibility**: 1 (one-way). Once tools assume intent log, removing it loses the meta-history.
   - **John's call**: research-track only, do not commit dev cycles.

2. **i44 — CRDT-backed virtual filesystem**
   - **What'll break**: file-tree-CRDT mapping to git is unsolved at the state-of-the-art. Multi-quarter build with no MVP slice. Conflict-resolution semantics that look correct in single-doc CRDTs (Yjs/Automerge) do *not* generalize to "two agents `rm -rf`'d the same dir." Storage scales with edit-count, not file-count.
   - **Blast radius**: dev-loop primary with deep ripple into corpus and tooling.
   - **Reversibility**: 1 (one-way data migration).
   - **John's call**: north-star vision, not implementable until CRDT-for-file-trees is a solved problem upstream.

3. **i49 / i51 (tied) — Cluster K reframings (split-trunk vs no-trunk)**
   - **What'll break**: deployment target re-architecture. Today's deploy-from-main contract becomes deploy-from-which-ref. Reconcile job (i49) or merge automation (i51) becomes new critical infra with its own failure modes — and we have *zero* operational experience with either. CI cost balloons (per-branch CI). Conflict UX is undefined.
   - **Blast radius**: production + dev-loop.
   - **Reversibility**: 1 (history bifurcation / branch-graph commitments stick).
   - **John's call**: don't touch until cluster A+B+C ship and we have *evidence* the storm survives those moves. Reframings as escape hatches, not first moves.

### Honorable-mention risk flags

- **i47 (jj)**: borderline-conflicts with topic.md "no replacing git"; needs explicit human ruling. Even with the ruling, retraining cost is large and reversibility is poor.
- **i48 (post-push CI as only gate)**: changes the contract for `main` (it can be broken). Revert-on-red automation can race; staging tolerates this, main may not.
- **i13 (microVMs)**: out-of-scope per topic.md ("single checkout"). Pre-existing scope conflict.
- **i09 (CAS with `--force-with-lease`)**: doctrinal gate against CLAUDE.md "NEVER force-push" is unresolved. Even with the carve-out, CAS race window is real and rollback after agents adapt is sticky.

### i42 position — telemetry-first is a John pick

**Position: accept i42 as a posture, but ship i06 + i38 in parallel — do not gate cluster B on a one-week wait.**

The reasoning:

- i42's premise — "we have *theories* about which collisions happen most; we don't have *counts*" — is exactly the discipline John exists to enforce. Measure-before-mutate reduces blind-deploy risk, which is John's currency.
- However, treating i42 as a *strict gate* on cluster B (the strict reading) means **continuing to lose commits for a week while we measure**. That's a price John won't pay — the loss vector is *already* characterized (reflog evidence, 4 eaten commits this session). We have a count of one. We don't need a week of counts to know "stop resetting" is correct.
- The reconciliation: ship **i06 (autosync never resets) + i38 (loud telemetry)** on day 1. Both are pure-additive, both are reversible, and i38 *is* the telemetry i42 wants. Then run i42's measurement window for the *shape* of cluster B's *more elaborate* fixes (i07 orphan vs i08 tombstone vs i09 CAS) — those are where data should drive.
- This treats i42 as advisory on the harder/more-reversible-cost choices, not as a blanket veto on the load-bearing single-line revert.

**John's rank for i42: #11 of 50** — high enough to be in the early shipping plan, not so high that it blocks i06.

### Conflict-pair rulings (strict, no ties)

- **i49 vs i51**: i49 ranked #48, i51 ranked #49. Both terrible from John's lens. Pick i49 if forced, because keeping `main`'s shape preserves more reversibility than killing it.
- **i21 vs i22**: i21 ranked #43, i22 ranked #42. Pick i22 if forced — outbox semantic at least keeps local commits surviving daemon outages; i21 daemon-down means all agents block.
- **i28 vs i11/i13/i14 (premise conflict)**: i28 ranked #41 (cheap + reversible but premise-fight); i11 ranked #28 (best of the parallelism-assuming options).
- **i01-i05 vs i48 (horizon)**: i01-i05 ranked top-tier (#1-#23 range); i48 ranked #40. Pick the local-gate-fix horizon.

### Bundles John would ship together

- **Day 1 bundle (do regardless)**: i06, i38, i31, i19 (trailer-only), i17, i01, i05, i35, i25, i26. Total: 10 ideas, all top-10. All cheap, all reversible, all add-only or single-revert.
- **Day-2 telemetry bundle (i42 first-mover)**: i39, i41, i43, i36, i40. Run for a week before committing to i07/i08/i09.
- **Hold for evidence**: i07 (need orphan-namespace policy), i08 (need eat-rate post-i06 to know if it's needed), i09 (doctrinal gate + race-window analysis).
- **Research-track only**: i44, i45, i47, i50. Do not commit dev cycles in this round.
