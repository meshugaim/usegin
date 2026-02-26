# Process Judgment — Vertex AI Search Reliability Experiment (ENG-2093)

## Process Assessment

### Verdict: RIGOROUS

This research represents a meaningful improvement over the ENG-2060 RAG Engine experiment in both adversarial testing and evidence completeness. The process was genuinely experimental, addressed the key gaps identified in the prior process judgment, and produced a well-auditable evidence trail. It earns RIGOROUS with minor caveats.

### Strengths

**1. Pre-registered success criteria with quantitative thresholds.** The whiteboard defines concrete pass/fail thresholds for all 6 questions before any experiments ran (e.g., ">=35/40 concurrent imports," ">=90% success rate for files >=3M chars," ">=95% of expected chunks"). This is a significant process improvement over ENG-2060, which defined questions but not pass/fail criteria. Pre-registration guards against post-hoc rationalization of ambiguous results.

**2. Adaptive methodology — Phase 2a/2b pivot.** When Phase 2a discovered the 1MB inline limit (a constraint, not a reliability failure), the research did not stop or declare failure. It spawned Phase 2b to test the GCS upload path, which is the production-relevant path. This is exactly the right response: the inline limit is an API design choice, not a reliability finding. Following the GCS path uncovered the real constraint (1,000-chunk limit at ~2.7MB), which is the actually useful finding. The pivot was honest — documented as two separate phases, not retroactively merged.

**3. Genuine adversarial testing on format support.** Phase 2a tested .docx, .pptx, .xlsx, AND binary garbage. The binary garbage test (50K random bytes declared as text/plain) is a true adversarial probe that ENG-2060's process judgment specifically called out as missing. The result (accepted without error) is a real finding with data quality implications. All three Office formats were tested, closing the gap where ENG-2060 only tested .txt and one .docx.

**4. Surprising findings were investigated, not dismissed.** Phase 3 discovered that documents with >1,000 chunks (which Phase 2b flagged as "failed") actually had all chunks accessible via `list_chunks()`. Rather than treating the Phase 2b error as the final word, Phase 3 verified chunk presence for the "failed" documents and found 2,161 chunks fully enumerable. This changed the interpretation: the 1,000-chunk threshold is a warning, not a hard limit. The research updated its conclusions accordingly.

**5. Phase 5 distinguished load-induced from baseline issues.** The metadata experiment ran baseline queries BEFORE starting concurrent imports. When the baseline itself showed non-deterministic recall (4/5 instead of 5/5), the research correctly attributed the during-load identical behavior to baseline characteristics rather than concurrency impact. This is careful experimental design — establishing a control before introducing the treatment.

**6. Complete evidence trail.** Every phase file includes: a summary, detailed results tables, source file paths (absolute), open questions, and dead ends. The JSON result files are preserved alongside the scripts. The chain from raw data to phase finding to whiteboard claim is traceable. Someone could re-run any phase script and verify the findings independently.

**7. Dead ends documented honestly.** Phase 1's ADC credential issue, Phase 2a's `struct_data` requirement discovery, and Phase 5's too-fast concurrent uploads (yielding only 1 query round during load) are all documented without spin. The research does not pretend everything worked on the first try.

### Concerns

**1. Phase 5 concurrent load window was too short to be conclusive.** The 10 concurrent uploads completed in ~1 second, allowing only 1 query round during actual upload activity. The research acknowledges this ("too fast to generate meaningful during-load query samples") but still claims a CONDITIONAL PASS. The verification phase (querying during indexing) partially compensates, but the experiment did not actually test the scenario it set out to test: "metadata filtering correctness DURING concurrent imports." It tested "during indexing after concurrent imports." A more rigorous design would have used slower uploads, more files, or staggered upload timing to create a longer active-upload window.

**2. No PDF testing.** ENG-2060's process judgment flagged this as the most critical gap. This experiment also omits PDFs entirely. The GFS baseline failures are heavily PDF-driven (import path, density effects, page count scaling). VAIS uses Document AI Layout Parser for PDFs, so the processing path differs from plain text. While the format support question (Q5) tests Office formats, PDFs remain the elephant in the room for production use.

