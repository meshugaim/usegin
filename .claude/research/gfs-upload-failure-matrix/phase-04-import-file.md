# Phase 4: importFile Path — Does It Bypass Project Degradation?

## Summary

**No. importFile is categorically worse than direct upload.** Every single import attempt across all 5 configurations failed with 0% success rate (0/48 uploads). The failure point is the File API itself: uploaded files never transition from PROCESSING to ACTIVE state, even on the clean project. importFile does not bypass project degradation — it introduces an entirely new failure mode that affects ALL projects, including healthy ones.

## Key Findings

### 1. importFile achieves 0% success rate across ALL configurations

| Key | Size | Pages | C | Method | Pass | Total | Rate |
|-----|------|-------|---|--------|------|-------|------|
| old-dev | large | 500 | 3 | import | 0 | 9 | **0%** |
| old-dev | large | 500 | 5 | import | 0 | 15 | **0%** |
| old-dev | super-heavy | 2000 | 1 | import | 0 | 3 | **0%** |
| fresh-b | large | 500 | 5 | import | 0 | 15 | **0%** |
| fresh-b | super-heavy | 2000 | 2 | import | 0 | 6 | **0%** |
| **TOTAL** | | | | **import** | **0** | **48** | **0%** |

### 2. Direct upload vs importFile — side-by-side comparison

| Config | Direct Upload | importFile |
|--------|:---:|:---:|
| old-dev large c=3 | **33-78%** (varies by key) | **0%** |
| old-dev large c=5 | **33-40%** | **0%** |
| old-dev super-heavy c=1 | **0-67%** | **0%** |
| fresh-b large c=5 | **100%** (15/15) | **0%** (0/15) |
| fresh-b super-heavy c=2 | **67%** (4/6) | **0%** (0/6) |

The most striking comparison is fresh-b large c=5: direct upload was **100% success** (15/15, avg 26.4s), while importFile was **0% success** (0/15, all timeout). Same key, same file, same project, same concurrency.

### 3. The failure point is the File API, NOT the store import step

Every failure had the same signature:
- `error`: "File never became ACTIVE"
- `document_state`: "FILE_NOT_ACTIVE"

The sequence:
1. `files.upload()` succeeds quickly (~1.3-2.3s) — the file bytes reach Google
2. File enters PROCESSING state
3. File **never** transitions to ACTIVE — polls continue for 600s until timeout
4. `import_file()` is **never reached** — the bottleneck is entirely in step 2-3

This means the import path's two-step design (File API upload + store import) introduces a single point of failure at the File API processing step that does not exist in the direct upload path.

### 4. File API processing hang is project-INDEPENDENT

Unlike direct upload failures (which are project-specific), the File API processing hang affects both projects equally:

| Project | Direct Upload (large c=5) | importFile (large c=5) |
|---------|:---:|:---:|
| effi-vertex-experiment (degraded) | 33-40% | 0% |
| effi-gfs-research-b (clean) | 100% | 0% |

This suggests the File API processing pipeline has its own bottleneck that is separate from the file search store processing pipeline. They appear to be different backend systems.

### 5. Duration profile

All import uploads had identical duration profiles: ~600-605s (the timeout value). Zero uploads completed before timeout. The File API upload step itself was fast (1.3-2.3s), but that only transfers the bytes — processing to ACTIVE never completes.

## Hypothesis: File API Processing Is Globally Throttled

The File API (`files.upload` + processing to ACTIVE) appears to have severe processing limitations for large PDFs that are independent of the file search store system. Two possible explanations:

1. **Global File API processing quota**: The File API has its own processing queue that is rate-limited or degraded, separate from the file search store pipeline. Large PDFs (500p+) overwhelm this queue.

2. **File API deprioritization**: Files uploaded via the File API for GFS import may be deprioritized compared to files uploaded directly to file search stores via `uploadToFileSearchStore`, which may have a dedicated processing path.

3. **Temporal coincidence**: The File API may have been experiencing a global outage during the ~2.5-hour experiment window (02:43-05:22 UTC on 2026-02-24). However, this is unlikely given the consistency across multiple hours and both projects.

The most likely explanation is (2): `uploadToFileSearchStore` uses a dedicated processing pipeline that handles the PDF-to-chunks conversion inline, while the File API upload processes files through a general-purpose pipeline that is either slower or has different quotas.

## Important Context

