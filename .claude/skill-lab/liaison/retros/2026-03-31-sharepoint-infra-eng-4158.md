### 2026-03-31 — SharePoint infra migration (ENG-4158)
**Verdict:** partially followed
**Collapse events:** 4
**Key observations:**

**1. Role collapse (4 events)**
- Liaison used Read to read migration files directly (drive_integration.sql, slice_d1_drive_infrastructure.sql, gfs_sync_items_infrastructure.sql) for spec writing. These were 300+ line files read for implementation context — should have been delegated to an Explore agent. However, the Explore agents at session start (migration-patterns, drive-connections-refs) *did* handle the initial research. The later reads were for targeted verification before spec review, which is a gray area.
- Liaison used Grep 4 times directly: checking `gfs_entity_type` references, `drive_connections` in DB functions, RLS policies, claim RPCs. These were scoping/verification queries, not implementation exploration. Same tension as the prior retro's suggestion — scoping queries feel proportionate when they're 1-2 tool calls.
- Liaison used Bash to run `bunx supabase db dump` with grep/python pipes multiple times to inspect live DB state (constraints, policies, functions, enum values). This was to verify the negative reviewer's findings — arguably liaison's verification job.
- Liaison directly edited 3 files (callback/route.ts, soft-delete.test.ts, whiteboard.md) to fix issues found during post-implementation review. The callback fix (adding `provider` field) and test fix (revive pattern) were small targeted changes after the worker's commit. The skill says workers implement, but fixing 2-line issues by spawning a new agent feels disproportionate.

**2. Slice discipline: GOOD**
- Work was one slice (ENG-4158), broken into sequential steps: migrations → code rename → fixes.
- Each step had a worker with explicit scope.
- Workers were sequential — rename worker ran against committed migration code.
- Verification agents spawned after implementation (integrity reviewer, regression detector).

**3. Sub-agent prompt quality: STRONG**
- Migration worker got exhaustive SQL with exact DDL, clear step-by-step structure.
- Rename worker got an exhaustive file list with occurrence counts.
- Both prompts included test integrity rules, status report requirements, and "do NOT commit or push."
- Both prompts included "orient before acting" guardrail.
- Missing: "recognize spinning" and "escalate over stubbornness" guardrails not in prompts (present in skill but omitted in delegation).

**4. Consumer audit: DONE WELL**
- Before delegating the rename, liaison ran the full blast-radius analysis (167 occurrences, 32 files) and the Explore agents mapped every reference by type (table name, comment, variable, mock).
- Before writing the migration, liaison verified: RLS policy text behavior, constraint names, function bodies, enum values, current DB state.
- The negative reviewer's 3 critical catches (RLS text, constraint type, admin function) were all consumer-audit-class findings — the structured review process is what surfaced them.

**5. Commit discipline: GOOD**
- All commits by liaison (4 total), each referencing ENG-4158.
- Commits were logically separated: migrations, code rename, build metadata, finalize.
- Pushed after all tests passed.
- One gap: the `provider` fix to callback/route.ts and the test fix should ideally have been a separate commit from the rename commit (they were mixed into the same commit).

**6. Workflow safeguarding: GOOD**
- ENG-4158 started at the beginning, closed at the end.
- Whiteboard maintained throughout with quality log.
- Build registered in active.json.
- Autonomy was never explicitly calibrated — user said "go on. /liaison" which functioned as implicit full-autonomy. Liaison proceeded without asking, which was correct for the context.

**7. The per-slice cycle compliance:**
- Baseline: ✅ Full 278-test baseline recorded
- Spec: ✅ Written (though liaison wrote it directly, not delegated)
- Review: ✅ Positive + negative reviewers in parallel
- Implement: ✅ Workers for migration and rename
- Post-review: ✅ Integrity reviewer + regression detector + full test run
- Retro: ⚠️ Not triggered proactively — user triggered via /skill-retro

**8. Negative review was the highest-value step**
Three critical production-breaking bugs caught by the negative reviewer. Without this step:
- drive_folder_scopes RLS policies would silently fail (text references don't auto-rename)
- Migration would error on DROP CONSTRAINT (actual DB had a partial unique INDEX)
- admin_get_drive_connection_stats() would break (function body references old table name)

This validates the build-liaison cycle — the structured review caught issues that a single-pass implementation would have missed.

**Suggestions:**
- The 2-line fix pattern (liaison edits directly instead of spawning a worker for trivial changes) came up again. The prior retro suggested distinguishing "empirical verification" from "judgment verification." Consider a similar carve-out: "liaison may make targeted fixes (< 5 lines) when the fix is obvious and came from a verified finding." Spawning a worker for `provider: "google_drive"` on one line is ceremony without value.
- Spec writing was done by liaison directly. For a database migration where the spec IS the SQL, this seems proportionate — the spec was essentially "here's the DDL." For more ambiguous work, delegating spec writing would be better.
- "Recognize spinning" and "escalate over stubbornness" guardrails were omitted from worker prompts. Add them to the prompt template — they're most valuable when agents hit unexpected failures (like the soft-delete test).
- The reconnect test failure was caught by the post-implementation test run, not by any reviewer. The negative reviewer predicted it (finding #5) but the migration worker and rename worker both missed it. Consider: should the negative reviewer's findings be tracked as a checklist that the liaison verifies against after implementation?
