# Refiner 01 — Gate + reframings

Slice: cluster A (i01–i05) + cluster K (i48–i51) = 9 ideas.

## Per-idea edit blocks

### i01 (canonical edit block)

**Title (refined, ≤10 words):** Pre-push gates the diff being pushed, not the working tree

**One-line (≤2 sentences):** Pre-push hook scopes lint + tsgo + tests to `git diff origin/main..HEAD --name-only`, ignoring uncommitted dirt elsewhere in the tree. Doc-only or zettel-only pushes can ship even while sibling agents have broken WIP.

**Why (concrete):** z095's exact root cause. 2026-04-27 session: ENG-5414 marketplace docs commit (`ac2d8f71d`) blocked because `tsgo --noEmit` ran whole-tree and failed on `integrations-tab-content.tsx` importing `./slack-integration-card` (missing) — both files belonged to ENG-5411 (sibling agent), neither was in the push range. 4 commits eaten by autosync's reset-on-push-failure recovery before the diagnosis landed.

**Cost-to-try:** small (≤1 day for v0; the hook lives in `.husky/pre-push` or `tools/pre-push-checks/`)

**Reversibility:** easy (single hook script change, behind a `dx` toggle)

**Prerequisites:** none — drop-in change to existing hook script

**Blast radius:** dev-loop only (changes how local push is gated; CI is still authoritative gate)

**Conflicts-with:** none. Partial overlap with i02 (i02 is a stronger isolation form — clean checkout vs. same-tree path-filter); i04 is the "post-process whole-tree output" cousin; i05 is the path-allowlist fast-path.

**Refiner notes:** Strongest convergence in pool (5/5). i01 is the canonical "diff-scoped pre-push" claim; i02–i05 are siblings on an implementation spectrum (cheap → principled). Recommend keeping all five, linking i02/i03/i04/i05 as variants under i01 in prioritize.

---

### i02

**Title (refined, ≤10 words):** Pre-push runs in clean ephemeral worktree of the push range

**One-line (≤2 sentences):** Hook does `git worktree add /tmp/precheck-<sha>` at the tip being pushed and runs lint/tsgo/tests there; the live working tree is invisible to the gate. Stronger isolation than i01: the artifact under test physically equals the artifact being pushed.

**Why (concrete):** Removes the "but what about transitively-broken imports outside the diff" objection to i01. If `marketplace-docs.md` doesn't import slack code, a clean checkout of just-the-push-range will pass type-check even if working-tree slack code is broken. Mirrors what staging CI already does — local hook becomes a faithful preview.

**Cost-to-try:** small-to-medium (~1 day; worktree creation + cleanup + cache reuse for `node_modules`/`.next`)

**Reversibility:** easy (hook script change; toggleable)

**Prerequisites:** none structurally; perf-prereq is a way to share `node_modules` (symlink or `pnpm`-style hardlink) so worktree creation isn't 90s

**Blast radius:** dev-loop only

**Conflicts-with:** none. Strict superset of i01's correctness guarantee at higher infra cost.

**Refiner notes:** v1 to i01's v0. Convergent 4/5 — only one ideator below i01. Worth shipping i01 first, evolving to i02 if path-filtering proves leaky (it will, on cross-file type errors).

---

### i03

**Title (refined, ≤10 words):** `git stash -u` before pre-push, pop after — 5-line wrapper

**One-line (≤2 sentences):** Cheapest possible variant of i01/i02: stash everything uncommitted (including untracked) before lint/test, pop after. The gate runs against HEAD = the push range.

**Why (concrete):** ~5 lines of bash; doesn't need diff-name parsing or worktree machinery. Same correctness story as i02 (gate sees only committed state) at 1/10th the implementation cost.

**Cost-to-try:** small (≤2 hours; `.husky/pre-push` 5-line wrapper + `trap` for pop-on-exit)

**Reversibility:** easy (revert the wrapper)

**Prerequisites:** none

**Blast radius:** dev-loop only — but caveat: stash-pop on hook failure can leave the tree in a surprising state if pop conflicts with anything that changed during the hook run. Need `trap` on EXIT to guarantee pop.

**Conflicts-with:** none. Single-source but functionally equivalent to i01+i02 with different mechanism.

**Refiner notes:** Single-source (ideator-01). This is the "ship today" form. Concern: in a multi-agent storm, stashing the working tree right when sibling agents are mid-write could itself collide (Mode-1 style). i02's worktree is collision-free; i03 trades cheapness for a small concurrency wart. Worth shipping behind a toggle and watching telemetry.

