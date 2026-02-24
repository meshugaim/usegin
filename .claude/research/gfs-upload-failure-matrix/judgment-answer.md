# GFS Upload Failure Matrix — Answer Judgment

## Answer Assessment

### Verdict: SUPPORTED

The whiteboard provides a well-organized, evidence-backed answer to all three parts of the driving question. The overall answer is supported by direct experimental evidence across 162+ uploads, but two specific sub-claims rest on small sample sizes that prevent a "proven" rating for the complete picture. No claims are unsupported, and confidence labels are generally honest.

### The Question

When and why does `uploadToFileSearchStore` fail, and how should we manage uploads in production?

### The Answer

The whiteboard answers: Failures are caused by two distinct mechanisms — (1) per-project processing contention that manifests as timeouts under concurrent large-file uploads, and (2) probabilistic server-side processing failures (`STATE_FAILED`) at 750+ pages even at c=1. The bottleneck is per-project, not per-key. Small/medium files (<=50p) are immune at any concurrency. The `importFile` path is categorically worse (0/48). Production should serialize 500p+ uploads, allow high concurrency for small files, implement retry with orphan cleanup, and monitor project-level latency as a health signal.

### Evidence Classification

**Claim: Small/medium files immune at c=10 — labeled PROVEN**
- Phase 2b: 114 uploads, 0 failures, duration range 7.9-11.7s across c=1 through c=10.
- **Assessment: PROVEN.** Direct evidence, large N, zero ambiguity.

**Claim: Bottleneck is per-project — labeled PROVEN**
- Phase 3: Three keys on `effi-vertex-experiment` all showed degraded performance (0-78% pass rates at various configs), while `fresh-b` on `effi-gfs-research-b` achieved 100% on configs that failed on the degraded project.
- 12-15x latency difference for identical operations across projects.
- **Assessment: PROVEN.** Multiple keys on same project vs. different project is a clean controlled comparison. Only 2 projects tested (a third would strengthen), but the signal is unambiguous.

**Claim: Key age irrelevant — labeled PROVEN**
- Phase 3: `old-dev` (months old), `fresh-a1`, `fresh-a2` (brand new) all performed comparably on the same project. `fresh-a1` super-heavy c=1 was 67% vs `old-dev` 0% vs `fresh-a2` 0% — the variation falls within the documented backend volatility.
- **Assessment: PROVEN.** Three keys, controlled for project. The within-project variance between keys is smaller than run-to-run variance for the same key.

**Claim: importFile categorically worse than direct upload — labeled PROVEN**
- Phase 4: 0/48 across 5 configurations, both projects, multiple concurrency levels. Files never reached ACTIVE state. The clean project (`effi-gfs-research-b`) went from 100% direct to 0% import on the same config.
- **Assessment: PROVEN.** 48 uploads with 0 successes is definitive. The mechanism is clearly identified (File API processing hang, not store import failure).

**Claim: Bimodal outcomes — labeled STRONG**
- Phase 2a: c=2 run durations of 23s vs 205s; c=3 individual files in same batch at 22s vs 427s.
- Phase 3: Same pattern on degraded project across keys.
- Phase 4b: Fresh project also shows it at 2000p c=2.
- **Assessment: Supported as STRONG.** Observed consistently across multiple phases and configurations. Not labeled "proven" because no mechanistic explanation is established — this is appropriate.

**Claim: Backend volatile — labeled STRONG**
- Phase 2a: c=3 run 1b (28s wall) vs run 3b (100% failure, all timeout). c=2 run 1 (23s) vs run 2 (205s).
- **Assessment: Supported as STRONG.** Reproducibly observed but the cause (Google backend load, time-of-day effects) is unknown. Honest labeling.

