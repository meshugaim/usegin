# Drive Migration Planning Research

**Date:** 2026-03-18
**Purpose:** Foundation for the drive migration plan to gfs_sync_items. Research only.

---

## Dimension 1: All Migration Commits (Chronological)

### Pre-work (March 15-18)

| Commit | Date | What | Slice |
|--------|------|------|-------|
| 057ad0d3 | 03-18 01:49 | sync-test CLI (content generator + verification manifest) | Pre-work |
| 40b1976b | 03-18 01:50 | 6 design spec docs committed | Pre-work |

### File Migration (Slices 1-4, March 18 morning)

| Commit | Date | What | Slice | Fix/Revert? |
|--------|------|------|-------|-------------|
| 978f2ef8 | 03-18 03:28 | Partitioned table, triggers, backfill, 9 claim RPC rewrites | Slice 1 | No |
| c18f63ef | 03-18 04:42 | App code writes to gfs_sync_items instead of project_files | Slice 2 | No |
| e3d1f8c1 | 03-18 04:57 | Python unit test mocks updated for gfs_sync_items | Slice 2 | Fix (15 min later) |
| cd776432 | 03-18 05:44 | Rewrote 9 claim RPCs to write retry_exhausted to gfs_sync_items | Slice 2 | Misdiagnosis (reverted 10h later) |
| 7e1bb99a | 03-18 07:57 | Worker uses entity-agnostic claim RPCs, writes to gfs_sync_items | Slice 4 | No |
| 9b155833 | 03-18 08:53 | Allowlisted orphaned trigger branches in db-checks | Slice 4 | Fix (1h later) |
| ceeb2c42 | 03-18 09:40 | Moved trigger liveness check from security to schema suite | Housekeeping | No |
| 2c005b9f | 03-18 09:41 | File readers switch to gfs_sync_items computed relationships | Slice 3 | No |
| 8b29396c | 03-18 10:27 | #variable_conflict use_column for ambiguous entity_type | Slice 4 | Fix (2.5h later) |
| 280228c2 | 03-18 15:20 | Revert cd776432 contamination | Revert | Revert |

### Vocabulary + triggered_by (Slices 4.5 + 4.6, March 18 afternoon)

| Commit | Date | What | Slice | Fix/Revert? |
|--------|------|------|-------|-------------|
| 4bc4c53e | 03-18 16:09 | CASE mapping in audit trigger (status->action vocabulary) | Slice 4.5 | No |
| c9512b46 | 03-18 16:20 | sync-test updated for gfs_sync_items | Slice 4.5 | No |
| bb212464 | 03-18 16:25 | Remaining event_type assertions fixed | Slice 4.5 | Fix (16 min later) |
| 99034acb | 03-18 16:27 | Build whiteboard + per-slice specs committed | Docs | No |
| 8e7350c6 | 03-18 17:39 | triggered_by column added to gfs_sync_items | Slice 4.6 | No |

### Email Migration (Slices E1-E4, March 18 evening)

| Commit | Date | What | Slice | Fix/Revert? |
|--------|------|------|-------|-------------|
| 38eb5a55 | 03-18 17:39 | Backfill emails into gfs_sync_items | E1 | Reverted (30 min later) |
| b0d0b2b3 | 03-18 18:10 | Revert E1 backfill | E1 | Revert |
| 65c6786b | 03-18 18:30 | triggered_by added to all gfs_sync_items callers | Slice 4.6 | No |
| f57a8a91 | 03-18 18:54 | Backfill emails (2nd attempt, successful) | E1 | No |
| 9662d46b | 03-18 18:54 | E2 prerequisites: transitions, RLS, projections | E2 prereq | No |
| 0ed6b6ad | 03-18 18:59 | Email resolver writes to gfs_sync_items | E2 | No |
| 8e8d8584 | 03-18 19:04 | Resolver unit test mocks | E2 | Fix (5 min later) |
| 6e48b466 | 03-18 19:09 | Email exclusion/external toggles to gfs_sync_items | E2 | No |
| 9e8852ae | 03-18 19:11 | Email API unit test mocks | E2 | Fix (2 min later) |
| 9b2ecee5 | 03-18 20:08 | Attachment backfill + full projection upgrade | E3 prereq | No |
| ef3ee9cc | 03-18 20:37 | Email worker writes to gfs_sync_items | E3 | No |
| 987e3502 | 03-18 21:01 | triggered_by assertions in files-sync test | E3 | Fix (24 min later) |
| 2cc321c3 | 03-18 21:10 | Email readers switch to gfs_sync_items | E4 | No |
| 02f01de3 | 03-18 21:17 | Email query unit test mocks | E4 | Fix (7 min later) |

