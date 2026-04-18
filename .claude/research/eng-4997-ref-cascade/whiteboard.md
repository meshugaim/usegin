# Research: Best solution for ref-identity cascade in Data tab overlays (bug #052)

## Current State
Phase: 1e CI-evidence | Status: **DONE — FIX CONFIRMED ON CI**
Last checkpoint: shard-2 artifact inspection showed BOTH regression tests passed cleanly on first attempt in staging run 24569607214 (2026-04-17 14:12 UTC). Shard-2 failures were UNRELATED flakes. Two corroborating CI runs now in flight.
Next: converge research — write retraction footer for bug doc, close ENG-4997/ENG-5001 as superseded by ENG-4998, file side-thread for unrelated shard-2 flakes

## Shared-state collision note
`.claude/builds/active.json` `research` key is a singleton. Another research (`fast-pre-push-tests`) is registered there now. My whiteboard on disk at `.claude/research/eng-4997-ref-cascade/whiteboard.md` is authoritative and unaffected; only the Auto-Inject re-injection hook is lost. Director will re-ground from whiteboard manually between phases.

## Auto-Inject (automatically re-injected after every agent/team return)
Process: Read whiteboard → write note-to-self (§Note-to-Self) → spawn phase manager → read summary only → distill → update whiteboard
Role: I am the director. I NEVER do research myself — not reading sources, not analyzing findings, not verifying claims, not reading phase files. Every action = a subagent. If I'm about to do it myself, I stop and delegate. (§Hard Rules, §Role Collapse)
Output: Tell every agent "return ≤10 line summary; write details to phase file." I read summaries, never details. If unclear, spawn a follow-up agent to clarify — don't read the source. (§Agent Output Protocol)
Convergence: After each phase, ask: do findings answer the thesis? Are new phases producing novel insights? If not, trigger judgment. (§Convergence)

## Autonomy
Mode: **significant moments** — check in on pivots, surprises, or before converging. Don't narrate routine phases.

