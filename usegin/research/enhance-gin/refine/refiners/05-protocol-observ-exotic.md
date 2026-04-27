# Refiner 05 — Cluster G (coordination via convention) + Cluster I (observability) + Cluster J (heavy primitives)

Slice: i29–i34, i38–i43, i44–i47 (16 ideas).

Whole-pool read posture. Only edits the bullet-blocks for these ids; cross-slice
notes captured at bottom for the orchestrator.

---

## Cluster G — Coordination via convention/protocol

### i29 — Path-prefix claim/lock (`dx claim`)

- **Refined-title**: `dx claim <prefix>` writes a short-lived lockfile; pre-push refuses unclaimed touches on it.
- **Refined-one-line**: Convert "shared mutable directory" into "per-prefix mutable", lock-free reads stay free; conflicts become explicit, not implicit.
- **Refined-why**: This is the smallest primitive that converts a storm into a sharded storm. Each agent declares its territory; the pre-push hook (or a PreToolUse hook on Edit/Write) enforces. Lock has TTL so a crashed agent doesn't permanently fence a directory off.
- **Cost-to-try**: small (lockfile + 1 hook check + 1 pre-push assertion).
- **Reversibility**: easy (delete `.gin/claims/`, remove hook line, done).
- **Prerequisites**: i19 (per-agent author trailer / sid) so the hook can compare claim-owner to current sid. Without an sid, this idea has no teeth.
- **Blast radius**: dev-loop only.
- **Notes**: Conflicts-with: nothing structural, but **synergy** with i31 (etiquette) — claim is the enforcement primitive, etiquette the social rule. Without i29 the etiquette is honor-system; with i29 it has muscle.

### i30 — Agent-to-agent narration channel

- **Refined-title**: Pre-touch narration pub/sub between agents.
- **Refined-one-line**: Tiny pub/sub (file-tail or unix socket) where each agent announces "about to touch X" / "touched X"; sibling agents read before diving in.
- **Refined-why**: Pour-and-process generalized to Gin↔Gin (z087/z088). Coordinates *before* commit, not after collision. Compatible with z086 (the channel is observable, so failure modes accumulate as data, not silence).
- **Cost-to-try**: small (append-only file, tail consumer; no daemon needed for v0).
- **Reversibility**: easy (stop tailing, delete file).
- **Prerequisites**: i19 (sid/agent identity) so messages are attributable. Pairs naturally with i29 (claim) and i40 (tree-tail).
- **Blast radius**: telemetry + dev-loop. Doesn't touch production.
- **Notes**: Adjacent to i40 (tree-tail) — i40 watches the *tree*, i30 watches *intent*. Both useful, neither replaces the other. Could be the same SQLite/JSONL substrate.

### i31 — Multi-agent etiquette doc at `usegin/etiquette.md`

- **Refined-title**: Five-rule multi-agent etiquette injected into every CLAUDE.md.
- **Refined-one-line**: A short, load-bearing convention doc (don't reset commits I didn't author; declare path-prefix before deep work; don't autosync untracked files I haven't touched; etc.) loaded into every agent.
- **Refined-why**: Convention as code — z086 form (process-as-artifact). Useful even alone because Claude follows written conventions readily, but most powerful as the human-readable spec for the enforcement primitives (i29, i32, i17).
- **Cost-to-try**: small (one markdown file + one CLAUDE.md include).
- **Reversibility**: easy.
- **Prerequisites**: none structurally. **Soft prereq**: pairs with i29 (claim) and i32 (reset-blocker) — without enforcement the rules are advisory and will drift under pressure (z086 friction-loop). Worth shipping anyway as the *spec* the enforcement targets.
- **Blast radius**: docs only.
- **Notes**: Question the orchestrator should hold: is i31 useful *without* i29/i32? Yes for the same reason CLAUDE.md is useful without hooks — Claude follows written rules. But the durability is much higher with primitives. Recommend: ship i31 first, use it as the spec for i29/i32.

