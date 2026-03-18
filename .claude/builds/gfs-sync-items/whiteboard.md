## Current State
Phase: Slice 4.5 (Event vocabulary + triggered_by) | Status: starting | Iteration: 1
Last checkpoint: Fixed claim RPC ambiguity (d9f89cc5). Discussion settled: unify event vocabulary + add triggered_by column.
Next: Full cycle — baseline, spec, review, implement, verify

## Auto-Inject (automatically re-injected after every agent/team return)
Priority: Don't regress > Orchestrate > Build. Never sacrifice correctness for velocity.
Process: Read whiteboard → write note-to-self → spawn agent → read summary only → update whiteboard.
Role: I am the director. I NEVER do work myself. Every action = a subagent.
Integrity: After every implementation phase, spawn a test-integrity reviewer. Check the test diff, not the summary.
Verification: Spawn sanity-check agents at phase boundaries for continuous confidence.
Pace: We have all night. Verifying > completing. Run as long as needed.
Data: Never clean seeded data between slices — accumulation proves back-compatibility.

## Per-Slice Cycle (every slice follows this exact sequence)

### Step 1: Baseline (2 agents in parallel)
- **Test suite**: Run full integration test suite. Record pass/fail baseline.
- **Manual verification**: Use `sync-test verify` (all 33 scenarios). All must pass before we change anything.

### Step 2: Seed data
- Run `sync-test seed fill --project <id>` to populate tables with data across all sync states.
- This data stays permanently — never cleaned. Proves each migration is truly back-compatible.

### Step 3: Write slice spec
- Spawn interactive spec writer (`/writing-specs`). I answer its questions via intermediary agents.
- Spec must be detailed enough for an implementer to build from it alone.

### Step 4: Review spec
- Spawn 2 reviewers in parallel: one positive (strengths, what's good), one negative (gaps, risks, what's missing).
- Unbiasedly evaluate both. Revise spec if needed.

### Step 5: Implement
- Spawn liaison orchestrator via TeamCreate. Guide it to work TDD.
- Liaison spawns its own workers. Test integrity rules enforced.

### Step 6: Post-implementation review (4 agents in parallel)
- **Code reviewer**: review the diff for correctness
- **Regression detector**: review commits + git diff for scope creep, removed assertions, silent changes
- **Integration tests**: run full test suite
- **Manual verification**: re-run `sync-test verify` (all 33 scenarios)

### Step 7: QA
- Additional QA agents if needed based on step 6 findings.

### Step 8: Retro
- Write retro file (`.claude/builds/gfs-sync-items/phases/slice-N-retro.md`)
- Extract conclusions that apply to the next slice
- Update whiteboard with lessons learned

## Phase Map
- [x] Phase 0: Smoke tests
- [x] Slice 1: Infrastructure + backfill (ENG-2823 + ENG-2824) — PASS. 268 tests. Commit 978f2ef8.
- [x] Slice 2: Switch file writers (ENG-2825) — PASS. 479 tests. Commit e3d1f8c1.
- [x] Slice 4: Switch file worker (ENG-2827) — PASS. 129 JS + 355 Py. Commit 7e1bb99a.
- [x] Slice 3: Switch file readers (ENG-2826) — PASS. 129 JS pass. Commit 2c005b9f.
- [ ] Slice 5: Drop old columns (ENG-2828)
- [ ] Phase 2: Emails (ENG-2829)
- [ ] Phase 3: Attachments (ENG-2830)
- [ ] Phase 4: Cleanup (ENG-2831)

## Specs
- **Slice 2 impl**: `docs/specs/gfs-sync-items/slice-2-switch-writers.spec.md` (13 ACs, reviewed+revised)
- **Slice 1 impl**: `docs/specs/gfs-sync-items/slice-1-infrastructure.spec.md` (25 ACs, reviewed+revised)
- Meta: `docs/specs/gfs-sync-items/00-meta.spec.md`
- Data model: `docs/specs/gfs-sync-items/01-data-model.spec.md`
- Events: `docs/specs/gfs-sync-items/02-event-system.spec.md`
- DB logic: `docs/specs/gfs-sync-items/03-db-logic.spec.md`
- Worker: `docs/specs/gfs-sync-items/04-worker.spec.md`
- App integration: `docs/specs/gfs-sync-items/05-app-integration.spec.md`
- Migration: `docs/specs/gfs-sync-items/06-migration.spec.md`