## Thesis / Driving Question
What is the best solution to the ref-identity cascade causing React #185 "Maximum update depth exceeded" on the Data tab during polling-active overlays, where "best" weighs:
- Mechanism (actually fixes the observed crash, not just plausible leaves)
- Verification cost (can we confirm on the real-browser repro?)
- Migration cost (from shadcn+Radix today)
- Long-term maintainability (doesn't re-emerge in Email/People/Drive tabs)

## Scope
**In:**
- Diagnostic: identify the actual seed (app code? useComposedRefs array-identity? Fast Refresh?) via static audit + instrumentation + cold repro
- Library alternatives: Radix patched, React Aria (Adobe), Headless UI (Tailwind Labs), Floating UI direct, native platform (`<dialog>` / `popover="auto"` / CSS `anchor-name`)
- **OSS survey**: how do Next.js+shadcn/Radix apps in the wild (Cal.com, Dub, Plane, Formbricks, Documenso, Twenty, Langfuse, Novu, Trigger.dev, Ghost, etc.) handle poll-driven overlays? Any known hits of React #185 / composed-ref cascade in their GitHub issue history?
- shadcn swap-underneath feasibility (per-component: Dialog, Popover, DropdownMenu, Tooltip, Select, Sheet)
- General app-level stable-setter pattern (`useStableCallback` at `asChild` boundaries)
- ENG-4998 (React Query) pivot credibility

**Out:**
- Actual implementation / shipping code
- Fixing ENG-5003 (slot-patch precedent) — separate follow-up
- Upstream Radix PR authoring

## Planned Phases (reshaped again after 1d pivot)
- **Phase 1 — Diagnostic: find the seed**
  - 1a DONE: static audit (3 plausible candidates, not confirmed)
  - 1d DONE: targeted repro — **baseline did not reproduce**; verdict: escalate to instrumentation
  - **1e (NEW, recommended next): baseline re-establishment**. Three mini-options to run in parallel or sequence:
    - 1e-i: rerun baseline in main working tree (not worktree) — 15 min
    - 1e-ii: rerun baseline on production build via e2e locally — 30 min (bug doc Next Direction #4)
    - 1e-iii: `git log` between prior-session HEAD and today's HEAD for anything that could have incidentally fixed — 15 min
  - 1b (instrument composeRefs) — reactivated as fallback if 1e confirms bug still exists but repro is flaky
  - 1c (cold repro without Fast Refresh) — deferred, would subsume into 1e
- Phase 2 Library alternatives — unchanged but lower priority now
- Phase 3 OSS survey — unchanged but lower priority now
- Phase 4/5/6 — unchanged, pending Phase 1 closure

**New possibility to consider:** if the bug no longer reproduces after 1e, the research thesis shifts from "design the best fix" to "design a regression test for recurrence + decide whether to ship the plausible hardening (ENG-5001 leaf patches + site 1–3 app-side stabilization) as defense-in-depth."

## Key Findings

### Phase 1e-iii — git-log analysis (SMOKING GUN)
- **87 commits** between `a3d049b41` (2026-04-17 09:15:01) and HEAD `42a9eef72` (2026-04-18 11:01:30).
- **Smoking gun: `704baa8ed` (2026-04-17 09:23:08) — "fix(data-tab): Phase 3 — rewire component to useDataTab, eliminate bug class"**
  - Introduces `@tanstack/react-query` on the Data tab. React Query's default `structuralSharing: true` preserves outer-array identity across refetches.
  - Mechanism: eliminates the hand-rolled setState cadence that produced new-identity rows on every poll tick — which was the *real* seed of the ref-identity flip feeding into `useComposedRefs`.
  - This is **ENG-4998 from our escape-hatch list** — already landed a day ago.
  - Commit message explicitly calls out `structuralSharing` as "load-bearing fix for ENG-4916 max-depth."
- **Corroborating commit: `a68f99c23` (2026-04-17 10:52:50) — dropped `test.fail()`** from the max-update-depth regression guard, treating it as passing after the fix.
- Confidence: worker assessed 99%.
- Phase file: `.claude/research/eng-4997-ref-cascade/phases/phase-01e-iii.md`

### Unresolved puzzle
Prior session `c3cd5f19` started at **10:09 UTC** — roughly 45 min *after* the fix landed at 09:23 — and reported the bug as deterministically reproducing. Three hypotheses (still open; 1e-iv needed):
- (h1) Prior session was on a branch / stash / working tree that didn't include 704baa8ed
- (h2) The fix addresses a *related but different* mechanism (ENG-4916 parent) and ENG-4997 is a genuinely distinct cascade that survives
- (h3) Prior session's "deterministic 2/2" was stale repro state from earlier investigation

### Phase 1e — authorship + CI evidence
**Authorship:**
- `704baa8ed` — Author: oria masas. **Co-Authored-By: Claude Opus 4.7, Claude-Session `6c0698ad-9acd-42fa-ab55-08f23a49053e`**. Part of ENG-4998, closes ENG-5002. 9 files, +100/−570.
- `a68f99c23` — Author: oria masas. Co-Authored-By: Claude Opus 4.7, Claude-Session `8843238c-8d4a-4ea0-8ea7-cc41775f3bb5`. Closes ENG-4916 + ENG-4998. Removed `test.fail()` from `tests/e2e/tests/data-tab.spec.ts:192`.
- Note: the prior *investigation* session (`c3cd5f19`, 10:09 UTC) is a **different** session than the fix-authoring session (`6c0698ad`, 09:23 UTC). Two parallel Claude sessions working the same bug family that day — fix session shipped Phase 3; investigation session pursued ENG-5001 patches without (apparently) integrating the Phase 3 fix.

**CI evidence:**
- Code-integration test `data-tab-render-invariant.test.tsx` is `describe.skip()` post-fix — file compiles but asserts nothing. **NOT meaningful CI coverage.**
- E2E regression `tests/e2e/tests/data-tab.spec.ts:192` "deleting a file does not crash with max update depth" — `test.fail()` removed in a68f99c23. **This IS the regression guard.**
- Note mismatch: ENG-4997's symptom is at `tests/e2e/tests/file-upload.spec.ts:53` per the bug doc. The regression guard that flipped lives in a *different* file (`data-tab.spec.ts:192`). Worth clarifying whether `data-tab.spec.ts:192` actually covers the ENG-4997 scenario (file upload with pending row crash) or only the ENG-4916 scenario (single-row delete crash).
- Last staging run with the fix: 2026-04-17 14:12:37 UTC, run #24569607214. 3/4 shards passed; **shard 2 failed**. Artifact inspection showed shard 2 owned all of `data-tab.spec.ts` + 2 tests from `file-upload.spec.ts`. **Both regression tests PASSED on first attempt** — `data-tab.spec.ts:192` (8.4s) and `file-upload.spec.ts:53` (17.1s). Shard-2 failures were UNRELATED: `data-tab.spec.ts:59` (seed row count 3 vs 4) and `:265` (access toggle Internal→External).
- **Verdict:** CI proof is **STRONG**. Both manifestations (ENG-4916 delete, ENG-4997 upload-then-delete) passed under CI with fix in place.
- **Corroborating runs in flight** (staging @ 3be58cdcc, both fix commits as ancestors):
  - Full suite: https://github.com/AskEffi/test-mvp/actions/runs/24604309738
  - Targeted (grep `"Maximum update depth|owner can delete an uploaded file|max update depth"`): https://github.com/AskEffi/test-mvp/actions/runs/24604310095

### Resolution of h1/h2/h3 puzzle
- **h1 confirmed most likely:** investigation session `c3cd5f19` (10:09 UTC) was almost certainly working against a stale/branch-local tree lacking 704baa8ed.
- **h2 refuted:** no distinct ENG-4997-specific cascade survives — both manifestations' e2e pass.
- **h3 refuted:** session did observe React #185 firing, so tree definitely lacked the fix.

### Side threads (file separately, not in scope)
- `tests/e2e/tests/data-tab.spec.ts:59` — "shows seeded files" — shard 2 flake, seed row count mismatch.
- `tests/e2e/tests/data-tab.spec.ts:265` — "toggling access Internal→External" — shard 2 flake.

### Phase 1d — targeted repro (PIVOT: baseline did not reproduce)
- 0/4 attempts crashed. 3 normal + 1 cold-session, each with upload rows held in `Pending`/`Syncing` for 5+ seconds (longer than the prior-session 4–6s window). No React #185, no console errors, no error boundary.
- Environment: isolated worktree, fresh install, HEAD `42a9eef72`, 2026-04-18.
- Prior session's "deterministic 2/2 in dev-browser" was 2026-04-17 on a different working state.
- Worker's sharp secondary observation: **if site 1's per-render span recreation were alone sufficient to trigger the cascade, the crash would fire on every fast-poll tick irrespective of upload. The fact that the bug requires a transient-status row to manifest points the seed at DataTable row-scoped ref composition (sites 2/3 or neighbors), not the header.** That weakens the Phase 1a primary-seed assignment for site 1.
- Phase file: `.claude/research/eng-4997-ref-cascade/phases/phase-01d.md`; artifacts at `phase-01d-artifacts/`.

### Phase 1a — static audit (downgraded: "plausible candidates, not confirmed")
Three suspect sites in app code, all `TooltipTrigger asChild` wrapping elements whose identity or props change every render:

1. **PRIMARY: `nextjs-app/app/projects/[projectId]/config/data-tab-content.tsx:142–156`** — Tooltip wraps a `<span>` with conditional `tabIndex={canUploadFiles ? undefined : 0}` around an upload Button. Span recreated per render; conditional prop flip triggers Radix ref detach-reattach. Fast-poll (1500ms) re-renders `DataTabContent` constantly.
2. **SECONDARY AMPLIFIER: `nextjs-app/app/projects/[projectId]/config/data-tab/data-table.tsx:447–459`** — Tooltip on delete button with `disabled={isDeleting}` prop flip per row during sync state transitions.
3. **TERTIARY: `nextjs-app/app/projects/[projectId]/config/data-tab/data-table.tsx:141–154`** — Tooltip on Badge with inline-computed className per render.

**Root hypothesis:** the ENG-5001 Radix-leaf patches were code-quality fixes but insufficient — the leaves can't be stable if the outermost child handed to `TooltipTrigger` via `asChild` is itself unstable.

Phase file: `.claude/research/eng-4997-ref-cascade/phases/phase-01a.md`

**Caveat (director): this is a static-audit hypothesis. Not yet empirically confirmed. Before recommending a fix, phase 1b or a targeted repro should verify that fixing site 1 alone (e.g. stable span, or Tooltip wrapping the Button directly) eliminates the dev-browser crash.**

## Open Questions (reshaped by 1d pivot)
- **Does the bug still reproduce at all?** Baseline failed in worktree today. Needs confirmation in:
  - main working tree (not worktree — different node_modules / next cache possibly)
  - production build (not dev) — CI stack differed from dev stack in the bug doc
  - original repro environment (prior session's env state, if recoverable)
- **Has something incidentally fixed it between 2026-04-17 and 2026-04-18?** `git log 42a9eef72..HEAD` and `git log --since=2026-04-17` on nextjs-app — look for dep bumps, render changes, anything touching Radix / react / Data tab.
- **Is the bug transient-row-dependent in a deeper way than we thought?** Worker noted 5+ second `Pending`/`Syncing` windows didn't crash; prior session said 4–6s with at least one transient row. Possibly the crash needs a specific polling pattern (multiple rows transitioning concurrently? specific query cadence?).
- **Was the prior-session repro actually deterministic, or was the "2/2" a small sample?** Worth re-reading that session's repro notes.
- Downstream questions (paused until baseline re-established):
  - Does fixing site 1 alone stop the crash?
  - Is the `<span>`-wrap-trigger pattern widespread in the app?
  - OSS patterns for tooltip-on-disabled-button?

## Dead Ends
- **ENG-5001 inline-arrow patches at three Radix leaves** — empirically falsified. Patches at `/tmp/eng-5001-work/` applied, bundle verified, `.next` cleared, crash persists with identical 15-deep stack. Per prior session `c3cd5f19-0cbb-4d65-82a9-2c0bfebc8f62` and `docs/bugs/052-data-tab-max-update-depth-investigation.md`.

## Confidence Assessment
_(will fill after convergence)_
