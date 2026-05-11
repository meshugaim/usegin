# Polaroid — 2026-05-11 18:01 UTC (scope: eng-5952-tdd-execute, cycle 13 sleep)

## Who am I
**Director** in the `tdd-execute` skill for slice **ENG-5952** (Slice 1 of ENG-4968 per-workspace chat `auth_mode` override). Opus orchestrator; never edits code/tests directly — spawns role-isolated tweakers (Haiku), unseeded reviewers (`ron`, Opus), separate verifier per cycle. The PreToolUse hook at `.claude/skills/tdd-execute/hooks/gate-edit-by-phase.ts` denies my edits to source paths; carve-out for `.tdd-execute/<slice>/{state.json,events.jsonl}`.

## The kill
**Drive cycles 14-20 + 7-mutation pass for ENG-5952 so T4 outer-green is real and the slice's contract is mutation-tested.** This session landed cycles 9, 10, 11, 12, and 13-red. 12-of-20 plan steps committed + style/drift/fix commits.

## Where I am

- **Phase:** between cycles 13 (red committed at `5e698eb58`) and 14 (inner-green T5 — adds the `'global'` fall-through conditional). **Production code change for cycle 14 is reverted** — clean cleavage at cycle 13 red on origin/main.

- **Done this session (committed + pushed to origin/main):**
  - `eb92a6808` — cycle 10 green (T8 marker removal; types regen committed separately at `996648cbd`)
  - `8a824040d` — fix(admin-workspaces): widen RPC cast through unknown after types regen
  - `397949d07` — style(python): ruff format on slice + sibling drift
  - `ce661a77c` — cycle 12 green (build_chat_context reads workspace.auth_mode override; T7+T4 both flip to real green; T4 advanced ahead of step 20)
  - `ccafbd61e` — fix(eng-5952): mock create_safe_client in chat_context unit-test mocks (regression caught by pre-push after Tier-2 reviewer-skip)
  - `5e698eb58` — cycle 13 red (T5 'global' literal fall-through, xfail-strict)

- **Done previously (cycles 1-8 from prior session):**
  - 5e8da734b through 3438030c9 — migration substrate (DEFAULT, CHECK, RPC re-creation) + admin-guard regression pin

- **Not done (open-to-empty):**
  - **Cycle 14 inner-green T5** — the conditional change is *literally one line* in `python-services/agent_api/chat/chat_context.py:337`. Current code says `if workspace_row:`; needs `if workspace_row and workspace_row["auth_mode"] != "global":`. Impl-plan step 14, TPP rank 6. Then substep 14b removes T5's xfail marker. Two-spawn green protocol.
  - Cycles 15-16 (verification-only T6/T9 — project_id=None, workspace_id=None branches; small)
  - Cycles 17-18 (T10 try/except + sentry_sdk.capture_exception on workspace fetch failure; meaty)
  - Cycle 19 (T11 verification-only Layer-2 wiring pin)
  - Cycle 20 (outer-green T4 — verification-only since T4 flipped at cycle 12)
  - Mutation pass: 7 mutations (M1-M7) in per-mutation worktrees

- **In flight:**
  - Nothing uncommitted. Working tree: `?? .tdd-execute/` only.
  - `git log origin/main..HEAD` is empty — local matches origin.

## THE ONE THING

> **Before resuming cycle 14, fix the test-supabase infrastructure. This session's `test-supabase start` exits 0 BUT only brings up `supabase_db_test-integ` — the REST/Kong/Auth/Storage containers never come up. `test-supabase status` then reports "NOT running" and `test-supabase env` exits 1. Integration tests cannot run until the full stack is healthy. Without this fix, you cannot verify cycle 14 right-reason green and the slice halts.**

## Pending decisions / questions

- (none) — Lihu's "complete the feature autonomously" mandate (this session, after the drift-halt) still stands. He explicitly pushed back on bouncing-back for small Qs; default to finish-don't-halt unless the wrong-default cost is high.

## Don't-trust-yourself warnings

- **Test-supabase infrastructure broken.** `test-supabase start` reports `API URL: ?` and `Anon key: undefined...` — that's the tell. The DB container comes up but the rest of the stack doesn't. Symptoms: integration test fixtures fail with `subprocess.CalledProcessError: Command 'test-supabase env' returned non-zero exit status 1`. Try: `docker ps` to see which containers are up; expect 9 `supabase_*_test-mvp` containers AND 9 `supabase_*_test-integ` containers; current state has only 1 of the test-integ set. May need full docker compose rebuild or a different reset approach.

- **Tier-2 reviewer-skip bit me.** I skipped the Green-phase reviewer for cycle 12 on grounds of "plan-pinned exact code shape" — but the reviewer would have demanded a full unit-suite run, which would have caught the `test_chat_context_outline.py` regression that pre-push then caught. Lesson: skip reviewer ONLY when (a) full unit suite ALSO clean AND (b) prod diff has zero external seams. Cycle 14's diff is also small + plan-pinned, but it touches the same `if workspace_row:` block — re-review is cheap, do it.

