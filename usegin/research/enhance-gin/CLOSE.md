# Close — enhance-gin round 1

**Run:** Use the brainstorm + refine + prioritize team-skills (built earlier in this session) on Gin's own multi-agent autosync friction (z095). Produce a ranked, ready-to-spec round-1 picklist.

**Closed at:** 2026-04-27 by Gin session `73e20f04-8572-4b59-8fe9-fa241be758a2`

**Status:** Blocked-on-human. Round 1 is fully prioritized and ready to spec; 5 product-shape decisions are waiting on Lihu's calls before round 2 can shape itself.

## What landed

- **Three principles** in `usegin/Gin.md` — process-over-outcome / unlimited-resources / laconic.
- **`!zettleit` DX** — `dx zettel it` + `tools/bin/zettleit` shortcut + skill/README pointers + tests.
- **Wispr corrector grew** — `again`/`Game Giant` → Gin; `settle it`/`zettle custom` → zettleit.
- **Four team-skills** — brainstorm, refine, prioritize, consult — each with a skill lab.
- **Round-1 pipeline run end-to-end** — 5 ideators (158 raw → 51 distinct) → 5 refiners (legibility + 4 prioritize-prep fields per idea) → 5 prioritizers (Mark/Johan/John/Sam/Cal) → Borda + convergence aggregate.
- **Six-pick spine, 5/5 unanimous in everyone's top-13:** i06, i01, i17, i19, i35, i38 (+ i05 as 4/5 high-confidence support).
- **Universal meta-rulings** — i42 telemetry-first rejected as gate / accepted as ethos; i19 trailer-only v0 unanimous.
- **Closing zettel z104.**

Front door for the work: `usegin/research/enhance-gin/prioritize/aggregate.md`. Read it cold and you have the full picture.

## What's blocked on you

5 decisions waiting. Each is in product/posture language — the implementation shape follows from your call. Order matters only for D2 (it reshapes the size of what we ship).

### D1 — Should agents have automatic-retry mode for pushing to main, or wait for manual recovery?

**What:** When an agent's push to `main` is rejected because someone else pushed first, should the agent's tooling automatically rebase + retry (like a database compare-and-swap), or stop and wait for the human?

