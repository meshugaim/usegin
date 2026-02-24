# GFS Upload Failure Matrix — Process Assessment

## Process Assessment

### Verdict: RIGOROUS

This is a well-designed empirical investigation that follows strong experimental methodology. The research systematically controlled variables, built each phase on prior findings, documented anomalies honestly, and qualified claims appropriately for sample sizes. There are some concerns, mostly around small N values in the tails and a few untested configurations, but the core methodology is sound and the evidence trail is clear.

### Strengths

**1. Excellent variable isolation across phases.**

The research cleanly separated file size (Phase 2a/2b), key/project identity (Phase 3), upload method (Phase 4), and page count gradient (Phase 4b). Each phase changed exactly one variable while holding others constant. Phase 3 is the standout example: three keys on the same project versus one key on a different project, tested on configurations already baselined in Phase 2. This is textbook controlled experimentation.

**2. Fresh store per run eliminates accumulation confounds.**

From the experiment harness (lines 534-536 of the script): each run creates a fresh file search store, uploads, records, then cleans up. This isolates concurrency effects from store-level document accumulation, which the researchers explicitly noted as an untested variable in Phase 2a open questions. The design choice was deliberate and correct.

**3. The 600s timeout was a critical methodological decision, and it was justified empirically.**

Phase 2a includes an explicit "Would 120s have been enough?" analysis showing that at c=2, 50% of successes would have been misclassified as failures at 120s, and at c=5, 100% would have been misclassified. This is not just a parameter choice — it is a verified finding about right-censoring risk. The researchers discovered and documented that their timeout choice revealed real successes that a shorter timeout would have hidden. Quote from Phase 2a:

> At c=5, every successful upload took >120s. A 120s timeout would have shown 0% pass rate across all runs.

**4. Anomalies were documented, not dismissed.**

Phase 2a explicitly flags that c=5 runs appeared to improve over time (0/5, 2/5, 3/5) and honestly notes "Could be coincidence (n=3 is small) or could suggest some backend warm-up / queue clearing effect." Phase 2a also documents that c=3 run 1b was perfectly fast while run 3b was 100% failure with the same configuration. These observations are reported as anomalies without forcing an explanation. This is good science.

**5. Dead ends are documented with reasoning for abandonment.**

Each phase has a "Dead Ends" section. Phase 2a explains skipping c=8/c=10 for large files (trend already clear at c=5). Phase 3 conclusively rules out key freshness as a solution. Phase 4 demonstrates importFile is categorically worse. None of these were abandoned prematurely — each had sufficient evidence to close the investigation.

**6. The experiment harness is production-quality and auditable.**

The Python script at `/workspaces/test-mvp/python-services/experiments/gfs_upload_matrix_experiment.py` is 961 lines of well-structured code with proper data classes, configurable parameters, JSON result persistence, cleanup, and summary output. An independent researcher could clone the repo, set environment variables, and reproduce the experiments. The harness was also iterated on during Phase 1 (the key verification bug fix shows real-time methodology improvement).

**7. Phase progression was logical and adaptive.**

Phase 1 (infrastructure) established baselines and tooling. Phase 2a/2b mapped the size x concurrency matrix on one key. Phase 3 tested whether the bottleneck was per-key or per-project — a question that naturally arose from Phase 2a's finding that super-heavy files were 0% on old-dev. Phase 4 tested importFile as an alternative path. Phase 4b filled the gap between 500p and 2000p that Phase 2a identified. Each phase was motivated by gaps or questions from the prior phase.

**8. Two-project design provides a natural control group.**

Testing the same configurations on both `effi-vertex-experiment` (degraded) and `effi-gfs-research-b` (clean) provides the strongest possible evidence for the per-project bottleneck finding. The 100% vs 33% pass rate on large files at c=5 (same key age, same file, different project) is dispositive.

### Concerns

**1. Small N for tail claims — the "~17% failure rate" is based on very thin evidence.**

The whiteboard claims "750-1000p ~17% single-attempt failure" with confidence "MODERATE" and notes N=3 per config. Phase 4b shows 2/3 success at c=1 for both 750p and 1000p (1 timeout each), giving a point estimate of 33% failure rate per run, or 17% per file (1/6 files failed across both sizes). But with N=3 runs, the 95% confidence interval for a binary outcome spans roughly 0-60%. The "~17%" is technically the observed rate, but the true rate could be anywhere in a wide range.

The phase file itself acknowledges this: "With only 6 attempts per size at c=1, the sample is small. Could be 5% or 30%." This is appropriately qualified in the phase file, but the whiteboard's "Properties Proven" table lists it at "MODERATE" confidence, which is fair. The production recommendations in the whiteboard correctly treat this as "retry logic needed" rather than a precise threshold, so the practical impact of the imprecision is limited.

**2. The c=2/c=3 showing 100% at 750-1000p while c=1 shows 83% is not adequately explained.**

Phase 4b reports this surprising result but does not investigate it further. Two hypotheses are offered (pipeline warmth, statistical noise) but neither is tested. With the small N, this is almost certainly noise — 6/6 and 9/9 versus 2/3 — but the research could have run additional c=1 trials to increase confidence. The finding appears in the whiteboard's summary table without qualification. If c=1 truly has a higher failure rate than c=2-3 at these page counts, that would undermine the "serialize large uploads" recommendation.

