# Prioritizer 05 — Cal (scope-skeptic / direction-level critic)

> **Priming line:** Scope-skeptic — direction over correctness. Should we
> build this at all? What's the cheaper way?

Cal questions the premise. Defaults smaller scope. Rewards ideas that name
"do nothing" or "remove the source" alternatives. Penalizes ideas where the
underlying assumption is questionable, or where the implementation is
correct but the direction unjustified. Convergence is *signal*, not gospel —
five ideators agreeing on a fix doesn't mean the problem deserved fixing at
that layer.

---

## Notes — load-bearing positions

### Position on the parallelism premise (i28 vs i11/i13/i14)

**This is the meta-question of the pool, and Cal calls it out first.**

Half the pool exists *because* we run N agents on one checkout. z095, the
4-eaten-commits incident, Mode-1 stranger-file collisions, the 27-stash
spiral — none of these are git's fault, autosync's fault, or the pre-push
gate's fault in isolation. They are the *consequence* of one decision: spawn
multiple agents into a shared mutable directory.

The pool then proposes 50 fixes. Most of them solve "how do we survive the
storm?" None of the 50 (except i28) ask: **why are we standing in the
storm?**

The honest pre-mortem: *if this project fails*, the failure mode is "we
spent a quarter building CRDT/jj/event-sourcing/microVM scaffolding to
survive a working condition we didn't have to be in." We will look back and
say — we should have asked, in week one, whether a single agent per
checkout, with the human serializing parallel R&D into queued work, would
have killed 80% of the pain at zero engineering cost.

So **i28 ranks #1**. Not because capping at 1 is the final answer — it
might not be — but because **the cap forces the cost of parallelism to be
visible at the moment of choice**. Today the cost is paid silently in eaten
commits and stash spirals. With i28, the human says "I want N=3 today" and
*sees* that decision. That's all Cal asks of any direction-call: make it
visible, make it deliberate.

Concretely: i28 doesn't *forbid* i11/i13/i14 — it makes them earn their
keep. If Lihu hits the cap and overrides daily, that's data: parallelism is
load-bearing, build i11. If he hits it weekly, that's data: parallelism is
exceptional, don't build i11. **Today we have neither datum** — we've
inferred parallelism is needed because we keep doing it.

i11 (worktrees) ranks high too — it's the *cheapest* answer if we keep
parallelism — but Cal ranks i28 above it. Question first, then build.

### Position on i42 (telemetry-first)

Cal's instinct is to like i42 — "measure before mutating" is direction-
questioning. *We have theories about Mode-1, we don't have counts.* That's
the right shape of complaint.

**But i42 is also a procrastination cloak.** "Add telemetry first" is the
phrase a team says when they don't want to commit to a position. The risk:
i42 ships, cluster I lights up dashboards, the storm visibility makes
everyone feel productive, and cluster B never ships because the data "isn't
in yet."

