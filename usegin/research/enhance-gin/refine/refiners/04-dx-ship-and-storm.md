# Refiner 04 — Cluster E (`dx ship` wrapper) + Cluster F (storm detection & mode)

Slice: i20–i23 (E) + i24–i28 (F). 9 ideas. Read the whole pool.

## Cross-slice notes (orchestrator should read)

- **i20 (dx ship wrapper) ↔ i21 (gin-commitd daemon).** Not substitutes — they
  *nest*. i20 is the agent-side surface (a wrapper command); i21 is one
  possible backend it can call. The wrapper can start with a synchronous
  in-process implementation and later be re-pointed at a daemon socket
  without changing the agent contract. Mark i20 as the umbrella; i21 as a
  backend variant; i22 (outbox) as a *different* backend variant.
- **i20 ↔ Cluster A (i01–i05).** The wrapper is where diff-scoped pre-push
  (i01) physically *lives*. i20 without i01 is decoration. Prerequisite link
  both ways: i01 wants a home; i20 needs the diff-scoping check to mean
  anything.
- **i20 ↔ Cluster B (i06–i10).** Side-branch fallback (i07), tombstone
  (i08), CAS (i09), last-words (i10) are all *behaviors* the wrapper
  composes. The wrapper is the integration point for cluster B.
- **i24 (storm-mode-as-state) is the policy hub.** i25 (storm-status) and
  i26 (wait-for-clean-tree) are detection-side inputs feeding the mode;
  i27 (side-branch-default) and i28 (cap-to-1) are behavior-side outputs.
  The mode itself is just a piece of state that consumers read.
- **i23 (push-by-intent) is the most ontology-shifting idea in this slice.**
  It does NOT require event-sourcing (i45) or CRDT FS (i44) to start — a
  cheaper retrofit is "agent declares intent label at `dx ship` time and the
  wrapper assembles a commit from only files matching that label's path
  prefix or PostToolUse-tracked set". Strong link to i17 (per-session
  touched-files set) — the touched-set IS the labeled-changes index.
- **i27 (side-branch-default) duplicates i07 (push-to-orphan-on-failure)
  semantically but at a different trigger.** i07 is reactive (push failed);
  i27 is proactive (storm is high). Both push to a side branch; difference
  is *when*. Worth keeping both but cross-link.
- **i28 (cap-at-1) is in tension with the whole topic.** The brainstorm
  presupposes multi-agent storms; i28 questions the premise. Don't merge
  away — it's a real conflict-with for i11/i13 (per-agent worktree/VM,
  which assume parallelism).

## Friction zettels to capture

- z095 already exists; this slice is its descendants. Worth a zettel on
  "wrapper-vs-daemon is not a choice; it's a layering" once we land
  prioritize.
- The push-by-intent (i23) framing — agent declares semantic unit of work
  separately from filesystem state — is a reusable primitive across many
  ideas in clusters D and G. Worth a zettel on "intent-as-first-class".

## Per-idea edit blocks

Format below mirrors the canonical `Refined:` field shape. Orchestrator
merges these into `ideas.md`.

---

### i20 — `dx push` / `dx ship` wrapper as sanctioned write path

**Sharpened title:** `dx ship` wrapper is the only sanctioned agent push path.

**Tightened one-line:** A single thin wrapper command replaces raw `git push`
for agents; it composes diff-scoped checks, side-branch fallback, tombstone,
and storm-aware behavior into one place every agent inherits.

**Concrete why:** Bare `git push` in an autosync-multi-agent regime is a
foot-gun — every agent reinventing safety primitives. A wrapper is the only
seam where we can enforce *all* the cluster A/B improvements simultaneously
and where storm-mode (i24) policy can land. Without it, fixes scatter across
hooks, scripts, and per-agent CLAUDE.md notes.

- **Cost-to-try:** small (v0 is a 30-line bash/ts wrapper that calls
  existing primitives).
- **Reversibility:** easy (it's an additive command; raw `git push` still
  works).
- **Prerequisites:** none for the shell of the wrapper; *meaningful*
  versions need i01 (diff-scoped checks) and i07 (side-branch fallback) to
  compose.
- **Blast radius:** dev-loop only (no production impact; `nextjs-app/`,
  `python-services/` push paths unchanged).
- **Composes-with:** i01, i02, i06, i07, i08, i09, i10, i17, i19, i24, i26,
  i27, i35.
- **Substitutes-for:** raw `git push` for agents (humans unaffected — i34
  asymmetry).

---

### i21 — Single `gin-commitd` daemon serializes pushes to `main`

**Sharpened title:** `gin-commitd` daemon owns serialized push-to-main.

**Tightened one-line:** A long-running local daemon accepts push requests
from agents over a socket, serializes them, runs diff-scoped checks, and
fast-forwards to `origin/main`; agents never call `git push` directly.

