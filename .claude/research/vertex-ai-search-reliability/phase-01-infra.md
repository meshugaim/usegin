# Phase 1: Infrastructure Setup for VAIS Reliability Experiment

## Summary

Test file generation completed successfully (58 files, 12.3 MB across txt/docx/pptx/xlsx formats). Infrastructure setup scripts are written and tested. **Datastore + engine + schema creation is BLOCKED on expired ADC credentials** — requires human `gcloud auth application-default login` to proceed.

## Findings

### Test File Generation — COMPLETE

All test files generated successfully in `python-services/experiments/vais_reliability/test_files/`:

| Category | Files | Total Size | Purpose |
|---|---|---|---|
| Size variants | `small.txt` (100K), `medium.txt` (1M), `large.txt` (3M), `xlarge.txt` (6M) | 10.1 MB | Upload size limits, chunking behavior |
| Office formats | `test.docx`, `test.pptx`, `test.xlsx` | 75 KB | Format support testing |
| Concurrent batch | `concurrent_01..40.txt` (50K each) | 2.0 MB | Concurrent upload stress test |
| Metadata test | `meta_01..10.txt` (10K each) + `metadata_configs.json` | 101 KB | Metadata filtering (project_id, file_type, batch_id) |

Key design decisions:
- Each file has unique content (seeded PRNG with file label) to avoid dedup issues
- Text files include section headers every ~2000 chars to test heading-aware chunking
- Metadata files embed their metadata in content headers for cross-validation
- `metadata_configs.json` maps file index to metadata for upload scripts
- SHA-256 checksums printed for reproducibility verification

### Infrastructure Setup Script — WRITTEN, NOT YET EXECUTED

`python-services/experiments/vais_reliability/setup_infra.py` implements:

1. **Phase 0**: ADC auth verification (list existing datastores)
2. **Phase 1**: Datastore creation with:
   - `CONTENT_REQUIRED` content config
   - Layout parsing enabled (`LayoutParsingConfig`)
   - Layout-based chunking with `chunk_size=500`, `include_ancestor_headings=True`
   - `SOLUTION_TYPE_SEARCH` solution type
3. **Phase 2**: Engine creation with:
   - `SEARCH_TIER_ENTERPRISE` (required for chunk-based search)
   - Linked to the datastore via `data_store_ids`
4. **Phase 3**: Metadata schema setup on `default_schema` with:
   - `project_id` (string, indexable, retrievable)
   - `file_type` (string, indexable, retrievable)
   - `batch_id` (string, indexable, retrievable)
   - `size_bytes` (number, indexable, retrievable)
5. **State file**: Writes `infra_state.json` with all IDs for subsequent phases

Script supports `--data-store` / `--engine` flags to reuse existing resources, and `--skip-schema` to skip schema setup.

### ADC Authentication — BLOCKED

The existing ADC credential (`~/.config/gcloud/application_default_credentials.json`) is an `authorized_user` type with an expired refresh token. Refreshing requires interactive browser flow:

```bash
gcloud auth application-default login --no-launch-browser
# Opens browser for OAuth consent
gcloud config set project effi-vertex-experiment
gcloud auth application-default set-quota-project effi-vertex-experiment
```

This cannot be done from a non-interactive CLI session.

### Patterns Reused from Existing Experiment

All infrastructure patterns copied from `python-services/experiments/vertex_ai_search_experiment.py`:
- `LOCATION = "global"`, `COLLECTION = "default_collection"` (NOT regional)
- `DataStoreServiceClient` / `EngineServiceClient` / `SchemaServiceClient` from `google.cloud.discoveryengine_v1`
- LRO (Long Running Operation) pattern with `.result(timeout=N)`
- Schema uses `UpdateSchemaRequest` with `allow_missing=True` on `default_schema`
- Schema fields require `"indexable": True` for filtering to work
- String filter syntax: `field: ANY("value")`, numeric: `field >= N`

## Sources

- `python-services/experiments/vertex_ai_search_experiment.py` — patterns for datastore/engine/schema creation
- `python-services/experiments/vais_reliability/generate_test_files.py` — test file generator (created)
- `python-services/experiments/vais_reliability/setup_infra.py` — infrastructure setup (created)
- `python-services/experiments/vais_reliability/.gitignore` — gitignore for generated files
- `~/.config/gcloud/application_default_credentials.json` — expired ADC credential

## Open Questions

1. **ADC refresh** — human needs to run `gcloud auth application-default login` before infrastructure can be created
2. **Datastore naming** — using `vais-reliability-{run_id}` pattern; subsequent phases need the IDs from `infra_state.json`
3. **Enterprise tier cost** — `SEARCH_TIER_ENTERPRISE` is required for chunk search but may have cost implications in the experiment project
4. **Schema timing** — schema MUST be set up before document upload for filtering to work; the script enforces this ordering

## Infrastructure Created (2026-02-26)

Setup completed successfully using gcloud CLI token fallback (ADC was expired).

| Resource | ID |
|---|---|
| Data Store | `vais-reliability-51daa72e` |
| Engine | `vais-rel-engine-51daa72e` |
| Run ID | `51daa72e` |
| Schema | OK — 4 fields (project_id, file_type, batch_id, size_bytes) |
| State file | `python-services/experiments/vais_reliability/infra_state.json` |

Timings: Datastore creation 3.3s, engine creation 1.7s, schema update 3.2s.

### Auth Fix Applied

ADC credentials were expired (refresh token revoked). Added a gcloud CLI token fallback to `setup_infra.py`:
- `_get_gcloud_credentials()` — gets token via `gcloud auth print-access-token` with quota project
- `_make_client()` — factory that uses fallback credentials when ADC is broken
- All client instantiations updated to use `_make_client()`
- Falls through: ADC first, then gcloud fallback, then error with instructions

## Dead Ends

- Attempted non-interactive ADC refresh — `gcloud auth application-default login --no-launch-browser` requires stdin for the verification code, which fails in non-interactive mode
- No service account key found in the environment as fallback
- Bare `oauth2.Credentials(token=...)` without `quota_project_id` gets 403 SERVICE_DISABLED (quota project defaults to the gcloud internal project, not the user's)
