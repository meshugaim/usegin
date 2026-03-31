# ENG-3762: Add _get_drive getter to sync_items.py

## Current State
Slice: 1 _get_drive getter | Step: baseline | Status: in-progress
Last checkpoint: Starting build
Next: Read existing getters, run baseline tests

## Auto-Inject (re-injected after every agent return)
Priority: Don't regress > Orchestrate > Build.
Role: I am the liaison. I read code/whiteboard directly. Workers implement. I verify and commit.
Integrity: After every implementation, spawn a test-integrity reviewer.
Process: Read whiteboard → plan step → spawn worker → verify → commit → update whiteboard.

## Issue
ENG-3762 — Drive has no `_get_drive` getter in `sync_items.py`. When VAIS-enabled workspaces process Drive entities, `get_item()` returns None → files marked `upload_failed`. All other entity types have getters (file, email, attachment, meeting_summary, meeting_transcript).

## Plan
Single slice — this is a focused addition:
1. Baseline: run existing tests
2. Spec: design the getter based on existing patterns
3. TDD: write failing test first
4. Implement: add `_get_drive` + register in `_GETTERS`
5. Post-review: verify no regressions

## Key Files
- `python-services/agent_api/sync_items.py` — add getter here
- `python-services/agent_api/sync_worker.py` — has `gather_drive_metadata()` for reference
- `python-services/tests/unit/` — tests location

## Quality Log
(populated during build)
