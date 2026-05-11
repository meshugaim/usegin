# Polaroid — 2026-05-11 15:47 UTC (scope: eng-5952-tdd-execute)

## Who am I
**Director** in the `tdd-execute` skill for slice **ENG-5952** (Slice 1 of ENG-4968 per-workspace chat `auth_mode` override). Opus orchestrator; never edits code/tests directly — spawns role-isolated tweakers (Haiku), unseeded reviewers (`ron`, Opus), and a separate verifier (Opus) per cycle. The PreToolUse hook at `.claude/skills/tdd-execute/hooks/gate-edit-by-phase.ts` denies my edits to source paths by design — there's a carve-out for `.tdd-execute/<slice>/{state.json,events.jsonl}` (committed earlier in slice setup).

## The kill
Drive 12 more TDD cycles + mutation pass for ENG-5952 so the outer-red T4 (`ctx.chat_config['auth_mode'] == 'api_key'` for workspace-overridden chat_config) flips to xpass-then-pass at cycle 20.

## Where I am
- **Phase:** `green` (just landed cycle 8 inner-green T3). Ready to advance to step 9 (inner-red T8 types regen).
- **Slice progress: 8/20 commits on `main`.** All migration substrate complete. Next phase = types regen → `build_chat_context` resolution logic → outer-green T4 → mutation pass.

- **Done (committed and pushed to `origin/main`):**
  - `5e8da734b` — outer-red T4 (xfail-strict; fails at `chat_context.py` resolution layer)
  - `13e2a0297` — inner-red T2 (workspaces.auth_mode default test, xfail-strict)
  - `dce6a2774` — inner-green T2 (migration `NOT NULL DEFAULT 'global'`)
  - `85799e1f7` — inner-red T1 (CHECK constraint test, xfail-strict)
  - `b616ae330` — inner-green T1 (`workspaces_auth_mode_check` constraint)
  - `1fb523768` — verification-only T12 (admin RPC guard regression pin; no xfail, passes today)
  - `274ef9af0` — inner-red T3 (RPC returns auth_mode test, xfail-strict)
  - `3438030c9` — inner-green T3 (RPC re-created via DROP+CREATE because `CREATE OR REPLACE` can't change RETURNS TABLE shape — SQLSTATE 42P13)

- **Not done (open-to-empty):**
  - Step 9: inner-red T8 — types regen test. NO file path predicted yet by impl-plan (read `n: 9` for predicted_seam_touchpoints).
  - Step 10: inner-green T8 — run `just supabase-types` to regen `nextjs-app/lib/supabase/database.types.ts`.
  - Steps 11-12: T7 (override reads workspace.auth_mode).
  - Steps 13-14: T5 ('global' literal fall-through; AC4).
  - Step 15: T6 (project_id=None, verification-only).
  - Step 16: T9 (workspace_id=None, verification-only).
  - Steps 17-18: T10 (try/except + Sentry on workspace read failure).
  - Step 19: T11 (Layer-2 wiring pin, verification-only).
  - Step 20: outer-green T4 — flips xfail, full slice passes.
  - Mutation pass: 7 mutations, runs under `phase=mutation-pass` per-mutation worktrees (per skill epilogue). Required per impl-plan.
  - After Slice 1 closes: ENG-5953 (admin UI). Handoff note suggested running Slice 2 under `liaison` instead of trio (UI is mechanical mirroring of `FeatureSwitch`).

- **In flight:** nothing uncommitted. Working tree:
  ```
  ?? .tdd-execute/   # workspace state, intentionally untracked
  ```
  `git log origin/main..HEAD` is empty — local matches origin.

## THE ONE THING
> **At each inner-green, the test xpasses strict (xfail marker) → suite RED. Two-spawn protocol per Lihu's cycle-3 decision: phase=green GreenTweaker mutates production, then flip phase=red briefly for a separate tweaker to remove the xfail marker; commit both as one green commit. The hook physically denies the wrong-phase edit, so the protocol is load-bearing — don't try to bundle both edits into one GreenTweaker spawn.**

## Pending decisions / questions
- (none) — the user's earlier decisions still hold:
  1. **Two-spawn green for xfail removal** (decided cycle 3, still applies for cycles 11/13/17 and the outer-green step 20).
  2. **Accept narrower-than-spec tests with a NOTE comment** when the strict spec shape requires conftest invention (decided cycle 2, may recur for T7 / T10).
  3. **Barrel through** until must-fix / surprise / >50-line conftest invention. None pending.

## Don't-trust-yourself warnings

- **Verify origin/main after each push**, not just that the SHA is in `git log`. Per `reference_autosync_concurrent_collisions`: concurrent agents can rebase your commit and leave cross-contamination. I've been doing this; keep doing it. (`git fetch origin main && git log origin/main --oneline -3`.)

- **`test-supabase` reset vs start**: in cycle 5 the GreenTweaker discovered `test-supabase start` is a no-op when the migration's timestamp doesn't change (caches "Migrations up to date"). Use **`test-supabase reset`** for in-place migration mutations. `start` is only correct when the instance is stopped (cold start).

- **GreenTweaker hits `CREATE OR REPLACE` 42P13 trap** when RETURNS TABLE shape changes. Cycle 8 hit this; worker correctly pivoted to `DROP FUNCTION IF EXISTS ... CREATE FUNCTION ... GRANT EXECUTE ... COMMENT ON FUNCTION`. If types regen step (9-10) or step 8-equivalent for any later RPC change recurs, expect this; charter pre-emptively if asking for an RPC return-shape change.

- **Probe-agent verdicts have been wrong twice this slice** — once on T2 fixture infra (verdict was READY but partial fixture writes needed), once on T3 admin-auth (verdict A "use seeded admin" but pre-write hook physically blocks the seeded UUID; correct pattern is `create_test_world` + INSERT into `admins` with `register_cleanup`). Future probes for fresh seams: include in the probe charter "also check `.claude/hooks/pre-write.ts` directives, not just sibling tests".

- **Each green-tweaker spawn has been getting follow-up "nit" send-messages** for header/docstring/comment cleanup. Real-world cycles are 3-5 spawns each, not the 2 the skill pseudocode implies. Budget your context accordingly. If the next cycle's reviewer raises 3+ nits worth fixing, consider batching them into a single follow-up message (vs sequential send-messages).

- **Outer-red T4 commit `5e8da734b` is the slice's revert/restore anchor** for step 20's outer-green Verifier. Don't lose its SHA — it's in `state.json.outer_red_commit`.

- **Pre-existing migration `20260324104803_get_all_workspaces_for_admin.sql` must stay UNTOUCHED.** Cycle 8 re-creates the RPC via a *new* DROP+CREATE in the SLICE migration; the HEAD migration must remain byte-identical. Verifier confirmed this at cycle 8; preserve the invariant.

- **The migration test file (`test_workspaces_auth_mode_migration.py`) now contains 4 tests** (T2 + T1 + T12 + T3). File name is technically narrower than its content (also covers admin RPC). Not renaming mid-slice; future-Ron may judge. Just don't get surprised that "migration" file has RPC tests.

## Resume cue
> **First action on wake:** Read `.tdd-execute/ENG-5952/state.json` and `events.jsonl`. State should be at `phase=green, step_index=7, cycle_index=8, target=T3, red_commit=274ef9af0`. Advance to step 9 by reading impl-plan `n: 9` notes for T8 (types regen) — likely needs phase flip to red, predicted_seam_touchpoint is the types.ts file or a thin wrapper test of its shape. Verify state.json's step_index=7 was bumped to 8 before dispatching (it wasn't — I haven't advanced after cycle 8's commit yet; you do that first).

