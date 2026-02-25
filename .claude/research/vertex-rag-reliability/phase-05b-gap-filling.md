# Phase 5b: Gap-Filling — PDFs, Adversarial Files, Office Formats

## Summary

All three gaps have been filled. Text-heavy PDFs work perfectly in Vertex RAG Engine (9/9 success, including 6M chars that fails ~60% in GFS). Adversarial files produce clear, fast exceptions with descriptive error messages — the polar opposite of GFS's silent hangs. Office formats are mixed: .pptx works (3/3), .xlsx is explicitly unsupported.

## Gap 1: PDF Testing — 9/9 Success (0% Failure)

This was the most critical gap. GFS fails primarily on text-heavy PDFs, and Phase 2 only tested .txt and .docx. Now we have direct PDF evidence.

### Results

| File | Target Chars | File Size | Attempts | Success | Avg Duration |
|------|-------------|-----------|----------|---------|-------------|
| pdf-300k.pdf | ~300K | 45,289 bytes | 3 | 3/3 (100%) | 9.6s |
| pdf-3m.pdf | ~3M | 454,812 bytes | 3 | 3/3 (100%) | 35.6s |
| pdf-6m.pdf | ~6M | 912,186 bytes | 3 | 3/3 (100%) | 70.7s |

### Individual Timings

```
pdf-300k.pdf:  9.4s,  9.5s,  9.9s  → avg  9.6s  (low variance: 0.3s range)
pdf-3m.pdf:   35.1s, 35.7s, 36.0s  → avg 35.6s  (low variance: 0.9s range)
pdf-6m.pdf:   71.2s, 69.5s, 71.4s  → avg 70.7s  (low variance: 1.9s range)
```

### GFS Comparison

| Size | GFS Failure Rate | Vertex RAG Failure Rate |
|------|-----------------|------------------------|
| ~300K chars | ~0% (low risk) | 0% (3/3) |
| ~3M chars | ~20% | 0% (3/3) |
| ~6M chars | ~60% | 0% (3/3) |

### PDF Timing vs .txt Timing (Phase 2)

PDF processing is slightly slower than .txt at equivalent character counts, likely due to PDF parsing overhead:

| Chars | .txt (Phase 2) | PDF (Phase 5b) | Overhead |
|-------|---------------|----------------|----------|
| ~300K | ~7.6s (100K .txt) | 9.6s | ~+2s (PDF parse) |
| ~3M | ~31.5s | 35.6s | ~+4s (+13%) |
| ~6M | ~54.7s | 70.7s | ~+16s (+29%) |

The overhead grows with size, suggesting PDF text extraction scales slightly worse than raw text ingestion. But the key point: **zero failures at any size**.

### Verdict Update for Q2

**Q2 (Text Volume Ceiling): GOOD → STRONG.** Now tested with the actual file format (PDF) that causes GFS failures. 0/9 failures across the full range where GFS fails 0-60%. Combined with Phase 2's .txt results (15/15), total evidence is 24/24 uploads at all sizes.

## Gap 2: Adversarial Testing — Clear, Fast Error Reporting

This was the Q3 gap — we'd never seen Vertex RAG fail, so we couldn't assess error reporting. Now we have 4 deliberate failure modes.

### Results

| File | What It Is | Duration | Error Code | Error Message |
|------|-----------|----------|------------|---------------|
| corrupt-random-bytes.pdf | 4KB random bytes, .pdf extension | 4.5s | 3 (INVALID_ARGUMENT) | "PDF was invalid or file contains no text pages. If the PDF is valid, consider using the DocAI Layout Parser to extract text from the scanned PDF." |
| zero-byte.txt | 0 bytes, valid extension | 2.5s | 3 (INVALID_ARGUMENT) | "The file is empty." |
| unsupported.xyz | 57 bytes, unknown extension | 4.7s | 3 (INVALID_ARGUMENT) | "File extension .xyz is not supported" |
| unsupported.mp4 | 2KB random bytes, .mp4 extension | 5.5s | 3 (INVALID_ARGUMENT) | "File extension .mp4 is not supported" |

### Key Observations

1. **All failures raise exceptions immediately.** No silent hangs, no indefinite polling, no stuck operations. The `upload_file()` call raises `RuntimeError` within 2-6 seconds. This is the correct behavior.

2. **Error messages are descriptive and actionable.** Each one tells you exactly what's wrong:
   - Corrupt PDF → "PDF was invalid or file contains no text pages" + suggests DocAI parser for scanned PDFs
   - Empty file → "The file is empty"
   - Unsupported extension → "File extension .xyz is not supported"

3. **Error code is consistent: 3 (INVALID_ARGUMENT).** All four failures use gRPC error code 3, which maps to HTTP 400. Semantically correct — these are client errors, not server errors.

4. **No zombie files created.** Failed uploads don't leave dangling resources in the corpus. The file is rejected before being committed.

5. **GFS comparison — night and day:**
   - GFS corrupt PDF: `importFile` returns, `operation.done` never transitions from `None`, file stuck in processing forever
   - GFS unsupported format (.docx): hangs indefinitely, no error, no status update
   - Vertex RAG: exception in <6s with clear message

### Verdict Update for Q3

