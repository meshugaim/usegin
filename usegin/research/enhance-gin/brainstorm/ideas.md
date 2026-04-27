# Ideas — enhance Gin (survive multi-agent storms)

> Source: brainstorm round, 2026-04-27, 5 ideators.
> Frame: `usegin/research/enhance-gin/brainstorm/topic.md`
> Raw: 158 ideas. Merged: 51 distinct claims.

## Pool

### Cluster A — Diff-scoped pre-push gate (kill z095 root cause)

- **i01: Lint/test the diff, not the working tree.** Pre-push hook scopes lint + tsgo + tests to `git diff origin/main..HEAD --name-only`, ignores working-tree dirt entirely.
  - **One-line**: pre-push gates the artifact being pushed, not ambient state
  - **Why**: z095's root cause; doc-only pushes get blocked by other-agent broken slack imports
  - **From**: ideator-01 (#1 lint-the-diff), ideator-02 (#15 principled fix), ideator-03 (push-readiness, blast-radius report), ideator-04 (#13, #18 push-judged-on-diff), ideator-05 (#15, #17 stop-linting-whole-tree). **CONVERGENT 5/5.**
  - **Refined**: *(refine)*
  - **Rank**: *(prioritize)*
  - **Rationale**: *(prioritize)*

- **i02: Pre-push runs in clean ephemeral checkout/clone.** Hook does `git worktree add /tmp/precheck-<sha>` and lints/tests there; working tree is invisible to the gate.
  - **Why**: variant of i01 with stronger isolation guarantee — the artifact under test physically equals the artifact being pushed
  - **From**: ideator-02 (#16), ideator-04 (#20 dx ship in clone), ideator-05 (#15, #16). **CONVERGENT 4/5.**

- **i03: `git stash -u` before pre-push, pop after.** 5-line wrapper variant of i01/i02 — cheap immediate fix.
  - **Why**: smaller blast radius than full reimplementation; might be the v0
  - **From**: ideator-01 (#2). Single-source.

- **i04: Pre-push only fails on errors in YOUR commit's files.** Even keeping whole-tree lint, post-process to filter errors by `diff --name-only`.
  - **Why**: ~10 lines of grep, drop-in fix that doesn't change lint runtime
  - **From**: ideator-01 (#24). Single-source.

- **i05: Skip pre-push entirely for usegin/research/zettel-only changes.** Path-filter fast-path: if all changed files are `*.md` or `usegin/**`, skip TS/test.
  - **Why**: 90% of zettel pushes need zero TS check; same-turn fix
  - **From**: ideator-01 (#13, #14). Single-source.

### Cluster B — Stop the destructive recovery (autosync never resets)

- **i06: Autosync MUST NOT call `git reset HEAD~1` on push failure.** Any autosync-eaten commit is a contract violation.
  - **One-line**: replace with side-branch park, tombstone ref, or just-leave-the-commit
  - **Why**: this single change kills the 4-commits-eaten loss vector observed this session
  - **From**: ideator-01 (#3 disable entirely, #4 push-to-orphan, #21 reflog-tag-before-reset), ideator-02 (#11 append-only, #29 CAS no-reset, #39 tombstone-and-revive), ideator-03 (refuse-to-be-silent, last-words log), ideator-04 (#21 blame-free reset, #16 reset-only-own-commits), ideator-05 (#18 push-to-quarantine, #20 no resets ever). **CONVERGENT 5/5.**
  - **Refined**: *(refine)*

- **i07: On push failure, push to `gin/orphan/<sha>` instead of resetting.** Cheap side-branch dump, never lose work.
  - **Why**: one extra `git push origin HEAD:refs/heads/gin/orphan/$(git rev-parse --short HEAD)`; commit always survives
  - **From**: ideator-01 (#4), ideator-02 (#10 gin/abandoned, #21 outbox, #22 storm side-branch), ideator-04 (#17 side-branch-by-default), ideator-05 (#18 quarantine, #19 promotion-separate-event). **CONVERGENT 4/5.**

- **i08: Tombstone-and-revive: any reset writes `refs/gin/tombstones/<sha>` first.** Refuses if tombstone-write fails. `dx revive <prefix>` lists and one-command-restores.
  - **Why**: soft-delete pattern — never lose data even when asked to
  - **From**: ideator-02 (#39), ideator-04 (#21 blame-free reset). **CONVERGENT 2/5.**

- **i09: CAS push (compare-and-swap loop), never reset.** Read `origin/main`, compute new commit on top, push with `--force-with-lease=origin/main:<seen-sha>`, on fail rebase and retry.
  - **Why**: CAS is the universal primitive for safe concurrent updates
  - **From**: ideator-02 (#29), ideator-01 (#18 push retry with backoff). **CONVERGENT 2/5.**

- **i10: "Last words" log: dump `git diff HEAD~1 HEAD` to `~/.dx/last-words/<sha>.diff` before any destructive op.** Even if reset succeeds, content recoverable from a friendly path.
  - **Why**: belt-and-suspenders for reflog
  - **From**: ideator-03. Single-source.

### Cluster C — Per-agent isolation (worktrees / index / VMs)

- **i11: Per-agent git worktree as the default.** `dx session start` materializes a worktree under `.gin/worktrees/<sid>/` sharing one objectdb. Agents physically can't see each other's working tree.
  - **Why**: git's built-in solution to "shared mutable directory"; ~5 lines in agent bootstrap
  - **From**: ideator-01 (#17), ideator-02 (#9, #10), ideator-05 (#1 one-agent-per-worktree). **CONVERGENT 3/5.**

- **i12: Per-agent git index file (`GIT_INDEX_FILE`).** Set per-session env var so each agent has its own staging area; `git add` from agent A never sees agent B's staged files.
  - **Why**: git already supports this; eliminates Mode-1 collisions by construction; zero new code
  - **From**: ideator-01 (#11), ideator-02 (#20). **CONVERGENT 2/5.**

- **i13: Per-agent VM / firecracker / fork.** Unit of isolation is the machine, not the directory. Cheap microVM per spawn; sync via git remote, not shared FS.
  - **Why**: maximal isolation; each agent's blast radius is its own VM
  - **From**: ideator-05 (#7, #8, #13). Single-source (multi-flavor).

- **i14: Read-only checkout + propose-via-PR.** The shared tree is `chmod -R a-w`. Agents work in scratch worktrees and submit machine-PRs into a queue.
  - **Why**: serializes the storm into a line; the queue *is* the order
  - **From**: ideator-05 (#4). Single-source.

- **i15: Agents work in `~/scratch/<agent>/`, files staged into clean checkout only at commit-time.** "Working tree" stops being a shared resource.
  - **Why**: removes the assumption that working tree is shared
  - **From**: ideator-05 (#26). Single-source.

### Cluster D — Stage only what you authored (kill Mode-1 collision)

- **i16: `git commit -- <paths>` everywhere; never `git add -A`.** Autosync uses explicit-path adds + commits.
  - **Why**: one-char change ends Mode-1 (stranger files riding into commits); the tool already supports it
  - **From**: ideator-01 (#10 commit -o not -a, #16 add -u not add -A), ideator-03 (Mode-1 detector, pre-commit refuses unauthored), ideator-04 (#19 untracked-unborn, #36 Agent-Session trailer). **CONVERGENT 3/5.**

- **i17: Track per-session "files I touched" set; refuse to commit anything outside it.** PostToolUse hook on Edit/Write logs each touched file to `.gin/sessions/<sid>/touched.jsonl`; commit refuses unauthored files.
  - **Why**: the Edit/Write hooks already know what was edited — use that set instead of reading working tree
  - **From**: ideator-01 (#12 refuse-when-stranger), ideator-01 (#27 use PostToolUse-tracked set), ideator-03 (Mode-1 detector). **CONVERGENT 2/5.**

- **i18: Commit-message footer auto-annotates "captured stranger files".** Even when sweep happens, the footer says `Autosync-stranger-files: a.tsx, b.ts...` so attribution survives.
  - **Why**: turns silent collision into a visible audit trail in `git log` itself
  - **From**: ideator-03. Single-source.

- **i19: Per-agent commit author identity / Agent-Session trailer.** `GIT_AUTHOR_NAME=gin-<sid>` or `Agent-Session: <id>` in commit message footer.
  - **Why**: even when files mix, attribution is forensically traceable; `git log --grep '[agent=...]'` becomes the recovery tool
  - **From**: ideator-01 (#5), ideator-03 (per-agent prefix), ideator-04 (#36 protocol-level). **CONVERGENT 3/5.**

### Cluster E — `dx push` / `dx ship` as the sanctioned write path

- **i20: `dx push` / `dx ship` wrapper replaces raw `git push` for agents.** Encodes diff-only checks + side-branch fallback + reflog tag + storm-aware behavior in one place.
  - **Why**: one place to fix; all agents inherit; bare `git push` becomes a smell
  - **From**: ideator-01 (#6), ideator-02 (#13 commitd daemon, #21 outbox), ideator-04 (#11 push-as-protocol), ideator-05 (#3 explicit dx push, #18 enqueue-and-retry). **CONVERGENT 4/5.**

- **i21: Single `gin-commitd` daemon owns push to `main`.** Agents enqueue `(sha, branch, intent)` to a local socket; daemon serializes, lints diff-only, fast-forwards or rejects.
  - **Why**: single-writer-multiple-reader is the classic concurrency primitive; eliminates push races
  - **From**: ideator-02 (#13), ideator-05 (#12 Zisser-as-write-gate). **CONVERGENT 2/5.**

- **i22: Outbox pattern.** Agents commit to local refs only; a separate `outbox` worker drains commits to `origin/main` with retry+backoff and dead-letter to `refs/gin/dlq/<sid>`.
  - **Why**: outbox decouples local progress from remote availability
  - **From**: ideator-02 (#21). Single-source.

- **i23: Push-by-intent, not push-by-diff.** Agent declares "I want to ship the marketplace docs"; broker assembles a clean commit from the agent's labeled changes only, regardless of what else is in the tree.
  - **Why**: removes the "your diff includes everyone's WIP" ontology
  - **From**: ideator-05 (#25). Single-source.

### Cluster F — Storm detection & adaptive mode

- **i24: First-class storm-mode state.** Three modes: paranoid / normal / yolo. Detection signals: stash count > 5, push-fail rate > 50% in last hour, >2 active agents (heartbeat). Mode picks pre-push behavior, autosync side-branching, etc.
  - **Why**: storms are normal weather; we have storm gear
  - **From**: ideator-01 (#19 stash-count meter, #36 just slow down), ideator-02 (#22 backpressure, #31 storm detector), ideator-03 (storm-status, status-line gauge, push-budget), ideator-04 (#15 quiet hour, #22 storm-as-state, #30 three-mode autosync), ideator-05 (#22 detect-and-refuse, #27 storm-is-the-bug). **CONVERGENT 5/5.**

- **i25: `dx storm-status` live one-liner.** Shows N agents touching tree, autosync in-flight, stash count, push-fail rate over last 30 min. Wire into status-line.
  - **Why**: visibility before action
  - **From**: ideator-03 (multiple). Single-source (heavily 03's territory).

- **i26: `dx wait-for-clean-tree` primitive.** Polls `git status --porcelain` with timeout; called automatically by `dx ship` when storm-level > 1.
  - **Why**: cheapest "defer push when storm in progress" primitive; z095 already names this
  - **From**: ideator-01 (#7), ideator-04 (#26 promote it). **CONVERGENT 2/5.**

- **i27: Side-branch-by-default for storms.** When `dx storm-level >= 2`, `dx ship` auto-pushes to `gin/<sid>/<topic>` and opens a PR-into-main; main only receives integrated work.
  - **Why**: in a storm, main is read-mostly
  - **From**: ideator-04 (#17), ideator-05 (#19 promotion-separate). **CONVERGENT 2/5.**

- **i28: Cap concurrent agents at 1 by default.** Spawning multiple requires explicit handshake from human.
  - **Why**: questions whether parallelism is needed; makes the cost visible at spawn time
  - **From**: ideator-05 (#22, #23). Single-source.

### Cluster G — Coordination via convention/protocol (not infrastructure)

- **i29: Path-prefix claim/lock.** `dx claim nextjs-app/components/slack/` writes a short-lived lockfile under `.gin/claims/`; pre-push refuses unclaimed agent's touch on claimed prefix.
  - **Why**: shards shared-mutable into per-shard-mutable; lock-free reads still work
  - **From**: ideator-02 (#28 sharded ownership), ideator-04 (#10 codify-the-claim). **CONVERGENT 2/5.**

- **i30: Agent-to-agent narration channel.** Tiny pub/sub (Redis/file/socket) where agents post "I'm about to touch X" / "I just touched X". Coordination *before* commit, not after collision.
  - **Why**: prevents collision at the source; pour-and-process generalized to Gin↔Gin
  - **From**: ideator-04 (#39 storm-pour), ideator-05 (#11 agent-to-agent channel, #34 WIP.md, #35 plan-bus). **CONVERGENT 2/5.**

- **i31: Multi-agent etiquette doc at `usegin/etiquette.md`.** Five rules every Gin agrees to: don't reset commits I didn't author; declare path-prefix; never autosync untracked files I haven't seen; etc. Loaded into every agent's CLAUDE.md.
  - **Why**: convention as code, not infrastructure
  - **From**: ideator-04 (#14, #26 working-agreement-injected). Single-source (multi-flavor).

- **i32: "Gin doesn't reset Gin" hook.** Hook on `git reset HEAD~` checks last-commit author trailer; blocks if it's a different sid; requires `dx amnesty <reason>` to override.
  - **Why**: convention encoded in muscle memory
  - **From**: ideator-04 (#16, #24). Single-source.

- **i33: Push-as-proposal with cancellation window.** `dx ship` opens a 30-second window; sibling agents can `dx contest` if their work would conflict.
  - **Why**: pushing becomes consent-seeking in a multi-agent regime
  - **From**: ideator-04 (#33). Single-source.

- **i34: Asymmetry: humans push commands, Gins push proposals.** A human's `git push` is direct; a Gin's `dx ship` is mediated.
  - **Why**: agents in plurality need different rules than the single human
  - **From**: ideator-04 (#34). Single-source.

### Cluster H — Recovery as one command

- **i35: `dx recover` / `dx unreset` lists last N reflog entries with diffstat, prompts "restore which?".** Most code is already in `git reflog`.
  - **Why**: turns "investigation" into a menu
  - **From**: ideator-01 (#23), ideator-02 (#34 reflog-as-recovery API), ideator-03 (commit-eats show, reflog dashboard), ideator-04 (#27 recovery-same-shape-as-bug). **CONVERGENT 4/5.**

- **i36: `dx commit-eats` counter + show + recover.** SQLite-backed log of every silent reset; `dx commit-eats recover <id>` cherry-picks back.
  - **Why**: friction with the storm becomes telemetry; humans see the cost
  - **From**: ideator-03. Single-source.

- **i37: Hash-chain stash naming for findability.** `gin/<sid>/<parent-sha>/<intent-hash>` form a chain; `dx unstash` walks it deterministically.
  - **Why**: 27-stash explosion becomes greppable, idempotent
  - **From**: ideator-02 (#25). Single-source.

### Cluster I — Observability surface (refuse-to-be-silent)

- **i38: Refuse-to-be-silent autosync.** Before any destructive op: emit a loud `systemMessage`, file `dx his rate friction_lost_work=95`, write a zettel stub.
  - **Why**: invisible failure is worse than noisy one
  - **From**: ideator-03. Single-source.

- **i39: Status-line storm gauge (R/A/G).** Green = lone agent, Amber = 2-3 agents + clean tree, Red = N agents OR stash > 10 OR recent commit-eat. Behavior changes follow color.
  - **Why**: visibility wired into the surface every agent already sees
  - **From**: ideator-03. Single-source.

- **i40: `dx tree-tail` like `tail -f` for the working tree.** Shows files becoming dirty/clean in real time with agent attribution.
  - **Why**: watching the storm rather than guessing
  - **From**: ideator-03. Single-source.

- **i41: `dx push-readiness` 0-100 score.** Pre-flight factoring tree-owner mix, stash count, push-fail rate, time since last successful push.
  - **Why**: read the number, decide
  - **From**: ideator-03. Single-source.

- **i42: Telemetry-first migration.** Don't change autosync v1 behavior at all; just add the observability layer. Run for a week, design the fix from data.
  - **Why**: Lihu's "process over outcome" — measure before mutating
  - **From**: ideator-03. Single-source.

- **i43: Periodic team digest (cron, mailed).** Top 5 commit-eats, collision modes, agent push success rates, stash growth curve.
  - **Why**: patterns surface across sessions, not just within one
  - **From**: ideator-03. Single-source.

### Cluster J — Heavy primitives (CRDT / event-sourced / jj)

- **i44: CRDT-backed virtual filesystem on top of git.** Conflicts merge automatically in CRDT layer; commits are projections.
  - **Why**: removes the "two agents touched same file" race entirely
  - **From**: ideator-02 (#12 MVCC overlayfs, #18 CRDT messages, #19 vector clocks), ideator-05 (#21 CRDT FS). **CONVERGENT 2/5.**

- **i45: Event-sourced session state.** Append-only log of `(sid, edit, ts)`; working tree is a projection. Recovery = replay.
  - **Why**: lost work becomes structurally impossible
  - **From**: ideator-02 (#30). Single-source.

- **i46: WAL-style commit journal.** Every staged file write goes through `.gin/wal/<seq>.json` before touching working tree. Recovery replays WAL.
  - **Why**: write-ahead log is the canonical recovery primitive
  - **From**: ideator-02 (#24). Single-source.

- **i47: Replace `git` with `jj` (Jujutsu) for agent operations.** First-class concurrent branches, conflict-as-data not error. Sits on top of git refs.
  - **Why**: out-of-scope-says-no but jj might be in scope (uses git refs)
  - **From**: ideator-05 (#33). Single-source.

### Cluster K — Reframings / pre-push-stays-out-of-it

- **i48: Replace pre-push with post-push CI as the gate.** Push always succeeds locally; staging/main is a queue; CI promotes commits forward only when green. We do this for staging — extend to main.
  - **Why**: CI knows the actual gate; local hooks are duplicate work
  - **From**: ideator-05 (#28). Single-source.

- **i49: Two histories: `main-human` and `main-gin`, periodically reconciled.** Pre-push between agents never blocks human pushes; cross-stream conflicts surface in a daily reconcile.
  - **Why**: questions whether agents and humans should share authorship on `main`
  - **From**: ideator-05 (#30). Single-source.

- **i50: Treat git as a cache of intent, not source of truth.** Zisser holds the canonical intent log; git is a downstream projection.
  - **Why**: ontology shift — work to attribute/recover/protect "Gin's commits" is fighting an ontology error
  - **From**: ideator-05 (#36). Single-source.

- **i51: Kill `main` in the agent layer.** Agents work in topic-graph (issue-per-topic, branch-per-topic, no shared trunk between agents). Trunk-based was a human-team optimization.
  - **Why**: removes the shared-tree assumption entirely
  - **From**: ideator-05 (#37). Single-source.

---

## Convergence summary

| Convergence | Count | Cluster |
|---|---|---|
| 5/5 ideators | 3 | A (i01 diff-scoped pre-push), B (i06 no-reset autosync), F (i24 storm-mode-as-state) |
| 4/5 ideators | 4 | A (i02 ephemeral checkout), B (i07 side-branch-on-fail), E (i20 dx-ship wrapper), H (i35 dx-recover) |
| 3/5 ideators | 4 | C (i11 per-agent worktree), D (i16 explicit-path commit, i19 author trailer) |
| 2/5 ideators | 11 | i08, i09, i12, i17, i26, i27, i29, i30, i44, others |
| Single-source | 30 | (preserved as calibration) |

## Strongest convergent picks (≥4/5)

- **i01** — Lint/test the diff, not the working tree
- **i02** — Pre-push runs in clean ephemeral checkout
- **i06** — Autosync MUST NOT call `git reset HEAD~1`
- **i07** — On push failure, push to `gin/orphan/<sha>` instead of resetting
- **i20** — `dx push` / `dx ship` wrapper as the sanctioned write path
- **i24** — First-class storm-mode state (paranoid/normal/yolo)
- **i35** — `dx recover` / `dx unreset` one-command recovery from reflog

These are the prioritize round's high-confidence inputs.

## Hand-off

→ Ready for **refine** skill (legibility pass + add cost-to-try, reversibility, prerequisites, blast-radius fields per idea) → then **prioritize** with the seven 4/5+ picks as the high-confidence tier.
