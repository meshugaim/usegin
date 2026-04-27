# Ideas — enhance Gin (survive multi-agent storms)

> **Refine summary** (round 1, 2026-04-27): 51 ideas in pool, 50 active + 1 merged.
> - Strongest convergence (5/5): i01 (diff-scoped pre-push), i06 (no-reset autosync), i24 (storm-mode-as-state). These are the spine.
> - Strongest convergence (4/5): i02, i07, i20, i35. High-confidence supports.
> - **i46 merged into i45** (WAL is i45's implementation strategy; preserved as `Refined-merged-into: i45`).
> - **1 conflict pair surfaced**: i49 ⊕ i51 (split-trunk vs no-trunk are mutually exclusive).
> - **1 doctrinal gate**: i09 (`--force-with-lease` CAS) needs explicit carve-out from CLAUDE.md "NEVER force-push" rule before it can ship.
> - **1 sequencing constraint**: i42 (telemetry-first migration) — if accepted, gates cluster B on cluster I shipping first. Prioritize must rule on this explicitly.
> - **1 premise conflict**: i28 (cap concurrent agents at 1) conflicts with i11/i13/i14 which assume parallelism. Surfaces "do we want parallelism?" as the meta-question.
> - Cost distribution: 30 small / 11 medium / 6 large / 4 (varies-by-variant).
> - Blast-radius distribution: 41 dev-loop / 4 production / 3 telemetry / 2 corpus / 1 docs.
> - Strongest convergent picks ranked by composability: i06 (load-bearing for cluster B) > i01 (load-bearing for cluster A) > i20 (load-bearing for cluster E — the wrapper that hosts everything else) > i24 (policy hub for cluster F).
>
> Pool is ready for prioritize.

> Source: brainstorm round, 2026-04-27, 5 ideators, 158 raw → 51 distinct.
> Frame: `usegin/research/enhance-gin/brainstorm/topic.md`

## Pool

### Cluster A — Diff-scoped pre-push gate (z095 root cause)

#### i01 — Pre-push gates the diff being pushed, not the working tree

- **One-line**: Pre-push hook scopes lint + tsgo + tests to `git diff origin/main..HEAD --name-only`, ignoring uncommitted dirt elsewhere in the tree. Doc-only and zettel-only pushes ship even while sibling agents have broken WIP.
- **Why**: z095's exact root cause. This session: ENG-5414 marketplace-docs commit blocked by `tsgo` whole-tree run failing on a sibling agent's broken slack import; 4 commits eaten by autosync's reset-on-failure recovery.
- **Cost-to-try**: small (≤1 day) | **Reversibility**: easy | **Prerequisites**: none | **Blast radius**: dev-loop only
- **From**: ideator-01, ideator-02, ideator-03, ideator-04, ideator-05. **CONVERGENT 5/5.**
- **Refiner notes**: Strongest convergence in pool. Canonical claim of cluster A; i02–i05 are siblings on an implementation spectrum (cheapest filter → principled clean checkout). Recommend keeping all five with i01 as anchor.

#### i02 — Pre-push runs in clean ephemeral worktree of the push range

- **One-line**: Hook does `git worktree add /tmp/precheck-<sha>` at the tip and runs lint/tsgo/tests there; the live working tree is invisible to the gate.
- **Why**: Strict superset of i01's correctness. Removes the "transitively-broken imports outside the diff" objection. Mirrors what staging CI does — local hook becomes a faithful preview.
- **Cost-to-try**: small-medium (~1 day; perf needs `node_modules` symlink) | **Reversibility**: easy | **Prerequisites**: none structurally; perf-prereq is a way to share `node_modules` | **Blast radius**: dev-loop only
- **From**: ideator-02, ideator-04, ideator-05, refiner-01-as-i01-v1. **CONVERGENT 4/5.**
- **Refiner notes**: v1 to i01's v0. Ship i01 first; evolve to i02 if path-filtering proves leaky on cross-file type errors (it will).

#### i03 — `git stash -u` before pre-push, pop after — 5-line wrapper

- **One-line**: Cheapest variant of i01/i02: stash everything uncommitted (including untracked) before lint/test, pop after. Gate runs against HEAD = the push range.
- **Why**: ~5 lines of bash; same correctness as i02 at 1/10th the cost.
- **Cost-to-try**: small (≤2 hours) | **Reversibility**: easy | **Prerequisites**: none | **Blast radius**: dev-loop only — caveat: stash-pop-on-hook-failure can leave tree in surprising state if pop conflicts; needs `trap` on EXIT to guarantee pop.
- **From**: ideator-01. Single-source.
- **Refiner notes**: "Ship today" form. Concern: stashing during an active multi-agent storm could itself collide. Worth shipping behind a toggle and watching telemetry.

#### i04 — Whole-tree lint, then filter errors to commit's files

- **One-line**: Keep running lint/tsgo against the whole tree, but post-process output and only fail if errors point at files in `git diff origin/main..HEAD --name-only`. ~10 lines of grep.
- **Why**: Smallest-possible drop-in fix. No worktree management, no stash-pop. z095's slack-import error wouldn't have blocked the marketplace-docs push.
- **Cost-to-try**: small (≤2 hours) | **Reversibility**: easy | **Prerequisites**: lint/tsgo emit machine-parseable file:line:col output (they do) | **Blast radius**: dev-loop only
- **From**: ideator-01. Single-source.
- **Refiner notes**: "Least surgery" answer. Edge case: tsgo crashes on a stranger file have no `file:line` to filter against — runner exits nonzero. Mitigation needs i01 v1 anyway.

#### i05 — Skip TS/test pre-push entirely for `usegin/`/`*.md`-only pushes

- **One-line**: Path-allowlist fast-path: if every file in the diff matches `^(usegin/|.*\.md$|docs/)`, skip lint/tsgo/test entirely. 90% of zettel and research pushes need zero code-gate.
- **Why**: Marketplace-docs and zettel pushes this session were docs-only — there's no code to type-check. 10-line bash check at hook entry; same-turn fix.
- **Cost-to-try**: small (≤1 hour) | **Reversibility**: easy | **Prerequisites**: agreement on docs-only path globs (must be `*.md`-tight, not `usegin/**`-loose since `usegin/` contains shell scripts) | **Blast radius**: dev-loop only
- **From**: ideator-01. Single-source.
- **Refiner notes**: Cheapest gate fix for the most-common case. Pair with i01: i05 is the early-exit, i01 is the slow path.

### Cluster B — Stop the destructive recovery (autosync never resets)

#### i06 — Autosync never resets — push failure surfaces, never destroys

- **One-line**: Remove every `git reset HEAD~1` (and `--hard`/`--mixed` forms) from autosync code paths; on push failure, surface error, leave commit in place, let human or `dx recover` decide.
- **Why**: This session lost 4 commits to `reset HEAD~1` on push-rejection (reflog evidence). The reset itself is the loss vector. Single-line deletion closes the entire loss class. All other cluster B ideas (i07/i08/i09/i10) presuppose this — they describe what to do *instead of* resetting.
- **Cost-to-try**: small (≤1 day) | **Reversibility**: easy (single-commit revert) | **Prerequisites**: none — works alone | **Blast radius**: dev-loop (autosync hook only — production code untouched)
- **From**: ideator-01, ideator-02, ideator-03, ideator-04, ideator-05. **CONVERGENT 5/5 — load-bearing.**
- **Refiner notes**: The most-impactful single-line change in the pool. All ideators independently named "stop resetting" — promotes from "pick" to "do this regardless."

#### i07 — On push failure, park commit on `gin/orphan/<sha>` side-branch

- **One-line**: When `git push origin main` is rejected, push the same commit to `refs/heads/gin/orphan/<short-sha>` instead — commit survives on remote, greppable from any env.
- **Why**: Local survival (i06's "leave it alone") is fragile — checkout can be wiped, dev container rebuilt, another agent can reset over it. Remote side-branch makes it durable.
- **Cost-to-try**: small (1 extra `git push` line) | **Reversibility**: easy | **Prerequisites**: i06 (don't reset). Composes with i20, i37 | **Blast radius**: dev-loop + creates new server-side refs under `gin/orphan/*`
- **From**: ideator-01, ideator-02, ideator-04, ideator-05. **CONVERGENT 4/5.**
- **Refiner notes**: Naming question for spec time: `gin/orphan/<sha>` vs `gin/abandoned/...` vs `gin/quarantine/...`. Lean toward `refs/heads/gin/orphan/*` for browsability in `gh`.

#### i08 — Tombstone-and-revive: every reset writes `refs/gin/tombstones/<sha>` first

- **One-line**: Wrap any code path that destroys a commit in a tombstone-write; refuse the destructive op if write fails. `dx revive <prefix>` lists tombstones and one-command-restores.
- **Why**: Defense-in-depth atop i06. Even if some future code path or human typo calls `git reset` directly, the tombstone wrapper catches it.
- **Cost-to-try**: medium (1-3 days) | **Reversibility**: easy | **Prerequisites**: i06; sharper paired with i35 | **Blast radius**: dev-loop + telemetry (tombstones observable as destruction-attempt telemetry)
- **From**: ideator-02, ideator-04. **CONVERGENT 2/5.**
- **Refiner notes**: Soft-delete pattern. 2/5 undersells it — ideator-04's "blame-free reset" is the same pattern in convention form.

#### i09 — CAS push loop — read, rebase, retry; never reset

- **One-line**: Replace push-fail-then-reset with compare-and-swap loop: `git push --force-with-lease=origin/main:<seen-sha>`; on lease-fail re-read and retry up to N times.
- **Why**: CAS is the universal primitive for safe concurrent updates. The push-rejection that motivates `reset HEAD~1` is itself a CAS failure; right response is "retry CAS," not "throw away work."
- **Cost-to-try**: medium (1-3 days) | **Reversibility**: hard (changes central push semantic) | **Prerequisites**: i06; i16/i17 (rebase mid-loop can sweep stranger files into Mode-1 collision otherwise) | **Blast radius**: dev-loop
- **From**: ideator-02, ideator-01. **CONVERGENT 2/5.**
- **Conflicts-with**: CLAUDE.md "NEVER force-push" doctrine. **Doctrinal gate** — `--force-with-lease=origin/main:<sha>` is structurally CAS, not destructive force, but spec-time needs explicit carve-out before this can ship.
- **Refiner notes**: Pairs with i20 (`dx ship` is where this lives). Without the doctrinal carve-out, i09 is doctrinally blocked.

#### i10 — Last-words log — dump diff before any destructive op

- **One-line**: Before any destructive git op, dump `git diff <doomed>~1 <doomed>` and metadata to `~/.dx/last-words/<sha>.diff`; survives even if reflog GCs.
- **Why**: Belt-and-suspenders for reflog. Reflog is fragile (expires, repo-local, noisy). A friendly path with one diff per doomed-sha is grep-able, scp-able, human-readable.
- **Cost-to-try**: small (file-write hook, <1 day) | **Reversibility**: easy | **Prerequisites**: i06 makes destructive ops rare; i08 makes them tombstoned; i10 is the on-disk view that survives both | **Blast radius**: dev-loop only — needs retention policy at spec time (rotate? cap?)
- **From**: ideator-03. Single-source.
- **Synergy-with**: i38 (refuse-to-be-silent absorbs i10's mechanism — same instinct).
- **Refiner notes**: Strongest as a complement to i06–i08, weakest as standalone (because i06 already kills the loss vector — last-words then has nothing to record).

### Cluster C — Per-agent isolation (worktrees / index / VMs)

#### i11 — Per-agent git worktree, materialized at session start

- **One-line**: `dx session start` runs `git worktree add .gin/worktrees/<sid>/` so each agent gets its own working tree, sharing one objectdb. Agents physically cannot see each other's working tree.
- **Why**: Git's native answer to "shared mutable directory". Solves Mode-1 (no stranger files exist in your tree) and z095 (your pre-push runs against your worktree only) in one move.
- **Cost-to-try**: small (worktrees are git-native; bootstrap shim + cleanup-on-end) | **Reversibility**: easy | **Prerequisites**: none. Composes with i20 (per-worktree push verb) | **Blast radius**: dev-loop only
- **From**: ideator-01, ideator-02, ideator-05. **CONVERGENT 3/5.**
- **Refiner notes**: i11/i12/i13 are complement-stack, not substitutes. i11 alone solves Mode-1 + z095 cheaply. If i11 ships, i12 is automatic.

#### i12 — Per-session `GIT_INDEX_FILE` env var

- **One-line**: Each agent session exports `GIT_INDEX_FILE=.gin/sessions/<sid>/index`; `git add` from agent A is invisible to agent B's staging area.
- **Why**: Git already supports this; eliminates Mode-1 staging collisions by construction with zero new code. Useful when worktrees (i11) are too heavy or not yet adopted.
- **Cost-to-try**: small (one env var) | **Reversibility**: easy | **Prerequisites**: none. **Subsumed by i11** when i11 ships | **Blast radius**: dev-loop only
- **From**: ideator-01, ideator-02. **CONVERGENT 2/5.**
- **Synergy-with**: i11 (subsumes i12 in v1; i12 is the "ship today, no FS reshuffle" v0)

#### i13 — Per-agent microVM as the unit of isolation

- **One-line**: Spawn a firecracker/Lima/devcontainer per agent; sync via git remote, not shared FS. Blast radius = the VM.
- **Why**: Maximal isolation — solves Mode-1, z095, port conflicts, dependency drift, `rm -rf` blast in one model.
- **Cost-to-try**: large (1+ weeks; VM provisioning, image baking, devcontainer parity, network plumbing) | **Reversibility**: hard | **Prerequisites**: host decision (firecracker / Lima / devcontainer); image pipeline; agent↔git auth model | **Blast radius**: dev-loop + corpus
- **From**: ideator-05. Single-source.
- **Conflicts-with**: topic.md scope ("Cross-machine sync — assume single checkout") — needs explicit re-scoping or downgrade to single-host VM-per-agent.
- **Refiner notes**: Escalation tier. Pick only if i11+i12 isolation still leaks (shared `node_modules`, ports, `~/.dx/`).

#### i14 — Read-only checkout + propose-via-PR

- **One-line**: `chmod -R a-w` shared tree. Agents work in scratch worktrees and submit PRs into a queue; broker serializes promotion.
- **Why**: Serializes the storm into a line — the queue *is* the order.
- **Cost-to-try**: medium (broker, PR queue, agent retraining) | **Reversibility**: hard (changes commit→push→main shape) | **Prerequisites**: broker daemon (overlaps i21). Composes with i15 | **Blast radius**: dev-loop
- **From**: ideator-05. Single-source.
- **Refiner notes**: i14 = i11 + serialization broker on top.

#### i15 — Scratch-tree workspaces; clean checkout used only for staging

- **One-line**: Each agent's edits live in `~/scratch/<sid>/`; staging copies authored files into a clean checkout at commit-time.
- **Why**: Removes "working tree is shared" assumption without committing to full worktree-per-agent.
- **Cost-to-try**: medium (scratch→checkout copy step, conflict semantics) | **Reversibility**: hard (agents' tool/test invocations now run from `~/scratch/`) | **Prerequisites**: how dev-server / tests find files outside repo root; composes with i17 (touched-set is the staging manifest) | **Blast radius**: dev-loop
- **From**: ideator-05. Single-source.
- **Refiner notes**: Substitute (weaker) for i11. i11 uses git's native worktree mechanism; i15 reinvents it with raw FS copies. Prefer i11.

### Cluster D — Stage only what you authored (kill Mode-1 collision)

#### i16 — Explicit-path adds and commits; `git add -A` banned in agent code

- **One-line**: Autosync (and any agent commit) uses `git commit -- <paths>` or `git add -u <paths>` against an explicit author-set; bare `git add -A` is a lint failure in `tools/dx/`.
- **Why**: One-line change kills Mode-1 (stranger files riding into your commit) at the git-command layer.
- **Cost-to-try**: small (audit + rewrite + CI grep) | **Reversibility**: easy | **Prerequisites**: needs an authored-files set (i17) | **Blast radius**: dev-loop only
- **From**: ideator-01, ideator-03, ideator-04. **CONVERGENT 3/5.**
- **Refiner notes**: i16 is the verb; i17 is the noun. Ship together.

#### i17 — PostToolUse-tracked authored-set; commits refuse out-of-set files

- **One-line**: A PostToolUse hook on Edit/Write logs each touched file to `.gin/sessions/<sid>/touched.jsonl`; `dx commit` and autosync refuse to add anything outside that set.
- **Why**: The Edit/Write hooks already know what was authored — use that set as commit manifest instead of inferring from working-tree dirt. Closes the Mode-1 hole that i16 alone leaves.
- **Cost-to-try**: small (hook + jsonl appender + commit-time filter) | **Reversibility**: easy | **Prerequisites**: none (hooks are settled infra). Provides the noun i16 needs | **Blast radius**: dev-loop + telemetry
- **From**: ideator-01, ideator-03. **CONVERGENT 2/5.**
- **Synergy-with**: i16 (verb+noun pair), i19 (trailer makes the touched-set survive into git-log durably)

#### i18 — `Autosync-stranger-files:` trailer when sweep happens

- **One-line**: Even when autosync sweeps non-authored files into a commit, append `Autosync-stranger-files: a.tsx, b.ts...` as a commit trailer. Attribution survives in `git log` itself.
- **Why**: Turns silent collision into visible audit trail. Recovery becomes `git log --grep`, not a forensics session.
- **Cost-to-try**: small | **Reversibility**: easy | **Prerequisites**: i17 (need authored-set to compute "stranger" delta) | **Blast radius**: dev-loop + corpus (commit messages persist)
- **From**: ideator-03. Single-source.
- **Refiner notes**: Failsafe — assumes Mode-1 still happens. Even if i16+i17 prevent capture, keep i18 because file-system anomalies will produce surprises.

#### i19 — `GIT_AUTHOR_NAME=gin-<sid>` + `Agent-Session: <id>` trailer on every agent commit

- **One-line**: Every agent commit carries forensically-traceable identity in author + trailer; `git log --grep 'Agent-Session: <sid>'` becomes the recovery tool.
- **Why**: Even when files mix (Mode-1 leaks past i16/i17) or commits get reset (Mode-2), attribution survives in commit object and reflog. Cheapest defense-in-depth.
- **Cost-to-try**: small | **Reversibility**: easy for trailer; one-way for author-name (forever-fact in git history) | **Prerequisites**: stands alone (does NOT depend on i17). Composes with i17, i32 | **Blast radius**: corpus (commit history)
- **From**: ideator-01, ideator-03, ideator-04. **CONVERGENT 3/5.**
- **Refiner notes**: Author-name vs trailer split worth a prioritize-time decision: trailer-only (reversible) vs author-name+trailer (forever). Recommend trailer-only for v0.

### Cluster E — `dx ship` wrapper as the sanctioned write path

#### i20 — `dx ship` wrapper is the only sanctioned agent push path

- **One-line**: A single thin wrapper command replaces raw `git push` for agents; composes diff-scoped checks, side-branch fallback, tombstone, storm-aware behavior into one place every agent inherits.
- **Why**: Bare `git push` in autosync-multi-agent regime is a foot-gun. A wrapper is the only seam where cluster A/B improvements compose. Without it, fixes scatter across hooks, scripts, per-agent CLAUDE.md notes.
- **Cost-to-try**: small (30-line wrapper) | **Reversibility**: easy (additive; raw `git push` still works) | **Prerequisites**: none for shell; meaningful versions need i01, i07 | **Blast radius**: dev-loop only
- **From**: ideator-01, ideator-02, ideator-04, ideator-05. **CONVERGENT 4/5.**
- **Refiner notes**: Umbrella for cluster E. i21/i22 are pluggable backends. Composes with i01, i02, i06, i07, i08, i09, i10, i17, i19, i24, i26, i27, i35.

#### i21 — `gin-commitd` daemon owns serialized push-to-main

- **One-line**: A long-running local daemon accepts push requests over a socket, serializes them, runs diff-scoped checks, fast-forwards to `origin/main`; agents never call `git push` directly.
- **Why**: Single-writer-multiple-reader is the textbook safe-write primitive. Eliminates push races by construction.
- **Cost-to-try**: medium (daemon lifecycle + socket + retry; ~1 day) | **Reversibility**: easy (point `dx ship` back at in-process impl) | **Prerequisites**: i20 (wrapper is client surface). Optional with i22 | **Blast radius**: dev-loop only
- **From**: ideator-02, ideator-05. **CONVERGENT 2/5.**
- **Refiner notes**: Backend variant of i20. Likely path: try i20+i01+i07 first, escalate to i21 only if races persist.

#### i22 — Outbox: agents commit locally, worker drains to origin

- **One-line**: Agents commit only to local refs; a separate worker process drains commits to `origin/main` with retry+backoff, dead-lettering permanent failures to `refs/gin/dlq/<sid>`.
- **Why**: Decouples local progress from remote availability. Agents never wait on a push gate.
- **Cost-to-try**: medium (worker + retry + DLQ; ~1 day) | **Reversibility**: hard-ish (mental-model shift) | **Prerequisites**: i20; i07 (DLQ destination is side-branch convention) | **Blast radius**: dev-loop only
- **From**: ideator-02. Single-source.
- **Conflicts-with**: i21 (architecturally — same wrapper-backend slot). Pick one in prioritize.

#### i23 — Push by declared intent; broker assembles the commit

- **One-line**: Agent declares semantic intent ("ship marketplace docs"); the wrapper builds a clean commit from only files the agent authored under that intent — independent of working tree.
- **Why**: Removes "your diff includes everyone's WIP" ontology that causes Mode-1 + z095. Filesystem stops being unit of authorship; *labeled change set* does. Cheap retrofit: combine i17 touched-set with intent-labels at `dx ship` time.
- **Cost-to-try**: medium (intent-label + commit assembly from i17; ~1 day) | **Reversibility**: easy | **Prerequisites**: i17. Composes with i19, i20 | **Blast radius**: dev-loop only
- **From**: ideator-05. Single-source.
- **Refiner notes**: Does NOT require event-sourcing (i45) or CRDT (i44). Cheap retrofit on top of i17.

### Cluster F — Storm detection & adaptive mode

#### i24 — Storm-mode as first-class state, three levels

- **One-line**: A persisted mode (`paranoid` / `normal` / `yolo`) read by every dx subcommand and hook; set automatically from detection signals (stash count, push-fail rate, agent heartbeat) or manually by human.
- **Why**: Storms are recurring weather. Encoding storm level as state means every safety primitive reads the same number and adapts coherently — instead of each subsystem inventing its own threshold.
- **Cost-to-try**: small (config key + reader; detection added incrementally) | **Reversibility**: easy (consumers can ignore mode; default = normal is no-op) | **Prerequisites**: none for state itself. Detection inputs from i25, i26, agent heartbeat. Behavior outputs i27, i28 | **Blast radius**: dev-loop + telemetry
- **From**: ideator-01, ideator-02, ideator-03, ideator-04, ideator-05. **CONVERGENT 5/5.**
- **Refiner notes**: Policy hub. Reads-from cluster I observability; feeds cluster B autosync behavior. Synergy with i39 (R/A/G gauge surfaces same state) and i41 (push-readiness numerical view of same state).

#### i25 — `dx storm-status` one-line live readout

- **One-line**: Single-command readout — N agents touching tree, autosync in-flight, stash count, push-fail rate over last 30 min — for status-line + hook gating.
- **Why**: Cheap "what's the weather" lookup. Wires into status-line for ambient awareness; wires into i24 for mode-derivation.
- **Cost-to-try**: small | **Reversibility**: easy | **Prerequisites**: none for v0. Agent-heartbeat enrichment depends on i11 or per-session sid registry | **Blast radius**: dev-loop + telemetry
- **From**: ideator-03. Single-source.
- **Synergy-with**: i24, i39, i41 (all surface the same storm-state).

#### i26 — `dx wait-for-clean-tree` poll-with-timeout primitive

- **One-line**: Polls `git status --porcelain` until empty (or timeout); called automatically by `dx ship` when storm-level ≥ 1, or manually.
- **Why**: Cheapest "defer push during storm" primitive. z095 explicitly names this option.
- **Cost-to-try**: small (~10 lines) | **Reversibility**: easy | **Prerequisites**: none for v0. Auto-invocation needs i20 + i24 | **Blast radius**: dev-loop only
- **From**: ideator-01, ideator-04. **CONVERGENT 2/5.**

#### i27 — Side-branch by default when storm-level ≥ 2

- **One-line**: When storm-level high, `dx ship` auto-targets `gin/<sid>/<topic>` instead of `main` and opens a draft PR; `main` only receives integrated work.
- **Why**: In a storm, `main` is read-mostly. Letting agents fast-forward `main` while N others are mid-write maximizes collision surface.
- **Cost-to-try**: small (branch convention + `gh pr create --draft`) | **Reversibility**: easy | **Prerequisites**: i20, i24 | **Blast radius**: dev-loop only
- **From**: ideator-04, ideator-05. **CONVERGENT 2/5.**
- **Synergy-with**: i07 (same `gin/...` destination shape; i07 reactive on push-fail, i27 proactive on storm-high — different triggers, keep both).

#### i28 — Cap concurrent agents at 1; require explicit handshake

- **One-line**: Default to one agent per checkout; spawning a second requires human handshake or explicit `dx storm allow-N=K` override.
- **Why**: Questions whether parallelism is needed. Most of this brainstorm's pain (z095, Mode-1, eaten commits) arises from multi-agent assumption. Capping makes the cost visible at the moment of choice.
- **Cost-to-try**: small (counter + check at agent-spawn) | **Reversibility**: easy | **Prerequisites**: none for gate; meaningful enforcement needs knowing where agents spawn | **Blast radius**: dev-loop only — affects how human spawns parallel R&D / brainstorm / refine teams
- **From**: ideator-05. Single-source.
- **Conflicts-with**: i11, i13, i14 (those *assume* parallelism). Premise conflict — i28 questions the topic's frame.

### Cluster G — Coordination via convention/protocol

#### i29 — `dx claim <prefix>` writes short-lived lockfile; pre-push refuses unclaimed touches

- **One-line**: Convert "shared mutable directory" into "per-prefix mutable", lock-free reads stay free; conflicts become explicit.
- **Why**: Smallest primitive that converts a storm into a sharded storm. Lock has TTL so a crashed agent doesn't permanently fence a directory.
- **Cost-to-try**: small (lockfile + 1 hook + 1 pre-push assertion) | **Reversibility**: easy | **Prerequisites**: i19 (sid for hook to compare claim-owner to current agent) | **Blast radius**: dev-loop only
- **From**: ideator-02, ideator-04. **CONVERGENT 2/5.**
- **Synergy-with**: i31 (claim is enforcement primitive; etiquette is social rule).

#### i30 — Pre-touch narration pub/sub between agents

- **One-line**: Tiny pub/sub (file-tail or unix socket) where each agent announces "about to touch X" / "touched X"; siblings read before diving in.
- **Why**: Pour-and-process generalized to Gin↔Gin (z087/z088). Coordinates *before* commit, not after collision.
- **Cost-to-try**: small (append-only file + tail consumer; no daemon for v0) | **Reversibility**: easy | **Prerequisites**: i19 (sid). Pairs with i29, i40 | **Blast radius**: telemetry + dev-loop
- **From**: ideator-04, ideator-05. **CONVERGENT 2/5.**
- **Synergy-with**: i40 (tree-tail watches *tree*; i30 watches *intent* — different layers, both useful).

#### i31 — Five-rule multi-agent etiquette doc at `usegin/etiquette.md`

- **One-line**: Short, load-bearing convention doc (don't reset commits I didn't author; declare path-prefix; don't autosync untracked I haven't touched; etc.) loaded into every agent's CLAUDE.md.
- **Why**: Convention as code (z086 form). Useful even alone because Claude follows written conventions readily; most powerful as the spec for enforcement primitives (i29, i32, i17).
- **Cost-to-try**: small (one markdown file + one CLAUDE.md include) | **Reversibility**: easy (`rm`) | **Prerequisites**: none structurally. Soft prereq: pairs with i29 + i32 | **Blast radius**: docs only
- **From**: ideator-04. Single-source.
- **Refiner notes**: Ship first; the doc *is* the spec for i29/i32.

#### i32 — PreToolUse hook on `git reset HEAD~` blocks cross-sid resets

- **One-line**: Hook reads last-commit's `Agent-Session:` trailer; blocks if it's a different sid than current agent; requires `dx amnesty <reason>` to override.
- **Why**: Encodes etiquette (i31) in muscle memory. Single biggest behavioral guard against the 4-commits-eaten loss vector when paired with autosync changes.
- **Cost-to-try**: small (one PreToolUse hook reading `git log -1`) | **Reversibility**: easy (remove hook) | **Prerequisites**: hard prereq i19 (Agent-Session trailer). Pairs with i06 | **Blast radius**: dev-loop only
- **From**: ideator-04. Single-source.
- **Synergy-with**: i06 (i06 fixes autosync; i32 also catches manual `git reset` from confused agent — different vectors of same failure).

#### i33 — `dx ship` opens 30s cancellation window before push lands

- **One-line**: Pushing becomes consent-seeking — siblings can `dx contest` if their work would conflict; otherwise the proposal commits.
- **Why**: In multi-agent regime, pushing is no longer private (z095). Window converts collision-resolution from "after-the-fact-and-destructive" to "at-the-moment-conversational".
- **Cost-to-try**: medium (state machine + sibling notification + cancel path) | **Reversibility**: easy (skip when storm-level=0) | **Prerequisites**: i20. Useful with i30 (contest mechanism) | **Blast radius**: dev-loop. Slows pushes by 30s in storms
- **From**: ideator-04. Single-source.
- **Refiner notes**: Tension with z086 friction-loop — adding a 30s wait *is* friction. Probably right only at storm-level ≥ 2 (chain with i24).

#### i34 — Asymmetry: humans push commands, Gins push proposals

- **One-line**: A human's `git push` is direct; a Gin's `dx ship` is mediated. Architectural framing that justifies i20/i21/i33 rather than feeling like agent-special-casing.
- **Why**: One human in the loop is single writer; N Gins are many writers. Concurrency primitives differ.
- **Cost-to-try**: small (the framing is free; implementations are i20/i21/i33) | **Reversibility**: easy | **Prerequisites**: none — it's a principle | **Blast radius**: docs + whatever its implementations touch
- **From**: ideator-04. Single-source.
- **Refiner notes**: More principle than idea. Recommend hoist as cluster-G preamble in final pool.

### Cluster H — Recovery as one command

#### i35 — `dx recover` — menu of last-N reflog/tombstone entries with diffstat

- **One-line**: Lists last N reflog entries and tombstone refs with diffstat + commit message + timestamp, prompts "restore which?", cherry-picks chosen commit back onto HEAD.
- **Why**: All four lost commits this session were in reflog the whole time — investigation, not infrastructure, was the bottleneck. Menu collapses minutes-of-detective-work into seconds-of-arrow-keys.
- **Cost-to-try**: small (parse reflog + tombstones, format, picker) | **Reversibility**: easy (read-mostly; ends in `git cherry-pick`; user can abort) | **Prerequisites**: none for v0. Sharper with i08 (tombstones), i36 (commit-eats), i10 | **Blast radius**: dev-loop only
- **From**: ideator-01, ideator-02, ideator-03, ideator-04. **CONVERGENT 4/5.**
- **Refiner notes**: Implementation uncontroversial; design choice is which sources feed the menu. Ship v0 reflog-only; expand sources as i08/i36/i07 land.

#### i36 — `dx commit-eats` — SQLite log of every silent reset, with recover

- **One-line**: SQLite-backed log under `~/.dx/commit-eats.db` with one row per autosync reset (sha, message, timestamp, sid, reason); `dx commit-eats list/recover`; counter exposed via `dx storm-status`.
- **Why**: Lossy events become durable telemetry. Humans see the cumulative cost in numbers, not anecdotes. Aligns with z086.
- **Cost-to-try**: medium (SQLite schema + write hook + list/show/recover commands + status-line wiring) | **Reversibility**: easy | **Prerequisites**: i06 ideally (so eat-rate trends to zero post-deploy and counter becomes regression detector). i35 (recovery exists). i39 (gauge consumes counter) | **Blast radius**: telemetry + dev-loop
- **From**: ideator-03. Single-source.
- **Synergy-with**: i43 (i36 is per-event log; i43 is rollup digest).

#### i37 — Hash-chain stash naming — `gin/<sid>/<parent-sha>/<intent-hash>`

- **One-line**: Replace opaque numeric stashes with structured names so stashes (and orphan-branches per i07) form a deterministic chain walkable by `dx unstash`.
- **Why**: This session climbed to 27 stashes — opaque, ungreppable. Structured naming makes them findable by sid, parent-sha, or intent. Idempotent.
- **Cost-to-try**: small | **Reversibility**: easy (old-style stashes coexist) | **Prerequisites**: none for v0. Converges with i07 (orphan-branches share scheme) and i19 (per-agent sid trailer) | **Blast radius**: dev-loop only
- **From**: ideator-02. Single-source.
- **Synergy-with**: i07 (one namespace, distinguished by ref type — `refs/stash/...` vs `refs/heads/gin/...`).

### Cluster I — Observability surface (refuse-to-be-silent)

#### i38 — Autosync emits loud telemetry before any destructive op

- **One-line**: Pre-destructive: emit `systemMessage` in agent transcript, file `dx his rate friction_lost_work=95 --as=claude --trigger=auto`, write zettel stub, dump diff to `~/.dx/last-words/`.
- **Why**: Invisible failure is worse than noisy failure (z086). Even if destructive op proceeds, trail is forensically reachable, not hidden in reflog archeology.
- **Cost-to-try**: small (3-4 emits in autosync path) | **Reversibility**: easy | **Prerequisites**: none. Composes with i06 | **Blast radius**: telemetry only
- **From**: ideator-03. Single-source.
- **Synergy-with**: i06 (i06 changes behavior; i38 changes surface — both wanted; i38 protects against future regressions of i06). **Absorbs i10** (`~/.dx/last-words/` mechanism).

#### i39 — Three-color storm gauge in agent status line (R/A/G)

- **One-line**: Green = lone agent + clean tree; Amber = 2-3 agents + clean tree; Red = N agents OR stash > 10 OR commit-eat in last 30 min. Visible to every Gin every turn.
- **Why**: Visibility wired into the surface every agent already sees. Behavior changes (i24) feed off the same signal — gauge *is* the mode indicator.
- **Cost-to-try**: small (status-line script + queries) | **Reversibility**: easy | **Prerequisites**: i24 (defines signal sources). Without i24, i39 has to compute itself (still doable, redundant) | **Blast radius**: telemetry only
- **From**: ideator-03. Single-source.
- **Synergy-with**: i24, i41 (same data, three presentations).

#### i40 — `dx tree-tail` streams working-tree status with agent attribution

- **One-line**: Live stream of which files are becoming dirty/clean and which agent (sid) made the change. Run in side terminal during a storm to literally watch it unfold.
- **Why**: Watching the storm rather than guessing. Companion to i30 (i30 announces intent; i40 records actual).
- **Cost-to-try**: medium (watch FS + map paths to active sids via i17 + render) | **Reversibility**: easy | **Prerequisites**: i17 (per-session touched files for attribution). Without i17, paths only | **Blast radius**: telemetry only
- **From**: ideator-03. Single-source.
- **Synergy-with**: i30 (could share substrate — events store; tree-tail is a query, narration is a feed).

#### i41 — Pre-flight push-readiness 0-100 score

- **One-line**: Read the number, decide. 0 = don't push, 100 = clean shot. Computed from working-tree mix, stash count, push-fail rate over last 30 min, time since last successful push.
- **Why**: Numerical decision support — collapses storm signals into one legible value. Useful as input to i33, gate inside i20, status-line companion to i39.
- **Cost-to-try**: small (computed-on-demand from same signals i24 uses) | **Reversibility**: easy | **Prerequisites**: i24 (storm signals). Synergy with i20 (feature inside it) | **Blast radius**: telemetry only
- **From**: ideator-03. Single-source.

#### i42 — Don't change autosync v1; add observability first; design fix from data

- **One-line**: Run cluster-I (i38, i39, i40, i41, i43) for one week before touching cluster B (i06, etc.). Let data shape the cluster-B fix.
- **Why**: Lihu's process-over-outcome (z086). We have *theories* about which Mode-1 / Mode-2 collisions happen most; we don't have *counts*. Cluster B's specific shape (orphan vs tombstone vs CAS) should be data-driven.
- **Cost-to-try**: small as posture (only the discipline; cluster-I ideas have own costs) | **Reversibility**: easy (sequencing decision) | **Prerequisites**: none upstream. Downstream: gates ALL of cluster B (and parts of A and E) on shipping cluster I first | **Blast radius**: dev-loop sequencing
- **From**: ideator-03. Single-source.
- **Refiner notes**: **Meta and load-bearing.** Sequencing constraint that affects how prioritize ranks cluster B. Tension with following 5/5 convergence on i06. Prioritize must rule on this explicitly: if accepted, cluster B drops in round 1; if rejected, surface why.

#### i43 — Cron-driven digest of storm metrics across sessions

- **One-line**: Daily/weekly mailed summary: top 5 commit-eats, collision modes, agent push success rates, stash growth curve. Builds on `dx his digest` pattern.
- **Why**: Patterns surface across sessions, not just within one. Companion to i36 (per-event log).
- **Cost-to-try**: small (clones existing `dx his digest --since-last --markdown` pattern) | **Reversibility**: easy | **Prerequisites**: i38, i36 | **Blast radius**: telemetry only
- **From**: ideator-03. Single-source.
- **Refiner notes**: Direct-clone of existing `dx his digest`. High confidence, low effort, leverages working tooling.

### Cluster J — Heavy primitives

#### i44 — CRDT-backed virtual filesystem; commits are CRDT-state projections

- **One-line**: Two agents touching the same file no longer race — CRDT layer merges their edits, and a git commit is a snapshot of merged state.
- **Why**: Eliminates "two agents touched same file" as a class of failure. Many cluster B/C/D ideas become unnecessary.
- **Cost-to-try**: large (multi-quarter; off-the-shelf CRDTs are document-CRDTs, not file-tree-CRDTs; mapping to git is hard) | **Reversibility**: one-way (data migration) | **Prerequisites**: lots — i11 substrate, i17 attribution, complete edit-pipeline rewrite | **Blast radius**: dev-loop primary, deep ripple
- **From**: ideator-02, ideator-05. **CONVERGENT 2/5.**
- **Refiner notes**: Vision, not try-this-Tuesday. North star that justifies smaller moves (i11, i12, i17). Treat as long-horizon research-track.

#### i45 — Append-only `(sid, edit, ts)` event log; tree is projection; recovery = replay

- **One-line**: Lost work becomes structurally impossible because source-of-truth is the edit log, not the tree. Many cluster B recovery ideas (i07, i08, i10, i35) collapse into "replay from last good event".
- **Why**: Inverts ontology — if tree is projection, "tree got reset" means nothing; the log replays.
- **Cost-to-try**: large (every Edit/Write must hit log atomically; concurrent replay must converge) | **Reversibility**: one-way (removing log loses history) | **Prerequisites**: i17 is v0 of the log. PostToolUse hooks capture input. Walking i17 → i45 is plausible | **Blast radius**: dev-loop primary; storage growth concern
- **From**: ideator-02. Single-source.
- **Refiner notes**: Smaller cousin of i44. Stepping stone to i44 if/when this direction is committed.

#### i46 — *(Refined-merged-into: i45)* WAL-style commit journal

- **Status**: **Refined-merged-into: i45.** WAL is i45's implementation strategy; preserved forward (principle 02 — never delete) but no longer ranked separately.
- **Original one-line**: Every staged file write goes through `.gin/wal/<seq>.json` before touching the tree; recovery replays the WAL.
- **Refiner-05 recommendation**: i45 (event-sourcing) is the ontology; i46 (WAL) is the implementation primitive. If we go this direction, do i45's framing with i46's mechanism.
- **From**: ideator-02. Single-source.

#### i47 — Use `jj` (Jujutsu) as the agent's git surface

- **One-line**: jj sits on top of git refs (team's `git` workflow keeps working) but gives agents better concurrent semantics — conflicts are first-class objects, not error states.
- **Why**: Many cluster B/C/D ideas exist because git's model fights us. jj fights us less.
- **Cost-to-try**: large (every agent's git muscle memory retraining; every hook needs jj equivalent; `dx ship` rewrites) | **Reversibility**: hard (once tooling assumes jj abstractions, reverting loses them) | **Prerequisites**: none mechanically (jj installs cleanly); practically i20 as abstraction layer hiding git/jj choice | **Blast radius**: dev-loop only — but touches every agent's mental model
- **From**: ideator-05. Single-source.
- **Conflicts-with**: i20/i21 if interpreted as "wrap git" (jj would replace, not wrap). Topic.md says "no replacing git" — borderline read since jj uses git refs. **Needs explicit human ruling before prioritize.**

### Cluster K — Reframings (architectural forks)

#### i48 — Replace pre-push with post-push CI as the only gate

- **One-line**: Local push always succeeds; `main` is treated as a queue and CI promotes commits forward only when green (revert-on-red). We do this for staging — extend to main.
- **Why**: If pre-push is duplicate of CI, delete pre-push; CI is single source of truth. Eliminates entire local-vs-tree-vs-diff debate.
- **Cost-to-try**: medium (revert-on-red automation, status notification, story for "CI broken so nobody can land") | **Reversibility**: easy at gate level (re-add pre-push); harder if revert automation lands and gets baked-in | **Prerequisites**: main-CI fast enough that revert-windows are tolerable; team agreement | **Blast radius**: dev-loop + production (changes contract for `main`)
- **From**: ideator-05. Single-source.
- **Conflicts-with (partial)**: i01–i05 (frames them as wrong-layer-fixes). If i48 lands, i01–i05 become moot. Pick a horizon in prioritize.

#### i49 — Two histories: `main-human` and `main-gin`, periodically reconciled

- **One-line**: Agents push to `main-gin`; humans push to `main-human`; daily/hourly reconcile job fast-forwards or surfaces conflicts. Pre-push between agents never blocks human pushes.
- **Why**: Solves cross-stream pre-push interference structurally — Gin-WIP can never block Lihu-push because they're not on the same ref.
- **Cost-to-try**: large (1+ weeks; reconcile job, conflict UX, deploy-target rethink) | **Reversibility**: hard (history bifurcation is sticky) | **Prerequisites**: decision on which ref deploys; reconcile policy; CI re-routing | **Blast radius**: production (deploy ref) + dev-loop
- **From**: ideator-05. Single-source.
- **Conflicts-with**: i51 (i51 kills `main` for agents entirely; i49 keeps it but splits it). Mutual exclusion — pick one.

#### i50 — Treat git as a cache of intent; canonical intent log is the source of truth

- **One-line**: Zisser (or some canonical intent log) holds what each agent meant to do; git is downstream projection. Lost commits, attribution, recovery all flow from intent log.
- **Why**: Reframes "Gin's commits got eaten" as a category error. Today, the work to attribute / recover / protect "Gin's commits" is fighting an ontology where the medium (git) is treated as the message.
- **Cost-to-try**: large (1+ months; intent-projection-to-git pipeline, recovery-from-intent UX, decision on what "intent" means) | **Reversibility**: one-way at architectural level | **Prerequisites**: canonical intent-log definition; projection tool; story for human edits | **Blast radius**: production + telemetry + corpus
- **From**: ideator-05. Single-source.
- **Refiner notes**: Deepest reframing. Most expensive; highest upside if it lands. Worth keeping as long-horizon ontology bet — even if not implemented, naming it changes how we think about i06–i10 and i19. **Recommend research-track only.**

#### i51 — Kill `main` in the agent layer — topic-graph instead

- **One-line**: Agents never push to `main` directly; each topic gets a branch (one-issue-one-branch), merge-to-main is a separate human-or-bot step.
- **Why**: z095's collision problem only exists *because* every agent shares one checkout pointing at one branch. If each topic owns its own branch, no shared `main` for cross-agent dirt to collide on.
- **Cost-to-try**: large (branch-per-topic spawn protocol, merge automation, CI-per-branch story, deployment policy) | **Reversibility**: hard | **Prerequisites**: i11 (worktree-per-agent) is near-prereq; merge automation; CI cost story | **Blast radius**: dev-loop + production
- **From**: ideator-05. Single-source.
- **Conflicts-with**: i49 (mutual exclusion). Pairs with i11/i13 (cluster C).

---

## Strongest convergent picks (≥4/5) — high-confidence inputs to prioritize

The seven ideas with the most independent agreement:

1. **i01** — Lint/test the diff, not the working tree (5/5)
2. **i06** — Autosync MUST NOT call `git reset HEAD~1` (5/5) — *load-bearing*
3. **i24** — First-class storm-mode state (5/5)
4. **i02** — Pre-push runs in clean ephemeral checkout (4/5)
5. **i07** — Push to `gin/orphan/<sha>` instead of resetting (4/5)
6. **i20** — `dx ship` wrapper as sanctioned write path (4/5) — *load-bearing for cluster E*
7. **i35** — `dx recover` / `dx unreset` one-command recovery (4/5)

Three 5/5 picks form the spine: reframe the gate (i01), stop destructive recovery (i06), name the storm as state (i24). The other four are high-confidence supports.

## Decisions deferred to prioritize

1. **i42 sequencing** — telemetry-first vs follow-convergence. Either accept i42 (cluster B drops in round 1) or reject and explain.
2. **i09 doctrinal carve-out** — does `--force-with-lease=origin/main:<seen-sha>` count as "force-push" under CLAUDE.md "NEVER force-push"? Spec-time gate.
3. **i19 author-name vs trailer split** — ship trailer-only (reversible) or author-name+trailer (forever-fact in git)?
4. **i47 jj scope** — borderline read of "no replacing git". Human ruling needed before prioritize.
5. **i28 vs i11/i13/i14 premise** — do we want parallelism at all? Premise conflict surfaces "the storm is the bug" question.
6. **i49 ⊕ i51 mutual exclusion** — pick one if/when cluster K becomes implementable.
7. **i48 vs i01–i05 horizon** — local gate fix vs delete-the-gate. Pick the layer.
8. **Recovery-surface bundle** (refiner-02 recommendation): rank i08+i35+i36 as a bundle, not three independent line items.
9. **i50 / i44 research-track flag** — park as long-horizon, not implementation-candidate?
10. **i34 disposition** — keep as standalone idea or hoist as cluster-G preamble?

## Hand-off

→ Ready for **prioritize** skill. Lock criteria.md (recommend default set: Impact / Effort / Confidence / Strategic Fit / Reversibility), spawn 3-5 prioritizers with mixed primings (pragmatic-PM / strategist / risk-conscious / evidence-driven-by-convergence), produce Borda + convergence-bucket views, surface the 10 deferred decisions as dilemmas in z026 shape.