**Q3 (Honest Operation Status): MIXED → GOOD.** The high-level SDK still strips `file_status` fields (that design flaw remains), but it doesn't matter for failure cases because `upload_file()` raises exceptions with clear error messages. The failure path works correctly:
- **Success path:** `upload_file()` returns normally, file is ACTIVE (verified via low-level API)
- **Failure path:** `upload_file()` raises `RuntimeError` with gRPC code + descriptive message within seconds

The remaining "MIXED" aspect: `size_bytes=0` and `rag_file_type=UNSPECIFIED` are still broken in the low-level API. These are non-critical metadata gaps, not reliability issues.

## Gap 3: Office Formats — .pptx Works, .xlsx Does Not

### Results

| Format | Attempts | Success | Avg Duration | Notes |
|--------|----------|---------|-------------|-------|
| .pptx | 3 | 3/3 (100%) | 5.5s | Fast upload, ACTIVE state confirmed |
| .xlsx | 3 | 0/3 (0%) | 5.5s | "File extension .xlsx is not supported" |

### .pptx Details

```
Attempt 1: 4.2s → ACTIVE
Attempt 2: 6.9s → ACTIVE
Attempt 3: 5.3s → ACTIVE
```

The .pptx file (31KB, 4 slides with headings and bullet points) was processed correctly. All three copies confirmed ACTIVE via the low-level API. Processing time is comparable to small .txt files.

### .xlsx Details

All three attempts failed immediately with:
```
RuntimeError: ('Failed in indexing the RagFile due to: ',
  {'code': 3, 'message': 'File extension .xlsx is not supported'})
```

This is a clear, honest rejection — not a hang or silent failure.

### Verdict Update for Q5

**Q5 (Format Support): GOOD → GOOD (refined).** Supported formats verified:
- .txt: 15/15 (Phase 2)
- .docx: 3/3 (Phase 2)
- .pdf: 9/9 (Phase 5b)
- .pptx: 3/3 (Phase 5b)
- .xlsx: 0/3 — **NOT SUPPORTED** (clear error message)

The format coverage is strong for document types (.txt, .docx, .pdf, .pptx). Spreadsheet support (.xlsx) is absent. Unsupported formats are rejected clearly and quickly.

## Updated Verdict Table

| Question | GFS | Vertex RAG | Previous Verdict | Updated Verdict | Evidence |
|----------|-----|-----------|-----------------|-----------------|----------|
| Q1: Concurrency | Silent infinite hangs | Queue, all complete | GOOD | **GOOD** (unchanged) | 40/40 (Phase 4) |
| Q2: Text volume | 20-60% failure at 3-6M | 0% failure at 6M | GOOD | **STRONG** | 24/24 across .txt + .pdf (Phase 2 + 5b) |
| Q3: Operation status | `done` never transitions | Exceptions with clear messages | MIXED | **GOOD** | 4/4 adversarial failures reported clearly (Phase 5b) |
| Q4: Extraction visibility | Total black box | Partial (100 chunks max) | PARTIAL | **PARTIAL** (unchanged) | Phase 3 |
| Q5: Format support | .docx hangs forever | .txt/.docx/.pdf/.pptx work, .xlsx rejected clearly | GOOD | **GOOD (refined)** | 30/33 success across 5 formats (Phase 2 + 5b) |

## Sources

- Experiment script: `/workspaces/test-mvp/python-services/experiments/vertex_reliability_gap_filling.py`
- Test files generated in: `/tmp/vertex-gap-filling/`
- Corpus: `projects/768786717495/locations/us-west1/ragCorpora/2842897264777625600`
- SDK: `google-cloud-aiplatform 1.136.0`, `vertexai.rag`
- Low-level API: `google.cloud.aiplatform_v1beta1.VertexRagDataServiceClient`
- Prior phase: `/workspaces/test-mvp/.claude/research/vertex-rag-reliability/phase-02-single-file.md`

### Uploaded File Resource Names

```
pdf-300k.pdf attempt 1: .../ragFiles/5641462303532737180
pdf-300k.pdf attempt 2: .../ragFiles/5641462450604936989
pdf-300k.pdf attempt 3: .../ragFiles/5641462595724723904
pdf-3m.pdf attempt 1:   .../ragFiles/5641462904782894104
pdf-3m.pdf attempt 2:   .../ragFiles/5641463269802712430
pdf-3m.pdf attempt 3:   .../ragFiles/5641463630502028039
pdf-6m.pdf attempt 1:   .../ragFiles/5641464229941789081
pdf-6m.pdf attempt 2:   .../ragFiles/5641464886633388605
pdf-6m.pdf attempt 3:   .../ragFiles/5641465539679900118
test-slides.pptx attempt 1: .../ragFiles/5641465794069951225
test-slides.pptx attempt 2: .../ragFiles/5641465903156349715
test-slides.pptx attempt 3: .../ragFiles/5641466027959846667
```

## Open Questions

1. **Is .pptx content retrievable via queries?** We confirmed ACTIVE state but didn't test retrieval. Slide text extraction quality is unknown.
2. **What about .csv files?** Common data format, not tested. Could be supported (it's text-based).
3. **What's the actual maximum PDF size?** We tested up to 6M chars (~900KB PDF). GFS density experiments went to 500 pages. Vertex RAG's true ceiling remains unknown.

## Dead Ends

None — all experiments produced clear, interpretable results. The adversarial tests in particular gave us exactly what we needed (fast, descriptive exceptions).
