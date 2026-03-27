# File Content Tools Build — COMPLETE

## Current State
Phase: done | All 5 phases passed.

## Phase Map
| # | Phase | Type | Status | Outcome |
|---|-------|------|--------|---------|
| 1 | Slice ENG-3715 | spec | done | 5 slices: ENG-3718–3722 |
| 2 | Implement ENG-3715 (extraction generalization) | implementation | done | Test integrity: JUSTIFIED |
| 3 | Implement ENG-3716 (get_attachment tool) | implementation | done | Test integrity: CLEAN |
| 4 | Implement ENG-3717 (get_drive_file tool) | implementation | done | (in phase 3 commits) |
| 5 | QA | qa | done | PASS — endpoints, tools, toggle, backfill all verified |

## Quality Log
| Phase | Verdict | Notes |
|-------|---------|-------|
| 1 — Slicing | pass | 5 slices match spec |
| 2 — ENG-3715 | JUSTIFIED | Mechanical URL/field renames only |
| 3+4 — Tools | CLEAN | No test modifications, toggle in one place |
| 5 — QA | PASS | All 3 entity types work, 181 tests pass, no regressions |

## What Was Built
- **Generalized extraction**: `POST /api/extract-text/{entity_type}/{entity_id}` (file/attachment/drive)
- **Pure function**: `extract_text_from_storage()` — entity-agnostic
- **get_file**: always-on (no toggle)
- **get_attachment**: queries email_attachments + parent email context
- **get_drive_file**: queries drive_files + folder path/MIME
- **Toggle**: `content_tools` gates get_attachment + get_drive_file, checked in mcp_builder.py only
- **Ingest wiring**: Mailgun webhook + drive sync worker → fire-and-forget extraction
- **Backfill**: `just files-content-backfill` covers all 3 entity types