### Post-Migration (March 18 late evening)

| Commit | Date | What | Slice | Fix/Revert? |
|--------|------|------|-------|-------------|
| c890f6da | 03-18 21:54 | Backend field added to claim RPCs (workspace toggle lookup) | ENG-2972 | No |
| 01217ac1 | 03-18 22:21 | sync-test reads from gfs_sync_items + two-step reinclude | Fix | Fix |
| 715e4d19 | 03-18 22:22 | VAIS backend dispatch added to sync worker | ENG-3048 | No |
| 890e2f0c | 03-18 22:23 | @load-bearing annotations for email/attachment sync triggers | Docs | No |
| 548c91e2 | 03-18 22:40 | Dead sync code removed + old claim RPCs dropped | ENG-3051 | No |
| d59b3149 | 03-18 22:45 | VAIS search toggle on workspace settings | ENG-3047 | No |
| 1e555cc0 | 03-18 23:09 | vais-admin: use real schema (gfs_sync_items) | Fix | Fix |
| 5a909683 | 03-18 23:09 | vais-admin: use real schema (duplicate on branch) | Fix | Fix |

### Summary Statistics

- **Total feature commits:** 22 (Slices 1-4, 4.5, 4.6, E1-E4, post-migration)
- **Fix commits:** 12 (unit test mocks x6, trigger liveness x1, ambiguous column x1, vocabulary assertions x1, sync-test x1, vais-admin x2)
- **Reverts:** 3 (E1 backfill x1, contamination x1, original E1 x1)
- **Elapsed time:** ~21 hours (01:49 to 23:09) — one continuous day

---

## Dimension 2: All Specs and Notes

### Design Specs (docs/specs/gfs-sync-items/)

| File | Content |
|------|---------|
| `00-meta.spec.md` | Overview, motivation, entity types, migration strategy |
| `01-data-model.spec.md` | Partitioned table schema, columns, constraints, computed relationships |
| `02-event-system.spec.md` | Event-driven architecture, audit trigger, vocabulary design |
| `03-db-logic.spec.md` | Transitions, validation triggers, claim RPCs |
| `04-worker.spec.md` | Entity-agnostic worker, claim RPCs, dual-path coexistence |
| `05-app-integration.spec.md` | App-side writes, reader pattern, TypeScript types |
| `06-migration.spec.md` | Migration ordering, backfill strategy, rollback plan |

### Per-Slice Specs (docs/specs/gfs-sync-items/)

| File | Slice | ACs |
|------|-------|-----|
| `slice-1-infrastructure.spec.md` | Slice 1 | 25 ACs |
| `slice-2-switch-writers.spec.md` | Slice 2 | 13 ACs |
| `slice-3-switch-readers.spec.md` | Slice 3 | ~10 ACs |
| `slice-4-switch-worker.spec.md` | Slice 4 | ~15 ACs |
| `slice-4.5-event-vocabulary.spec.md` | Slice 4.5 | Vocabulary mapping |
| `slice-4.6-triggered-by.spec.md` | Slice 4.6 | Column + caller update |
| `slice-e3-switch-worker.spec.md` | E3 | Worker switch for emails |

### Build Artifacts (.claude/builds/gfs-sync-items/)

| File | Content |
|------|---------|
| `whiteboard.md` | File migration orchestration state — phase map, quality log, lessons |
| `drive-migration-handoff.md` | **Key document**: 13 pitfalls, design question (download stage), slice structure, backfill mapping, reference files |
| `phases/deep-retro.md` | Root-cause analysis of 6 issues (vocabulary, contamination, ambiguous columns, orphaned triggers, coexistence race, slice ordering) |
| `phases/slice-*-*.md` | 45 phase files across all file slices (baseline, spec reviews, implementation, retros) |

### Email Build Artifacts (.claude/builds/gfs-sync-emails/)

