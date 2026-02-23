## Answer Assessment

### Verdict: SUPPORTED

The research provides strong experimental evidence for its central claims, but the overall verdict cannot be PROVEN because of one critical untested variable (per-key vs. per-GCP-project scope) and N=1 sample sizes on the most impactful tests. The findings are well above best-guess -- they are grounded in controlled experiments with clean, unambiguous results -- but they fall short of proven due to replication gaps and the untested scope boundary.

### The Question

Do GFS stores have shared overhead -- can concurrent file-sync processes targeting the same store (or the same API key) interfere with each other, and is the "processing capacity" (as opposed to per-request quota) shared?

### The Answer

Yes, processing capacity is shared, but not in the way initially suspected. The research found that:

1. **Upload processing capacity is shared across ALL stores under the same API key** -- not per-store. Concurrent large-file uploads (500+ pages) to completely separate stores interfere with each other and cause silent hangs. The bottleneck is a concurrency limit, not a depleting quota, so recovery is instant once concurrent operations drop below the threshold.

2. **Query and delete operations are completely independent from uploads.** Users can search and delete documents with zero degradation even while the upload pipeline is fully saturated.

3. **Small files (50 pages or fewer) are immune to the interference** at all tested concurrency levels, suggesting the bottleneck is proportional to total processing load (page volume), not operation count.

### Evidence Classification

**Claim 1: Uploads share capacity across stores under the same API key.**
Classification: **Strongly supported.** Test A (Phase 3) is the primary evidence: 5 separate stores, 1 file each, 4/5 timeout. This is a clean result, but it is a single run (N=1). The earlier Phase 1 experiment (5 concurrent to same store = 5/5 timeout, sequential = 4/5 success) provides corroboration from a different angle. Together they converge strongly on the conclusion, but N=1 on the key test prevents "proven."

**Claim 2: The scope of the bottleneck is "at least per-API-key."**
Classification: **Strongly supported, with an acknowledged gap.** The experiments prove the bottleneck spans all stores under one key. However, Test F (multi-key isolation) was skipped because only one API key was available. The whiteboard correctly flags this as MEDIUM confidence and acknowledges the bottleneck could be per-GCP-project rather than per-key. This is the single most important open question, and the research is honest about it.

**Claim 3: Queries are independent from uploads.**
Classification: **Proven.** Test G (Phase 4) ran 10 queries -- 5 baseline, 5 under full upload saturation. All returned 5 grounding chunks. Under-load average was 2.4s vs. baseline 2.6s. This is a clean, decisive result.

**Claim 4: Deletes are independent from uploads.**
Classification: **Proven.** Test I (Phase 4) ran 5 deletes -- 1 baseline, 4 under saturation. All succeeded. Under-load average was 2.0s vs. baseline 2.1s. Clean result.

**Claim 5: No cooldown after saturation -- instant recovery.**
Classification: **Proven.** Test H (Phase 4) attempted a sequential upload immediately after 3 concurrent uploads all timed out. It succeeded in 40.5s. Two subsequent probes also succeeded. Three probes, all instant recovery. The conclusion that this is a concurrency limit (not a depleting quota) follows directly.

**Claim 6: Small files (50 pages or fewer) are immune at any tested concurrency.**
Classification: **Strongly supported.** Tests B and C (Phase 3) show 16/16 success across 1-page and 50-page files at concurrency 1-5. However, Test E shows a timing anomaly: 5 concurrent 50-page files took ~57s each (vs ~10s in Test B), suggesting some internal queuing even for small files. The whiteboard does not reconcile this tension. Files complete without timeout, but "no interference" overstates what the data shows -- there may be slowdown without failure.

**Claim 7: The concurrency limit for heavy uploads is approximately 1 per API key.**
Classification: **Best-guess.** Phase 3 showed 5 concurrent yielded 1 success; Phase 4 showed 3 concurrent yielded 0 successes. The whiteboard infers the limit is "~1" but no gradient test of 1 vs 2 concurrent 500-page uploads was run. The limit could be 1, 2, or even variable depending on server-side conditions. The inference is reasonable but not pinned down.

### Gaps

