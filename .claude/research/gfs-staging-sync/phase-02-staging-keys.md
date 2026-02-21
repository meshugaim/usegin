# Phase 02: GFS/Gemini API Keys and Configuration - Staging vs Local

## Summary

Staging and local use **different Gemini API keys pointing to different GCP projects**, enforced by strict environment isolation in `get_gemini_api_key()`. Staging has both `GEMINI_API_KEY` (production key, unused) and `GEMINI_API_KEY_STAGING` (the key staging actually uses). There is one notable inconsistency: `text_extraction_service.py` does NOT use the environment-aware key selector and would use the wrong key on staging.

## Findings

### Key Inventory Across Environments

| Variable | Local (Doppler/env) | Staging (Railway) | Production (Railway) |
|---|---|---|---|
| `GEMINI_API_KEY` | Not set | `AIzaSyCZ3A-90AxrBoBVXWOgw-dQQvP7FANjA2Q` | `AIzaSyCZ3A-90AxrBoBVXWOgw-dQQvP7FANjA2Q` |
| `GEMINI_API_KEY_STAGING` | Not set | `AIzaSyB7QwfnxEkBQSMOPFx-jhpkgbvza1ScK04` | Not set |
| `GEMINI_API_KEY_DEV` | `AIzaSyAHW21ZIrzZm8UmV_0ubOhPlwuS-LqDSnQ` | Not set | Not set |

### Key Observations

1. **Three distinct API keys** exist, one per environment, each pointing to a separate GCP project:
   - Production: `AIzaSyCZ3A-90Axr...` (GCP project: `effi-gfs-prod`)
   - Staging: `AIzaSyB7QwfnxEk...` (GCP project: `effi-gfs-staging`)
   - Development: `AIzaSyAHW21ZIrz...` (GCP project: `effi-gfs-dev`)

2. **Staging has BOTH `GEMINI_API_KEY` and `GEMINI_API_KEY_STAGING`** set on Railway. The `GEMINI_API_KEY` on staging holds the **production key** value (`AIzaSyCZ3A...`), which is identical to production's `GEMINI_API_KEY`. This is presumably a leftover from before environment isolation was added.

3. **Production and staging share the same `GEMINI_API_KEY` value** -- both have `AIzaSyCZ3A-90AxrBoBVXWOgw-dQQvP7FANjA2Q`. But staging's active key (via `get_gemini_api_key()`) is `GEMINI_API_KEY_STAGING`, which is different.

### Key Selection Logic

The environment-aware key selector lives in `python-services/agent_api/agent/config.py:34-64`:

```python
def get_gemini_api_key() -> str:
    env = _get_environment()  # reads RAILWAY_ENVIRONMENT
    if env == "production":
        return os.getenv("GEMINI_API_KEY")       # AIzaSyCZ3A...
    elif env == "staging":
        return os.getenv("GEMINI_API_KEY_STAGING")  # AIzaSyB7Qw...
    else:
        return os.getenv("GEMINI_API_KEY_DEV")    # AIzaSyAHW2...
```

Environment detection: `RAILWAY_ENVIRONMENT` env var (`"production"`, `"staging"`, or absent for dev).

### Services Using `get_gemini_api_key()` (Correct)

These all use the environment-aware selector and will get the right key:

| Service | File | Usage |
|---|---|---|
| `ProjectFileSearchService` | `agent_api/project_file_search_service.py:101` | Store creation, file upload/delete |
| `MultiStoreQueryService` | `agent_api/agent/multi_store_query_service.py:41` | Multi-store queries |
| `FileSearchQueryService` | `agent_api/agent/file_search_query_service.py:26` | Single-store queries |
| `AdminGFSService` | `agent_api/admin_gfs_service.py:58` | Admin GFS operations |
| `DriveSyncService` | `agent_api/drive_sync_service.py:83` | Uses `ProjectFileSearchService` |

### BUG: `text_extraction_service.py` Uses Wrong Key Pattern