**Why:** This determines how self-healing the multi-agent setup is. With auto-retry, agents don't lose work or pause when sibling agents push concurrently — but the retry uses `git push --force-with-lease`, which the codebase doctrine flags as a force-push variant. Without auto-retry, every push race becomes a recovery task. Today neither exists; today's behavior is "drop the commit and lose the work" (which is what we're fixing in round 1 regardless).

**Recommendation:** Allow the auto-retry. `--force-with-lease=<seen-sha>` is structurally a compare-and-swap — it fails closed if state has moved, never overwrites unseen commits. Distinct from raw `--force` which the doctrine should still forbid. Carve it out explicitly when used as the autosync push primitive.

**Cost:** A short doc update + one phrase in the autosync wrapper. Otherwise zero.

**Risk:** A future agent reads the carve-out as license for raw `--force`. Mitigated by: name the wrapped primitive (`dx ship`), keep raw `git push --force` blocked.

**What to worry about:** If we ever want to share this autosync pattern outside our own dev loop, a future reader (auditor, compliance, new hire) needs to find the carve-out before they find the doctrine. Make sure the carve-out lives next to the doctrine, not in a buried hook script.

### D2 — Should multi-agent runs be the default mode, or require explicit opt-in?

**What:** Today, anyone can spawn N parallel agents on the same checkout. The friction we just lived through (4 commits eaten, 27 stashes accumulated, sibling WIP blocking pushes) only exists because of that default. Should we keep it, cap at one agent unless overridden, or build true isolation (worktree-per-agent)?

**Why:** Half the round-1 idea pool exists *because* we run N agents on shared tree. If we don't actually want N agents, we can retire that half of the pool and ship a much smaller round 1. If we do, we should pay the worktree-isolation cost so multi-agent stops being silently expensive. Today we pay the cost in lost commits, which is the worst of both worlds.

**Recommendation:** Hybrid. Default to one agent per checkout; spawning a second requires a one-line override (`dx storm allow-N=K`) that surfaces the cost at the moment of choice. If overrides happen routinely, build worktree-per-agent (i11 from the pool) as the implementation. If they rarely happen, we've retired half the pool for free.

**Cost:** Small (a counter at agent-spawn + a check). Adds 5 seconds of friction the first time anyone spawns a second agent each session.

**Risk:** The team-form skills (brainstorm/refine/prioritize/rnd) all spawn parallel sub-agents — those need to count as one-coordinated-spawn, not N independent ones. If the cap interferes with the very pipeline that proved its value this run, we've made the tooling worse.

**What to worry about:** This decision shapes the *size* of round 1. If you go A (cap), round 1 stays small (the spine + a handful of supports). If you go B (embrace + isolate), round 1 grows to include i11 and the per-agent-isolation cluster (~3 more weeks of work).

### D3 — Should we keep a local quality gate before push, or trust CI as the only gate?

**What:** The pre-push hook runs lint + typecheck + tests against the whole working tree before letting any push through. CI runs the same checks on `main` after push. Should we keep the local hook (with the diff-scoping fix from round 1), or delete it entirely and trust CI as the single gate?

**Why:** This is "is the local hook earning its keep, or is it duplicate work?" Today it's blocking pushes for reasons CI also catches, *plus* false-positives from sibling-agent WIP (which CI never sees). Round-1 spine fixes the false-positive class. The remaining question is whether the local-hook value-add (catch issues 30 seconds earlier) justifies the maintenance cost.

**Recommendation:** Keep the local hook for now (with round-1 fixes), revisit in a quarter once we have data. Round 1 ships either way; this only affects round 2+.

**Cost:** Status quo, plus eventual ~3-day project to delete the hook + build revert-on-red automation if you go B later.

**Risk:** A = duplicate-of-CI smell persists. B = "CI is broken so nobody can land" failure mode without the local safety net.

**What to worry about:** If we end up adding more local checks over time (security scans, license checks, perf budgets), the "duplicate of CI" framing breaks down — the local hook becomes unique value. Watch for that drift; if it happens, re-evaluate.

### D4 — Should agent commits stay attributed to the human in `git log`, or show as `gin-<session>`?

**What:** Right now every agent commit is attributed to the human (you / Oria) in `git log --author`. We can either keep that, or set the author to `gin-<session-id>` per agent run.

**Why:** Forever-fact in git history. If we change to gin-attribution today, every commit from now on shows the agent's session id as the author. We've lived with human-attribution for a year+ and it's the convention every git tool assumes. The 5/5-prioritizer team unanimously recommended *trailer-only* (`Agent-Session: <id>` as a footer line, human stays as author) — but I want your explicit nod since this is one of those "decided once, sticks for the life of the repo" calls.

**Recommendation:** Trailer-only. Keep the human as author; add a footer line so forensics can still trace which session produced each commit. Reversible (drop the trailer hook); author-name change isn't.

**Cost:** Zero (just don't change `GIT_AUTHOR_NAME`).

**Risk:** Author column shows the human even on agent commits — `git blame` will sometimes lie about who wrote a line. Mitigated by trailer + reflog + session JSONLs preserving the real chain.

**What to worry about:** If we ever want commit history to be *automatically* analyzable by who-actually-wrote-it (compliance, audit, attribution-driven workflows), the trailer makes that a parse step instead of a column read. Acceptable today, painful later.

### D5 — Should agents use a different version-control tool (`jj` / Jujutsu) than the team's git?

**What:** `jj` is a git-on-top-of-git tool with first-class concurrent branches and "conflicts as data, not errors" — it solves several problems in our pool natively. The team's `git` workflow keeps working (jj uses git refs); only the agent's tooling changes.

**Why:** Most of our multi-agent friction comes from git's model fighting us. jj's model fights us less. But adopting it means every agent's muscle memory + every hook + every wrapper retrains.

**Recommendation:** No, not now. Topic frame says "no replacing git itself"; jj-on-top-of-git is borderline but real, and the round-1 spine fixes 80% of the pain without it. Park as research-track for after round 1 ships and we have new data.

**Cost:** A = zero (status quo). B = a quarter of plumbing work + retraining + bus-factor risk (only Gin would know jj fluently).

**Risk:** A = we keep paying the git-model tax forever. B = we adopt a tool the team doesn't use, then have to teach it or revert.

**What to worry about:** If round-1 spine lands and the multi-agent pain *doesn't* go away (i.e. we discover the friction is git-shaped not autosync-shaped), this question re-opens with new evidence.

## How to continue

1. Read this file cold.
2. Make the calls on D1–D5. Order doesn't matter for D1, D3, D4, D5. **D2 (parallelism mode) shapes round-1 size — answer it first if you want to know how big the spec gets.**
3. Tell Gin "ship round 1" with your D-calls inline. The next Gin (this session resumed, or a fresh `claude --resume <session-id>`) starts from the next-action below with your decisions baked in.

## Next action (if all decisions go to recommendation)

If you greenlight the recommendations across the board: invoke `/spec` on the round-1 bundle (i06 + i38 + i19 + i17 + i16 + i01 + i05 + i35) — single spec covering all 8 picks, since they compose into one coherent change touching `tools/dx/`, `.claude/hooks/`, and `.husky/pre-push`. Then `slicing-specs` to break into 2-3 vertical slices, then implement. Round 1 fits in a single PR. ETA from green-light to merged: 1-2 days of focused work.

If D2 goes to A (cap at 1) instead of C (hybrid): round 1 stays exactly as above, plus i28 (the cap). If D2 goes to B (embrace + build i11): round 1 grows by i11 + i12, +1-2 days.

## Pointers (front-door legibility)

- **Front door / cold-reader entry:** `usegin/research/enhance-gin/prioritize/aggregate.md` — Borda + convergence-bucket views, full ranking, 6-pick spine, all 5 dilemmas in z026 shape.
- **Pool source:** `usegin/research/enhance-gin/brainstorm/ideas.md` — 51 refined ideas, all with cost/reversibility/prerequisites/blast-radius fields.
- **Per-prioritizer rationale:** `usegin/research/enhance-gin/prioritize/prioritizers/0[1-5]-*.md` (Mark/Johan/John/Sam/Cal full rankings + notes).
- **Closing zettel:** `usegin/zettel/zettels/z104-enhance-gin-round-1*.md`.
- **Friction zettel that motivated the run:** `usegin/zettel/zettels/z095-cross-agent*.md`.
- **Resume pointer:** `claude --resume 73e20f04-8572-4b59-8fe9-fa241be758a2` (this session).
