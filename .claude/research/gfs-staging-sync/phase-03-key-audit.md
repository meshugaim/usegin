# Phase 3: Gemini API Key Usage Audit

## Summary

There is exactly **1 confirmed bug** in production runtime code: `text_extraction_service.py:314` bypasses `get_gemini_api_key()` and reads `GEMINI_API_KEY` directly. On staging, this resolves to the production key. No other production runtime code paths bypass the env-aware selector. There are also 2 local CLI tools and 1 E2E test helper that use direct env var reads, but these are acceptable for their context (local-only tools, test cleanup).

## Findings

### The Canonical Selector: `get_gemini_api_key()` in `agent_api/agent/config.py:34-64`

Reads `RAILWAY_ENVIRONMENT` and maps:
- `"production"` -> `GEMINI_API_KEY`
- `"staging"` -> `GEMINI_API_KEY_STAGING`
- anything else -> `GEMINI_API_KEY_DEV`

Raises `ValueError` if the required key is missing. No fallbacks.

### CORRECT: Production services using `get_gemini_api_key()`

| File | Line | How key is obtained |
|------|------|---------------------|
| `python-services/agent_api/project_file_search_service.py` | 101 | `self.gemini_api_key = get_gemini_api_key()` |
| `python-services/agent_api/admin_gfs_service.py` | 58 | `self.gemini_api_key = get_gemini_api_key()` |
| `python-services/agent_api/agent/multi_store_query_service.py` | 41 | `genai.Client(api_key=get_gemini_api_key())` |
| `python-services/agent_api/agent/file_search_query_service.py` | 26 | `genai.Client(api_key=get_gemini_api_key())` |

All four production GFS code paths correctly use the env-aware selector.

### BUG: Production code bypassing `get_gemini_api_key()`

| File | Line | Code | Impact |
|------|------|------|--------|
| `python-services/agent_api/text_extraction_service.py` | 314 | `os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY_DEV")` | On staging: resolves to production key (`GEMINI_API_KEY` is set to prod value on staging Railway). Skips `GEMINI_API_KEY_STAGING` entirely. PDF text extraction on staging hits the **production GCP project**. |

This is the **only bug in production runtime code**. The pattern `GEMINI_API_KEY or GEMINI_API_KEY_DEV` predates the env-aware selector (likely copied from the `text_extraction_gemini_fallback.py` experiment).

### OK: Service-level config validation (`python-services/agent_api/config.py`)

| File | Line | What it does |
|------|------|--------------|
| `python-services/agent_api/config.py` | 42 | Lists `GEMINI_API_KEY` in `REQUIRED_VAR_NAMES` |
| `python-services/agent_api/config.py` | 77 | `Settings.GEMINI_API_KEY: str = ""` |

This is startup validation / settings schema. It only validates `GEMINI_API_KEY` exists, **not** `GEMINI_API_KEY_STAGING`. This is a secondary concern (not a key-resolution bug, but a missing validation): staging could start without `GEMINI_API_KEY_STAGING` and only fail at runtime when GFS is invoked.

### OK: Local CLI tools (not deployed, not env-aware)

| File | Lines | Pattern | Notes |
|------|-------|---------|-------|
| `tools/google-file-search/main.py` | 59, 347 | `os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_DEV")` | Local debug tool, never deployed |
| `tools/google-file-search/inspect_sdk.py` | 11 | `os.getenv("GEMINI_API_KEY")` | Local inspection script |

These are developer CLI tools run locally. They don't need env-aware selection because they're always run in a single environment context (the developer sets the key they want).

### OK: E2E test helper

| File | Line | Pattern | Notes |
|------|------|---------|-------|
| `tests/e2e/tests/office-file-lifecycle.spec.ts` | 125 | `process.env.GEMINI_API_KEY_DEV \|\| process.env.GEMINI_API_KEY` | E2E cleanup function, runs locally/CI only |
| `tools/e2e/src/lib/services.ts` | 355 | `process.env.GEMINI_API_KEY_DEV \|\| 'mock-gemini-key-for-e2e-tests'` | E2E service config, local only |

### OK: CI / GitHub Actions

