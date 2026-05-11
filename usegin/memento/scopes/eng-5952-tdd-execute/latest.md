# Polaroid — 2026-05-11 (slice ENG-5952 fully complete; mutation pass closed)

## Who am I

UseGin Director in `tdd-execute` for slice **ENG-5952** (Slice 1 of ENG-4968 per-workspace chat `auth_mode` override). This polaroid supersedes the cycle-20-entry polaroid that prompted the mutation-pass run. Both the 20 TDD cycles AND the 7-mutation epilogue are now closed.

## The kill

**Mutation pass complete:**
- 6 of 7 mutations caught (M1–M6) by their expected tests.
- 1 uncaught: M7. Surfaced as a no-op-equivalent in Python (function-level scoping, not block scoping — the impl-plan author's premise that "the ORIGINAL dict survives in ChatContext construction" is false because the rebound name IS what line 478 reads). **Filed `ENG-5958` (child of ENG-4968)** with the diagnosis + three resolution options. Not a test gap; a test-plan calibration issue.

Slice's core 20 cycles + epilogue: done. Next slice in the parent feature is **ENG-5953 (admin UI)**, separate work.

## Mutation-pass results

| id | target | expected | caught_by | notes |
|---|---|---|---|---|
| M1 | migration SQL | T1 | `test_workspaces_auth_mode_rejects_value_outside_allowlist` | "DID NOT RAISE APIError" — without CHECK, bogus value accepted |
| M2 | migration SQL (RPC SELECT) | T3 | `test_get_all_workspaces_for_admin_rpc_returns_auth_mode` | rows return auth_mode=NULL ≠ seeded value |
| M3 | migration SQL (admin guard) | T12 | `test_get_all_workspaces_for_admin_rpc_rejects_non_admin` | non-admin call succeeds without guard |
| M4 | `database.types.ts` | T8 | `database-types-workspaces-auth-mode.test.ts` | tsc exit 2 (TS2536 on `Row["auth_mode"]`) |
| M5 | `chat_context.py` (condition flip) | T4, T5, T7 | T4 + T5 caught; T7 not affected (project_id=None short-circuits before override branch) | impl-plan's [T7] listing was over-inclusive; at-least-one rule satisfied |
| M6 | `chat_context.py` (try/except removal) | T10 | `test_build_chat_context_workspace_fetch_failure_falls_through_with_sentry_capture` | exception propagates instead of being captured |
| M7 | `chat_context.py` (shadow `chat_config = dict(chat_config)`) | T11 | **UNCAUGHT** — filed ENG-5958 | Python function-scope rebind, no block scope; the rebound local IS what line 478 reads |

## Execution deviation (logged, intentional)

**Did NOT use per-mutation detached worktrees** as F-MUT-3 specifies. Reason: `tools/test-supabase/src/cli.ts` pins `ROOT_DIR` to the script's checkout (`import.meta.dir + "../../.."`), and `shutil.which("test-supabase")` in the Python conftest resolves via PATH (parent's `tools/bin/`). The shared test-supabase singleton would read parent's migration files regardless of which worktree spawned the test. Worktree isolation would provide hook scoping but no test isolation — i.e., it would force every mutation to copy the mutated file into parent for tests to see, which defeats the worktree's purpose.