**Claim: 750-1000p ~17% single-attempt failure rate — labeled MODERATE**
- Phase 4b: 750p c=1: 2/3 success (1 timeout). 1000p c=1: 2/3 success (1 timeout). Combined: 4/6 success = 33% failure, though the whiteboard says "~17% (1/3 failures at c=1, N=3 per config)."
- **Assessment: PARTIALLY SUPPORTED, but the math needs scrutiny.** The whiteboard says "~17% single-attempt failure" but the raw data shows 1/3 failure per config at c=1 (33% per config, or 2/6 combined = 33%). However, Phase 4b's own text says "~17% failure probability at c=1 (1/6 runs)" — treating the 6 total c=1 uploads (3 at 750p + 3 at 1000p) as one pool where 1 of 6 failed. Wait — actually 2 of 6 failed (1 at 750p + 1 at 1000p), which is 33%. The phase file itself says "~1 in 6 runs hits a server-side STATE_FAILED" which is ~17%, but the actual data is 2/6 = 33%. This appears to be an error in the phase file that propagated to the whiteboard. Regardless, with N=3 per config, the confidence interval is enormous (anywhere from 5% to 60%). The MODERATE label is appropriate but the point estimate of 17% vs 33% is a discrepancy worth noting.

**Claim: Project degradation real — labeled PROVEN**
- Phase 3: 22.7s avg on clean project vs 279.3s avg on degraded project for identical large c=3 config. Consistent across all three keys on the degraded project.
- **Assessment: PROVEN.** 12-15x latency difference is not statistical noise. The comparison is controlled (same file, same concurrency, different project).

**Claim: 500p c=3 safe on clean project (whiteboard "Safe zone")**
- Phase 3: fresh-b large c=3: 9/9, 100%, avg 22.7s. Phase 3: fresh-b large c=5: 15/15, 100%, avg 26.4s.
- Phase 4b: 500p c=5 on fresh-b showed 50% (15/30) — WAIT. Phase 4b table shows "500 | c=5 | 50% (15/30)". But Phase 3 showed fresh-b large c=5 at 100% (15/15).
- **Assessment: DISCREPANCY.** The whiteboard's clean-project table shows 500p at c=5 as "100% (26s)" but Phase 4b's complete table shows 500p c=5 at 50% (15/30). This appears to aggregate across both projects for c=5 or include later runs. The whiteboard's "Clean Project" table may be selectively presenting Phase 3 data without incorporating Phase 4b data that contradicts it. However, reviewing more carefully: the Phase 4b table header says "fresh-b / clean project" and shows 500p c=5 at 50% (15/30). This 15/30 could include additional runs beyond Phase 3's 15/15. If so, the whiteboard's clean-project summary at 500p c=5 is overstated. The "Safe zone" recommendation of "c=3 safe on clean project" for <=500p is still supported by Phase 3 data (9/9 at c=3), but the c=5 claim needs qualification.

**Claim: Duration scaling ~9s fixed + ~0.03-0.05s per page**
- Phase 4b duration table confirms: 5p=9s, 50p=10s, 500p=22s, 750p=31.4s, 1000p=55.6s, 2000p=81.3s.
- Per-page overhead from Phase 4b: 0.044s at 500p, 0.042s at 750p, 0.056s at 1000p, 0.041s at 2000p.
- Whiteboard says 0.03-0.05s. Phase 4b shows 0.04-0.06s.
- **Assessment: MOSTLY SUPPORTED.** The range is slightly off — should be ~0.04-0.06s/page, not ~0.03-0.05s. Minor imprecision, not materially misleading.

**Claim: 2000p works at c=1 on clean project (whiteboard clean-project table: 100% at c=1, 67% at c=2)**
- Phase 3: fresh-b super-heavy c=1: 3/3 (100%), avg 81.3s. fresh-b super-heavy c=2: 4/6 (67%), avg 84.6s.
- **Assessment: PROVEN for c=1 (N=3), PROVEN for 67% at c=2 (N=6).** Small N but consistent.

### Gaps