### i32 — "Gin doesn't reset Gin" hook

- **Refined-title**: PreToolUse hook on `git reset HEAD~` blocks cross-sid resets.
- **Refined-one-line**: Hook reads last-commit's `Agent-Session:` trailer; if it's a different sid than the current agent, block — require explicit `dx amnesty <reason>` to override.
- **Refined-why**: Encodes the etiquette (i31) in muscle memory. Single biggest behavioral guard against the 4-commits-eaten loss vector when paired with autosync changes (cluster B).
- **Cost-to-try**: small (one PreToolUse hook reading `git log -1 --format='%(trailers)'`).
- **Reversibility**: easy (remove hook).
- **Prerequisites**: **hard prereq i19** (Agent-Session trailer) — without sid in commits, the hook has nothing to compare. Pairs with i06 (autosync no-reset). Note: i06 fixes autosync; i32 also catches manual `git reset` from a confused agent. Both layers wanted.
- **Blast radius**: dev-loop only.
- **Notes**: Strong overlap with i06 (cluster B — refiner 02's slice). i06 is the *autosync behavior*, i32 is the *generic guard at the git level*. Both are needed because the failure shape (Gin A's commit gets reset) can come from autosync OR from a confused agent typing `git reset`. Recommend treating as complementary, not duplicates.

### i33 — Push-as-proposal with cancellation window

- **Refined-title**: `dx ship` opens a 30s cancellation window before push lands on `origin/main`.
- **Refined-one-line**: Pushing becomes consent-seeking — sibling agents can `dx contest` if their work would conflict, otherwise the proposal commits.
- **Refined-why**: In a multi-agent regime, pushing is no longer a private action (z095). The window converts collision-resolution from "after the fact and destructive" to "at the moment, conversational".
- **Cost-to-try**: medium (state machine + sibling notification + cancel path; not trivial).
- **Reversibility**: easy (skip the window when storm-level=0).
- **Prerequisites**: i20 (`dx ship` wrapper) — i33 lives inside it. Useful with i30 (narration channel) as the contest mechanism.
- **Blast radius**: dev-loop. Slows pushes by 30s in storms.
- **Notes**: Tension with z086 friction-loop — adding a 30s wait *is* friction; the question is whether the friction is well-placed. Probably yes only when storm-level ≥ 2 (so chain it with i24 mode).

### i34 — Asymmetry: humans push commands, Gins push proposals