The previous accumulation curve experiment (`gfs_accumulation_curve_experiment.py`) used the import path with **small .txt files (~2KB)** and it worked perfectly — 25/25 at every accumulation level. This suggests the import path failure is specific to **large files** (500p/~300KB PDFs and above), not the import mechanism itself. The File API can process small files promptly but chokes on large PDFs.

## Raw Data Details

### old-dev large c=3 import (3 runs, 9 uploads)
| Run | File 0 | File 1 | File 2 |
|-----|--------|--------|--------|
| 1 | TIMEOUT 605s (FILE_NOT_ACTIVE) | TIMEOUT 604s (FILE_NOT_ACTIVE) | TIMEOUT 605s (FILE_NOT_ACTIVE) |
| 2 | TIMEOUT 605s (FILE_NOT_ACTIVE) | TIMEOUT 604s (FILE_NOT_ACTIVE) | TIMEOUT 604s (FILE_NOT_ACTIVE) |
| 3 | TIMEOUT 605s (FILE_NOT_ACTIVE) | TIMEOUT 605s (FILE_NOT_ACTIVE) | TIMEOUT 605s (FILE_NOT_ACTIVE) |

### old-dev large c=5 import (3 runs, 15 uploads)
| Run | Result |
|-----|--------|
| 1 | 0/5 success, all FILE_NOT_ACTIVE timeout |
| 2 | 0/5 success, all FILE_NOT_ACTIVE timeout |
| 3 | 0/5 success, all FILE_NOT_ACTIVE timeout |

### old-dev super-heavy c=1 import (3 runs, 3 uploads)
| Run | Result |
|-----|--------|
| 1 | TIMEOUT 605s (FILE_NOT_ACTIVE) |
| 2 | TIMEOUT 604s (FILE_NOT_ACTIVE) |
| 3 | TIMEOUT 604s (FILE_NOT_ACTIVE) |

### fresh-b large c=5 import (3 runs, 15 uploads)
| Run | Result |
|-----|--------|
| 1 | 0/5 success, all FILE_NOT_ACTIVE timeout |
| 2 | 0/5 success, all FILE_NOT_ACTIVE timeout |
| 3 | 0/5 success, all FILE_NOT_ACTIVE timeout |

### fresh-b super-heavy c=2 import (3 runs, 6 uploads)
| Run | Result |
|-----|--------|
| 1 | 0/2 success, all FILE_NOT_ACTIVE timeout |
| 2 | 0/2 success, all FILE_NOT_ACTIVE timeout |
| 3 | 0/2 success, all FILE_NOT_ACTIVE timeout |

## Analyzer Summary (Method x Concurrency)

```
Method               c=1        c=2        c=3        c=5       c=10
------------- ---------- ---------- ---------- ---------- ----------
direct         15/22 68%  10/12 83%  48/63 76%  56/75 75% 60/60 100%
import            0/3 0%     0/6 0%     0/9 0%    0/30 0%        ---
```

## Sources

- Experiment script: `/workspaces/test-mvp/python-services/experiments/gfs_upload_matrix_experiment.py`
- Analysis script: `/workspaces/test-mvp/python-services/experiments/gfs_upload_matrix_analyze.py`
- Result JSON files: `/tmp/gfs-experiment/results/*_import_*.json` (15 files)
- Experiment window: 2026-02-24 02:43 UTC to 05:22 UTC (~2.5 hours)
- Projects tested: effi-vertex-experiment (old-dev key), effi-gfs-research-b (fresh-b key)

## Open Questions

1. **Does the File API import path work for small/medium files?** The accumulation curve experiment succeeded with 2KB .txt files. Where's the cutoff? Between 30KB (medium/50p) and 300KB (large/500p)?
2. **Is this a permanent File API limitation or temporal?** Would the same test succeed if run at a different time of day or after a cooling period?
3. **Does `uploadToFileSearchStore` use a completely separate processing pipeline?** The 100% vs 0% on the same file+project strongly suggests yes.
4. **Would sequential (c=1) import of large files work if given more time (e.g., 1200s timeout)?** Or is the file permanently stuck in PROCESSING?

## Dead Ends

- **importFile as a workaround for project degradation**: Completely unviable. importFile performs worse than direct upload in every tested configuration, including on clean projects.
- **Two-step upload as reliability improvement**: The additional File API step adds a failure mode rather than improving reliability. The File API processing queue is a bottleneck that `uploadToFileSearchStore` avoids entirely.
