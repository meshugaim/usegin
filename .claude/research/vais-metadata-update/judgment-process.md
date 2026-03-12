# Process Judge: VAIS Metadata Update Research

**Date:** 2026-03-12
**Evaluator:** Process Judge (Claude)

## Process Assessment

### Verdict: RIGOROUS

### Strengths

1. **Triangulation between external and internal evidence.** Phase 1 established the API surface from proto definitions and official documentation. Phase 2 independently confirmed the same conclusion from local code, git history, and prior experiment results. The two phases arrive at the same answer via completely different evidence paths, which is the hallmark of reliable research.

2. **Primary sources throughout.** Both phases cite specific proto field numbers, exact file paths with line numbers, commit hashes, and grep output. No claim rests on a secondary summary alone. The phase-07-date-filter-fix research is cited as empirical proof, not as hearsay -- the researcher traced the actual three-bug cascade and the fix commit.

3. **Honest treatment of limitations.** The research does not overstate the conclusion. It clearly distinguishes between "stores but does not index" (observed) and "does not work" (contextual to filtering). It flags that `update_document()` may work fine for structured stores -- the limitation is specific to unstructured stores. This nuance would be easy to flatten.

4. **Workaround exploration.** Rather than stopping at "it doesn't work," the research catalogs three alternative approaches (INCREMENTAL re-import, delete+re-upload, `update_mask` on ImportDocumentsRequest) with honest assessments of each. The `update_mask` lead is explicitly marked as untested rather than dismissed or assumed.

5. **Strong evidence trail.** Every claim in the whiteboard can be traced to a specific section in a phase file, which in turn cites a specific source (file path, commit, proto definition). The chain from evidence to finding to whiteboard insight is clean and auditable.

6. **Phase decomposition is well-scoped.** Phase 1 (external docs/API surface) and Phase 2 (local code/experiments) are logically independent and complementary. There is no unnecessary duplication -- Phase 2 references Phase 1 findings where appropriate rather than re-deriving them.

### Concerns

1. **No direct API experimentation.** Both phases rely on prior empirical results (phase-07-date-filter-fix from Feb 2026) rather than running a fresh experiment. The indexing behavior could theoretically have changed in the intervening two weeks (API-side fix, backend update). The research treats the Feb 2026 finding as still current without verifying. This is a minor concern -- the behavior is almost certainly unchanged -- but a truly rigorous process would note the assumption explicitly.

2. **Structured store behavior is inferred, not verified.** Phase 1, Section 4 states that `update_document()` "likely works as expected" for structured stores. This is reasonable inference but is presented alongside verified claims without clearly marking its speculative status. The whiteboard does not surface this caveat.

3. **The "bug or by design" question is raised but not pursued.** Phase 1 asks whether the indexing gap is intentional or a bug (Section 6, question 4). This is a meaningful question -- if it is a known bug with a fix timeline, the workaround calculus changes. No attempt was made to check Google issue trackers or community forums. This is defensible given the research scope but worth noting.

### Gaps

1. **No test of `update_mask` on `ImportDocumentsRequest`.** Both phases identify this as the most promising untested workaround. If the research question is "can we update metadata without re-uploading," this is the single most important experiment to run. It remains unaddressed. The whiteboard correctly flags it as untested, but a research investigation that stops short of testing its own most promising lead is leaving value on the table.

2. **No exploration of the Google Cloud support/issue tracker.** Given that the behavior (API silently accepts data but does not index it) could be classified as a bug, checking whether others have reported this or whether Google has acknowledged it would strengthen the conclusion. The research relies entirely on our own empirical observation.

3. **Re-indexing timing after INCREMENTAL re-import.** The research notes 22-55s indexing delay from phase5_metadata_load experiments, but does not explore whether a re-import of the same document with only metadata changes would have a shorter or longer delay. For a metadata update workaround, this latency matters.

### Recommendations

The verdict is RIGOROUS -- the process was well-structured, balanced, and evidence-based. The gaps identified above are refinements, not flaws. If the research were to continue:

1. **Run a targeted experiment** for `update_mask` on `ImportDocumentsRequest` with `struct_data` only. This is a 30-minute experiment that could unlock metadata-only updates without content re-upload.
2. **Search Google Cloud issue trackers** for reports of `update_document` not indexing metadata on unstructured stores, to determine if this is acknowledged behavior or a potential fix target.
3. **Add an explicit "assumptions" section** to the whiteboard noting that the empirical evidence is from Feb 2026 and has not been re-verified against the current API.
