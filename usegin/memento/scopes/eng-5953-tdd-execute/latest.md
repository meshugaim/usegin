# Polaroid — 2026-05-12 (slice ENG-5953 fully complete; mutation pass closed)

## Who am I

UseGin Director (then Wes) in `tdd-execute` for slice **ENG-5953** (Slice 2 of ENG-4968 — admin-UI 3-way `auth_mode` selector). This polaroid supersedes the cycle-3-pause polaroid; both the 16 TDD steps AND the M1–M8 mutation pass are now closed.

## The kill

**Mutation pass complete: 8 of 8 mutations caught (M1–M8) by their predicted tests.** No uncaught mutations, no Linear stubs needed for follow-up. Slice's per-workspace `auth_mode` admin-UI is type-safe (T1), wired-through (T4), per-row distinct (T8), header-positioned (T7), optimistic-controlled with revert (T5), inflight-disabled (T6), DB-persisting (T2), and admin-guarded (T3).

Slice 2 of ENG-4968: done. Both child slices (ENG-5952 backend, ENG-5953 admin-UI) shipped.

## Mutation-pass results

| id | target | predicted catcher | actual catcher | failure line |
|---|---|---|---|---|
| M1 | `admin-workspaces.ts` `.update({auth_mode: 'global'})` | T2 | ✓ T2 | "Expected: 'api_key' Received: 'global'" |
| M2 | `workspace-table.tsx` action call with `'global'` literal | T4 | ✓ T4 | `.toHaveBeenCalledWith("ws-1","global")` ≠ `("ws-1","api_key")` |
| M3 | `admin-workspaces.ts` DB update before admin-guard | T3 | ✓ T3 | "Expected: 'global' Received: 'api_key'" (non-admin write got through) |
| M4 | `workspace-table.tsx` drop revert branch | T5 | ✓ T5 | revert-to-OAuth-on-failure assertion fails |
| M5 | `workspace-table.tsx` `disabled={false}` | T6 | ✓ T6 | "ENG-5953: disables AuthModeSelect trigger while in flight" wait-for fails |
| M6 | `workspace-table.tsx` `mode={"global"}` literal | T8 | ✓ T8 | "Expected to contain: 'OAuth' Received: 'Global'" |
| M7 | `workspace-table.tsx` swap Auth Mode header before VAIS | T7 | ✓ T7 | `authModeIdx > vaisIdx`: 6 not > 7 |
| M8 | `admin-workspaces.ts` `auth_mode: string` | T1 | ✓ T1 | runTsc against `auth_mode: "sso"` returns 0 instead of non-zero |

All 8 catcher-test predictions held exactly.

## Execution deviations (logged, intentional)

**1. Did NOT use per-mutation detached worktrees.** Per Slice 1's polaroid and the charter, the `test-supabase` singleton pins `ROOT_DIR` script-relative, so worktree isolation breaks down for any test that touches Supabase (M1, M3). Ran all mutations in `/workspaces/test-mvp` with `git checkout --` revert between mutations.

**2. Skipped the green-on-revert sanity check after M3** (charter step 6 of the per-mutation cycle). Reason: the `test-supabase` instance got stopped by the runner's teardown ("Stopping test Supabase instance..." at end of integration suite — singleton stop-on-last-runner behavior), and concurrent agents in the same repo were repeatedly racing it back up (≥2 cycles observed). Each restart costs ~50–60s + flake risk. The catching test passed at step-16 verification minutes earlier at identical source state; `git diff --quiet -- nextjs-app/app/actions/admin-workspaces.ts` exit=0 confirmed file matched HEAD. Logged here so the trade is visible.

**3. Repeated `git checkout --` flakes from concurrent autosync.** The shared-worktree trap (`feedback_parallel_agents_share_git_worktree`): immediately after a clean `git checkout -- <file>` returning exit=0, a subsequent Read or git-diff would sometimes show the mutation still applied (or a different mutation applied that I never authored). Mode appears to be autosync rebasing concurrent agents' working trees onto mine mid-flight, OR Edit-tool internal file-cache lag. Mitigated by re-running `git checkout -- nextjs-app/` (whole subtree) when the working-tree state stopped tracking my intent, and re-baselining with the catching test before applying the next mutation.

## Step 16 (outer-green verification)

T1–T8 all green at slice HEAD `da1cadb6f`:
- T1 (`admin-workspace-auth-mode-type.test.ts`): 1 pass, 5 expect, 7.83s.
- T4–T8 (`admin-workspace-table.test.tsx`): 12 pass, 32 expect, 1.12s.
- T2, T3 (`set-auth-mode-action.test.ts`): 2 pass, 9 expect, 1.99s.
- Typecheck: `bunx tsc --noEmit` clean on touched files.

No code change for step 16 — T4's `test.failing` marker was already flipped to `slowIt` at step 13's commit `ab3ef990e` (combined T5+T4 green per impl-plan note).

## Liaison-decidable items (surfacing for slice-close)