Executed all 7 mutations in **main worktree** with:
- `.tdd-execute/ENG-5952/state.json.mutation_pass.allowed_paths` populated per mutation (hook scoping).
- Haiku mutation-applier spawned with `TDD_WORKSPACE=/workspaces/test-mvp` (hook resolution).
- `git checkout -- <target_file>` to revert between mutations.
- `test-supabase reset` to re-apply clean migration after M1–M3 (migrations need DB replay; M4–M7 don't).

Audit trail in `.tdd-execute/ENG-5952/events.jsonl` (cycle 21 entries: `mutation-pass-start`, 7× `mutation-applied`, 6× `mutation-caught`, 1× `mutation-uncaught`, `mutation-pass-complete`, `advance` to `phase=complete`).

The F-MUT-3 worktree mechanism likely needs revision to address this — the shared-singleton problem isn't slice-specific; any monorepo-wide test infra that reads from a fixed ROOT_DIR will have it. Worth a sub-issue against `tdd-execute` skill if anyone hits it again.

## Where I am

- **Phase:** `complete`. State written, events logged.
- **Working tree:** clean of slice code. `?? .tdd-execute/` is the carve-out (untracked-by-convention audit trail).
- **`origin/main` last commit:** `55a08de6c` (cycle 19 style fix). No new commits from this session — mutation pass is verification-only by design.
- **Linear:** ENG-5958 filed under ENG-4968 for M7 follow-up.

## THE ONE THING

> **The slice is done. No further work on ENG-5952 itself. If a fresh agent wakes here, the right next move is either (a) close out ENG-5952 in Linear and pick up ENG-5953 (admin UI slice), or (b) read ENG-5958 and decide how to evolve the mutation-pass M7 entry. There is no implementation work pending on this slice.**

## Don't-trust-yourself warnings (still valid for future sessions)

- **Parallel-agent-in-same-session collisions** were the dominant friction in cycles 1–20. Subjects can lie about diffs. Always read the diff, not the subject.
- **Test-supabase env can wedge silently.** Symptom: start exits 0 but `API URL: ?` + `Anon key: undefined...`. Fix: `cd tests/shared/supabase-project && bunx supabase stop --no-backup && cd -` then re-start. This session started clean (51.3s cold-start).
- **CI vs pre-push tach gap.** Pre-push uses tach impact-analysis; CI runs full. Run `uv run pytest tests/unit/ -p no:tach -q` for prod-side changes. Not relevant for mutation-pass (which always uses `-p no:tach` on targeted tests), but the gap stays for future cycles.
- **M7's Python-scoping issue is a class signal:** when an impl-plan's mutation comes from another language's intuition (JS block scope, C++ scope), verify the mutation actually breaks the target before promoting it. Mutation-pass is honest about catching false positives — that's its job.

## Tattoos still holding

- **z003, z032, z002, z020** (standard).
- **Director never edits source code/tests** — held throughout (Haiku mutation-applier did every edit). Director-only touched state.json + events.jsonl + the polaroid.
- **`feedback_finish_dont_halt`** — held this session: M7 uncaught didn't trigger a halt-for-user-input; followed the polaroid's pre-stated directive (file a stub).
- **`feedback_parallel_agents_share_git_worktree`** — informed the deviation. Documented in the events.jsonl rather than fighting the infra.
- **No PR language**, no force-push, no `--no-verify`.

## Pointers (final state)

- `.tdd-execute/ENG-5952/state.json` — `phase=complete`. Mutations caught/uncaught/followups recorded.
- `.tdd-execute/ENG-5952/events.jsonl` — full audit, ~70 entries through cycle 21.
- `docs/specs/eng-4968-per-workspace-auth-mode/impl-plan-eng-5952.md` — mutation_pass block; M7 entry needs revision per ENG-5958.
- `docs/specs/eng-4968-per-workspace-auth-mode/test-plan-eng-5952.md` — T1–T12 reference, all tests green at HEAD.
- Linear: parent ENG-4968, slice ENG-5952 (this one, done), follow-on slice ENG-5953 (admin UI, not started), calibration stub ENG-5958 (filed).
- Slice's integration tests (all green at HEAD):
  - `python-services/tests/integration/db/test_chat_context_workspace_auth_mode.py` (T4–T10, 6 tests)
  - `python-services/tests/integration/db/test_workspaces_auth_mode_migration.py` (T1, T2, T3, T12, 4 tests)
  - `python-services/tests/unit/test_auth_fallback_layer2.py::test_workspace_override_flows_to_agent_construction` (T11, 1 test of 12)
  - `tests/browser-integration/tests/database-types-workspaces-auth-mode.test.ts` (T8, 1 test)
- Production change site: `python-services/agent_api/chat/chat_context.py` lines 327–346 (override + try/except).
- Migration: `supabase/migrations/20260511122718_workspace_auth_mode_and_admin_rpc.sql`.
