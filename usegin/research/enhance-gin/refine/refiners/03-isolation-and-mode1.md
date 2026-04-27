# Refiner 03 — Per-agent isolation (C) + Stage-only-what-you-authored (D)

Owns: i11–i19. Read whole pool, edited only this slice.

## Per-idea edit blocks

### i11 — Per-agent worktree as the default unit of isolation

- **Refined title:** Per-agent git worktree, materialized at session start.
- **One-line:** `dx session start` runs `git worktree add .gin/worktrees/<sid>/` so each agent gets its own working tree, sharing one objectdb. Agents physically cannot see each other's working tree.
- **Why:** git's native answer to "shared mutable directory" — solves Mode-1 (no stranger files exist in your tree) and z095 (your pre-push runs against your worktree only) in one move. ~5 lines in agent bootstrap.
- **Cost-to-try:** small (worktrees are git-native; bootstrap shim + cleanup-on-end)
- **Reversibility:** easy (delete the worktree dir; objectdb intact)
- **Prerequisites:** none (git already supports). Composes with i20 (`dx ship` becomes the per-worktree push verb).
- **Blast radius:** dev-loop only (no production code touched; agent FS layout changes)
- **Convergence with siblings (i12, i13):** **complement, not substitute.** i11 isolates the working tree; i12 isolates the staging area inside one tree; i13 isolates the whole machine. Stack: i11 alone solves Mode-1 + z095 cheaply. i12 is a sub-primitive of i11 (each worktree gets its own index for free) and only stands alone if we *don't* adopt i11. i13 is the heavy escalation when i11+i12 still leak (e.g. `node_modules` writes, port conflicts).

### i12 — Per-agent `GIT_INDEX_FILE`

- **Refined title:** Per-session `GIT_INDEX_FILE` env var.
- **One-line:** Each agent session exports `GIT_INDEX_FILE=.gin/sessions/<sid>/index`; `git add` from agent A is invisible to agent B's staging area.
- **Why:** git already supports this; eliminates Mode-1 staging collisions by construction with zero new code. Useful when worktrees (i11) are too heavy or not yet adopted.
- **Cost-to-try:** small (one env var in `dx session start`)
- **Reversibility:** easy (unset the var)
- **Prerequisites:** none. **Subsumed by i11** when i11 ships (each worktree owns its own index).
- **Blast radius:** dev-loop only
- **Relation to i11:** i12 is the cheap fallback when worktree-per-agent isn't viable. If i11 ships, i12 is automatic. Keep both in the pool — i12 is the "ship today, no FS reshuffle" v0.

### i13 — Per-agent VM / firecracker / fork

- **Refined title:** Per-agent microVM as the unit of isolation.
- **One-line:** Spawn a firecracker/Lima/devcontainer per agent; sync via git remote, not shared FS. Blast radius = the VM.
- **Why:** maximal isolation — solves Mode-1, z095, port conflicts, dependency drift, and runaway `rm -rf` in one model. Each agent is a real peer over git, not a co-tenant.
- **Cost-to-try:** large (VM provisioning, image baking, devcontainer parity, network plumbing, startup latency)
- **Reversibility:** hard (changes the operating model for spawning agents; rolling back means re-introducing shared-FS patterns)
- **Prerequisites:** decision on host (firecracker / Lima / nested devcontainer / Codespaces); image-building pipeline; agent↔git-remote auth model.
- **Blast radius:** dev-loop + corpus (changes how telemetry, session-resume, and zettel capture cross machines)
- **Relation to i11/i12:** **escalation tier.** i11 and i12 work *inside* one host; i13 says the host is the wrong unit. Pick i13 only if we observe i11-class isolation still leaking (shared `node_modules`, shared bun caches, shared `~/.dx/`, port collisions on `just agent-dev`). Conflicts loosely with `cross-machine sync out-of-scope` constraint in `topic.md` — note this.
- **Conflicts-with:** topic.md scope ("Cross-machine sync — assume single checkout"). i13 contradicts this constraint and would need explicit re-scoping.

### i14 — Read-only checkout + propose-via-PR

- **Refined title:** Shared tree is read-only; agents propose via machine-PRs into a queue.
- **One-line:** `chmod -R a-w` the shared tree. Agents work in scratch worktrees (cf. i15) and submit PRs into a queue; a broker serializes promotion.
- **Why:** serializes the storm into a line — the queue *is* the order. Removes shared-mutable-tree as a category.
- **Cost-to-try:** medium (broker, PR queue, agent education to never write into shared tree, chmod tooling)
- **Reversibility:** hard (changes commit→push→main shape into commit→propose→merge; agents have to be retrained)
- **Prerequisites:** broker daemon (overlaps with i21 `gin-commitd`). Composes with i15 (scratch trees are where work happens).
- **Blast radius:** dev-loop (write paths fundamentally change)
- **Relation to i11:** i14 is i11 + a serialization broker on top. i11 alone gives isolated worktrees; i14 says "and main is read-only, integration is brokered."