| File | Content |
|------|---------|
| `whiteboard.md` | Email migration orchestration — E1-E4 + A1-A4 status, pitfall rules, writer/reader surfaces |
| `phases/slice-e*-spec-review-*.md` | 6 spec review files (positive + negative for E1, E2, E3) |

### Handoff Document Analysis

The handoff document (`drive-migration-handoff.md`) is the most important artifact. Key contents:
1. **What exists for drive already** — partition exists, FK exists, but no creation trigger, no cleanup trigger, no computed relationships, no backfill, no RLS UPDATE, no rows
2. **The download stage question** — recommendation to keep download on drive_files, use gfs_sync_items from `stored` onward (blocked -> pending handoff)
3. **13 numbered pitfalls** — each derived from an actual incident during file/email migration
4. **Drive-specific columns** — 8 columns that stay on drive_files (lifecycle, not sync)
5. **Backfill status mapping** — SQL CASE for download-stage statuses
6. **4-slice structure** — D1 (backfill), D2 (writers), D3 (worker), D4 (readers)
7. **Reference files** — 10 file paths pointing to email migration patterns to follow

---

## Dimension 3: Problems and Fixes Timeline

### Problem 1: Event Vocabulary Split

- **What broke:** Audit trigger on gfs_sync_items wrote status names (`synced`, `pending`) while the entire existing system expected action names (`sync_succeeded`, `sync_requested`). Events went into the same column with different vocabulary.
- **Discovered:** During Slice 4.5 design discussion, after all 4 file slices were committed
- **How discovered:** Manual analysis — not CI, not tests, not runtime
- **Fixed:** Slice 4.5 (commit 4bc4c53e) — full CASE mapping in audit trigger
- **Could it have been prevented?** YES. Spec review should have checked that written values match existing readers. The Slice 1 migration contained BOTH the new vocabulary (trigger writes `'synced'`) and the old vocabulary (view filters `'sync_succeeded'`). Neither spec reviewer caught it.
- **Prevention:** "Vocabulary audit" checklist item for spec reviewers. Now part of build-liaison skill.

### Problem 2: Claim RPC Contamination (cd776432)

