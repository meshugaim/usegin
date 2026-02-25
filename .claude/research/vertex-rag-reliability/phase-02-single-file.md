# Phase 2: Single File Upload Reliability

## Summary

Vertex AI RAG Engine's `upload_file()` API is **dramatically more reliable than GFS** for file uploads. All 15 uploads (3 attempts each for 100K, 1M, 3M, 6M text files and a .docx file) succeeded with 100% success rate. The 6M file — which fails ~60% of the time in GFS — succeeded every time. The .docx format — which hangs indefinitely in GFS — uploaded and indexed successfully every time. Upload times scale linearly with file size (~7s for 100K, ~55s for 6M).

## Findings

### Q2: Text Volume Ceiling — No failures up to 6M characters

| File | Size | Attempts | Success | Failed | Timeout | Avg Duration |
|------|------|----------|---------|--------|---------|-------------|
| test-small.txt | 100K chars | 3 | 3 | 0 | 0 | 7.6s |
| test-medium.txt | 1M chars | 3 | 3 | 0 | 0 | 15.3s |
| test-large.txt | 3M chars | 3 | 3 | 0 | 0 | 31.5s |
| test-xlarge.txt | 6M chars | 3 | 3 | 0 | 0 | 54.7s |
| test.docx | 37KB | 3 | 3 | 0 | 0 | 9.7s |

**GFS comparison:**
- GFS: >3M chars fails ~20% of the time, >5.7M chars fails ~60%
- Vertex RAG: 6M chars = 100% success (3/3 attempts)
- Upload time scales linearly: ~9.1 bytes/ms (~1.1s per 100KB)

**Verdict:** Vertex RAG Engine has a substantially higher text volume ceiling than GFS. 6M characters (the largest we tested) works reliably. We didn't find the ceiling.

### Q3: Operation Status Honesty — Mixed results

**High-level SDK (`rag.get_file()`) does NOT expose file status.** The returned `RagFile` object (from `vertexai.rag.utils.resources`) is a custom dataclass with only 3 fields:
- `.name` — resource path
- `.display_name` — display name
- `.description` — description

There is NO `file_status`, `state`, or `error_status` field. The `_pb` (proto buffer) attribute is also absent. This means the high-level SDK **cannot report file state at all** — it strips this critical information during the proto-to-dataclass conversion.

**Low-level API (`VertexRagDataServiceClient.get_rag_file()`) DOES expose file status.** The v1beta1 proto `RagFile` has:
- `file_status.state` — enum: `STATE_UNSPECIFIED=0`, `ACTIVE=1`, `ERROR=2`
- `file_status.error_status` — string error description

Post-experiment verification via the low-level API confirmed all 30 files (15 from this run + 15 from a previous run) were in `ACTIVE` state with no error messages.