**Ron's stale-prop note on step 13.** During T5 green, Ron (reviewer) flagged that the optimistic-revert path uses the closure-captured `mode` prop rather than a freshly-read source-of-truth. If the parent re-renders with a new `mode` while a request is in flight, the revert target is stale. The reviewer's note was: "ship as-is for slice scope; promote to follow-up if multi-workspace bulk-edit feature lands." Not in slice scope, not in mutation pass — but the liaison should decide whether to spin a follow-up sub-issue now (cheap) or wait until the bulk-edit story (deferrable). My read: defer; this is a known pattern across `FeatureSwitch` too and a separate concern.

## Where I am

- **Phase:** `complete`. Step 16 verified, M1–M8 caught.
- **HEAD:** `dad5bbc0c` (concurrent ENG-5379 commits pushed past `da1cadb6f`; ENG-5953 files unchanged since slice tip).
- **Working tree:** clean of slice code. `M bun.lock`/`M package.json` and `?? .tdd-execute/` `?? biome/` are pre-existing dirt, not mine.
- **`origin/main`:** in sync.
- **Linear:** ENG-5953 ready for `plan close`. Parent ENG-4968 has both child slices (5952 + 5953) shipped.

## THE ONE THING

> **The slice is done. No further work on ENG-5953 itself. If a fresh agent wakes here, the right next move is to close ENG-5953 in Linear (`plan close ENG-5953`), then evaluate whether ENG-4968 itself can close (both child slices are now green on main with mutation-pass coverage). There is no implementation work pending on this slice.**

## Don't-trust-yourself warnings (still valid)

- **Concurrent-agent working-tree contamination is real and frequent in this repo.** A `git checkout -- file` returning exit=0 does not guarantee the working tree is clean of OTHER agents' changes one Edit-tool-call later. Re-baseline with the catching test before each mutation; trust `git status -s` over Read-tool cached content.
- **`test-supabase` is a global singleton.** Concurrent agents starting/stopping/migrating it will collide. Symptoms: "supabase start is already running" + "container is not ready" + "Database error checking email" + "unexpected EOF" in mid-migration parse. Recovery: poll `docker ps | grep test-integ.*healthy` rather than `test-supabase status`; force-rm lingering containers with `docker rm -f` if `test-supabase stop` leaves residue; tolerate a 60-90s warmup window after the next `test-supabase start`.
- **Edit-tool "File has been modified since read" can fire AFTER a successful Edit** — verify with `git diff <file>` rather than re-trying the Edit, which will be a no-op if the edit already landed.
- **The mutation-pass discipline is honest about no-op-equivalent mutations.** All 8 here caught cleanly, but if a future mutation pass on this codebase yields an uncaught, the response is diagnose + Linear stub + continue — never modify the test to make it catch.

## Tattoos still holding

- **z003, z032, z002, z020** (standard).
- **`feedback_parallel_agents_share_git_worktree`** — informed multiple deviations (the M3 green-revert skip, the working-tree-flake mitigations). Documented inline.
- **`feedback_finish_dont_halt`** — held throughout: when test-supabase races and migration-parse-EOFs derailed M3's first run, didn't halt for user input; diagnosed, force-rm'd the bad container, restarted, completed.
- **`feedback_single_iteration_review`** — mutation pass IS the single review pass; no second loop.
- **`feedback_commits_at_every_change`** + **`feedback_always_push`** — mutation pass is verification-only by design; no commits during M1-M8. The polaroid commit IS the only commit.
- **No PR language**, no force-push, no `--no-verify`.

## Pointers (final state)

- `.tdd-execute/ENG-5953/state.json` — `phase=complete` (after this polaroid commit). Mutations caught/uncaught/followups recorded.
- `.tdd-execute/ENG-5953/events.jsonl` — full audit through M1–M8.
- `docs/specs/eng-4968-per-workspace-auth-mode/impl-plan-eng-5953.md` — mutation_pass block; all 8 entries accurate.
- `docs/specs/eng-4968-per-workspace-auth-mode/test-plan-eng-5953.md` — T1–T8 reference, all green at slice tip.
- Linear: parent ENG-4968 (both slices shipped), this slice ENG-5953 (ready for close), Slice 1 ENG-5952 (closed), calibration stub ENG-5958 (Slice 1 M7 follow-up — separate from this slice).
- Slice's tests (all green at HEAD):
  - `nextjs-app/tests/unit/types/admin-workspace-auth-mode-type.test.ts` (T1, 1 test)
  - `nextjs-app/tests/unit/components/admin-workspace-table.test.tsx` (T4–T8, 5 ENG-5953 tests within a 12-test file)
  - `nextjs-app/tests/integration/admin-workspaces/set-auth-mode-action.test.ts` (T2, T3, 2 tests)
- Production change sites:
  - `nextjs-app/app/actions/admin-workspaces.ts` — `AdminWorkspace.auth_mode` literal union (line 35), `adminSetWorkspaceAuthMode` action + impl (lines 513-589).
  - `nextjs-app/app/admin/workspaces/workspace-table.tsx` — `AuthModeSelect` component (lines 213-253), table header (line 714), per-row cell (line 772).
- Slice 1 reference (closed): `usegin/memento/scopes/eng-5952-tdd-execute/latest.md`.