**3. Single GCP project, no degradation testing.** Same concern as ENG-2060. GFS's most insidious failure mode is per-project degradation over time. This experiment used the same `effi-vertex-experiment` project with a fresh datastore. There is no multi-project comparison and no test for degradation after sustained use. The whiteboard does not even list this as an open question.

**4. Concurrency tested at 40 only — no boundary search.** The 40-concurrent test matches the RAG Engine experiment for comparability, which is reasonable. But it does not attempt to find the failure boundary. GFS fails at ~1,500 concurrent pages. Testing at 100, 200, or 500 would determine whether VAIS has a similar cliff. The research asks "What about 100+?" in open questions but did not run the test.

**5. The 1,000-chunk threshold ambiguity was left partially resolved.** Phase 3 found that >1,000-chunk documents have all chunks enumerable. But the whiteboard's first open question notes "Can search return results from >1000-chunk docs? (chunks exist but searchability unverified)." This is a critical production question — if large documents are indexed but not searchable, the 1,000-chunk limit is still a hard ceiling for practical purposes. A single search query against a >1,000-chunk document would have resolved this.

### Gaps

1. **PDF format testing** — same gap as ENG-2060, same importance. Document AI Layout Parser handles PDFs differently than text files; untested.

2. **Search quality for >1,000-chunk documents** — chunks exist and are listable, but nobody verified whether search queries actually return results from these documents. One search query would close this.

3. **Project degradation / sustained load** — no test for whether VAIS performance degrades with heavy use over time. All tests were on a fresh datastore.

4. **Larger concurrency boundary search** — 40 concurrent uploads is the baseline comparison, but the failure boundary is unknown.

5. **Production-representative file sizes** — the 50KB concurrent test files and 10KB metadata test files are smaller than typical production files. Testing concurrent uploads with 500KB-1MB files would be more representative.

### Recommendations

The verdict is RIGOROUS, so these are polish items rather than blocking gaps:

1. **Run one search query against a >1,000-chunk document.** This is a 5-minute test that would resolve the most important open question. If search works, Q2 upgrades from CONDITIONAL PASS to PASS with a workaround note. If search fails, Q2 stays CONDITIONAL and the 1,000-chunk limit is a real production constraint.

2. **Add PDF variants to Phase 2b.** Generate 1MB and 3MB dense-text PDFs and upload via GCS. This would close the format gap with minimal effort since the GCS upload infrastructure already exists.

3. **Test concurrency at 100.** Reuse the Phase 4 script with `max_workers=100` and 100 test files. This would provide one data point above the current boundary.

### Comparison with ENG-2060 (RAG Engine Experiment)

| Dimension | ENG-2060 (RAG Engine) | ENG-2093 (VAIS) | Improvement? |
|---|---|---|---|
| Pre-registered criteria | No (questions only) | Yes (quantitative thresholds) | Yes |
| Format coverage | .txt, 1 tiny .docx (initial); added .pdf, .pptx in gap-fill | .txt, .docx, .pptx, .xlsx, binary garbage | Yes |
| Adversarial testing | None initially; 4 adversarial tests added in Phase 5b | Binary garbage in Phase 2a, format boundary probing | Comparable |
| Adaptive methodology | Linear phases | Phase 2a/2b pivot on inline limit discovery | Yes |
| Baseline controls | No pre-load baseline for comparison | Phase 5 baseline queries before load | Yes |
| PDF testing | Added in gap-fill phase | Still missing | No improvement |
| Sample sizes | 3 per size point (initial), expanded later | Single runs per size, but 40 concurrent | Comparable |
| Evidence trail | Good (scripts + results) | Strong (scripts + JSON + absolute paths + dead ends) | Slightly better |
| Phase count | 6 (including gap-fill) | 6 (including 2a/2b split) | Same |
| Total operations | 68 uploads | 63+ documents | Comparable |

Overall, the ENG-2093 process learns from ENG-2060's process judgment: it pre-registers criteria, tests more formats upfront, includes adversarial probes from the start, and establishes baseline controls. The persistent blind spot is PDF testing, which both experiments defer.
