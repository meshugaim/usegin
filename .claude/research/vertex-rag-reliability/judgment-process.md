# Process Judgment — Vertex AI RAG Engine Reliability vs GFS

## Process Assessment

### Verdict: ADEQUATE

This research demonstrates genuine experimental rigor in its execution but has meaningful gaps in adversarial testing that prevent a RIGOROUS verdict. The process was honest about its limitations, which is commendable, but the experiment design was structurally tilted toward confirming the hypothesis that "Vertex RAG is better than GFS."

### Strengths

**1. Experimental, not speculative.** The research ran real code against real infrastructure. Five executable Python scripts were written, two corpora were created, 70 files were uploaded, and concrete timing data was collected. This is experiment-weight research, not documentation-reading. The scripts are well-structured, reproducible, and include clear run instructions.

**2. Direct GFS comparison methodology.** Each question was mapped to a specific GFS failure mode with concrete baselines (e.g., "GFS fails ~60% at 6M chars"). The research used the same file sizes, same metrics, and same operational patterns as prior GFS experiments. This makes the comparison apples-to-apples where it counts.

**3. Multi-approach verification for Q4 (chunk visibility).** Phase 3 tried six distinct approaches to enumerate chunks: high-level SDK, low-level v1beta1 API, REST API endpoints, escalating top_k, per-file rag_file_ids, and detailed chunk inspection. When the primary approach failed (no list_chunks API), the research explored workarounds systematically rather than stopping. This is good dead-end exploration.

**4. Honest about gaps and limitations.** The whiteboard explicitly notes that Q3 is MIXED and Q4 is PARTIAL, not GOOD. The open questions section acknowledges the ceiling was never found, failure paths were never tested, and concurrency was only tested to 20. The statistical caveat on sample sizes (3 per size point) is included, with a reasonable p-value calculation.

**5. SDK bug discovery.** The finding that `rag.get_file()` strips `file_status` from the proto response is a genuine discovery documented with primary evidence (inspecting the returned dataclass vs the proto). This was not assumed — it was verified by examining both the high-level and low-level APIs.

**6. Queuing model hypothesis in Phase 4.** Rather than just reporting "all succeeded," the concurrency phase identified the queuing/serialization pattern from the timing gaps. The analysis of per-worker completion times (~12s slots for 1M files matching single-upload baselines) is insightful and well-evidenced.

### Concerns

**1. No adversarial testing — the most significant gap.** The experiment tested Vertex RAG exclusively within its comfort zone. The GFS experiments that produced the baseline findings ran 162+ uploads across 4 API keys, 2 GCP projects, 6 file sizes, and 6 concurrency levels (per GFS_FINDINGS.md). This research ran 55 uploads across 1 project, 4 file sizes, and 4 concurrency levels. Where GFS research deliberately hunted for failure boundaries, this research stopped at the point where things were working.

Specific adversarial tests that were not attempted:
- Files larger than 6M (8M, 10M, 20M) to find the actual ceiling
- Corrupted files or invalid content to test error reporting
- Deliberately triggering failure states to validate Q3's error path
- Concurrency beyond 20 (50, 100) to find the queue depth limit
- PDF format testing (GFS's weakest format, and the format actually used in production)

**2. Sample sizes are small for reliability claims.** 3 attempts per file size is the minimum viable sample. GFS's failure rate at 6M is ~60% — getting 0/3 failures is informative (p < 0.07 per the whiteboard), but 0/3 at a single size point is not strong evidence of reliability. GFS research used N=10 per variant for the density experiment. The concurrency test (40 total uploads) is more convincing, but 20 concurrent files is modest — GFS hangs started at ~1500 concurrent pages.

**3. Text files only — no PDF testing.** The GFS baseline is primarily about PDFs (the density experiment, the upload matrix, the import hang). This research tested only `.txt` and `.docx`. Text files bypass any format-specific extraction pipeline. The claim "Vertex RAG doesn't share GFS's problems" may be true for text, but the evidence doesn't cover the format where GFS actually fails hardest. Phase 2 explicitly notes "PDF not tested in this phase" and Phase 1 notes PDF generation code was available but not used.

**4. Single GCP project — no project degradation testing.** GFS's most insidious failure mode is per-project degradation (12-15x latency, proven across 4 keys). This research used a single project (`effi-vertex-experiment`) — the same project documented as "degraded" for GFS. There is no test with a fresh project, no cross-project comparison, and no investigation of whether Vertex RAG Engine shares the per-project bottleneck.

**5. Phase sequencing created a momentum toward positive conclusions.** Phase 1 (setup) led to Phase 2 (single file) where everything succeeded, which led to Phase 3 (chunks, a different question) and Phase 4 (concurrency, also all succeeded). At no point did a phase result trigger a "go deeper on this failure" pivot, because nothing failed. The research acknowledged this ("No failures to test error reporting paths") but didn't design a phase specifically to provoke failures.

**6. The `.docx` test was minimal.** One 37KB file with ~810 characters of content, tested 3 times. GFS's `.docx` hang was with an 87KB file. Testing a single tiny `.docx` doesn't thoroughly probe format support — it's a smoke test, not a reliability test. No `.pptx`, `.xlsx`, or large `.docx` files were tested.

### Gaps

1. **PDF format testing** — GFS's primary failure format. The research has no PDF data at all, yet GFS_FINDINGS.md devotes entire sections to PDF-specific behavior (import path, density effects, page count scaling).

2. **Failure path verification** — Q3 was rated MIXED because "all uploads succeeded." The research never attempted to trigger the ERROR state. Methods to try: upload binary garbage, upload a 0-byte file, upload a 200MB file (exceeding the 100MB limit documented for GFS), or upload an encrypted PDF.

3. **Project degradation investigation** — One of GFS's top 5 findings. Not addressed for Vertex RAG at all.

4. **Production-realistic file mix** — Real projects contain a mix of PDFs, docs, spreadsheets, and text files of varying sizes. The test used only synthetic text generated by a template engine. Even the `.docx` was synthetic and tiny.

5. **Latency under sustained load** — Phase 4 tested 4 bursts with 15s gaps. No test of sustained upload pressure over minutes, which is closer to production sync behavior.

6. **Deletion reliability** — Mentioned in passing ("Not explicitly tested in this research"). GFS has documented 503 errors on deletion. This is a real operational concern that was deferred.

### Recommendations

To upgrade this from ADEQUATE to RIGOROUS:

1. **Run a PDF variant of Phase 2.** Generate dense-text PDFs at 100p, 500p, 1000p, 2000p using the existing `gfs_density_experiment.py` PDF generation code (already identified in Phase 1). Test 5+ attempts per size. This directly addresses whether the format-specific failures in GFS are shared.

2. **Design a failure-induction phase.** Upload invalid files (binary garbage, 0-byte, encrypted PDF, 150MB file) to observe the ERROR state and validate Q3's error reporting path. This is the only way to move Q3 from MIXED to a definitive verdict.

3. **Increase sample sizes for the critical size point.** Run 10 uploads at 6M chars (not 3) to get a more reliable failure rate estimate. At N=10, a true 10% failure rate would be caught with 65% probability.

4. **Test higher concurrency.** Push to 50 or 100 concurrent uploads to find the queue depth limit. The current 20 is well below GFS's ~1500 concurrent page threshold.

5. **Test on a fresh GCP project.** Create a second project and compare upload behavior to check for per-project degradation effects.

These additions would approximately double the experiment scope but would close the most critical evidence gaps.
