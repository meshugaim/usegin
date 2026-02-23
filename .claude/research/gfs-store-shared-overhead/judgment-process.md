# GFS Store Shared Overhead — Process Judgment

## Process Assessment

### Verdict: ADEQUATE

This is a competent, well-structured investigation that produced actionable findings from an undocumented API. The experimental code is clean, the results are presented honestly, and the known gaps are called out explicitly. However, several methodological shortcomings prevent a RIGOROUS rating.

### Strengths

**1. Sound phase decomposition.** The forensics-first approach was the right call. Phase 1 established what Google documents (and does not), catalogued existing experiment data, mapped the codebase architecture, and surveyed community evidence before designing any new experiments. This prevented the common failure mode of running experiments that rediscover already-known facts.

**2. Honest treatment of dead ends and gaps.** The research is refreshingly candid about what it does not know:
- Test F (multi-key isolation) was skipped with a clear explanation of why and what it would have shown.
- Test E (cancel API) failed to trigger the stuck condition and this is reported straightforwardly rather than hidden.
- The N=1 limitation is flagged in the whiteboard's "Known Gaps" section and the confidence table distinguishes HIGH from MEDIUM confidence.
- Open questions at the end of each phase are specific and actionable, not vague hand-waving.

**3. Good control design in the topology experiments.** Phase 4's test design was methodologically sound: Test G measured baseline query latency before introducing upload load, then measured under-load latency against the same queries and store. Test I used the same baseline-then-load structure for deletes. Test H used staggered probes (t+0, t+30, t+60) to characterize recovery shape rather than a single point measurement. These are genuine controls, not afterthoughts.

**4. Evidence trail is auditable.** Each phase cites specific files, specific run IDs, and specific timestamps. The experiment code is committed to the repository. Phase 3 and Phase 4 each reference raw output files. Someone could reproduce these experiments by running the scripts and comparing results.

**5. The experiment code is well-structured.** Both scripts use clean dataclasses for results, consistent logging with timestamps, proper cleanup of created resources, and separate test functions for each hypothesis. The code is readable enough to serve as its own documentation.

**6. Prior work was leveraged, not ignored.** The forensics phase thoroughly analyzed the existing `gfs_import_hang_experiment.py` data, extracting the Phase 1 vs Phase 3 comparison (1000 pages failing on accumulated store vs succeeding on clean store) and the Phase 4 concurrent vs sequential results. This grounded the new experiments in existing evidence.

### Concerns

**1. N=1 is acknowledged but under-weighted in the confidence table.** The whiteboard assigns HIGH confidence to claims backed by single-run experiments (Test A: 1 run, Test G: 1 run, Test I: 1 run). The justification — "clean result" — conflates signal clarity with statistical reliability. A single N=1 trial with a clear outcome is suggestive, not conclusive. Google's infrastructure could exhibit time-of-day effects, regional routing differences, or intermittent capacity variations. The prior experiment (`gfs_import_hang_experiment.py`) itself showed non-determinism: 700-page uploads sometimes succeeding in 23s and sometimes hanging for 183s. That non-determinism should have moderated confidence in single-run results more than it did.

The confidence table would be more honest with:
- Test A (cross-store): MEDIUM-HIGH (clear signal, but N=1, and the 180s timeout may have been too short for the other 4 to complete)
- Test G (query independence): HIGH is defensible here given 10/10 successes with no degradation
- Test I (delete independence): MEDIUM-HIGH (5/5 but N=1 run, small sample)

**2. The 180-second timeout creates a censoring problem.** This is the most significant methodological concern. Test A showed 4/5 timeouts at 180s, but the one success took 105.8s. The Phase 3 findings note this: "the 4 that timed out may still have completed eventually — our 180s timeout cut them off." This is acknowledged but not adequately addressed. The finding "4/5 timeout" is presented as equivalent to "4/5 failure," but they may have been slow completions rather than permanent hangs. The production timeout is 600s (10 minutes). Running Test A with a 600s timeout would distinguish "concurrent uploads are slower" from "concurrent uploads permanently hang." This distinction matters enormously for production: serialization with a generous timeout is a different fix than serialization with a tight timeout.

Phase 3's Open Question 1 raises this exact point, but it was not pursued in Phase 4. Given that Phase 4 ran new experiments anyway, extending Test A's timeout would have been a natural follow-up.

**3. Test B and Test A tested different variables simultaneously.** Test A used 500-page files across 5 stores. Test B used 50-page files on the same store. The conclusion "file size is the determining factor, not concurrency count" compares these two tests, but they differ in two variables: file size AND store topology. A more rigorous design would have included Test A' (5 stores x 50-page files) to isolate the file size variable from the cross-store variable. Without this, the claim that small files are "immune" to cross-store interference is an inference, not an observation. (Test B only showed small files are immune to same-store interference.)