---

### i04

**Title (refined, ≤10 words):** Whole-tree lint, then filter errors to commit's files

**One-line (≤2 sentences):** Keep running lint/tsgo against the whole tree (no behavior change to runners), but post-process the output and only fail the push if errors point at files in `git diff origin/main..HEAD --name-only`. ~10 lines of grep.

**Why (concrete):** The smallest-possible drop-in fix. Doesn't change lint/tsgo invocation, doesn't add worktree management, doesn't risk stash-pop. Just `tsgo --noEmit | filter-by-changed-files | exit-nonzero-if-any-remain`. z095's slack-import error wouldn't have blocked the marketplace-docs push.

**Cost-to-try:** small (≤2 hours; one bash filter)

**Reversibility:** easy (delete the filter wrapper)

**Prerequisites:** lint/tsgo emit machine-parseable file:line:col output (they do)

**Blast radius:** dev-loop only

**Conflicts-with:** none directly. Weaker than i01 — still **runs** lint on the whole tree, so a tsgo crash on a stranger file (vs. a typed error) could still fail the push. Worth flagging.

**Refiner notes:** Single-source (ideator-01). The pragmatic "least surgery" answer. Edge case: when the error is a parse error or compiler crash on a stranger file, there's no `file:line` to filter against — the runner just exits non-zero. Mitigation: still want i01 v1.

---

### i05

**Title (refined, ≤10 words):** Skip TS/test pre-push entirely for `usegin/`/`*.md`-only pushes

**One-line (≤2 sentences):** Path-allowlist fast-path: if every file in `git diff origin/main..HEAD --name-only` matches `^(usegin/|.*\.md$|docs/)`, skip lint/tsgo/test entirely. 90% of zettel and research pushes need zero code-gate.

**Why (concrete):** This very session's marketplace-docs and zettel pushes were docs-only — there is no code to type-check. Today's pre-push runs the full code gate anyway. The fast-path is a 10-line bash check at the top of the hook; same-turn fix.

**Cost-to-try:** small (≤1 hour; path-glob check at hook entry)

**Reversibility:** easy (delete the early-return)

**Prerequisites:** agreement on which paths are "docs-only" (probably `usegin/**`, `*.md`, `docs/**`, `.claude/skills/**/*.md` but **not** `.claude/skills/**/*.sh` or `.claude/hooks/**`)

**Blast radius:** dev-loop only — but watch: a doc-only push that secretly includes a `.json` or `.sh` schema change must NOT match the allowlist. Allowlist must be `*.md`-tight, not `usegin/**`-loose, since `usegin/` contains shell scripts.

**Conflicts-with:** none. Strict subset of i01 (i01 also handles docs-only by virtue of empty-diff-on-code-files); i05 is i01's "don't even bother running the runner" optimization.

**Refiner notes:** Single-source (ideator-01, 2 sub-ideas). The cheapest of all the gate fixes for the most-common case. Pair with i01 — i05 is the early-exit, i01 is the slow path.

---

### i48

**Title (refined, ≤10 words):** Replace pre-push with post-push CI as the only gate

**One-line (≤2 sentences):** Local push always succeeds; `main` is treated as a queue and CI promotes commits forward only when green (revert-on-red). We already do this for staging — extend to main.

**Why (concrete):** Reframes the whole z095 problem class away. If pre-push is a duplicate of CI, delete pre-push; CI is the single source of truth for "is this green". Eliminates the entire local-vs-tree-vs-diff debate. The cost is now-visible-CI-failures vs. now-invisible-pre-push-failures — but CI already runs on main pushes, so the marginal cost is low.

