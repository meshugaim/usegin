# Phase 2: Single-File Upload Reliability — Text Volume, LRO Honesty, Format Support

## Summary

VAIS inline upload (`ImportDocuments` with `InlineSource`) has a **hard 1MB limit on raw_bytes** — files over 1,000,000 bytes are rejected with a clear error. All files under 1MB succeed reliably (100K txt, 37K docx, 31K pptx, 7K xlsx, 50K binary garbage). LROs complete in 5-10s and **always report errors honestly** — no hangs, no silent failures. All three Office formats (docx, pptx, xlsx) succeed, unlike GFS where docx hangs.

## Findings

### Q2: Text Volume — 1MB Hard Limit on Inline Upload

| File | Size | Result | LRO Duration | Error |
|---|---|---|---|---|
| `small.txt` | 100,172 bytes | OK | 6.3s | — |
| `medium.txt` | 1,001,644 bytes | FAIL | 6.2s | "Content bytes size cannot exceed 1000000, received 1001644" |
| `large.txt` | 3,004,922 bytes | FAIL | 10.3s | "Content bytes size cannot exceed 1000000, received 3004922" |
| `xlarge.txt` | 6,009,820 bytes | FAIL | 8.6s | "Content bytes size cannot exceed 1000000, received 6009820" |

**Key finding**: The limit is exactly **1,000,000 bytes** on `raw_bytes` content when using `InlineSource`. This is NOT the same as GFS's failure mode (GFS silently hangs on large files). VAIS rejects cleanly with a specific error message including the exact byte count.

**Implication for production**: Files > 1MB must be uploaded via GCS (Google Cloud Storage) URI path instead of inline bytes. The `ImportDocumentsRequest` also supports `GcsSource` and `BigQuerySource` which likely have higher limits. This is a well-documented API design pattern — inline for small, GCS for large.

### Q3: LRO Honesty — Excellent

**All LROs completed honestly.** Every single upload attempt (8 total) had its LRO reach `done=True` within 5-11 seconds. No hangs, no stuck operations, no ambiguous states.

| Scenario | LRO Done? | Error Reported? | Honest? |
|---|---|---|---|
| Valid 100K text | Yes (6.3s) | No error | Yes |
| Over-limit 1M text | Yes (6.2s) | Yes — clear byte limit error | Yes |
| Over-limit 3M text | Yes (10.3s) | Yes — clear byte limit error | Yes |
| Over-limit 6M text | Yes (8.6s) | Yes — clear byte limit error | Yes |
| 50K random binary garbage as text/plain | Yes (6.1s) | No error — **accepted** | Yes (honest, but surprising) |
| 37K docx | Yes (6.2s) | No error | Yes |
| 31K pptx | Yes (9.1s) | No error | Yes |
| 7K xlsx | Yes (6.1s) | No error | Yes |

**LRO transition tracking**: All LROs were already `done=True` on the first poll (5s poll interval). The operations complete within the first polling window. No intermediate `done=False` states were observed — the operations are fast enough to finish before the first check.

**Adversarial test (binary garbage)**: Random binary data uploaded as `text/plain` was **accepted without error**. The document was created and verified in the datastore. VAIS does not validate that the content is actually valid text — it trusts the declared mime_type. This is different from GFS behavior and worth noting for data quality considerations.

**First run discovery — `struct_data` is REQUIRED**: The initial run failed ALL uploads with `"Field 'document.data' is a required field, but no value is found."` even though `content.raw_bytes` was provided. The fix was adding a `struct_data` (protobuf Struct) field to each document. The datastore's `CONTENT_REQUIRED` config means it requires `struct_data` as the document's "data" field — `content` alone is insufficient. The existing experiment (`vertex_ai_search_experiment.py`) always provided both, which is why it worked. This is a significant API gotcha.

### Q5: Format Support — All Office Formats Succeed

| Format | Size | Result | LRO Duration | Verified |
|---|---|---|---|---|
| `test.docx` | 37,249 bytes | OK | 6.2s | Yes |
| `test.pptx` | 31,278 bytes | OK | 9.1s | Yes |
| `test.xlsx` | 7,141 bytes | OK | 6.1s | Yes |

**Critical comparison with GFS**: `.docx` uploads succeed cleanly in VAIS (6.2s), whereas GFS hangs indefinitely on `.docx` files (the known GFS failure mode). This is a significant reliability improvement.

All three Office formats used their proper OOXML mime types:
- docx: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- pptx: `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- xlsx: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

## Sources

- **Experiment script**: `/workspaces/test-mvp/python-services/experiments/vais_reliability/phase2_single_file.py`
- **Detailed JSON results**: `/workspaces/test-mvp/python-services/experiments/vais_reliability/phase2_results.json`
- **Test files**: `/workspaces/test-mvp/python-services/experiments/vais_reliability/test_files/`
- **Infrastructure state**: `/workspaces/test-mvp/python-services/experiments/vais_reliability/infra_state.json`
- **Existing experiment patterns**: `/workspaces/test-mvp/python-services/experiments/vertex_ai_search_experiment.py` (phase 4: document upload)

## Open Questions

1. **GCS upload path for large files** — Does `ImportDocumentsRequest` with `GcsSource` support files > 1MB? What's the limit? This is the production path for our use case (GFS files range from 100K to 6M+).
2. **Binary garbage acceptance** — VAIS accepted 50K of random bytes as text/plain without complaint. Is there downstream impact on search quality? Are the chunks searchable or garbage?
3. **Chunk quality for Office formats** — The documents were imported, but we haven't verified chunk content. Does the Layout Parser correctly extract headings from docx/pptx, or is it garbage chunks?
4. **LRO polling granularity** — All LROs finished before the first 5s poll. Could we poll at 1-2s intervals to capture the False→True transition and get more precise timing?

## Dead Ends

1. **First attempt without `struct_data`** — All 8 uploads failed with `"Field 'document.data' is a required field"`. The `CONTENT_REQUIRED` datastore config requires `struct_data` (the "data" field in the API sense), not just `content.raw_bytes`. Adding a minimal `struct_data` with source metadata fixed it. This is an undocumented requirement — the error message is misleading because "data" refers to `struct_data`, not `content`.
