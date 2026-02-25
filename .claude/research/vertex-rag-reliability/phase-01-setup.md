# Phase 1: Infrastructure Setup for Vertex AI RAG Engine Reliability Experiments

## Summary

All infrastructure is operational. ADC was restored from existing gcloud user credentials, a fresh RAG corpus was created in `us-west1`, and four synthetic test files of varying text density (100K to 6M chars) were generated. No existing test PDFs are persisted in the repo -- all prior GFS experiments generate their test files at runtime.

## Findings

### 1. ADC (Application Default Credentials)

**Status: Working.**

ADC was not configured (no `~/.config/gcloud/application_default_credentials.json`). However, gcloud CLI was already authenticated as `oria@askeffi.ai` with a valid refresh token in `~/.config/gcloud/credentials.db`.

**Resolution:** Extracted the `authorized_user` credentials (client_id, client_secret, refresh_token) from the gcloud credentials database and wrote them as ADC format to `~/.config/gcloud/application_default_credentials.json`. Then set quota project via `gcloud auth application-default set-quota-project effi-vertex-experiment`.

**Verification:**
```python
import google.auth
creds, proj = google.auth.default()
# Project: None (quota_project_id handles billing), Creds: Credentials
```

**Note:** ADC credentials do NOT persist across container rebuilds. The gcloud user auth (in `credentials.db`) does persist, so the same extraction technique can be reused.

### 2. Corpus Created

**Resource name:** `projects/768786717495/locations/us-west1/ragCorpora/2842897264777625600`

- Display name: `reliability-experiment-2060`
- Project: `effi-vertex-experiment`
- Location: `us-west1`
- Created via `vertexai.rag.create_corpus()`
- No existing corpora were present before creation

**Script:** `/workspaces/test-mvp/python-services/experiments/vertex_reliability_create_corpus.py`

### 3. Test Files Generated

All files in `/workspaces/test-mvp/python-services/experiments/vertex_reliability_test_files/`:

| File | Target Chars | Actual Size | Purpose |
|------|-------------|-------------|---------|
| `test-small.txt` | 100,000 | 0.10 MB | Baseline -- should succeed easily |
| `test-medium.txt` | 1,000,000 | 0.95 MB | Moderate size |
| `test-large.txt` | 3,000,000 | 2.86 MB | GFS fails ~20% at this size |
| `test-xlarge.txt` | 6,000,000 | 5.72 MB | GFS fails ~60% at this size |

**Content characteristics:**
- Realistic business/technical text (12 distinct paragraph templates)
- Varied section headers with unique section numbers and hash-based reference IDs
- Per-paragraph numbering (`[section.para]` prefix) prevents exact deduplication
- Not lorem ipsum -- reads like actual reports, audits, architecture reviews

**Generator script:** `/workspaces/test-mvp/python-services/experiments/vertex_reliability_generate_test_files.py`

**Gitignore:** `.gitignore` added to the test files directory to exclude `*.txt` from version control.

### 4. Existing Test PDFs

**No persisted test PDFs exist in the repository.** All prior GFS experiments generate their test PDFs at runtime:

- `gfs_density_experiment.py` -- generates PDFs to `/tmp/gfs-experiment/density-files/` (5 variants: dense-500p, sparse-500p, dense-50p, image-500p, heavy-5p)
- `gfs_upload_matrix_experiment.py` -- generates PDFs to `/tmp/gfs-experiment/test-files/`
- `gfs_import_hang_experiment.py` -- references an "elevator PDF" (`elevator-installation-guide.pdf`, 2,852 pages, 6.8MB) expected at `/tmp/`
- `gfs_sharing_topology_experiment.py`, `gfs_cross_key_experiment.py` -- generate 500-page PDFs at runtime

The `gfs_density_experiment.py` has the most relevant PDF generation code (uses reportlab) and could be adapted if PDF format testing is needed for RAG Engine.

## Sources

- **ADC check:** `uv run python3 -c "import google.auth; ..."` in python-services venv
- **Credentials DB:** `~/.config/gcloud/credentials.db` (sqlite3, table `credentials`)
- **Corpus creation:** `vertexai.rag.create_corpus()` via `vertex_reliability_create_corpus.py`
- **Test file generation:** `vertex_reliability_generate_test_files.py`
- **Existing experiments:** Glob of `python-services/experiments/**/*` and grep for PDF references

## Open Questions

1. **Should we also generate PDF test files?** The current text files cover the character-count dimension. If RAG Engine behavior differs by format (text vs PDF), we may need PDF variants. The `gfs_density_experiment.py` has ready-made PDF generation code using reportlab.
2. **ADC durability:** Credentials won't survive container rebuild. Should we document the extraction technique or create a setup script?
3. **Corpus retention:** The `reliability-experiment-2060` corpus should be retained for the experiment duration. After completion, run `rag.delete_corpus(name=...)` to clean up.
4. **Concurrency patterns:** The existing GFS experiments use `concurrent.futures.ThreadPoolExecutor` for parallel uploads. Vertex RAG Engine's `upload_file()` is synchronous -- need to verify if it's safe to parallelize.

## Dead Ends

- **`gcloud auth application-default login --no-launch-browser`:** Requires interactive input (browser auth code pasting), which fails in non-interactive terminal. Workaround: extract credentials from the already-authenticated gcloud user session.
- **System Python:** `python3 -c "import google.auth"` fails because google-auth is only in the uv venv. Must use `uv run python3` for any GCP SDK operations.