1. **Per-key vs. per-GCP-project scope remains untested.** This is correctly identified as the most important open question. If all three API keys (dev, staging, production) share a GCP project, key rotation is not a viable mitigation. The whiteboard acknowledges this gap clearly, which is appropriate. However, the production implications section does not adequately caveat its recommendations against this uncertainty. "Per-key upload serialization is sufficient" may be true or may be insufficient if the scope is per-project.

2. **The exact concurrency threshold is unknown.** The research shows 3 concurrent heavy uploads = 3/3 timeout and 5 concurrent = 4/5 timeout, but never tested 2 concurrent. The whiteboard claims "~1" but this is interpolation, not measurement. This matters for production: if the limit is 2, the serialization strategy could be a semaphore(2) rather than semaphore(1), doubling throughput.

3. **The 50-page "immunity" claim has a tension with Test E.** Test E showed 5 concurrent 50-page files took ~57s each (vs ~10s individually). This is a 5x slowdown -- no timeout, but significant degradation. The whiteboard's "small file immunity" framing is slightly misleading. A more precise framing: small files complete successfully at any tested concurrency but may experience proportional slowdown under concurrency (serialization without failure).

4. **No testing of the File API + import path.** Production uses two upload paths: direct upload and the File API workaround. All experiments used direct upload only. The two-step path may behave differently with respect to the concurrency limit.

5. **Phase 1 "Inferred Processing Model" was partially superseded but not reconciled.** Phase 1 concluded "per-store processing queue" based on the initial experiment. Phase 3 proved it is per-key, not per-store. The Phase 1 document still contains the per-store model without a correction note. A reader following the phases chronologically would be confused until reaching Phase 3.

### Clarity

The whiteboard is well-structured and would be understandable to someone unfamiliar with the research. Specific strengths:

- The ASCII diagram of three independent pools is immediately graspable.
- The evidence table linking each claim to specific tests is excellent.
- The confidence assessment table with per-claim ratings is honest and useful.
- The "Production Implications" section translates findings into actionable guidance.
- Known gaps are stated explicitly rather than hidden.

Areas where clarity could improve:

- The whiteboard says "Concurrency limited" for uploads but does not state the inferred numeric limit in the diagram. A reader must piece together from the evidence table that the limit is approximately 1. The number should be in the diagram.
- The term "small file immunity" appears in the evidence table but the Test E anomaly (5x slowdown for 50-page files under concurrency) is not mentioned in the whiteboard at all. This creates a mismatch between the whiteboard's confident "safe at any concurrency" and the experimental data showing significant slowdown-without-failure.
- The distinction between "interference" (slowdown) and "failure" (timeout/hang) is blurred. The whiteboard treats timeout as the only failure mode, but a 5x slowdown (Test E) is operationally significant even if it does not trigger a timeout.

### Recommendations

To strengthen the verdict from SUPPORTED to PROVEN:

1. **Run the concurrency gradient for 500-page files (N=1, 2, 3).** This would pin down the exact threshold and confirm or refute the "limit is ~1" inference. This is the lowest-effort, highest-value follow-up.

2. **Replicate Test A (cross-store interference) at least once.** N=1 on the most important finding is a risk. A single replication would either confirm the result or reveal it was a transient Google-side condition.

3. **Test multi-key isolation when credentials are available.** This does not need to be immediate, but should be prioritized before making architectural decisions about key pooling.

4. **Reconcile the Test E timing anomaly.** Either explain why 50-page files took 57s under concurrency (vs 10s solo) or revise the "small file immunity" claim to "small files complete without failure but may experience proportional slowdown."

5. **Add a correction note to Phase 1.** The inferred per-store model was superseded by Phase 3's per-key finding. A brief note at the top of Phase 1 ("Superseded: See Phase 3 -- bottleneck is per-key, not per-store") would prevent confusion for future readers.

Even without these improvements, the research is actionable as-is. The core production guidance -- serialize heavy uploads per API key, don't worry about query degradation during imports, no cooldown needed -- is well-grounded and safe to implement. The main risk is over-specifying "per-key" when the scope might be "per-GCP-project," but even that risk is mitigated by the whiteboard's explicit acknowledgment of the gap.
