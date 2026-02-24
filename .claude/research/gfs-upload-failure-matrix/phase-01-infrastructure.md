# Phase 1: Infrastructure Setup for GFS Upload Failure Matrix

## Summary

All infrastructure is ready for the GFS upload failure matrix experiment. Four API keys across two GCP projects are set up, test PDFs of four size classes are pre-generated, and both the experiment harness and analysis scripts are validated with a successful smoke test.

## Findings

### GCP Projects

| Project ID | Name | Status | Notes |
|---|---|---|---|
| `effi-vertex-experiment` | effi-vertex-experiment | Existing | Generative Language API enabled, hosts old dev key + 2 fresh keys |
| `effi-gfs-research-b` | GFS Research B | **Created** (2026-02-23) | New project, Generative Language API enabled, hosts 1 fresh key |

Note: Two additional experiment projects already existed (`effi-gfs-experiment`, `effi-gfs-experiment-b`) from the cross-key experiment. The new project `effi-gfs-research-b` provides a clean, never-used project for this matrix.

### API Keys Created

| Label | GCP Project | Key ID (display_name) | Key UID | Env Var |
|---|---|---|---|---|
| old-dev | effi-vertex-experiment | (pre-existing, no display name) | N/A | `GFS_KEY_OLD_DEV` (= `GEMINI_API_KEY_DEV`) |
| fresh-a1 | effi-vertex-experiment | `gfs-research-a1` | `d2f7308a-b190-4a7f-9a62-dc2b32211a01` | `GFS_KEY_FRESH_A1` |
| fresh-a2 | effi-vertex-experiment | `gfs-research-a2` | `579b608b-b970-47f7-bb6e-d3b618552a14` | `GFS_KEY_FRESH_A2` |
| fresh-b | effi-gfs-research-b | `gfs-research-b` | `2a558699-d7d8-4efc-846a-8788303c4963` | `GFS_KEY_FRESH_B` |

All keys are restricted to `generativelanguage.googleapis.com` only.

**Key strings are NOT stored in this file.** They must be set as environment variables before running:
```bash
export GFS_KEY_OLD_DEV="$GEMINI_API_KEY_DEV"
export GFS_KEY_FRESH_A1="<key-string>"
export GFS_KEY_FRESH_A2="<key-string>"
export GFS_KEY_FRESH_B="<key-string>"
```

To retrieve key strings: `gcloud services api-keys get-key-string <key-resource-name>`

### Test PDF Files

Pre-generated at `/tmp/gfs-experiment/test-files/`:

| Size Class | Pages | File Size | Path |
|---|---|---|---|
| small | 5 | 3,953 bytes (3.9 KB) | `test-small-5p.pdf` |
| medium | 50 | 30,454 bytes (29.7 KB) | `test-medium-50p.pdf` |
| large | 500 | 298,303 bytes (291.3 KB) | `test-large-500p.pdf` |
| super-heavy | 2000 | 1,200,773 bytes (1.15 MB) | `test-super-heavy-2000p.pdf` |

Each page contains ~1600 chars of distinct text (matching existing experiment patterns). Files are reused across runs — the harness checks for existence before regenerating.

### Experiment Scripts

| Script | Purpose | Path |
|---|---|---|
| Matrix harness | Run concurrency x size x key experiments | `/workspaces/test-mvp/python-services/experiments/gfs_upload_matrix_experiment.py` |
| Results analyzer | Produce summary tables from JSON results | `/workspaces/test-mvp/python-services/experiments/gfs_upload_matrix_analyze.py` |

### Smoke Test Results

Single upload: `old-dev` key, `small` (5-page) file, concurrency=1, direct method, 60s timeout.

| Metric | Value |
|---|---|
| Result | SUCCESS |
| Duration | 9.6s |
| Store created | `fileSearchStores/matrix01924b16-mf9yamfmgzo1` |
| Store cleaned up | Yes |
| JSON result file | `/tmp/gfs-experiment/results/old-dev_small_c1_direct_run1_20260223-222222.json` |

The full pipeline works: key verification -> store creation -> upload -> poll -> success detection -> JSON persistence -> cleanup.

### Bug Found and Fixed During Setup

The initial key verification used `list(client.file_search_stores.list(page_size=1))` which the `google.genai` SDK eagerly paginates through ALL stores (76+ production stores), hitting the per-minute rate limit (60 RPM). Fixed to create+delete a temporary store instead — a single round-trip that verifies write access.

## Sources

- GCloud CLI: `gcloud auth list`, `gcloud projects list`, `gcloud projects create`, `gcloud services enable`, `gcloud services api-keys create`, `gcloud services api-keys get-key-string`
- Existing experiments studied for patterns: `gfs_import_hang_experiment.py`, `gfs_accumulation_curve_experiment.py`, `gfs_cross_key_experiment.py`
- Smoke test output captured in terminal

## Open Questions

- **Billing on new project**: `effi-gfs-research-b` was created successfully and the API was enabled without billing issues. However, if quota limits differ from the existing project, this may surface during heavy matrix runs.
- **Rate limits**: The smoke test revealed a 60 RPM limit on `ReadFileSearchStore` requests. The matrix creates/deletes stores rapidly — we may need inter-run cooldowns for high-concurrency matrix runs.
- **Super-heavy file timing**: The 2000-page PDF is only 1.15 MB. Prior experiments showed 3000-page minimal PDFs succeed in ~10s on clean stores. The "super-heavy" class tests page-count pressure, not file-size pressure.

## Dead Ends

- **`effi-vertex-experiment` had zero API keys**: Despite being the project behind `GEMINI_API_KEY_DEV`, that key wasn't visible via `gcloud services api-keys list`. It may have been created through a different mechanism (Google AI Studio). The fresh keys (gfs-research-a1, gfs-research-a2) were created successfully via CLI.
- **Store list as key verification**: Abandoned after rate limit hit. The SDK's `list()` doesn't respect `page_size` as a limit — it eagerly fetches all pages.