**Concrete why:** Single-writer-multiple-reader is the textbook safe-write
primitive. Eliminates push races by construction — there is exactly one
process touching `origin/main` at any time. Backend variant of i20: agents
keep calling `dx ship`; only the implementation changes from in-process to
daemon-backed.

- **Cost-to-try:** medium (daemon lifecycle + socket + retry semantics; not
  trivial but bounded — ~1 day of plumbing).
- **Reversibility:** easy (point `dx ship` back at the in-process
  implementation).
- **Prerequisites:** i20 (the wrapper is the client surface). Optional
  composition with i22 (outbox is the daemon's queue).
- **Blast radius:** dev-loop only.
- **Conflicts-with:** none direct; over-engineered if i20 + i01 + i07 alone
  resolve the pain (likely path forward: try i20 first, escalate to i21
  only if races persist).

---

### i22 — Outbox pattern: local commits, async drain to origin

**Sharpened title:** Outbox: agents commit locally, worker drains to origin.

**Tightened one-line:** Agents commit only to local refs; a separate worker
process drains commits to `origin/main` with retry+backoff, dead-lettering
permanently-failing commits to `refs/gin/dlq/<sid>` for human triage.

**Concrete why:** Decouples *local progress* (agents keep working) from
*remote availability* (push can fail without blocking the agent). Classic
outbox pattern from event-driven systems. Means agents never wait on a push
gate; pushability becomes an async background concern.

- **Cost-to-try:** medium (worker, retry, dead-letter convention; ~1 day).
- **Reversibility:** hard-ish (once agents stop calling `git push` directly,
  reverting to synchronous push means re-teaching the mental model).
- **Prerequisites:** i20 (wrapper as enqueue point); i07 (DLQ destination
  is just a side-branch convention).
- **Blast radius:** dev-loop only.
- **Substitutes-for:** i21 (different backend; daemon serializes
  synchronously, outbox drains asynchronously). Keep both; pick one in
  prioritize.
- **Conflicts-with:** i21 (architecturally; same wrapper-backend slot).

---

### i23 — Push-by-intent, not push-by-diff

**Sharpened title:** Push by declared intent; broker assembles the commit.

**Tightened one-line:** Agent declares a semantic intent ("ship marketplace
docs"); the wrapper builds a clean commit from only the files the agent
authored under that intent — independent of whatever else is in the working
tree.

**Concrete why:** Removes the "your diff includes everyone's WIP" ontology
that causes Mode-1 collisions and z095-shaped blocks at root. The
filesystem stops being the unit of authorship; the *labeled change set*
does. Cheap retrofit: combine PostToolUse touched-set (i17) with
intent-labels at `dx ship` time — no event-sourcing or CRDT required.

- **Cost-to-try:** medium (intent-label argument on `dx ship` + commit
  assembly from i17's touched-set; ~1 day).
- **Reversibility:** easy (path-based commit composition is additive).
- **Prerequisites:** i17 (per-session touched-files set is the index that
  intent maps onto). Strongly composes with i19 (Agent-Session trailer).
- **Blast radius:** dev-loop only.
- **Composes-with:** i16, i17, i19, i20.
- **Note:** does NOT require ontology shift to event-sourced (i45) or CRDT
  (i44). Those are heavier paths to the same property; i23 retrofit is the
  cheap version.

---

### i24 — First-class storm-mode state (paranoid / normal / yolo)

**Sharpened title:** Storm-mode as first-class state, three levels.

**Tightened one-line:** A persisted mode (`paranoid` / `normal` / `yolo`) is
read by every dx subcommand and hook; mode is set automatically from
detection signals (stash count, push-fail rate, active-agent heartbeat) or
manually by the human.

**Concrete why:** "Storms" are recurring weather, not exceptional events.
Encoding storm level as state means every safety primitive (autosync,
pre-push, side-branch default, agent cap) reads the same number and adapts
coherently — instead of each subsystem inventing its own threshold.
5/5-convergent across ideators; the policy hub for clusters E/F.

- **Cost-to-try:** small (a single config key + a `dx storm-level` reader;
  detection signals can be added incrementally).
- **Reversibility:** easy (consumers can ignore the mode; default = normal
  is a no-op).
- **Prerequisites:** none for the state itself. Detection inputs are i25
  (storm-status), i26 (wait-for-clean-tree readings), heartbeat from i11.
  Behavior outputs are i27 (side-branch on high), i28 (cap on extreme).
- **Blast radius:** dev-loop + telemetry (mode is a signal we'll want to
  log).
- **Hub-of:** i25, i26, i27, i28; reads-from cluster I observability; feeds
  cluster B autosync behavior.

---

### i25 — `dx storm-status` live one-liner

**Sharpened title:** `dx storm-status` one-line live readout.

**Tightened one-line:** A single-command readout — N agents touching tree,
autosync in-flight count, stash count, push-fail rate over last 30 min —
suitable for the status-line and for hook gating.

**Concrete why:** Visibility before action. Agents (and humans) need a
cheap "what's the weather right now" lookup that doesn't require parsing
git state. Wires into the status-line for ambient awareness; wires into
i24 for mode-derivation.

- **Cost-to-try:** small (one read across `git status --porcelain`,
  `git stash list`, autosync log, push-fail tally).
- **Reversibility:** easy (read-only command).
- **Prerequisites:** none for v0. Agent-heartbeat enrichment depends on
  i11 (per-agent worktree) or per-session sid registry.
- **Blast radius:** dev-loop + telemetry only.
- **Feeds:** i24 (mode derivation), i39 (R/A/G gauge), status-line.

---

### i26 — `dx wait-for-clean-tree` primitive

**Sharpened title:** `dx wait-for-clean-tree` poll-with-timeout primitive.

**Tightened one-line:** Polls `git status --porcelain` until empty (or
timeout); called automatically by `dx ship` when storm-level ≥ 1, or
manually by a careful agent.

**Concrete why:** The cheapest "defer push during storm" primitive — the
one z095 explicitly names as the pragmatic option. Doesn't try to fix the
ontology; just acknowledges that working-tree-quiescence is a real
synchronization point in a multi-agent regime and gives it a name.

- **Cost-to-try:** small (~10 lines of polling).
- **Reversibility:** easy.
- **Prerequisites:** none for v0. Auto-invocation requires i20 (wrapper) +
  i24 (mode read).
- **Blast radius:** dev-loop only.
- **Composes-with:** i20 (called by ship), i24 (gated by mode).

---

### i27 — Side-branch-by-default during high storm

**Sharpened title:** Side-branch by default when storm-level ≥ 2.

**Tightened one-line:** When storm-level is high, `dx ship` auto-targets
`gin/<sid>/<topic>` instead of `main` and opens (or updates) a PR-into-main;
`main` only receives integrated work in stormy conditions.

**Concrete why:** In a storm, `main` is read-mostly. Letting agents
unilaterally fast-forward `main` while N other agents are mid-write
maximizes collision surface. Side-branch + PR gives the storm a buffer.
Behavior-side output of i24.

- **Cost-to-try:** small (branch-name convention + `gh pr create --draft`;
  ~30 lines).
- **Reversibility:** easy (the default flips back; existing side-branches
  rebase or merge as normal).
- **Prerequisites:** i20 (wrapper is the routing point), i24 (mode is the
  trigger).
- **Blast radius:** dev-loop only.
- **Composes-with:** i07 (same destination shape — a `gin/...` branch);
  i20, i24.
- **Cross-link:** i07 is reactive (push failed), i27 is proactive (storm
  high). Same destination, different trigger; orchestrator should keep
  both with explicit cross-reference.

---

### i28 — Cap concurrent agents at 1 by default

**Sharpened title:** Cap concurrent agents at 1; require explicit handshake
to spawn more.

**Tightened one-line:** Default to one agent per checkout; spawning a
second requires a human handshake or an explicit `dx storm allow-N=K`
override that surfaces the cost at spawn time.

**Concrete why:** Questions whether parallelism is needed at all. Most of
this brainstorm's pain (z095, Mode-1 collisions, eaten commits) arises from
multi-agent assumption. Capping makes the cost visible at the moment of
choice — you're choosing complexity, not stumbling into it.

- **Cost-to-try:** small (a counter + a check at agent-spawn).
- **Reversibility:** easy (raise the cap).
- **Prerequisites:** none for the gate; meaningful enforcement requires
  knowing where agents spawn (`tools/dx/`, hooks, `usegin/` scripts).
- **Blast radius:** dev-loop only; potentially affects how the human
  spawns parallel R&D / brainstorm / refine teams (this very session).
- **Conflicts-with:** i11 (per-agent worktree), i13 (per-agent VM), i14
  (PR queue) — those *assume* parallelism. i28 says: question the premise
  first. Mark Conflicts-with on all three.
- **Composes-with:** i24 (cap is part of mode policy — paranoid mode = 1,
  normal = 3, yolo = unlimited).

---

## Open questions for orchestrator

1. i21 vs i22 — should they merge into one "wrapper-with-pluggable-backend"
   meta-idea, or stay distinct? My read: stay distinct; daemon and outbox
   have different operational properties (sync vs async drain). Prioritize
   picks one.
2. i27 vs i07 — are these dups? My read: no — different triggers
   (proactive vs reactive), same destination. Cross-link, don't merge.
3. i28 conflicts with the brainstorm's premise. Worth surfacing
   explicitly in the structural summary, since prioritize will need to
   decide whether to rank it as a serious option or as a thought-experiment.