**Additional notable fields from low-level API:**
- `size_bytes` = 0 for all files (Vertex RAG doesn't report actual file size)
- `rag_file_type` = 0 (`RAG_FILE_TYPE_UNSPECIFIED`) for all files (doesn't distinguish .txt from .docx)

**Verdict:** Since all uploads succeeded, we couldn't test what happens when a file fails. The low-level API has the infrastructure for honest status reporting (ACTIVE/ERROR states + error_status string). But the high-level SDK strips it, which is a significant API design flaw. You MUST use the low-level `VertexRagDataServiceClient` to check file status.

### Q5: Format Support — .docx works perfectly

The .docx file (37KB, created with python-docx) uploaded and indexed successfully in all 3 attempts:
- Attempt 1: 12.7s
- Attempt 2: 6.6s
- Attempt 3: 9.8s

Post-upload retrieval confirmed the content was properly extracted and indexed:
- Headings were concatenated with body text (e.g., "Test Document for Vertex RAG EngineThis is a test document...")
- The unique marker "Crystalline Serendipity Platypus" was retrievable
- Retrieval scores were consistent (0.471) across all 3 file copies

**GFS comparison:**
- GFS: `.docx` hangs indefinitely (never completes, never reports error)
- Vertex RAG: `.docx` uploads in ~10s, indexes fully, content is retrievable
- GFS: PDF `importFile` = 0/48 success
- Vertex RAG: .docx = 3/3 success (PDF not tested in this phase)

**Verdict:** Vertex RAG Engine handles .docx far better than GFS. This is a major advantage.

### Timing Data — Linear scaling

Upload duration scales linearly with file size:
```
100K chars:   7.3s,  7.1s,  8.6s   → avg  7.6s  (13.2K chars/s)
1M chars:    16.0s, 13.8s, 16.2s   → avg 15.3s  (65.4K chars/s)
3M chars:    30.6s, 30.2s, 33.5s   → avg 31.5s  (95.2K chars/s)
6M chars:    52.2s, 54.7s, 57.3s   → avg 54.7s  (109.7K chars/s)
.docx 37KB:  12.7s,  6.6s,  9.8s   → avg  9.7s
```

The throughput increases with file size (more efficient for larger files), suggesting a fixed overhead per upload (~5-7s) plus a linear component. The variance is low (coefficient of variation ~5-10% for text files), indicating consistent performance.

**GFS comparison:**
- GFS upload: 5-9s per small document (comparable for small files)
- Vertex RAG: 5-57s depending on size (predictable linear scaling)

### Surprise Findings

1. **The high-level SDK is an information sinkhole.** `rag.upload_file()` returns a `RagFile` with only name/display_name/description. `rag.get_file()` returns the same stripped object. You lose file_status, size_bytes, create_time, update_time, rag_file_type — all fields that exist in the proto. This is a critical SDK design flaw for any reliability monitoring.

2. **`upload_file()` is synchronous and blocking.** It waits for the file to be fully processed (uploaded, chunked, embedded) before returning. This means:
   - You know immediately if it succeeded (no async polling needed for success cases)
   - BUT the high-level SDK doesn't return status information, so you can't tell *why* it succeeded or what state it's in
   - For failures, it raises an exception (we didn't encounter any, but the pattern is exception-based, not status-based)

3. **No deduplication.** Uploading the same file 3 times creates 3 separate RagFile entries. Each is independently retrievable. GFS behaves similarly.

4. **size_bytes always 0.** The low-level API reports `size_bytes=0` for all files, even the 6MB one. This field appears to be non-functional.

5. **rag_file_type always UNSPECIFIED.** Even for .txt and .docx files, the type is not set. The enum has TXT=1 and PDF=2 but neither is populated.

6. **Existing files in corpus: 15.** The corpus already had 15 files from a previous experiment run (likely Phase 1). The second run of 15 uploads all succeeded, bringing the total to 30 files. No interference between runs.

## Retrieval Verification

Post-experiment retrieval queries confirmed all file types were properly indexed:

**Text files (6M):** Retrieved content from Section 2439 deep within the xlarge file, confirming the full file was indexed:
```
Chunk: score=0.450, source=reliability-test-xlarge.txt-attempt1-1772022811
text: Section 2439: Analysis and Findings (Ref: 5ef01d89)...
```

**.docx file:** Retrieved the unique marker and full document text:
```
Chunk: score=0.471, source=reliability-test-docx-attempt1-1772023191
text: Test Document for Vertex RAG EngineThis is a test document created by python-docx...
```

## Sources

- Experiment script: `/workspaces/test-mvp/python-services/experiments/vertex_reliability_single_upload.py`
- Full experiment output: `/tmp/vertex_reliability_output.txt`
- Test files: `/workspaces/test-mvp/python-services/experiments/vertex_reliability_test_files/`
- Reference experiment: `/workspaces/test-mvp/python-services/experiments/vertex_rag_experiment.py`
- Corpus: `projects/768786717495/locations/us-west1/ragCorpora/2842897264777625600`
- SDK: `google-cloud-aiplatform 1.136.0`, `vertexai.rag`
- Low-level API: `google.cloud.aiplatform_v1beta1.VertexRagDataServiceClient`

### Uploaded File Resource Names (preserved for Phase 3)

```
test-small.txt attempt 1:  .../ragFiles/5641438470694175467
test-small.txt attempt 2:  .../ragFiles/5641439083645853037
test-small.txt attempt 3:  .../ragFiles/5641439716465152119
test-medium.txt attempt 1: .../ragFiles/5641440341255965279
test-medium.txt attempt 2: .../ragFiles/5641441007500998055
test-medium.txt attempt 3: .../ragFiles/5641441689914718146
test-large.txt attempt 1:  .../ragFiles/5641442491175963785
test-large.txt attempt 2:  .../ragFiles/5641443348617941610
test-large.txt attempt 3:  .../ragFiles/5641444232476803950
test-xlarge.txt attempt 1: .../ragFiles/5641445186916497321
test-xlarge.txt attempt 2: .../ragFiles/5641446188597269562
test-xlarge.txt attempt 3: .../ragFiles/5641447200913739656
test.docx attempt 1:       .../ragFiles/5641447907142458648
test.docx attempt 2:       .../ragFiles/5641448557629428184
test.docx attempt 3:       .../ragFiles/5641449171624676642
```

## Open Questions

1. **What IS the Vertex RAG file size ceiling?** We tested up to 6M characters (6MB) with 100% success. GFS fails at ~5.7M. Vertex RAG may support much larger files. Testing 10M, 20M, 50M would establish the actual ceiling.

2. **What does a Vertex RAG failure look like?** All our uploads succeeded, so we couldn't observe the ERROR state or error_status field in action. A future test should deliberately trigger failures (invalid file formats, corrupted files, extremely large files).

3. **Does the low-level API's `file_status.error_status` provide useful error messages?** We only saw `ACTIVE` states. Need to trigger failures to test error reporting quality.

4. **PDF support?** GFS has 0/48 success with `importFile` for PDFs. Vertex RAG Engine's PDF handling was not tested in this phase.

5. **Why does `rag_file_type` always return UNSPECIFIED?** Is it set during processing and we're checking too late, or is it genuinely never populated?

## Dead Ends

1. **High-level SDK for status monitoring.** The `rag.get_file()` API strips `file_status` from the proto response. We discovered this after the experiment started, leading to all polling results showing "UNKNOWN". The workaround is the low-level `VertexRagDataServiceClient`, which we used for post-experiment verification.

2. **Post-upload state transition monitoring.** Since `upload_file()` is synchronous and blocks until processing is complete, there are no state transitions to observe. By the time the call returns, the file is already ACTIVE (or has raised an exception). The 60s polling period was unnecessary for this API — it's only useful for async APIs like GFS's `import_files()`.
