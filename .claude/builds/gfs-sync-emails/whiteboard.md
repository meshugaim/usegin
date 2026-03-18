## Current State
Phase: Complete (emails + attachments migrated) | Status: coexistence
Last checkpoint: E4 done. Attachment work collapsed into email slices (E2/E3/E4 handled both entity types).
Next: Cleanup — drop old columns from inbound_emails + email_attachments (production-gated).

## Auto-Inject (re-injected after every agent return)
Priority: Don't regress > Orchestrate > Build. Never sacrifice correctness for velocity.
Role: Liaison. I spawn workers, read code directly, verify results, commit and push. Workers never commit.
Process: Read whiteboard → plan step → spawn worker → verify → commit → update whiteboard.
Integrity: After every implementation step, spawn test-integrity reviewer. Check the diff, not the summary.
Sequencing: Sequential. Each worker builds against committed code from previous step.
Data: Never clean seeded data. Accumulation proves back-compatibility.

Pitfalls (from file migration — HARD RULES):
1. ONE concern per migration. No bundling.
2. Old RPCs are READ-ONLY. Don't modify them. They get replaced by entity-agnostic RPCs.
3. "Pre-existing failure" is a CLAIM. Verify: git stash, run at prior commit, confirm it fails.
4. Don't silence CI checks. Only allowlist trigger→trigger chains (items→event→entity) that db-checks can't trace.
5. Projection: only is_excluded needs it. Vocab fix handles gfs_sync_status + gfs_doc_id via old trigger.
6. Sibling deletion check: ONE condition, no branching. Don't split it.

Test baseline (must not regress):
- JS: 713 pass / 3 fail (2 flaky audit event ordering + 1 transition count fixed) / 1 skip (auth)
- Python: 359 pass
- pgTAP: 155 pass
- Schema: 1991 checks
- access-level-resync: now passing (ENG-2809 fixed by other agent)

## Per-Slice Cycle
1. **Baseline**: 3 test suites (JS, Python, pgTAP+schema) + sync-test verify — all in parallel
2. **Seed**: sync-test seed fill (accumulative, never cleaned)
3. **Spec**: Spawn spec-writer subagent, answer its questions via sub-agents
4. **Review spec**: 2 reviewers (positive + negative), revise if needed
5. **Implement**: Spawn workers sequentially, verify each, commit each
6. **Post-review**: 4 agents — code reviewer, regression detector, test runner, manual verifier
7. **Retro**: Write findings to phase file, extract lessons for next slice

## Goal
Migrate emails and attachments to use gfs_sync_items, same pattern as files (Slices 1-4).

## Scope
- ENG-2829: Emails (backfill + writers + worker + readers)
- ENG-2830: Attachments (same pattern, after emails)
- NOT in scope: ENG-2828 (drop old file columns) — separate, production-gated

## Phase Map
- [x] Slice E1: Backfill emails — PASS. Commit 9c704e36.
- [x] Slice E2: Switch email writers — PASS. 5 commits (prereqs + resolver + Python API + test fixes).
- [x] Slice E3: Switch email worker + attachment backfill — PASS. Commit ef3ee9cc.
- [x] Slice E4: Switch email readers — PASS. Commit 06bb3c8e.
- [x] Slice A1: Pulled forward into E3 (attachment backfill done)
- [x] Slice A2: Collapsed into E2 (attachment writers switched alongside email writers)
- [x] Slice A3: Collapsed into E3 (attachment worker switched alongside email worker)
- [x] Slice A4: Collapsed into E4 (attachment readers switched alongside email readers)
- [ ] Cleanup: Drop old columns from inbound_emails + email_attachments (production-gated)

## Key Context

### What already exists
- gfs_sync_items partitioned table with email + attachment partitions
- Creation triggers: emails → blocked, attachments → blocked
- Cleanup triggers (BEFORE DELETE), computed relationships (PostgREST)
- BEFORE UPDATE validation trigger (transitions, failure_count, pending_gfs_doc_id)
- AFTER UPDATE audit trigger (event logging, deleted_at, sibling check, vocab fix)
- Entity-agnostic claim RPCs (claim_pending_sync, claim_pending_deletion)
- 677-line contamination reverted (old RPCs untouched)

### Email-specific complexity
- Classification gate: emails start blocked → resolver transitions to pending or rejected
- Sibling deletion: email + attachments coupled via audit trigger (ONE check, no branching)
- is_excluded on both emails AND attachments — needs projection to entity table
- Attachments depend on parent email for metadata

### Backfill status mapping
```sql
CASE WHEN status = 'classified' THEN gfs_sync_status
     WHEN gfs_sync_status = 'pending' THEN 'blocked'
     ELSE gfs_sync_status END
```

### db-checks allowlist
Only allowlist trigger→trigger chains that can't be traced. Current file entries:
`file:sync_requested`, `file:deletion_requested`, `file:sync_failed`, `file:deletion_failed`,
`file:sync_timed_out`, `file:deletion_timed_out`. Email equivalents will need same treatment.

### Writer surfaces
- `nextjs-app/lib/services/inbound-email-resolver.ts` — classification, rejection, attachment unblock
- `python-services/agent_api/api/email.py` — exclusion toggles, external toggles
- `python-services/agent_api/email_sync_service.py` — sync callbacks (gfs_doc_id, status)

### Reader surfaces
- `nextjs-app/lib/services/project-email.ts` — ~20 refs to sync columns
- `get_data_summary` RPC — does NOT read sync columns (only deleted_at)
- `attachment_browse` view — does NOT read sync columns

### Test commands
```
cd nextjs-app && bun run test:integration
cd python-services && uv run pytest tests/integration/db/ -v
bun tools/db-test/src/cli.ts pgtap && bun tools/db-test/src/cli.ts schema
sync-test verify --list
```

## Quality Log
(populated as slices complete)

## Lessons Learned
(populated from retros)