`python-services/agent_api/text_extraction_service.py:314` has:
```python
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY_DEV")
```

This does NOT use `get_gemini_api_key()`. On staging:
- `GEMINI_API_KEY` is set to the **production** key (`AIzaSyCZ3A...`)
- So it would use the production key instead of the staging key
- This means PDF text extraction via Gemini on staging uses the production GCP project

**Impact:** Files uploaded via `_extract_pdf_gemini()` on staging go to the production GCP project's files API, not staging. This is a cross-environment contamination issue, though the impact may be limited since these are temporary uploads for text extraction (not GFS stores).

### GCP Project Mapping (from `docs/gfs-hardening.spec.md`)

| Environment | GCP Project | API Key Variable |
|---|---|---|
| Production | `effi-gfs-prod` | `GEMINI_API_KEY` |
| Staging | `effi-gfs-staging` | `GEMINI_API_KEY_STAGING` |
| Development | `effi-gfs-dev` | `GEMINI_API_KEY_DEV` |

### Historical Context: Bug #009

Bug #009 (`docs/bugs/009-staging-file-sync-permission-denied.md`) documents a previous incident (2025-12-11) where a staging GFS store was created with the production API key. The store was bound to the production key, so staging (using the staging key) got 403 PERMISSION_DENIED. Fix was deleting the orphaned store record. This confirms that GFS stores are tightly bound to the API key that created them.

### Service-Level Config (`config.py`) vs Agent Config (`agent/config.py`)

There are two config files:
- `agent_api/config.py` (service-level): Lists `GEMINI_API_KEY` as required. This is the startup validator that checks env vars exist.
- `agent_api/agent/config.py` (agent-level): Contains `get_gemini_api_key()` with environment-aware key selection.

The service-level config only validates `GEMINI_API_KEY` exists, not `GEMINI_API_KEY_STAGING`. This means staging startup validation doesn't check for the staging-specific key. If `GEMINI_API_KEY_STAGING` were missing, the service would start but fail at runtime when GFS operations are attempted.

### Secret Management

- **Local:** `GEMINI_API_KEY_DEV` is injected via Doppler (`.devcontainer/doppler-wrapper.sh` wraps the shell with `doppler run`)
- **Staging/Production:** Keys are set directly as Railway service variables
- **CI:** `GEMINI_API_KEY_DEV` comes from GitHub Actions secrets

## Sources

- Railway MCP: `list-variables` for python-services on staging and production environments
- `/workspaces/test-mvp/python-services/agent_api/agent/config.py` - `get_gemini_api_key()` function
- `/workspaces/test-mvp/python-services/agent_api/config.py` - service-level validation
- `/workspaces/test-mvp/python-services/agent_api/text_extraction_service.py:314` - non-standard key pattern
- `/workspaces/test-mvp/docs/gfs-hardening.spec.md` - GCP project mapping
- `/workspaces/test-mvp/docs/bugs/009-staging-file-sync-permission-denied.md` - historical key mismatch bug
- Local env: `GEMINI_API_KEY_DEV=AIzaSyAHW21ZIrzZm8UmV_0ubOhPlwuS-LqDSnQ` (from Doppler)

## Open Questions

1. **Should `text_extraction_service.py` be updated to use `get_gemini_api_key()`?** Currently uses a different key resolution that skips the staging key entirely. This is a bug or at minimum an inconsistency.
2. **Should `GEMINI_API_KEY` be removed from staging Railway vars?** It holds the production key value and is unused by the environment-aware selector (staging reads `GEMINI_API_KEY_STAGING`). Its presence creates confusion and was the root cause of Bug #009. However, `text_extraction_service.py` actually reads it, creating a subtle cross-env issue.
3. **Should `config.py` (service-level) validate `GEMINI_API_KEY_STAGING` on staging?** Currently only validates `GEMINI_API_KEY`, which means a missing staging key wouldn't be caught at startup.

## Dead Ends

None - the investigation was straightforward. Railway MCP tools provided direct access to all environment variables.