## Tattoos still holding
- **z003, z032, z002, z020** (standard).
- **Director never edits code/tests** — hook denies anyway, but observe in spirit. State files (`state.json` / `events.jsonl`) are the carve-out.
- **Single-iteration review per phase** (`feedback_single_iteration_review`) + **fix every must_fix** (`feedback_liaison_fix_everything`) tension is real. Resolution this slice: must_fix → fix in same phase, then re-commit. Nits → fix via send-message exact-substitution (no re-review per `feedback_nit_fix_exact_substitution`).
- **Always push** after every commit (`feedback_always_push`). Pre-push gates have caught nothing real this slice; supabase sql-rls check has run twice (cycles 5, 8) and passed.
- **Two-spawn green** (cycle-3 user decision) for any inner-green that flips a strict-xfail test.

## Pointers
- `git log --oneline -10` → main has 8 ENG-5952 commits since `5e8da734b`.
- `.tdd-execute/ENG-5952/state.json` — Director cursor.
- `.tdd-execute/ENG-5952/events.jsonl` — full audit (35+ entries).
- `.claude/handoffs/handoff_20260511_130555.md` — the handoff that started THIS session (cycle 0 → cycle 1 setup work).
- `docs/specs/eng-4968-per-workspace-auth-mode/impl-plan-eng-5952.md` — schema-validated 20-step plan + 7 mutations.
- `docs/specs/eng-4968-per-workspace-auth-mode/test-plan-eng-5952.md` — 12 tests, T4 outermost.
- The slice's two test files on main:
  - `python-services/tests/integration/db/test_chat_context_workspace_auth_mode.py` — T4 (still xfailed; flips at step 20).
  - `python-services/tests/integration/db/test_workspaces_auth_mode_migration.py` — T1+T2+T12+T3 all green; T7/T5/T6/T9/T10/T11 will likely either land here or in a new chat-context file (impl-plan steps 11+ will say).
- The slice's migration on main: `supabase/migrations/20260511122718_workspace_auth_mode_and_admin_rpc.sql` (column + CHECK + RPC re-creation).
- The HEAD RPC reference (untouched): `supabase/migrations/20260324104803_get_all_workspaces_for_admin.sql`.
- This polaroid: `usegin/memento/scopes/eng-5952-tdd-execute/latest.md`.