Cal's resolution: **i42 is right about i06.** i06 (delete `git reset
HEAD~1`) is one line; we don't need a week of telemetry to know deleting it
is correct. The 4 lost commits this session is enough evidence — a count of
4 is still 4. Ship i06 *first* alongside i38 (loud telemetry on destructive
ops), then let i42's discipline gate the *shape* of i07/i08/i09 (orphan vs
tombstone vs CAS).

So Cal **partially accepts i42**: accept the "design from data" principle,
reject the "gate cluster B entirely" sequencing. i06 is a textbook delete-
the-loss-vector move; it doesn't need data to justify.

i42 ranks mid-table — useful posture, dangerous as a hard gate.

### Three "skip — do nothing instead" picks

Cal's lowest-ranked ideas (the "skip and own that we skipped" picks):

1. **i44 (CRDT-backed virtual filesystem)** — multi-quarter scope to solve a
   problem that disappears if i28 (cap=1) or i11 (worktrees) ships first.
   Cal's pre-mortem: *this is the project that killed us*. Skip. Don't
   research-track it. Don't park it. Name it as the thing we *won't* build
   and move on. If parallelism becomes inarguably necessary AND
   worktree-isolation proves insufficient AND we have storage budget for
   doc-CRDTs at file-tree scale — *then* re-raise. Probability: <5%.

2. **i47 (use jj instead of git)** — replaces an entire layer of the team's
   muscle memory to solve a problem most of which is solved by i06 + i28.
   Cal's pre-mortem: *we became a jj shop and the only thing we shipped was
   the migration*. Skip. The constraint in topic.md ("not replacing git")
   is the right constraint — Cal upholds it.

3. **i50 (git-as-cache; canonical intent log is source of truth)** — even
   the refiner labels this "research-track only." Cal goes further: *don't
   even research-track it*. Naming it has value (it sharpens how we think
   about commits-as-projection), but ranking it on a buildable pool is
   confused — it's a worldview shift, not an idea. Skip from this pool;
   capture as a zettel-essay if Lihu wants it kept alive.

(Honorable mention: **i33 (30s cancellation window before push lands)** —
adds friction on the agent in a regime where the *human* is the one
serializing. Cal would skip this too, but it's storm-mode-gated so the
damage is bounded.)

### How Cal weighed the convergent picks

The 5/5 spine (i01, i06, i24) all survive Cal's scrutiny because they ARE
small-scope direction-calls:
- i01 = "the gate is wrong-shape" → smaller, more correct gate
- i06 = "the recovery is the loss vector" → delete it
- i24 = "name the storm as state" → make weather visible before reacting

These aren't building scaffolding; they're removing-or-renaming. Cal ranks
them high.

The 4/5 convergents fare differently:
- **i20 (`dx ship` wrapper)** — Cal likes the *seam* but is suspicious of
  wrapper-creep. Ranks well only if it stays a 30-line wrapper, not a
  framework. Spec-time concern, not a ranking concern.
- **i07 (orphan side-branch)** — durable answer, Cal accepts.
- **i35 (`dx recover` menu)** — recovery surface; Cal likes that it just
  surfaces what reflog already has rather than inventing new state.
- **i02 (clean ephemeral worktree gate)** — Cal questions: is this i01 done
  right, or i01 over-engineered? Lean toward "i01 first, evolve to i02 only
  if needed."

### Convergence with John (predicted)

Cal expects to converge with John on:
- **i28 worth raising** (different reasons — Cal: premise wrong; John:
  storm assumption introduces failure modes the cap eliminates)
- **i44/i47/i50 are too far** (Cal: scope; John: failure surface)

Cal expects to *diverge* from John on:
- **i33 (cancellation window)** — John might rank it high (defense-in-
  depth); Cal ranks it low (friction in service of an assumption we
  haven't tested)
- **i08 tombstones** — John likely ranks high; Cal sees it as belt-and-
  suspenders atop i06 that pays for itself only if i06 regresses

---

## Ranking

| Rank | Idea-id | Title | Impact | Effort | Confidence | Strategic | Reversibility | Total | Rationale |
|---|---|---|---|---|---|---|---|---|---|
| 1 | i28 | Cap concurrent agents at 1; explicit handshake to override | 5 | 5 | 4 | 5 | 5 | 24 | The premise question. Makes parallelism's cost visible at the moment of choice. Cheapest possible — a counter and a check. If overridden daily, builds the case for i11. If not, retires half the pool. Cal's #1 by design. |
| 2 | i06 | Autosync never resets — push failure surfaces, never destroys | 5 | 5 | 5 | 5 | 5 | 25 | One-line deletion of the loss vector. Doesn't need data to justify. Smaller-scope answer to "we lost 4 commits": *stop deleting them*. |
| 3 | i31 | Five-rule etiquette doc loaded into every agent's CLAUDE.md | 4 | 5 | 4 | 5 | 5 | 23 | Convention as code. Costs one markdown file. Most of agent behavior is "follows written conventions readily" — solve the problem at the layer it lives in (instructions) before building enforcement primitives. Cal-favorite: cheaper way exists. |
| 4 | i05 | Skip TS/test pre-push for docs-only pushes | 5 | 5 | 5 | 4 | 5 | 24 | The 90% case fix. Smallest possible diff, kills the most-frequent z095 instance. Pure scope-reduction. |
| 5 | i01 | Pre-push gates the diff, not the working tree | 5 | 4 | 5 | 5 | 4 | 23 | The right shape of the gate. Direction-correction, not new scaffolding. |
| 6 | i19 | Agent-Session trailer on every agent commit (trailer-only v0) | 4 | 5 | 4 | 5 | 4 | 22 | Cheapest defense-in-depth. Trailer-only (reversible) — Cal rejects the author-name-forever variant on reversibility grounds. |
| 7 | i16 | Explicit-path adds; ban `git add -A` in agent code | 5 | 5 | 4 | 4 | 5 | 23 | Verb half of i16+i17. Closes Mode-1 at the git-command layer. Cal accepts because it's a *removal* (ban the foot-gun), not addition. |
| 8 | i17 | PostToolUse-tracked authored-set; commits refuse out-of-set | 5 | 4 | 4 | 5 | 5 | 23 | Noun half of i16. Reuses already-settled hooks. Smaller scope than it looks because the substrate exists. |
| 9 | i35 | `dx recover` — menu of last-N reflog/tombstone entries | 4 | 5 | 5 | 4 | 5 | 23 | Surfaces what reflog already has. Doesn't invent new state. The "minutes-of-archeology → seconds-of-arrows" delta is exactly Cal's "what's the cheaper way?" |
| 10 | i24 | Storm-mode as first-class state, three levels | 4 | 4 | 4 | 5 | 5 | 22 | Naming the weather is direction-work. Lifts cluster F coherence. Ranks below i28 because i28 *kills the storm*; i24 only *names* it. |
| 11 | i11 | Per-agent git worktree, materialized at session start | 4 | 4 | 5 | 4 | 4 | 21 | Git-native answer if (and only if) i28 says parallelism is real. Earns its rank only after i28's data lands. Without i28-data, i11 is over-eager. |
| 12 | i07 | On push failure, park commit on `gin/orphan/<sha>` side-branch | 4 | 5 | 4 | 4 | 4 | 21 | Durable supplement to i06. Cal accepts because it's still a *do less destructive thing* answer. |
| 13 | i38 | Loud telemetry before any destructive op | 4 | 5 | 4 | 4 | 5 | 22 | Closes the silence problem (z086). Cheap. Pairs with i06 to prevent regressions. |
| 14 | i04 | Whole-tree lint, filter errors to commit's files | 4 | 5 | 3 | 3 | 5 | 20 | The 10-line bash drop-in. Cal likes it for its smallness. Rank below i01 because the filter is leaky on tsgo crashes. |
| 15 | i03 | `git stash -u` before pre-push, pop after | 4 | 5 | 3 | 3 | 4 | 19 | "Ship today" form of i01. Concern: stashing during storm collides with itself. |
| 16 | i32 | PreToolUse hook on `git reset HEAD~` blocks cross-sid resets | 4 | 5 | 4 | 4 | 5 | 22 | Encodes etiquette in muscle memory. Cal-friendly because it *prevents* rather than *recovers*. |
| 17 | i39 | Three-color storm gauge in agent status line (R/A/G) | 3 | 5 | 4 | 4 | 5 | 21 | Visibility wired to surface every agent already sees. Cheap. |
| 18 | i25 | `dx storm-status` one-line live readout | 3 | 5 | 4 | 4 | 5 | 21 | Substrate for i24/i39/i41. Read-only, cheap. |
| 19 | i20 | `dx ship` wrapper as sanctioned write path | 4 | 4 | 4 | 5 | 4 | 21 | The seam matters; Cal flags wrapper-creep risk. Spec-time discipline required. |
| 20 | i48 | Replace pre-push with post-push CI as the only gate | 5 | 3 | 3 | 5 | 3 | 19 | The deepest "delete the source" play in cluster K. Cal *wants* to rank this top-5 — "if pre-push is duplicate of CI, delete pre-push" is exactly Cal-shape. Held back by reversibility (revert-on-red automation is sticky) and the "CI broken so nobody can land" failure mode. Strong direction-question; medium-cost answer. |
| 21 | i26 | `dx wait-for-clean-tree` poll-with-timeout | 3 | 5 | 4 | 4 | 5 | 21 | Cheapest deferral primitive. Cal accepts. |
| 22 | i02 | Pre-push runs in clean ephemeral worktree | 4 | 3 | 4 | 4 | 4 | 19 | Cal asks: i01 done right, or over-engineered? Ship i01 first; only escalate if needed. |
| 23 | i42 | Telemetry-first; design fix from data | 3 | 5 | 3 | 4 | 5 | 20 | Right posture, dangerous as hard gate. Cal partially accepts: principle yes, sequencing-block no. Ranks mid-table because i06 doesn't need to wait. |
| 24 | i43 | Cron-driven digest of storm metrics across sessions | 3 | 5 | 4 | 4 | 5 | 21 | Direct clone of working pattern. Low risk. |
| 25 | i36 | `dx commit-eats` SQLite log of every silent reset | 3 | 4 | 4 | 4 | 5 | 20 | Ranks mid-table — the events should *trend to zero* once i06 ships. Cal questions investing in a counter for an event we just deleted. Useful as regression detector only. |
| 26 | i12 | Per-session `GIT_INDEX_FILE` env var | 3 | 5 | 4 | 3 | 5 | 20 | Subsumed by i11. Useful only as ship-today bridge. |
| 27 | i18 | `Autosync-stranger-files:` trailer when sweep happens | 3 | 5 | 4 | 4 | 4 | 20 | Failsafe assuming Mode-1 still happens. Cal accepts it as defense-in-depth. |
| 28 | i27 | Side-branch by default when storm-level ≥ 2 | 3 | 4 | 3 | 4 | 5 | 19 | Storm-gated so damage is bounded. Useful only if i28 is *not* adopted. |
| 29 | i34 | Asymmetry: humans push, Gins propose | 3 | 5 | 4 | 4 | 5 | 21 | More principle than idea. Cal likes the framing — it justifies i20 cleanly. |
| 30 | i08 | Tombstone-and-revive | 3 | 4 | 4 | 4 | 5 | 20 | Defense-in-depth atop i06. Cal: pays for itself only if i06 regresses. |
| 31 | i10 | Last-words log | 3 | 5 | 4 | 3 | 5 | 20 | Synergy absorbed by i38; standalone weak. |
| 32 | i37 | Hash-chain stash naming | 3 | 5 | 4 | 3 | 5 | 20 | Useful but smaller-scope than its rank suggests. 27-stash spiral mostly disappears if i06 ships. |
| 33 | i23 | Push by declared intent | 3 | 3 | 3 | 4 | 4 | 17 | Cheap retrofit on i17 — Cal likes that — but the *intent-label* abstraction is scope-creep. Ship i17, see if intent-labels emerge as a real need. |
| 34 | i40 | `dx tree-tail` streams working-tree status | 2 | 4 | 4 | 3 | 5 | 18 | Watching the storm rather than guessing. Cool but optional. |
| 35 | i41 | Pre-flight push-readiness 0-100 score | 2 | 5 | 3 | 3 | 5 | 18 | Cute. Cal questions whether a number-from-signals is more useful than the signals. |
| 36 | i29 | `dx claim <prefix>` lockfile | 3 | 4 | 3 | 3 | 5 | 18 | Cal's question: are we sharding the storm or solving it? Sharding is mid-tier. |
| 37 | i30 | Pre-touch narration pub/sub | 2 | 4 | 3 | 3 | 5 | 17 | Pour-and-process generalized. Real value depends on whether agents read each other — unproven. |
| 38 | i09 | CAS push loop with `--force-with-lease` | 3 | 3 | 4 | 3 | 3 | 16 | Doctrinally blocked until carve-out. Cal: even if carved, the simpler i06+i07 answer covers most of the value. |
| 39 | i14 | Read-only checkout + propose-via-PR | 3 | 2 | 3 | 3 | 2 | 13 | Serializes via broker. Cal: if you want serialization, *adopt i28 and let the human serialize*. Don't build a broker. |
| 40 | i21 | `gin-commitd` daemon | 3 | 3 | 3 | 3 | 4 | 16 | Backend variant of i20. Premature — try i20+i01+i07 first. |
| 41 | i33 | 30s cancellation window | 2 | 3 | 3 | 2 | 4 | 14 | Friction tax in service of a multi-agent assumption Cal doesn't grant. Skip-adjacent. |
| 42 | i22 | Outbox: agents commit locally, worker drains | 3 | 3 | 3 | 3 | 3 | 15 | Mental-model shift. Cal: do we need decoupling, or do we need fewer agents? |
| 43 | i15 | Scratch-tree workspaces | 3 | 3 | 3 | 2 | 2 | 13 | Reinvents i11 with raw FS copies. Strictly worse than i11. |
| 44 | i13 | Per-agent microVM | 4 | 1 | 3 | 3 | 1 | 12 | Maximal isolation, maximal cost. Cal: only if i11+i28 prove insufficient. Today the answer is "no." |
| 45 | i49 | Two histories: `main-human` and `main-gin` | 3 | 1 | 2 | 2 | 1 | 9 | History bifurcation is sticky. Cal: solving cross-stream interference structurally also creates cross-stream divergence structurally. |
| 46 | i51 | Kill `main` for agents — topic-graph instead | 3 | 1 | 2 | 3 | 1 | 10 | Pairs with i11+i28 logic but adds branch-spawn protocol + merge automation + CI-per-branch. Premature. |
| 47 | i45 | Append-only event log; tree is projection | 4 | 1 | 2 | 3 | 1 | 11 | Stepping stone to i44. Cal: if we ship i06+i28, the loss-of-work problem this solves is already solved. Don't pay an event-log tax for prevention we already have. |
| 48 | i50 | Git-as-cache; canonical intent log is source of truth | 3 | 1 | 1 | 2 | 1 | 8 | **Skip pick.** Worldview shift, not idea. Capture as zettel-essay; remove from buildable pool. |
| 49 | i47 | Use jj as the agent's git surface | 3 | 1 | 2 | 2 | 1 | 9 | **Skip pick.** Replaces team muscle memory to solve a problem i06+i28 covers. Topic constraint upheld. |
| 50 | i44 | CRDT-backed virtual filesystem | 4 | 1 | 1 | 2 | 1 | 9 | **Skip pick.** Multi-quarter scope; problem dissolves if cap or worktrees ship. Don't research-track. Name it as not-built. |

---

## Cal's parting note

The pool is mostly correct *given* the premise that we want N parallel
agents on one checkout. Strip that premise, and the top half of Cal's
ranking (i28, i06, i31, i05, i01, i19, i16, i17, i35) handles 80% of the
lived pain at <1 week of total engineering.

The bottom half is over-engineered for a working condition we haven't
chosen deliberately.

If the team adopts only one Cal-shaped move from this round, make it i28 —
not because cap=1 is the answer, but because the *act of capping* generates
the data that tells us whether the rest of the pool is even worth ranking.