- **What broke:** Agent saw failing tests, assumed old trigger lacked a `retry_exhausted` branch (it didn't), rewrote all 9 per-entity claim RPCs in a 677-line migration. Touched email/attachment/drive RPCs outside the slice scope.
- **Discovered as a problem:** 10 hours later, during Slice 4.5 discussion
- **How discovered:** Human review of the commit during planning
- **Fixed:** Revert (commit 280228c2) + correct fix via vocabulary unification in 4.5
- **Could it have been prevented?** YES. Reading the old trigger code (30-second grep) would have disproved the hypothesis. The tests were "pre-existing failures" — broken since March 13, not a Slice 2 regression.
- **Prevention:** "Root cause before fix" rule. Now part of build-liaison skill.

### Problem 3: Ambiguous Column Reference (8b29396c)

- **What broke:** Entity-agnostic claim RPCs in Slice 4 used RETURNS TABLE columns with names matching table columns. PL/pgSQL couldn't resolve ambiguity.
- **Discovered:** During integration testing after Slice 4
- **How discovered:** Test failure — RPC execution error
- **Fixed:** `#variable_conflict use_column` pragma (commit 8b29396c)
- **Could it have been prevented?** YES. Running integration tests before committing Slice 4 would have caught it immediately. Or spec reviewer could have flagged the naming collision.
- **Prevention:** PL/pgSQL naming convention: always use `#variable_conflict use_column` when RETURNS TABLE columns match table columns.

### Problem 4: Orphaned Trigger Branches (9b155833)

- **What broke:** db-checks trigger liveness flagged 10 orphaned branches in the old trigger after Slices 2+4 stopped inserting events for files.
- **Discovered:** During CI after Slice 4
- **How discovered:** CI check failure (db-checks)
- **Fixed:** Allowlist in `tools/db-checks/src/compare/checks.ts`
- **Could it have been prevented?** Partially — spec could have mentioned it as a known side effect. Minor operational issue.
- **Prevention:** Handoff document now lists this as pitfall #9.

### Problem 5: Python Unit Test Mocks (e3d1f8c1, 8e8d8584, 9e8852ae, 02f01de3)

- **What broke:** Every writer/reader switch broke unit test mocks. Mock Supabase clients didn't know about `gfs_sync_items` table.
- **Discovered:** After each commit — push hook (TypeScript) or test run (Python)
- **How discovered:** CI/test failure
- **Fixed:** 4 separate fix commits (one per switch: file writers, email resolver, email API, email readers)
- **Could it have been prevented?** YES. Running the full test suite before committing would have caught these. Each fix was 5-15 minutes after the feature commit.
- **Prevention:** Handoff document lists this as pitfall #10. Budget for mock updates in every switch.

### Problem 6: E1 Backfill Revert (b0d0b2b3)

- **What broke:** First E1 backfill attempt was reverted
- **Discovered:** 30 minutes after commit
- **How discovered:** Likely test failure or migration issue
- **Fixed:** Second attempt (f57a8a91) succeeded after Slice 4.6 (triggered_by column + callers) was committed
- **Root cause:** The backfill was committed before the triggered_by column callers were updated (Slice 4.6). The order dependency was: triggered_by column -> triggered_by callers -> then backfill (which would trigger callers that now require triggered_by).
- **Prevention:** Correct sequencing — prerequisites before consumers.

### Problem 7: gfs_doc_id COALESCE During Coexistence

- **What broke:** Old trigger uses `COALESCE(NEW.gfs_doc_id, existing)` — writing NULL to gfs_sync_items can't clear entity table's gfs_doc_id.
- **Discovered:** During E2 spec review or design
- **How discovered:** Analysis of trigger code
- **Fixed:** Dual-write workaround: write NULL directly to entity table alongside gfs_sync_items write
- **Could it have been prevented?** Inherent to the coexistence model — not a bug but a design constraint.
- **Prevention:** Handoff document lists this as pitfall #3.

### Problem 8: Re-inclusion Two-Step (01217ac1)

- **What broke:** Single update `{is_excluded: false, gfs_sync_status: "pending"}` fails on the BEFORE UPDATE trigger when the row is in `deleted` status. The trigger checks `NEW.is_excluded` which is `false` in the combined update.
- **Discovered:** sync-test verification
- **How discovered:** Manual testing
- **Fixed:** Two-step update: (1) set status to pending while is_excluded=true, (2) set is_excluded=false
- **Could it have been prevented?** Trigger validation logic is correct by design — the two-step is the intended pattern.
- **Prevention:** Handoff document lists this as pitfall #4.

### Problem 9: PostgREST Computed Relationships Return Arrays

- **What broke:** TypeScript expected `gfs_sync_items: { ... } | null` but PostgREST returns `gfs_sync_items: { ... }[]` for computed relationships.
- **Discovered:** During E4 (reader switch) — push hook TypeScript errors
- **How discovered:** TypeScript compilation
- **Fixed:** Changed access pattern to `row.gfs_sync_items?.[0]?.gfs_sync_status`
- **Prevention:** Handoff document lists this as pitfall #11.

### Problem 10: triggered_by Assertions in Files-Sync Test (987e3502)

- **What broke:** After E3 worker switch, files-sync integration tests had stale triggered_by assertions
- **Discovered:** 24 minutes after E3 commit
- **How discovered:** Test failure
- **Fixed:** Updated assertions (commit 987e3502)
- **Prevention:** Run full test suite before committing.

---

## Dimension 4: Session Transcripts

### Available Sessions (today only — session CLI retains recent sessions)

| ID | Turns | Description | Notes |
|----|-------|-------------|-------|
| 4ef4eeac | 1151 | Email + Attachment Migration | Main email build-liaison session |
| 6cf8d253 | 1183 | Email + Attachment Migration (duplicate/continuation) | Context-exhaustion restart |
| f008016f | 1182 | VAIS mapping (unrelated) | Parallel work |
| 051e76f3 | 754 | VAIS mapping (unrelated) | Parallel work |
| 42e165b0 | 642 | VAIS mapping (unrelated) | Parallel work |

### Email Migration Session Analysis (4ef4eeac)

- **Duration:** 3h 57m active time, $99 cost, 193% context utilization
- **Sub-agents:** 44 total
  - 11 spec writers/reviewers (slices E1-E3: write + positive + negative + revise)
  - 6 implementation agents (E1 implement, E2 implement x3 commits, E3 implement, E4 implement)
  - 4 fix agents (unit test mocks, triggered_by assertions, TypeScript types)
  - 1 massive test runner (545 turns, 25 min — ran ALL email tests)
  - Various context-gathering and verification agents
- **Pattern:** Liaison role — spawned workers sequentially, committed after each, ran spec review before implementation
- **Key observation:** The session hit 193% context utilization — it used context compaction to stay alive. The second session (6cf8d253, 199%) was a continuation/parallel of the same work.

### File Migration Session

The file migration session (Slices 1-4, 4.5) is NOT in the session list — it ran earlier today and is no longer retained. However, the whiteboard, retros, and deep-retro document capture its process:
- **Orchestration pattern:** build-orchestrate (3-layer: director -> liaison -> workers)
- **Per-slice cycle:** baseline (2 parallel) -> seed -> spec -> review (2 parallel) -> implement (liaison) -> post-review (4 parallel) -> retro
- **Key lesson:** The 3-layer pattern worked but was heavyweight. The email migration simplified to 2-layer (build-liaison) and was faster.

### Orchestration Pattern Evolution

1. **File migration (Slices 1-4):** build-orchestrate (3-layer). Director never reads code. Spawns liaison via TeamCreate. Liaison spawns workers via Agent. Very disciplined but slow — lots of context overhead from note-to-self, summaries, and the delegation chain.

2. **Email migration (E1-E4):** build-liaison (2-layer). Liaison reads code directly, spawns workers, commits and pushes. Faster because the liaison has direct access to code context. Spec review still uses 2 parallel reviewers (positive + negative).

3. **The key difference:** build-orchestrate treats the director as a pure orchestrator who never touches code. build-liaison lets the orchestrator read code and provide rich context to workers. For a well-understood migration pattern (where the previous entity type proves the pattern), build-liaison is clearly better — the liaison can directly read the file migration's code as a template for emails.

---

## Dimension 5: Available Skills

### `/build-orchestrate` — 3-Layer Director

- **Role:** Pure director. Never reads code, specs, or phase output. Only reads whiteboard.
- **Delegation:** Director -> TeamCreate liaison -> Agent workers
- **Strengths:** Extreme process discipline. Auto-inject re-orients after every agent return. Role-collapse detection.
- **Weaknesses:** High context overhead (note-to-self + summary protocol). Can't provide rich code context to workers because it never reads code. Slow for repetitive/templated work.
- **Key rules:** Max 3 iterations per phase. Mandatory spec reviewer. Test integrity rules in every worker prompt.
- **Hooks:** Blocks bare Agent calls (forces `[leaf]` tag or TeamCreate).
- **Used for:** File migration (Slices 1-4). Worked but overkill for a migration with an established pattern.

### `/build-liaison` — 2-Layer Orchestrator

- **Role:** Liaison + orchestrator combined. Reads code and whiteboard directly. Spawns workers.
- **Delegation:** Liaison -> Agent workers
- **Strengths:** Faster iteration. Liaison has direct code context to provide rich instructions. Workers never commit (liaison commits). Per-slice cycle is the same (baseline -> spec -> review -> implement -> post-review -> retro) but each step is leaner.
- **Weaknesses:** Liaison can role-collapse into doing the work itself (less guardrails than build-orchestrate). Context budget is tighter because liaison accumulates more direct context.
- **Key rules:** Workers never commit or push. Sub-agent guardrails (orient before acting, recognize spinning, connect before completing). Test integrity rules.
- **Used for:** Email migration (E1-E4). Faster and more effective than build-orchestrate for the same pattern.

### `/liaison` — General-Purpose Delegation

- **Role:** General-purpose orchestrator. Not build-specific — works for any multi-step task.
- **Delegation:** Liaison -> Agent workers (via Task tool)
- **Strengths:** Most flexible. Context guard option (--context-guard). Autonomy calibration with user. Step size negotiation. Self-review checkpoints.
- **Weaknesses:** Less build-specific structure. No per-slice cycle enforcement. No mandatory spec review.
- **Key rules:** Sequential by default (learned from parallel failures). Liaison commits and pushes. Workers implement and report.
- **Used for:** General development tasks, not specifically for this migration.

### Recommendation for Drive Migration

**Use `/build-liaison`.** Reasoning:
1. The drive migration follows a proven pattern (same 4-slice structure as files and emails).
2. The handoff document provides complete context — the liaison can read it and provide exact instructions to workers.
3. The 2-layer model was faster and equally rigorous for the email migration.
4. The 3-layer model (build-orchestrate) adds overhead without proportional benefit when the pattern is established.
5. The drive migration has one novel element (download stage) that benefits from the liaison being able to read code directly to understand the current download pipeline.

---

## Cross-Dimensional Findings

### 1. The migration is a solved pattern

After files (4 slices + 2 fix slices) and emails (4 slices collapsed with attachments), the pattern is well-established:
- D1: Backfill (creation trigger + cleanup trigger + computed relationships + RLS + backfill SQL)
- D2: Switch writers (app code writes to gfs_sync_items + prerequisite migrations + is_excluded projection)
- D3: Switch worker (worker uses entity-agnostic claim RPCs + full projection upgrade)
- D4: Switch readers (admin pages + API routes read from gfs_sync_items)

### 2. Drive has one novel dimension: the download stage

Files go `pending -> processing -> synced`. Emails go `blocked -> pending -> processing -> synced`. Drive goes `pending -> downloading -> stored -> processing -> synced`. The download stage is drive-specific. The handoff recommends keeping download on `drive_files` and using gfs_sync_items from `stored` onward (mapped to `blocked -> pending`).

### 3. Unit test mock updates are the #1 time sink

6 of 12 fix commits were unit test mock updates. Every writer and reader switch breaks mocks. This is predictable and should be budgeted — either by including mock updates in the implementation prompt or by doing mock updates as a separate step after each switch.

### 4. Spec review is the highest-leverage step

Across all slices, negative spec reviewers caught:
- Slice 1: 2 blockers (RESTRICT FK, backfill race)
- Slice 2: 2 blockers (RLS prevents writes, missing writer)
- E1: 2 blockers (DISABLE TRIGGER partition propagation, `failed` status dead-end)
- E2: blockers around old trigger event type gaps

The vocabulary split (the biggest issue overall) was NOT caught by spec review, but that gap has been closed — the build-liaison skill now includes a "schema compatibility audit" checklist.

### 5. The email migration was 2x faster

File migration: ~15 hours (01:49 to 16:27 for Slices 1-4.5)
Email migration: ~5 hours (17:39 to 22:40 for E1-E4 + cleanup)

Contributing factors: (a) proven pattern, (b) 2-layer instead of 3-layer orchestration, (c) attachment slices collapsed into email slices, (d) handoff document eliminated research time.

### 6. The handoff document is the migration's most valuable artifact

The 13 pitfalls in `drive-migration-handoff.md` encode every hard-won lesson. Each pitfall maps to a specific incident (vocabulary split, contamination, COALESCE, two-step re-inclusion, etc.). The document also provides the complete design recommendation (download stage), backfill SQL, and reference files.

### 7. What remains after drive

Once drive is migrated, all 4 entity types will use gfs_sync_items. Then:
- Slice 5 (ENG-2828): Drop old columns from project_files
- Email/attachment cleanup: Drop old columns from inbound_emails + email_attachments
- Drive cleanup: Drop old columns from drive_files
- Old trigger retirement: Remove `update_gfs_sync_status` trigger entirely
- Old claim RPC removal: Already done (548c91e2) for files/emails/attachments — drive's old RPCs remain

### 8. Existing drive infrastructure gaps (from handoff)

Missing for drive in gfs_sync_items:
- No creation trigger on `drive_files`
- No cleanup trigger (BEFORE DELETE) on `drive_files`
- No computed relationship functions for PostgREST
- No backfill — zero drive rows in gfs_sync_items
- No RLS UPDATE policy for drive entity type

Existing (to be replaced/extended):
- 3 old claim RPCs: `claim_pending_drive_download`, `claim_pending_drive_sync`, `claim_pending_drive_deletion`
- Old trigger drive branch: 13 event types across 3 stages
- drive_files columns for sync state: `gfs_sync_status`, `gfs_doc_id`, `is_excluded`, `deleted_at`, etc.