### i15 — Agents work in `~/scratch/<agent>/`, stage at commit-time

- **Refined title:** Scratch-tree workspaces; clean checkout used only for staging.
- **One-line:** Each agent's edits live in `~/scratch/<sid>/`; staging copies authored files into a clean checkout at commit-time. Working tree stops being a shared resource.
- **Why:** removes the "working tree is shared" assumption without committing to full worktree-per-agent (i11). Cheaper than i11 if we just need Mode-1 protection.
- **Cost-to-try:** medium (scratch→checkout copy step, conflict semantics when two agents staged the same path, tool-finding paths from `~/scratch/`)
- **Reversibility:** hard (agents' tool/test invocations now run from `~/scratch/`; reverting means retraining the loop)
- **Prerequisites:** decision on how dev-server / tests / lint find files outside the repo root; composes with i17 (touched-set is the staging manifest).
- **Blast radius:** dev-loop
- **Relation to i11:** **substitute, weaker.** i11 uses git's native worktree mechanism; i15 reinvents it with raw FS copies. Prefer i11 unless worktrees have a specific blocker. Keep i15 as a fallback / philosophical statement that working-tree-as-shared-resource is the problem.

### i16 — `git commit -- <paths>` everywhere; never `git add -A`

- **Refined title:** Explicit-path adds and commits; `git add -A` banned in agent code paths.
- **One-line:** Autosync (and any agent commit) uses `git commit -- <paths>` or `git add -u <paths>` against an explicit author-set; bare `git add -A` is a lint failure in `tools/dx/`.
- **Why:** one-line change kills Mode-1 (stranger files riding into your commit) at the git-command layer. The tool already supports it; we just stop using the wildcard.
- **Cost-to-try:** small (audit `tools/dx/` and `tools/bin/` for `add -A` / `commit -a`; rewrite to path-explicit; add a CI grep)
- **Reversibility:** easy (revert the rewrites)
- **Prerequisites:** **needs an authored-files set to pass to `--`.** This is the seam to i17 — without i17's touched-set, this idea has no source for `<paths>`. Standalone, it's "use `git diff --cached --name-only` of an already-curated index," which only works if i12 (per-session index) is in place.
- **Blast radius:** dev-loop only
- **Relation to i17:** **i16 is the verb; i17 is the noun.** They naturally pair. Could merge as one idea ("authored-set tracking + explicit-path commit") but keep separate because i16 is a same-day cleanup (audit + rewrite) and i17 is a hook subsystem with its own design surface.

### i17 — Per-session "files I touched" set

- **Refined title:** PostToolUse-tracked authored-set; commits refuse out-of-set files.
- **One-line:** A PostToolUse hook on Edit/Write logs each touched file to `.gin/sessions/<sid>/touched.jsonl`; `dx commit` and autosync refuse to add anything outside that set.
- **Why:** the Edit/Write hooks already know what we authored — use that set as the commit manifest instead of inferring from working-tree dirt. Closes the Mode-1 hole that i16 alone leaves (`<paths>` has to come from somewhere).
- **Cost-to-try:** small (PostToolUse hook + jsonl appender + commit-time filter — all in `.claude/` and `tools/dx/`)
- **Reversibility:** easy (disable the hook; remove the filter)
- **Prerequisites:** none (PostToolUse hooks are settled infra). Provides the noun that i16 needs.
- **Blast radius:** dev-loop + telemetry (jsonl is also useful as session-shape data)
- **Relation to i16:** see above — they pair. Don't merge but always ship together.
- **Relation to i19:** see i19 below — i17's touched-set is the source-of-truth for who-authored-what; i19's trailer makes that fact survive into git-log even when the touched-set file is later cleaned up.

### i18 — Commit-message footer auto-annotates "captured stranger files"

- **Refined title:** `Autosync-stranger-files:` trailer when sweep happens.
- **One-line:** Even when autosync sweeps non-authored files into a commit, append `Autosync-stranger-files: a.tsx, b.ts ...` as a commit trailer. Attribution survives in `git log` itself.
- **Why:** turns silent collision into a visible audit trail. Recovery becomes `git log --grep 'Autosync-stranger-files'` instead of a forensics session.
- **Cost-to-try:** small (commit-msg hook or wrapper; uses i17's touched-set vs index diff)
- **Reversibility:** easy (drop the trailer)
- **Prerequisites:** i17 (need authored-set to compute "stranger" delta).
- **Blast radius:** dev-loop + corpus (commit messages — the corpus that survives)
- **Note:** this is a *failsafe* — it assumes Mode-1 still happens. If i16+i17 together actually prevent stranger-file capture, i18 should fire never. Keep it because "should fire never" is the wrong base rate to design around — file-system anomalies (autosync timing, `.gitignore` misses, tool-side mass writes) will produce surprises.

### i19 — Per-agent commit author identity / Agent-Session trailer

- **Refined title:** `GIT_AUTHOR_NAME=gin-<sid>` + `Agent-Session: <id>` trailer on every agent commit.
- **One-line:** Every agent commit carries forensically-traceable identity in author + trailer; `git log --grep 'Agent-Session: <sid>'` becomes the recovery tool.
- **Why:** even when files mix (Mode-1 leaks past i16/i17/i18) or commits get reset (Mode-2), attribution survives in the commit object and reflog. Cheapest defense-in-depth layer.
- **Cost-to-try:** small (env var in `dx session start`; commit-msg hook for trailer)
- **Reversibility:** easy
- **Prerequisites:** **stands alone.** Does NOT depend on i17 — it's per-commit metadata, independent of touched-set tracking. (Question in mandate answered: *independent.*) But i17+i19 compose well: trailer + touched-set together let us reconstruct "agent X authored these files in session Y" even after a destructive event.
- **Blast radius:** corpus (commit history — durable; affects what `git log` looks like for everyone forever)
- **Note on author identity:** changing `GIT_AUTHOR_NAME` per agent is a *forever* corpus mutation — every commit will show `gin-<sid>` instead of `oria` / `lihu` / etc. This is desirable for forensics but Lihu should sign off explicitly; we're trading "commit blames a human" for "commit blames a session id." The trailer-only variant is reversible; the author-name variant is not.

---

## Cross-slice notes & dups spotted

- **i11 ↔ i02 (refiner 01's slice).** i02 is "pre-push runs in clean ephemeral checkout"; i11 is "agents already work in their own worktree." If i11 ships, i02 collapses into "the worktree IS the ephemeral checkout — pre-push there." Worth flagging to refiner 01 as a relation.
- **i14 ↔ i21 (refiner 04's slice).** i14 needs a broker; i21 is `gin-commitd` daemon. They are the same primitive at different framings. Refiner 04 should cross-link.
- **i15 ↔ i23 (refiner 04).** i23 ("push-by-intent") presupposes something like i15 — agent's "labeled changes only" is i17's touched-set rendered on top of i15's scratch tree.
- **i17 ↔ i31 (refiner 05).** i31's "etiquette doc" rule "never autosync untracked files I haven't seen" is the convention version of i17's hook-enforced version. Convention vs. infrastructure pair.
- **i18 ↔ i32 (refiner 05).** Both are "make collisions visible / inspectable in git." i32 is reset-side; i18 is commit-side; complementary not duplicate.
- **i19 ↔ i36 (refiner 02 — `dx commit-eats`).** i36's SQLite log of resets is the runtime side; i19's trailer is the durable-corpus side. Together they form the recovery substrate.

## Conflicts noted

- **i13 conflicts with topic.md scope** ("Cross-machine sync — assume single checkout"). Either re-scope topic.md or downgrade i13 to "single-host VM-per-agent (Lima/devcontainer)" which fits the constraint.
- **i19 author-name variant has irreversibility tension.** Author identity is a forever-fact in git. Recommend prioritize-time decision: trailer-only (reversible) vs. author-name+trailer (forever).

## Friction zettels

None this round — slice was internally coherent and topic.md was clear.

## Open questions for orchestrator (≤3)

1. **Should i12 be marked `Refined-merged-into: i11`?** Mechanically i12 is subsumed by i11 (each worktree gets its own index). I left them separate because i12 is a viable v0 if i11 has any blocker (e.g. tool-finding-paths assumes one tree). Orchestrator: confirm or merge.
2. **i13 scope conflict.** Topic.md says single-checkout assumption; i13 violates. Keep with conflict-noted, downgrade to single-host-VM, or drop?
3. **i19 author-name vs. trailer split.** Worth splitting into i19a (trailer, reversible) and i19b (author-name, forever) so prioritize ranks them separately?