**4. The "three independent resource pools" claim is stronger than the evidence supports.** The experiments showed that queries and deletes are not degraded by upload saturation. But "independent resource pools" is a claim about internal Google architecture. The observed behavior is equally consistent with: (a) uploads, queries, and deletes share a single resource pool but queries and deletes are so lightweight they never hit the limit, or (b) Google prioritizes queries and deletes over uploads, or (c) the bottleneck is specifically in the chunking/embedding pipeline which queries and deletes don't touch. The whiteboard presents "three independent pools" as the conclusion rather than one of several possible explanations.

**5. Test E's design flaw was not corrected.** Test E was designed to test the cancel API but used 50-page files, which (based on Test B results) would not trigger the stuck condition. The phase report acknowledges this: "The experiment design should have used 500-page files." This was a foreseeable design error — Phase 1's forensics already established that 50-page files succeed concurrently. Phase 4 could have re-run Test E with 500-page files but did not. The cancel API remains completely untested, which is a gap for the production fix.

**6. The forensics search for documentation could have been deeper.** Phase 1 searched Google's public docs, community forums, and GitHub issues. But it did not examine:
- The `google-genai` SDK source code for internal rate limiting, retry, or queuing logic
- The actual HTTP requests/responses (headers, status codes) during stuck operations to look for rate-limit headers (`Retry-After`, `X-RateLimit-*`)
- Google Cloud Console quotas page for the specific GCP project to see if File Search has invisible quota entries
- The protobuf definitions for the File Search Store API operations (which might document fields like `progress` or `cancel` capabilities)

These would be primary sources and could have revealed rate-limiting mechanisms that the public documentation omits.

**7. Test E timing anomaly (57s vs 10s) was flagged but not investigated.** Phase 3 notes that Test E's 50-page files took ~57s each (vs ~10s in Test B), calling it "unexplained." This 5x slowdown in the same file size / same concurrency level undermines the claim that small files are "immune." The difference between Test B (ThreadPoolExecutor, truly concurrent submission) and Test E (sequential `upload_to_file_search_store` calls, then polling) may be significant. This anomaly deserved follow-up, particularly because it suggests that even small files can exhibit serialized processing under certain conditions.

### Gaps

**1. The transition zone (100-300 pages) is completely unmapped.** We know 50-page files succeed concurrently and 500-page files fail. The threshold where interference begins — which directly determines the "small file" cutoff for the production fix — is unknown. The whiteboard's recommendation of "files under ~50 pages can be uploaded concurrently" is based on only two data points (50 pages and 500 pages).

**2. No investigation of the File API + import path.** Phase 1's forensics noted two upload paths in production code: direct upload and File API + import. The prior experiment found that "the importFile path does NOT exhibit concurrency hangs." This is a potentially critical finding for the production fix (switch all uploads to the two-step path?) but was not explored further or verified in this research.

**3. No examination of upload path differences.** The experiments all use `upload_to_file_search_store` (direct upload). Production code also uses `files.upload()` + `import_file()` for certain file types. If the two-step path avoids the concurrency bottleneck entirely (as the prior experiment suggests), the entire "per-key serialization" recommendation might be unnecessary for the two-step path. This is noted in Phase 1's Open Question 4 but never pursued.

**4. No investigation of whether timed-out operations eventually complete.** When Test A's 4 operations timed out, did they eventually complete server-side? Checking the store's `active_documents_count` after the timeout would have answered this. Test D proved this field works. Using it in conjunction with the timeout tests would have strengthened the understanding of what "timeout" actually means — client gives up, or server drops the work.

**5. Test B's concurrency gradient stopped at 5.** The whiteboard states "small files safe at any concurrency level" but only tested up to N=5. Production sync workers can run 5 concurrent cycles with 10 items each, potentially producing higher concurrency. Whether 50-page files remain immune at N=10, 20, or 50 is unknown.

### Recommendations

To reach RIGOROUS, the following additional work would be needed:

1. **Rerun Test A with a 600s timeout** (matching production) to determine whether the 4 "failed" uploads were permanently stuck or merely slow. This is the single highest-impact addition.

2. **Add a cross-store small-file test** (5 stores x 50-page files, concurrent) to isolate the file size variable from the store topology variable in the "small files immune" claim.

3. **Probe the transition zone** with concurrent uploads at 100, 200, and 300 pages to establish where interference begins.

4. **Check store state after timeouts** using `pending_documents_count` / `active_documents_count` to determine if timed-out operations complete server-side.

5. **Examine HTTP-level responses** during stuck operations (rate-limit headers, response codes) by adding debug logging to the SDK transport layer.

6. **Investigate the Test E timing anomaly** (57s vs 10s for 50-page files) — re-run Test B's exact conditions and compare to determine if the slowdown is real or an artifact of the different submission pattern.

7. **Downgrade confidence ratings** for single-run tests from HIGH to MEDIUM-HIGH, with a note that replication would be needed for HIGH.
