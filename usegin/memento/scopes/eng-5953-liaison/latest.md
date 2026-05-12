# ENG-5953 — slice close

## Status

**Complete.** Slice 2 of ENG-4968 (per-workspace auth_mode override). Admin UI shipped; admin can change a workspace's auth_mode from /admin/workspaces and the chat resolution (Slice 1) consumes it.

## Trajectory

Trio executed planning (test-architecture, tdd-impl-plan) cleanly. tdd-execute attempted but degraded at T1 due to missing `Task` spawn primitive in this harness (see follow-up ENG-5968). Escalated to the liaison; steps 4–16 + mutation pass M1–M8 ran as liaison-orchestrated Wes/Ron cycles. ~30+ sub-agent spawns; zero inline edits from the liaison.

## Commits

Trio + walking-skeleton + cycles + mutation-pass + tightenings landed across 25+ commits on origin/main. Key SHAs:
- Test architecture: 200aef36b
- Impl plan: 8eb80bdd6
- Walking skeleton: 158b9f27d, fe51604bb
- Cycles T1–T8: a36b299ac/f7476dc9f/41a699c04, c812f53a6/2e5b874fc, 84fbe4207/2c2e01569/5c86602bd/c55e9ab30, baddc6f29/450df3fd1, 76cd37689/d3bb76cc7, 512a4fb37/ab3ef990e, e106a7724/da1cadb6f
- Biome cleanup: 4082c5bf0
- Slice-end tightenings: 45f8a8040 (AUTH_MODES const, JSDoc, factory cleanup)

## Verification

- All 5 auth-mode unit tests pass plain (T4, T5, T6, T7, T8).
- T1 type test passes.
- T2 + T3 integration tests pass against real Supabase.
- update-model-action regression suite: 15/0.
- tsc --noEmit: clean.
- biome check on slice-touched files: clean.
- Mutation pass M1–M8: **8/8 caught** (each pre-verified to disconnect behavior; no Slice-1-style M7 no-op-equivalent).
- DoD verifier: PASS-WITH-FOLLOWUPS (forward 9/9, backward 3/3).
- Two parallel unseeded reviewers: PASS-WITH-FIXES (3 small findings — addressed in 45f8a8040; 1 parent-sync finding — deferred as paired follow-up with FeatureSwitch).

## Refactor-phase posture

No `inner-refactor` steps were in the impl-plan by design. `AuthModeSelect` was scoped tight (mirror `FeatureSwitch`, ~40 lines inline). Name-vs-id extraction (workspaceId vs workspaceName in aria-label) deferred to post-slice per impl-plan §581–593. The slice-end tightening commit (45f8a8040) covered the small post-T1 cleanups (AUTH_MODES const, JSDoc, factory crutch).

## Carry-forwards filed as follow-ups

- **ENG-5967** — AuthModeSelect + FeatureSwitch parent-sync gap (paired). Three reviewers converged on existence; 2/3 voted "defer + follow-up" given the slice's spec AC4 framed only the *local* optimistic pattern. Real bug shared with FeatureSwitch.
- **ENG-5968** — tdd-execute skill Task-vs-Agent mismatch. Slice-tooling concern, not slice-feature.
- **ENG-5969** — Clean up `.tdd-execute/ENG-5953/` stale state file.

## Carry-forwards accepted (no follow-up)

- **Commit `e396c93c2`** swept 31 unrelated `tools/effi-cli/` + `tools/lib/auth/` files into the outer-red T4 commit via autosync Mode 1 collision (per `reference_autosync_concurrent_collisions`). Content harmless (ENG-5862 rename fallout); irreversible without force-push; subsequent commits tightened `git add` — no recurrence. Acknowledged in this polaroid; no code action.

## Manual round-trip

**Not run by automated DoD verifier** (test-supabase + Next dev not booted at slice close). The DoD verifier explicitly surfaced this as a deliverable line: Lihu (or whoever closes ENG-4968 at the parent level) should run the round-trip before promoting the parent issue:

```
1. just agent-dev
2. log in at localhost:63000
3. ensure your user is in the `admins` table
4. navigate to /admin/workspaces
5. change a row's Auth Mode dropdown
6. hard-reload the page
7. verify the dropdown shows the new value
```

Validates the `revalidatePath('/admin/workspaces')` → server-component re-fetch hop end-to-end (the integration test stubs `next/cache` because there's no request context, so the real cache-invalidation hop is unverified at the test layer).

## Resume cue

Nothing to resume. Next adjacent work is ENG-5967 / ENG-5968 / ENG-5969 above, or the cross-slice manual round-trip at ENG-4968's level.