**Cost-to-try:** medium (2-3 days; needs revert-on-red automation, status notification, and a story for "CI is broken so nobody can land" that doesn't exist with local pre-push)

**Reversibility:** easy at the gate level (re-add pre-push hook); harder if revert-on-red automation lands and gets baked-in

**Prerequisites:** main-CI is fast enough that revert-windows are tolerable; revert-on-red automation; team agreement that local push is always-OK

**Blast radius:** dev-loop + production (changes contract for `main` — agents and humans both push optimistically)

**Conflicts-with:** none in pool, but **frames** i01–i05 as wrong-layer-fixes. If i48 lands, i01–i05 become irrelevant. If i01–i05 land first, i48 becomes "did we even need any of those".

**Refiner notes:** Single-source (ideator-05). The "stop fighting local hooks" reframing. Strong claim because it points at a real duplicate-of-CI smell. Worth keeping as a deliberate architectural fork against the gate-fix cluster.

---

### i49

**Title (refined, ≤10 words):** Two histories: `main-human` and `main-gin`, periodically reconciled

**One-line (≤2 sentences):** Agents push to `main-gin`; humans push to `main-human`; a daily/hourly reconcile job fast-forwards or surfaces conflicts. Pre-push between agents never blocks human pushes and vice versa.

**Why (concrete):** Questions whether agents and humans should share authorship on a single trunk at all. Solves cross-stream pre-push interference at a structural level — Gin-WIP can never block Lihu-push because they're not on the same ref. The 4-eaten-commits this session were all agent-vs-agent on `main`; this branch wouldn't have helped *that*, but the storm-vs-human case is the more painful one long-term.

**Cost-to-try:** large (1+ weeks; needs reconcile job, conflict-surfacing UX, deploy-target rethink — does staging deploy from `main-human` or `main-reconciled`?)

**Reversibility:** hard (history bifurcation is sticky; merging branches back has migration cost)

**Prerequisites:** decision on which ref deploys; reconcile policy (linear FF? PR? auto-merge?); CI re-routing

**Blast radius:** production (changes the deploy ref); dev-loop (changes where everyone pushes)

**Conflicts-with:** i51 (i51 kills `main` for agents entirely; i49 keeps it but splits it). Mutual exclusion — pick one.

**Refiner notes:** Single-source (ideator-05). The middle-ground reframing. i48 keeps single trunk, fixes gate via CI; i49 splits trunk; i51 removes trunk for agents. Three different ontology bets in cluster K.

---

### i50

**Title (refined, ≤10 words):** Treat git as a cache of intent; Zisser holds canonical intent

**One-line (≤2 sentences):** Zisser (or some canonical intent log) holds what each agent meant to do; git is a downstream projection. Lost commits, attribution, recovery all flow from intent log, not git plumbing.

**Why (concrete):** Reframes "Gin's commits got eaten by autosync reset" as a category error — if git is a cache, a wiped cache is recoverable from the source of truth. Today, the work to attribute / recover / protect "Gin's commits" is fighting an ontology where the medium (git) is treated as the message. The session-JSONL transcripts already contain everything Gin did — they ARE the intent log, just not currently treated as authoritative.

**Cost-to-try:** large (1+ months; needs intent-projection-to-git pipeline, recovery-from-intent UX, decision on what "intent" means concretely — JSONL turns? `dx` calls? edits?)

**Reversibility:** one-way at the architectural level (once teams trust intent-log, ripping it out is hard); easy at the experimental layer (just stop using it)

**Prerequisites:** canonical "intent log" definition; tool to project intent → git commit; story for human edits (humans don't have an intent log)

**Blast radius:** production (changes what "source of truth" means); telemetry (intent log is rich); corpus (intent log becomes a corpus)

**Conflicts-with:** none directly — i50 is orthogonal to i48/i49/i51 (you could split histories AND treat them as projections of intent). Closest tension: i50 implies pre-push is irrelevant (if git is a cache), aligning with i48.

**Refiner notes:** Single-source (ideator-05). The deepest reframing. Most expensive to pursue, highest upside if it lands. Worth keeping in pool as the long-horizon ontology bet — even if not implemented, naming it changes how we think about i06–i10 (recovery) and i19 (attribution).

---

### i51

**Title (refined, ≤10 words):** Kill `main` in the agent layer — topic-graph instead

**One-line (≤2 sentences):** Agents never push to `main` directly; each topic gets a branch (one-issue-one-branch), and merge-to-main is a separate human-or-bot step. Trunk-based dev was a human-team optimization; multi-agent regimes are different.

**Why (concrete):** z095's working-tree-collision problem only exists *because* every agent shares one checkout pointing at one branch. If each topic owns its own branch (and ideally its own worktree, see cluster C), there's no shared `main` for cross-agent dirt to collide on. The 4-eaten-commits, the 27-stash explosion, the pre-push blocks — all properties of "everyone is on `main`".

**Cost-to-try:** large (1+ weeks; needs branch-per-topic spawn protocol, merge automation, CI-per-branch story, deployment policy)

**Reversibility:** hard (once agents are habituated to topic branches, going back to trunk feels regressive)

**Prerequisites:** worktree-per-agent (i11 from cluster C) is a near-prerequisite; merge-to-main automation; PR-or-fast-forward policy; CI cost story (N agents = N branches = N CI runs?)

**Blast radius:** dev-loop (changes how every agent works); production (changes deploy story — is `main` still what deploys?)

**Conflicts-with:** i49 (i49 splits trunk into two, i51 removes trunk for agents); pick one. Reinforces i11 (per-agent worktree) — natural pair.

**Refiner notes:** Single-source (ideator-05). Strongest reframing in the cluster. Pairs naturally with cluster C (i11 worktrees, i13 VMs) — they're the implementation; i51 is the policy. Direct contradiction with i49; orchestrator should call out the fork explicitly in prioritize.

---

## Cross-slice notes

### Dups across slices
- **i01 vs i26 (cluster F):** i26 is `dx wait-for-clean-tree` — the "wait for storm to pass" primitive. Different shape from i01 (gate vs. defer), but z095 explicitly names the same problem. Not a dup; complement. Note in prioritize.
- **i48 (post-push CI gate) vs i20 (`dx ship` wrapper, cluster E):** i48 says "delete the local gate"; i20 says "wrap the local gate in our tool". They're at different layers, but if i48 lands, i20's gate-encoding role evaporates (i20's other roles — side-branch fallback, reflog tag — survive). Worth flagging as partial conflict.
- **i48 vs i06 (autosync no-reset, cluster B):** i06 is the "stop the destructive recovery" fix at the autosync layer; i48 is "remove the gate that makes recovery happen". Both attack the same loss-vector (4 commits eaten this session). i06 is local + immediate; i48 is structural. Not a dup — they're complementary v0 vs. v∞.
- **i51 (kill main for agents) vs i11 (per-agent worktree, cluster C) and i13 (per-agent VM, cluster C):** strong policy↔mechanism pairing. i51 is what cluster C's mechanisms enable. Not a dup; flag as natural cluster.

### Gap-fills
None added by this refiner. Cluster A is well-covered (5 ideas spanning the full implementation spectrum from cheapest filter-the-output to principled clean-checkout); cluster K is intentionally a small set of orthogonal reframings — adding more would dilute their reframing-as-singular-bets character. The one near-miss is "**i52 (gap-fill): adopt staging's existing diff-only-CI as the local hook's source of truth**" — a literal "what does staging-CI do, run that locally" — but it's covered transitively by i01+i02 and would be redundant.

### Conflicts
- **i49 ⊕ i51:** mutual exclusion (split trunk vs. no trunk). Both got `Conflicts-with` annotations in their blocks above.
- **i48 (partial) vs i01–i05:** i48 reframes i01–i05 as wrong-layer-fixes. Not strict mutual-exclusion (you could ship i01 today and i48 in 6 months), but if i48 lands, i01–i05 become moot. Worth surfacing in prioritize as "pick a horizon".

## Friction (≤30 lines)

**Decisions made:**
- Split sibling-on-spectrum (i01 v0 → i02 v1) by keeping both with a "refiner notes" pointer rather than merging — prioritize benefits from seeing the implementation gradient.
- Did not add gap-fill ideas; cluster A is exhaustive and cluster K is intentionally a small reframing-set.
- Annotated i48's relationship to clusters A/B/E as "complementary at different horizons" rather than calling it a dup of any of them.
- Marked i49⊕i51 as a strict mutual exclusion in both directions.

**Frictions hit:**
- The brainstorm pool already merged ideator-level dups (`i01: From: ideator-01,02,03,04,05`), so semantic-dup detection within my slice was light. The work shifted to **cross-slice** detection (cluster A↔F, K↔B, K↔C/E) — which the slicing.md doesn't explicitly invite refiners to do, but the SKILL.md does.
- Cost-to-try is hard to bucket for cluster K (i48–i51) — they're architectural reframings, not features. Marked as "medium" or "large" with caveats; orchestrator may want a separate axis for "architectural-shift cost" vs. "implementation cost".
- Reversibility for ontology shifts (i50) is genuinely "one-way at the architectural layer, easy at the experimental layer" — single-bucket is misleading. Annotated explicitly in i50's block.

**Open questions for orchestrator:**
1. Should i02 and i03 fold into i01 as "implementation variants" sub-bullets, or stay as peer ideas? I kept them as peers; clear merge candidate if you want fewer ranked items.
2. i48 sits awkwardly — it's a reframing (cluster K) but also a direct alternative to i01–i05 (cluster A). Worth a cross-cluster `Alternative-to:` field?
3. i50 is the most speculative idea in my slice; should it be flagged for prioritize as "park as research-track, not implementation-candidate"?