**3. No mixed-workload testing.**

Phase 2b identifies this as an open question: "What happens with concurrent uploads of different sizes?" The production recommendation to "allow concurrency for <50p files" while "serializing 500p+ files" implicitly assumes the two streams do not interfere. This was never tested. Given that the bottleneck was shown to be per-project processing capacity, it is plausible that 10 concurrent small files + 1 large file would degrade the large file's reliability. This gap matters for the production policy.

**4. No c=2 data for small/medium files.**

The small/medium matrix tested c=1, c=3, c=5, c=10 but skipped c=2. For the large file matrix, c=2 was the critical transition point (100% pass rate but with severe latency variance). The omission for small/medium is defensible since all tested concurrencies showed identical behavior, but it creates a small gap in the matrix.

**5. Time-of-day confound is acknowledged but not controlled.**

Phase 2a notes that experiments ran from 22:25 to 00:49 UTC, and Phase 4 ran 02:43 to 05:22 UTC. Google's backend capacity likely varies by time of day. The research acknowledges this (Phase 2a: "c=3 run 1b was perfectly fast at 00:27 UTC while batch 1 run 3 was 100% failure at 23:04 UTC") but does not attempt to control for it. Given the inherent volatility of the system under test, this is a reasonable trade-off — controlling for time-of-day would require running the same experiment across multiple days, dramatically increasing cost. But it means the absolute percentages (61%, 33%, etc.) should be understood as point-in-time estimates, not stable rates.

**6. The "degraded project" hypothesis is inferred, not proven.**

The research convincingly demonstrates that `effi-vertex-experiment` performs worse than `effi-gfs-research-b`. It hypothesizes this is due to accumulated usage (hundreds of experiments, thousands of uploads). But this was not verified — for instance, by checking store counts on both projects, or by creating a third fresh project and confirming it also performs well, or by cleaning up all stores on the degraded project and retesting. The hypothesis is reasonable and the evidence is consistent, but "project degradation" is an interpretation, not an observation. The whiteboard lists it as "PROVEN" in the properties table, which slightly overclaims — "per-project bottleneck" is proven, but the mechanism (accumulated usage causing degradation) is hypothesized.

**7. importFile was only tested with large PDFs.**

Phase 4 tests importFile with 500p and 2000p files. It references prior experiments with small .txt files (which worked), but does not test importFile with the same small/medium PDFs used in Phase 2b. The conclusion "never use importFile for PDFs" would be stronger with a 5-page PDF test showing success (confirming the size threshold) or failure (confirming it is method-wide for PDFs). The phase acknowledges this gap in its open questions.

### Gaps

**1. No testing of the 100-300 page range.**

Phase 2b shows 50p is immune. Phase 2a shows 500p degrades at c>=3. The transition zone (100p, 200p, 300p) was never tested. Phase 4b adds 750p and 1000p but does not fill the 50-500 gap. For production use, knowing whether 200-page files are in the "safe" or "caution" zone would be valuable. The production policy has to draw a line somewhere between 50p and 500p, and that line is currently based on a 10x gap in the data.

**2. No investigation of what makes a project "degraded."**

This is listed in the whiteboard's open questions and is the most consequential gap. If production's GCP project degrades over time, the entire upload system fails for large files. Understanding the trigger (upload volume? store count? orphaned documents? time?) would inform whether the problem is preventable. This was not in the original research scope, so it is not a methodological failure, but it is the most important follow-up.

**3. No testing of retry effectiveness.**

The production recommendation includes "implement retry with fresh upload." But the research never tested whether a second attempt on a failed upload succeeds. If server-side STATE_FAILED is deterministic for a given file+project+time, retries would not help. A simple experiment — retry immediately after a failure with the same file — would validate or invalidate the retry recommendation.

**4. File content was uniform across all sizes.**

All test PDFs use the same text pattern ("This is a test page with substantial text content for GFS processing." repeated 40 times per page). Real production files have heterogeneous content (text, tables, headers, images). It is possible that content complexity affects processing time or failure rate independently of page count. This is a standard limitation of synthetic test data and is not a flaw in the methodology, but it means the page-count thresholds may not transfer exactly to production workloads.

### Recommendations

The verdict is RIGOROUS, so major additional phases are not required. However, if time permits, the following would strengthen the findings:

1. **Increase N for 750p and 1000p at c=1 to at least 10 runs each.** This would narrow the confidence interval on the "~17% failure rate" claim from the current uninformative range to something actionable.

2. **Test one mixed workload configuration** (e.g., 5 small + 1 large concurrent on each project) to validate the production recommendation that small-file concurrency is safe alongside large-file uploads.

3. **Downgrade "Project degradation real" from PROVEN to STRONG in the whiteboard.** The per-project bottleneck is proven (different projects, same config, different results). The degradation mechanism is hypothesized (accumulated usage) but not verified.

4. **Test importFile with a 5-page and 50-page PDF** to confirm the failure is size-dependent rather than format-dependent. This would take about 5 minutes and would tighten the "never use importFile for PDFs" recommendation.

5. **Run a single retry experiment** — take a configuration that fails ~30-60% of the time (e.g., old-dev 500p c=3), observe a failure, immediately retry the same file in a new store. Record whether the retry succeeds or fails. Even 3-5 data points would validate the retry recommendation.