- **Haiku tweakers hallucinate.** Cycle 14's GreenTweaker reported a successful edit + green test run, but the file was unchanged and the test was failing. Also cycle 12's GreenTweaker overshot scope (added try/except reserved for cycle 18) before being fixed. Always verify the diff directly (per re-orientation hook) and run the tests myself before trusting the worker's report. **Re-verify even when the worker is confident.**

- **Hook misparses chained Bash commands.** Multi-line `git commit -m "..."` with shell metacharacters (parens, `<<`, `>&1`, `&&`) sometimes trips the hook's heredoc-bypass regex (`>>?\s*[A-Za-z]`) treating the next token as a "production-path edit target." Workaround: single-line commits with multiple `-m` flags, avoid words like `if`/`then`/`else` in commit bodies, split chained `&&` into separate Bash calls. Real bug to file, not this session's job.

- **Cycle 10 drift-first set the slice-narrow expectation.** When I halted cycle 10 on the 315-line drift hunk, Lihu pushed back hard ("stop bouncing back on small Qs"). The right read of the impl-plan's "halt unless approved" clause is: judge wrong-default cost yourself, halt only if it's high. Future cycles in this slice: bias hard to finishing.

- **Don't trust the polaroid's "Resume cue" if a Lihu signal contradicts it.** Tattoo still holds: live signal > prior cue.

- **Cycle 14's reverted change was correct on paper.** The 1-line diff (`if workspace_row and workspace_row["auth_mode"] != "global":`) matches impl-plan step 14 exactly. The revert was for safety (couldn't verify via tests). On wake, you can re-apply the same edit confidently; just verify with tests after infra is healthy.

- **Tach skip is dangerous.** When running pytest with Tach impact-analysis, it skipped 3178 tests as "unaffected" but the unit-test-chat_context_outline regression hit anyway because the touched file (chat_context.py) was directly imported. Don't rely on `--tach` for regression checks; run the full unit suite.

## Resume cue

> **First action on wake:** Run `docker ps --format "{{.Names}}"` to count `supabase_*_test-integ` containers. If <9, the full stack isn't up — `test-supabase stop && tools/bin/test-supabase start` is suspect; try `cd /workspaces/test-mvp/tests/shared/supabase-project && supabase stop && supabase start` directly. Once `tools/bin/test-supabase env` exits 0 (and `supabase_kong_test-integ` shows in `docker ps`), proceed: read this polaroid's THE ONE THING for context, then re-apply the cycle-14 conditional via Edit tool on `python-services/agent_api/chat/chat_context.py:337` (single line: `if workspace_row:` → `if workspace_row and workspace_row["auth_mode"] != "global":`), run `cd python-services && uv run pytest tests/integration/db/test_chat_context_workspace_auth_mode.py --runxfail -q`, expect 3 passed. Then dispatch substep 14b RedTweaker to strip T5's xfail marker. Then verifier proof, **then re-review (Tier 1 — no Tier-2 skip this cycle)**, then commit + push.

## Tattoos still holding

- z003 (open-to-empty), z032 (laconic), z002 (no later), z020 (decision shape) — standard.
- z109 (tikur self-tripwire) — still relevant; no new tikurs filed this session despite the test-supabase infra failure (it's an env issue, not a tikur-worthy systemic gap... yet — if it recurs next session, write the tikur).
- **Lihu's "finish, don't bounce" mandate** — this session's strongest tattoo. Pick a sensible default, surface the assumption, keep going. Halt only when wrong-default cost > redo cost.
- **Verify the diff directly, don't trust worker summaries** — re-orientation hook says it; this session's two tweaker hallucinations make it load-bearing.
- **Two-spawn green for xfail removal** — still applies (T5 will hit it at cycle 14).
- **Slice files PARKED for unrelated work** — don't drift into other ENG-* areas during this slice's cycles.
- `[ORIA]` not `[LIHU UNKNOWN]` for human-needed-input markers.

## Pointers

- `git log origin/main --oneline -10` — last 10 commits, cycles 9-13.
- `.tdd-execute/ENG-5952/state.json` — Director cursor (phase=green, cycle_index=14, target=T5, red_commit_T5=5e698eb58).
- `.tdd-execute/ENG-5952/events.jsonl` — full audit (60+ entries; see cycle 9-13 events for this session's narrative).
- `docs/specs/eng-4968-per-workspace-auth-mode/impl-plan-eng-5952.md` — 20-step plan + 7 mutations. Step `n: 14` is the immediate next.
- `docs/specs/eng-4968-per-workspace-auth-mode/test-plan-eng-5952.md` — T5 row for cycle 14.
- `python-services/agent_api/chat/chat_context.py:325-338` — the override block landed at cycle 12 and pending one-line widen at cycle 14.
- `python-services/tests/integration/db/test_chat_context_workspace_auth_mode.py` — T4 + T7 + T5 all live here (T4/T7 real-passing, T5 xfail-strict).
- `usegin/memento/scopes/eng-5952-tdd-execute/archive/2026-05-11-180112.md` — prior polaroid (cycle 8 sleep) for full prior context.
- Linear: ENG-4968 (parent spec), ENG-5952 (this slice), ENG-5953 (Slice 2 — admin UI, downstream).