| File | Line | What |
|------|------|------|
| `.github/workflows/gemini-integration-tests.yml` | 47 | Passes `GEMINI_API_KEY_DEV` secret |
| `.github/workflows/e2e-tests.yml` | 116, 123, 125 | Passes `GEMINI_API_KEY_DEV` secret |
| `.github/workflows/python-integration-tests.yml` | 63 | Passes `GEMINI_API_KEY_DEV` secret |

CI always uses `GEMINI_API_KEY_DEV` from GitHub secrets. This is correct -- CI is a dev environment.

### OK: Test fixtures (unit and integration)

All unit tests use `monkeypatch.setenv("GEMINI_API_KEY_DEV", "fake-api-key")` or mock `get_gemini_api_key`. Integration tests use the `gemini_api_key` fixture from `conftest.py:22` which reads `GEMINI_API_KEY_DEV or GEMINI_API_KEY`. These are all test-context-appropriate.

### OK: Experiments (never deployed)

13 experiment files in `python-services/experiments/` use direct `os.getenv("GEMINI_API_KEY_DEV") or os.getenv("GEMINI_API_KEY")`. These are standalone scripts, never imported by production code, never deployed.

### OK: Documentation

~20 references across `docs/` files are purely documentary (tables, examples, explanations).

### `genai.Client(api_key=...)` Audit

All production `genai.Client` instantiations:

| File | Line | Key source | Verdict |
|------|------|------------|---------|
| `agent_api/text_extraction_service.py` | 318 | Direct `os.environ.get` | **BUG** |
| `agent_api/project_file_search_service.py` | 102 | `get_gemini_api_key()` | CORRECT |
| `agent_api/agent/multi_store_query_service.py` | 41 | `get_gemini_api_key()` | CORRECT |
| `agent_api/agent/file_search_query_service.py` | 26 | `get_gemini_api_key()` | CORRECT |
| `agent_api/google_file_search_client.py` | 24 | `api_key` constructor param (passed from callers above) | CORRECT |

## Sources

- `/workspaces/test-mvp/python-services/agent_api/agent/config.py` -- `get_gemini_api_key()` definition (lines 34-64)
- `/workspaces/test-mvp/python-services/agent_api/text_extraction_service.py` -- BUG at line 314
- `/workspaces/test-mvp/python-services/agent_api/config.py` -- service-level config (lines 36-46, 77)
- `/workspaces/test-mvp/python-services/agent_api/project_file_search_service.py` -- correct usage (line 101)
- `/workspaces/test-mvp/python-services/agent_api/admin_gfs_service.py` -- correct usage (line 58)
- `/workspaces/test-mvp/python-services/agent_api/agent/multi_store_query_service.py` -- correct usage (line 41)
- `/workspaces/test-mvp/python-services/agent_api/agent/file_search_query_service.py` -- correct usage (line 26)
- `/workspaces/test-mvp/tools/google-file-search/main.py` -- local tool (lines 59, 347)
- `/workspaces/test-mvp/tools/google-file-search/inspect_sdk.py` -- local tool (line 11)
- `/workspaces/test-mvp/tests/e2e/tests/office-file-lifecycle.spec.ts` -- E2E helper (line 125)
- Full codebase grep for `GEMINI_API_KEY`, `GEMINI_API_KEY_DEV`, `GEMINI_API_KEY_STAGING`, `get_gemini_api_key`, `genai.Client(`

## Open Questions

1. **Should `text_extraction_service.py` be fixed to use `get_gemini_api_key()`?** Yes -- this is a clear bug. The fix is a 1-line change. The `or` fallback pattern should be replaced with the canonical selector.
2. **Should `config.py` (service-level) validate `GEMINI_API_KEY_STAGING` on staging?** Currently only validates `GEMINI_API_KEY`. A missing staging key would not be caught at startup, only at runtime when GFS operations are attempted. This is a lower-severity issue (defense-in-depth).
3. **Should `GEMINI_API_KEY` be removed from staging Railway vars?** It holds the production key value and is only read by the buggy `text_extraction_service.py`. After fixing that bug, `GEMINI_API_KEY` on staging would be entirely unused and its presence is confusing/dangerous.

## Dead Ends

None. This was a straightforward grep audit.