1. **The 500p c=5 discrepancy on clean project.** Phase 3 shows 100% (15/15) but Phase 4b shows 50% (15/30). The whiteboard presents the optimistic number without acknowledging the conflicting data point. This matters for the "Safe zone" recommendation — if 500p c=5 is actually 50% on clean projects, the safe concurrency for 500p should be c=3 (not implied-safe at c=5).

2. **No data between 50p and 500p.** The whiteboard acknowledges the contention threshold is "between 50p and 500p" but doesn't flag this as a gap in the production recommendation. If most production files are 100-300 pages, the safe concurrency for that range is unknown.

3. **Production project health unknown.** The whiteboard lists "Is production project degraded?" as an open question, which is honest. But the production recommendation assumes a healthy project state without explicitly flagging this assumption. If production is degraded, the "Safe zone" is wrong.

4. **Mixed workloads untested.** Production uploads are rarely uniform — a queue might have 5 small files and 1 large file. Phase 2b notes this as an open question. The whiteboard's tiered concurrency recommendation implicitly assumes these can be managed separately, but the interaction is unknown.

5. **The 17% failure rate confidence interval.** With N=3 per config, the true failure rate at 750-1000p could be anywhere from ~3% to ~60%. The whiteboard presents "~17%" as if it's a reliable point estimate. The MODERATE label is appropriate, but the recommendation to "expect ~17% single-attempt failure" should include a wider range.

### Clarity

The whiteboard is well-structured and readable. Strengths:

- **The two-table format** (clean project vs degraded project) immediately communicates the key finding.
- **The "Properties Proven" table** with confidence labels is an excellent summary device.
- **The "Two Distinct Failure Modes" section** clearly separates the concurrency-induced timeout from the probabilistic processing failure — this distinction is crucial and well-communicated.
- **The production policy** is organized into safe/caution/danger zones, which is intuitive.
- **Dead ends** are explicitly listed, preventing future engineers from re-investigating.

Weaknesses:

- **The degraded-project table has an unexplained asterisk** at 500p c=2 ("100%*") with a footnote about ">120s latency." The table would benefit from being explicit that this 100% pass rate comes with severe latency degradation.
- **The "c=3 safe on clean project" for 500p in the safe zone** may be contradicted by Phase 4b data showing 500p c=5 at 50%. This isn't visible from the whiteboard alone.
- **The open questions section** is good but could be more prominent. The production recommendation reads as confident, while several of the open questions (e.g., "is production project degraded?") would invalidate parts of the recommendation.

### Recommendations

To strengthen from SUPPORTED to PROVEN:

1. **Reconcile the 500p c=5 discrepancy.** The Phase 3 (100%) vs Phase 4b (50%) data for 500p c=5 on the clean project needs explanation. Were additional runs conducted? Did backend conditions change? This affects the safe concurrency threshold.

2. **Widen the confidence interval on the 17% failure rate.** Present it as "17-33% observed (N=6, wide CI)" rather than "~17%." With this sample size, the production recommendation should plan for up to 30-40% failure at 750-1000p.

3. **Add an explicit assumption statement** to the production policy: "These recommendations assume a healthy (non-degraded) GCP project. Verify by checking that 500p c=1 completes in ~22s. If latency is 10x+ higher, treat the project as degraded."

4. **Flag the 50p-500p gap** as a concrete follow-up. If the team uploads files in the 100-300p range regularly, one targeted experiment (e.g., 200p at c=3, c=5, c=10) would fill the most actionable gap.

### Rating: COMPREHENSIVE

Despite the noted discrepancy and small-sample caveats, the research answers all three parts of the driving question with direct experimental evidence across 162+ uploads, 4 API keys, 2 GCP projects, 6 file sizes, 5 concurrency levels, and 2 upload methods. The answer is actionable: an engineer could implement the tiered concurrency policy and retry logic from the whiteboard alone. The gaps are acknowledged, the confidence labels are mostly honest (with the ~17% exception), and the dead ends prevent wasted future effort. This is a comprehensive answer to the question posed.