## Tools
- `sync-test verify --list` — 33 verification scenarios across 7 categories
- `sync-test seed fill --project <id>` — populate all sync states
- `sync-test <action>` — 12 action commands (upload-file, delete-file, exclude, etc.)
- Integration tests: `bun test` in nextjs-app, `uv run pytest` in python-services

## Quality Log

### Slice 1 — Infrastructure + Backfill
- Step 1 baseline: 208 tests ALL PASS (32 sync-lifecycle, 15 project-files, 126 sync-events, 22 claim-rpcs, 13 sync-worker-e2e). No plumbing tests exist yet.
- sync-test verify: 33 scenarios documented in manifest, tool is checklist-only (no automated assertions). Not usable for automated pre/post checks.
- Note: manual verification relies on integration test suite, not sync-test verify.
- Step 2 seed: 12 files seeded in Demo Project across terminal states (synced:6, deleted:4, excluded:1, retry_exhausted:1). Transient states auto-transition due to background worker.
- Step 3 spec: written to `docs/specs/gfs-sync-items/slice-1-infrastructure.spec.md`. 25 ACs.
- Step 4 review: Positive=PASS. Negative=ITERATE with 2 blocking + 5 gaps. All 7 addressed in revision.
  - Key fixes: BEFORE DELETE cleanup trigger (permanent), ON CONFLICT on backfill, deleted→pending guard, updated_at in projection, RLS spelled out, triggered_by cleaned up, 3 missing ACs added.
- Step 5 implement: 2 migration files (1,655 lines SQL), 60 new tests. Commit 978f2ef8.
  - Extra work: recreated 9 claim RPCs (550 lines) for TEXT event_type compatibility.
- Step 6 review: ALL CLEAN. Code review=CLEAN, Regression=CLEAN, Tests=268 PASS/0 FAIL, Data=14 files survived + zero orphans.
- **VERDICT: SLICE 1 COMPLETE.**

### Slice 2 — Switch File Writers
- Step 1 baseline: 268 tests ALL PASS.
- Step 2 seed: re-ran seed fill, 19 total files now.
- Step 3 spec: `docs/specs/gfs-sync-items/slice-2-switch-writers.spec.md`. 13 ACs.
- Step 4 review: Positive=PASS. Negative=CONDITIONAL PASS — 2 blockers (RLS prevents writes, delete_stale_version missed) + 3 gaps. All addressed.
  - Key: Added RLS UPDATE policy for project members. Added missing transition `upload_failed → pending`. Projection trigger guard for coexistence.
- Step 5 implement: 2 migrations + TS/Python code changes. 14 new tests. Commit e3d1f8c1.
  - Projection trigger guard prevents no-op overwrites during coexistence.
  - sync-adapter dual-write for test coexistence.
- Step 6 review: ALL CLEAN. Code=CLEAN, Regression=CLEAN, Tests=479 PASS/0 FAIL, Data=19 files + zero orphans.
- **VERDICT: SLICE 2 COMPLETE.**
- Post-Slice 2 fix: retry_exhausted regression found in Slice 3 baseline. Claim RPCs inserted event but old trigger didn't handle it. Fixed: RPCs now write to gfs_sync_items. Commit via fix migration.
- 4 pre-existing Python test failures (test_claim_pending_rpcs: retry_exhausted tests) — never passed since March 13. Root cause: old trigger bug. NOT our regression. Test setup needs gfs_sync_items dual-write. Noted, not blocking.

## Lessons Learned

### From Slice 2
- Negative reviewer caught RLS blocker — authenticated users couldn't write to gfs_sync_items. Would have silently failed in production.
- Missing writer (delete_stale_version) caught by negative reviewer — spec writer missed a Python call site.
- Coexistence needs careful thinking: entity table remains authoritative while worker still writes there. Projection is one-way (sync→entity).
- Projection trigger guard (no-op prevention) was discovered during implementation, not in spec. Implementer found and fixed it.

### From Slice 1
- Negative spec reviewer caught 2 blocking issues (RESTRICT FK + backfill race) that would have broken all tests. Spec review is the highest-leverage step.
- sync-test verify is checklist-only, not automated. Integration test suite is the real baseline.
- Background worker auto-transitions transient states — only terminal states persist for data verification.
- event_type enum→TEXT required recreating 9 claim RPCs (~550 lines) — more work than expected but justified.
- Seeded data count was 14, not 12 (2 extra from seed tool behavior). Not a problem.