- **Refined-title**: Different push semantics for humans vs Gins.
- **Refined-one-line**: A human's `git push` is direct; a Gin's `dx ship` is mediated (validation, cancellation window, side-branch fallback). The asymmetry is principled, not accidental.
- **Refined-why**: One human in the loop is a *single writer*; N Gins are *many writers*. Concurrency primitives differ. This idea is mostly an architectural framing that makes i20/i21/i33 coherent rather than feeling like agent-special-casing.
- **Cost-to-try**: small (the framing is free; the implementations are i20/i21/i33).
- **Reversibility**: easy (it's a framing).
- **Prerequisites**: none — it's a *principle* that justifies a cluster.
- **Blast radius**: docs (the framing) + whatever its implementations touch.
- **Notes**: This is more *principle* than *idea*. Worth keeping as canonical framing for the cluster but it's not actionable on its own. Recommend: merge as a header/preamble for the G cluster in the final pool, not as a standalone implementation candidate.

---

## Cluster I — Observability surface (refuse-to-be-silent)

### i38 — Refuse-to-be-silent autosync

- **Refined-title**: Autosync emits loud telemetry before any destructive op.
- **Refined-one-line**: Pre-destructive: emit a `systemMessage` in the agent's transcript, file `dx his rate friction_lost_work=95 --as=claude --trigger=auto`, write a zettel stub `usegin/zettel/zettels/zNNN-autosync-ate-<sha>.md`, dump `git diff HEAD~1 HEAD` to `~/.dx/last-words/`.
- **Refined-why**: Invisible failure is worse than noisy failure (z086). Even if the destructive op proceeds, the trail is forensically reachable rather than hidden in `git reflog` archeology.
- **Cost-to-try**: small (3-4 emits in the autosync path).
- **Reversibility**: easy (silence them again).
- **Prerequisites**: none. Composes with i06 (no-reset autosync) — i06 changes the *behavior*, i38 changes the *surface*. Both are wanted; i38 is necessary even after i06 because new destructive ops will be added later.
- **Blast radius**: telemetry only.
- **Notes**: **Crucial relationship with i06.** i06 says "autosync mustn't reset" (behavior). i38 says "if it ever does, it must scream" (observability). Both should ship — i38 protects against future regressions of i06. Adjacent to i10 (last-words log) — refiner 02's slice. Recommend i38 absorb i10's `~/.dx/last-words/` mechanism since they're the same instinct.

### i39 — Status-line storm gauge (R/A/G)

- **Refined-title**: Three-color storm gauge in the agent status line.
- **Refined-one-line**: Green = lone agent + clean tree; Amber = 2-3 agents + clean tree; Red = N agents OR stash > 10 OR commit-eat in last 30 min. Visible to every Gin every turn.
- **Refined-why**: Visibility wired into the surface every agent already sees. Behavior changes (i24 storm-mode) feed off the same signal — the gauge *is* the mode indicator.
- **Cost-to-try**: small (status-line script + a few queries).
- **Reversibility**: easy (remove status-line entry).
- **Prerequisites**: i24 (storm-mode-as-state) defines the signal sources. i39 surfaces what i24 already computes. Without i24, i39 has to compute it itself (still doable, but redundant).
- **Blast radius**: telemetry only.
- **Notes**: Strong synergy with i24 (refiner 04's slice). Likely should merge: i24 = state, i39 = surface of the same state. Treat as paired.

### i40 — `dx tree-tail` like `tail -f` for the working tree

- **Refined-title**: `dx tree-tail` streams working-tree status with agent attribution.
- **Refined-one-line**: Live stream of which files are becoming dirty/clean and which agent (sid) made the change. Run in a side terminal during a storm to literally watch it unfold.
- **Refined-why**: Watching the storm rather than guessing about it. Critical companion to i30 (narration) — i30 announces intent, i40 records actual.
- **Cost-to-try**: medium (watch FS + map paths to active sids via i17's touched.jsonl + render).
- **Reversibility**: easy.
- **Prerequisites**: i17 (per-session touched files) for attribution. Without i17, can still show paths but not attribution.
- **Blast radius**: telemetry only.
- **Notes**: Pairs with i30. Could share substrate (one events store; tree-tail is a query, narration is a feed).

### i41 — `dx push-readiness` 0-100 score

- **Refined-title**: Pre-flight push-readiness score factoring tree state, stash count, push-fail rate, recency.
- **Refined-one-line**: Read the number, decide. 0 = don't push, 100 = clean shot. Computed from working-tree mix, stash count, push-fail rate over last 30 min, time since last successful push.
- **Refined-why**: Numerical decision support — collapses the storm signals into one legible value. Useful as: input to i33 cancellation window, gate inside i20 `dx ship`, status-line companion to i39.
- **Cost-to-try**: small (computed-on-demand from the same signals i24 uses).
- **Reversibility**: easy.
- **Prerequisites**: i24 (storm signals) — i41 is a function over the same inputs. Synergy with i20 (sanctioned write path) — i41 is a feature inside it.
- **Blast radius**: telemetry only.
- **Notes**: Tight overlap with i24+i39 — same data source, different presentation. All three should share one "storm-state" module.

### i42 — Telemetry-first migration

- **Refined-title**: Don't change autosync v1 behavior; add observability first, design the fix from data.
- **Refined-one-line**: Run cluster-I (i38, i39, i40, i41, i43) for one week before touching cluster B (i06, i07, etc.). Let the data shape the cluster-B fix.
- **Refined-why**: Lihu's process-over-outcome (z086). Measure before mutating. We have *theories* about which Mode-1 / Mode-2 collisions happen most; we don't have *counts*. Cluster B's specific shape (orphan vs. tombstone vs. CAS) should be data-driven, not theory-driven.
- **Cost-to-try**: small as a *posture* — it costs only the discipline to ship cluster I first. The cluster-I ideas have their own costs.
- **Reversibility**: easy (it's a sequencing decision).
- **Prerequisites**: none upstream. Downstream: gates ALL of cluster B (and parts of A and E) on shipping cluster I first.
- **Blast radius**: dev-loop sequencing decision, not a code change in itself.
- **Notes**: **This is meta and load-bearing.** It's a sequencing constraint that affects how the prioritize round should rank cluster B. Should surface explicitly to the orchestrator as: *"if i42 is accepted, cluster B drops in priority for round 1, cluster I rises"*. It's also the most z086-aligned idea in the slice.

### i43 — Periodic team digest

- **Refined-title**: Cron-driven digest of storm-related metrics across sessions.
- **Refined-one-line**: Daily/weekly mailed summary: top 5 commit-eats, collision modes, agent push success rates, stash growth curve. Builds on `dx his digest` pattern.
- **Refined-why**: Patterns surface across sessions, not just within one. Companion to i36 (commit-eats counter, refiner 02's slice) — i36 is the per-event log, i43 is the rollup.
- **Cost-to-try**: small (clones the `dx his digest --since-last --markdown` pattern documented in `tools/dx/CLAUDE.md` lines 113-120).
- **Reversibility**: easy.
- **Prerequisites**: i38 (telemetry surface to digest from), i36 (commit-eats log). Without those, the digest has nothing to read.
- **Blast radius**: telemetry only (output is markdown to Slack/email).
- **Notes**: Direct-clone pattern from existing `dx his digest` — high confidence, low effort, leverages tooling that already works.

---

## Cluster J — Heavy primitives

### i44 — CRDT-backed virtual filesystem on top of git

- **Refined-title**: CRDT virtual FS where conflicts merge automatically; commits are CRDT-state projections.
- **Refined-one-line**: Two agents touching the same file no longer race — the CRDT layer merges their edits, and a git commit is a snapshot of the merged state.
- **Refined-why**: Eliminates "two agents touched same file" as a class of failure. Outcome: many of the cluster B/C/D ideas become unnecessary because there's nothing to collide on.
- **Cost-to-try**: **large** — building a correct, byte-stable, code-aware CRDT layer is a multi-quarter project. Off-the-shelf CRDTs (Yjs, Automerge) are document-CRDTs, not file-tree-CRDTs; mapping them to git's expectations is hard.
- **Reversibility**: **one-way** — once code is being written through the CRDT, ripping it out means data migration.
- **Prerequisites**: a *lot*. Realistically: i11 (per-agent worktree) as the substrate; i17 (touched-set) for attribution; a complete rewrite of the agent edit pipeline.
- **Blast radius**: dev-loop primary, but with deep ripple — every tool that reads/writes files must understand the CRDT.
- **Notes**: Honor the cost. This is a *vision*, not a *try-this-Tuesday*. Worth keeping in the pool as the **principled long-term shape** that justifies smaller moves (i11, i12, i17). Recommend the prioritize round treat it as "north star, not next move".

### i45 — Event-sourced session state

- **Refined-title**: Append-only `(sid, edit, ts)` log; working tree is a projection; recovery = replay.
- **Refined-one-line**: Lost work becomes structurally impossible because the source-of-truth is the edit log, not the tree.
- **Refined-why**: Inverts the ontology — if the tree is the projection, "tree got reset" means nothing; the log replays. Many of cluster B's recovery ideas (i07, i08, i10, i35) collapse into "replay from last good event".
- **Cost-to-try**: **large** — every Edit/Write tool call must hit the log atomically; concurrent replay must converge; incremental is hard.
- **Reversibility**: **one-way** — once the log is canonical, removing it loses history.
- **Prerequisites**: i17 (per-session touched files) is the v0 of the log. PostToolUse hooks on Edit/Write capture the input. Walking from i17 → i45 is plausible.
- **Blast radius**: dev-loop primary; if storage grows unbounded, also infra.
- **Notes**: Smaller cousin of i44 — i45 is event-sourcing-at-edit-grain, i44 is CRDT-FS. They overlap but differ on conflict resolution: i45 still needs a merge story, i44 has merge built in. Recommend treating i45 as a stepping stone to i44 if/when this direction is committed.

### i46 — WAL-style commit journal

- **Refined-title**: Write-ahead log: every staged file write goes to `.gin/wal/<seq>.json` before touching the tree.
- **Refined-one-line**: Recovery replays the WAL; even a complete `.git/` corruption survives if the WAL is intact.
- **Refined-why**: WAL is the canonical recovery primitive in DB land; same instinct works for an edit pipeline.
- **Cost-to-try**: **medium-large** — needs a tool wrapper that intercepts every write; needs the replay tool; needs WAL truncation policy.
- **Reversibility**: **hard** — once you depend on the WAL for recovery, removing it loses the safety net (though the live tree continues working).
- **Prerequisites**: i17 (touched-set hooks) is the natural mount point. Without per-tool interception, WAL is incomplete.
- **Blast radius**: dev-loop. Storage growth is a real concern.
- **Notes**: Subset of i45 — WAL is the *implementation primitive*, event-sourcing is the *ontology*. If we go this direction, do i45's framing with i46's mechanism. Treat as merge candidate: **i45 ⊃ i46 in spirit; recommend orchestrator merge i46 into i45 as "WAL implementation strategy".**

### i47 — Replace `git` with `jj` (Jujutsu) for agent operations

- **Refined-title**: Use `jj` as the agent's git surface; first-class concurrent branches, conflict-as-data.
- **Refined-one-line**: jj sits on top of git refs (so the team's `git` workflow keeps working) but gives agents better concurrent semantics — conflicts are first-class objects, not error states.
- **Refined-why**: Many cluster B/C/D ideas exist because git's model fights us. jj's model fights us less. The "out of scope" constraint says "no replacing git" — but jj uses git refs, so the *team's* git is still git; just the *agent's* tools are jj.
- **Cost-to-try**: **large** — every agent's git muscle memory needs retraining; every hook (`pre-push`, `pre-commit`, the autosync wrapper) needs a jj equivalent; tooling like `dx ship` rewrites.
- **Reversibility**: **hard** — once tooling assumes jj concepts (changes vs. commits, anonymous branches, conflict objects), reverting to git means losing those abstractions.
- **Prerequisites**: none mechanically (jj installs cleanly), but practically: would want i20 (`dx ship` as the sanctioned write path) as the abstraction layer that hides the git/jj choice from agents.
- **Blast radius**: dev-loop. Doesn't touch shipping product. But touches every agent's mental model.
- **Notes**: Out-of-scope-ish — the topic.md says "no replacing git itself". jj-on-top-of-git is a defensible reading of "kept git", but the orchestrator should flag this for explicit human decision before letting it go to prioritize. **Conflicts-with**: i20/i21 if interpreted as "wrap git" — jj would replace, not wrap.

---

## Cross-slice notes (for orchestrator)

### Semantic dups to merge / strong synergies

- **i38 (refuse-to-be-silent) ⟷ i06 (no-reset autosync, refiner 02)**: Same instinct, different layers. i06 changes the *behavior*; i38 changes the *surface*. Both wanted; not duplicates. Recommend: cross-link via `Synergy:` field.
- **i38 absorbs i10 (last-words log, refiner 02)**: i10's `~/.dx/last-words/<sha>.diff` is exactly one of i38's "dump before destructive op" mechanisms. Recommend: refiner 02 keeps i10 as canonical; i38 references i10 as the implementation of one of its emits.
- **i39 (status-line gauge) + i41 (push-readiness score) + i24 (storm-mode-as-state, refiner 04)**: Same data source, three presentations. Should share one "storm-state" module. **Not a merge** — three legitimate surfaces over one substrate. Recommend: cross-link, don't collapse.
- **i40 (tree-tail) + i30 (narration) + i17 (touched-set, refiner 03)**: Share substrate (events store). i17 provides the data, i30 the live feed, i40 the tail view. Recommend cross-link.
- **i32 (Gin-doesn't-reset-Gin hook) + i06**: Different vectors of the same failure (autosync vs manual reset). Not duplicates; complementary.
- **i46 (WAL) ⊂ i45 (event-sourced)**: i46 is i45's implementation strategy. **Recommend orchestrator merge: i45 canonical, i46 = "WAL implementation of i45".**

### Conflicts

- **i47 (jj) vs. i20/i21 (dx ship/commitd)**: i20 wraps git; i47 swaps git underneath. Not strictly mutually exclusive (i20 could wrap jj) but they imply different roads. Mark `Conflicts-with:` both ways.
- **i33 (30s cancellation window) vs. throughput in storms**: adds 30s × N pushes friction. Already mitigated if gated on storm-level ≥ 2 (per i24).

### Sequencing constraint (load-bearing)

- **i42 says: ship cluster I before cluster B.** This is a meta-constraint that the prioritize round must honor or explicitly reject. If accepted, cluster I's costs are paid first; if rejected, surface why. Recommend the orchestrator flag this in the structural summary at top of `ideas.md`.

### Gap-fill candidates I considered and rejected

- "Auto-claim on first edit" — would be useful as an ergonomic layer over i29 (no manual `dx claim`), but it's an enhancement, not a missing sibling. Not adding.
- "Storm-aware companion" — companion-skill that reads i39's gauge and intervenes. Already covered in spirit by `companion` skill + i24/i39 composition. Not adding.

### i31 (etiquette) — "useful without enforcement?" question

Yes, ship it first. Reasons:
1. CLAUDE.md conventions *do* shape Claude behavior, even without hooks.
2. The doc *is* the spec for i29 (claim) and i32 (reset-blocker). Writing the etiquette first forces clarity on what we're enforcing.
3. Cost is one markdown file; reversibility is `rm`. Friction-cost of NOT shipping a free thing > friction-cost of redundancy with future hooks.

Recommend: i31 ranks high in cost-small tier; i29/i32 follow when enforcement is needed.

### Open questions for orchestrator (≤3)

1. **Is i47 (jj) in or out of scope?** Topic.md says "no replacing git". jj-on-top-of-git is a borderline read. Need explicit human ruling before prioritize sees it.
2. **Should i42 (telemetry-first) be enforced as a sequencing constraint on prioritize, or just noted?** It's the most z086-aligned idea but it gates cluster B which has the strongest convergence (5/5 ideators on i06). Tension between "follow convergence" and "follow the principle".
3. **i34 (asymmetry framing) — keep as standalone idea or hoist to cluster G preamble?** It's principle, not implementation. My read: hoist; but flagging for orchestrator.

### Frictions captured (zettel candidates, not written this turn)

- **Refining heavy primitives is uncomfortable** — i44/i45/i46/i47 force "honor the cost" judgments that feel like ranking, but aren't (the cost field IS legibility, not ranking). Worth a meta-zettel: *refiner self-check — "honor the cost" is a legibility move, not a prioritization move.*
- **Cross-slice synergy load** — this slice has 4 strong cross-cluster links (i38↔i06, i39↔i24, i40↔i17, i32↔i06). Suggests slicing 02/03/04 may have under-counted edge-density. Captured as an observation; no zettel yet.
