# Judgment: Reproduce Mode B SSE Stream Death

## Answer Assessment

### Verdict: SUPPORTED

The research produced strong circumstantial evidence and a partial reproduction, but did not achieve a full, deterministic reproduction of Mode B. The conclusion — that Mode B is caused by Railway infrastructure events amplified by the two-service architecture — is well-supported by convergent indirect evidence, but never directly proven (no Railway proxy logs, no controlled trigger).

### The Question

Can we reproduce Phil Lau's Mode B SSE stream death — streams dying during active data flow on Railway with silence gaps under 10s — and reproduce the exact incident signature, not merely a similar failure with 10s silence?

### The Answer

The research says: Mode B was "partially reproduced." A two-hop proxy chain through Railway's edge infrastructure produced 11 failures matching Phil's exact signature (curl exit 18, mid-stream death during active token flow, no server-side error, correlated timestamps). Zero failures occurred across 1,142 direct connections. The failure mechanism is attributed to Railway infrastructure events that sever proxied connections, with the two-service production architecture creating multiplicative exposure.

### Evidence Classification

**Claim 1: Phil's streams died during active data flow, not during silence gaps.**
- **Proven.** Phase 1 forensics reconstructed all 5 failures at millisecond precision using Sentry span data. Every failure occurred during Phase 6 (post-GFS response generation), when text tokens were actively flowing. Successful streams survived longer silence gaps (up to 9.9s) than the failed streams experienced (6.2-8.1s). This definitively rules out the 10s idle timeout. (Phase 1, "What the Stream Was Doing When It Died" section.)

**Claim 2: The 6-9ms NJS-to-Python death delta is a consistent infrastructure fingerprint.**
- **Proven.** All 5 failures show 6-9ms between Next.js span end and Python span end, consistent with TCP disconnect propagation through Railway's internal network. (Phase 1, "The 6-9ms Death Signature" section.)

**Claim 3: Two-hop connections are more vulnerable than direct connections.**
- **Strongly supported.** 0/1,142 direct failures vs 11/827 two-hop failures is a stark contrast. However, this was measured during a single testing session. The experiment's two-hop path (same server proxying to itself via public edge) is an approximation of production's two-service path (Next.js to Python via Railway internal networking). The paths are structurally similar but not identical. (Phase 2, soak test results.)

**Claim 4: The reproduction matches Phil's exact failure signature.**
- **Strongly supported.** The failure signature matches on: curl exit 18 / internal_error on HTTP 200, mid-stream death during active data flow, no server-side error, correlated timing across multiple simultaneous connections. The key difference is that Phil's failures happened during Railway platform instability (cert/DNS issues noted on status page), while the reproduction caught what appears to be routine infrastructure maintenance. The mechanism appears the same, but the trigger context differs. (Phase 2, "Failure Signature" section.)

**Claim 5: Railway infrastructure events are the root cause.**
- **Best-guess.** All evidence is consistent with this conclusion, and no alternative explanation fits the data. But no direct evidence exists — no Railway proxy logs, no confirmation from Railway support, no controlled trigger. The research correctly identifies this as the uninstrumented layer. The correlation (all 9 soak failures at the exact same second, 12:47:38 UTC) is powerful circumstantial evidence, but the actual mechanism (proxy rotation? cert renewal? connection pool reset?) remains unknown.

**Claim 6: Mode B cannot be prevented at the application level.**
- **Strongly supported.** Given that streams die during active data flow with no server-side error and no application-level trigger, there is no application-level mitigation that can prevent the disconnection itself. The research correctly pivots to recommending mitigation of the *consequences* (partial persistence, client error reporting) rather than prevention. However, "cannot be prevented" is a strong claim — without knowing the exact mechanism, there could theoretically be an application-level workaround (e.g., TCP keepalive tuning, different HTTP framing). This is unlikely but not ruled out.

**Overall: The conclusion rests on Claim 5, which is best-guess. But the evidence chain is strong enough to elevate the overall verdict to SUPPORTED** — multiple independent signals converge (failure signature match, two-hop amplification, correlated timing, absence of any application-level trigger), even though no single piece of evidence is direct proof.

### Gaps

1. **Deterministic reproduction not achieved.** The original question asked to "reproduce the exact incident." The research caught a real infrastructure event opportunistically but cannot trigger one on demand. This is acknowledged in the whiteboard ("PARTIALLY REPRODUCED") but is the most significant gap.

2. **Two-hop approximation vs. production architecture.** The experiment's two-hop path routes through the public edge twice (same service proxying to itself). Production routes through Railway's internal networking between two separate services. The research acknowledges this difference (Phase 2, Open Questions #4) but does not characterize how Railway internal networking differs from public edge traversal. This could matter — if internal networking is more resilient, the two-hop experiment may overstate production vulnerability. Conversely, it could understate it.

3. **Soak v2 results incomplete.** Phase 2 mentions "Soak v2: 500 two-hop connections (started 13:04 UTC)" and "Results will be added when complete." The whiteboard reports these as 0 failures, but the phase file never got updated with the full results. Minor gap — the 0 result is actually informative (shows failures are event-correlated, not random baseline noise).

4. **Baseline frequency unknown.** The research caught 1 event in ~2 hours. Is that typical? Without longer soak testing, it is impossible to estimate how often Mode B affects real users. The whiteboard acknowledges this (confidence: LOW on baseline frequency).

5. **No follow-up on Railway support (ENG-1939).** The whiteboard recommends requesting Railway proxy logs. The research does not report whether this was done or what the outcome was. This would be the most direct path to upgrading from SUPPORTED to PROVEN.

### Clarity

The whiteboard is well-structured and largely self-explanatory. Specific strengths:

- **The thesis is stated upfront and clearly.** Someone can read the first 3 paragraphs and understand the conclusion.
- **The experimental evidence table is immediately scannable.** Direct (0 failures) vs two-hop (11 failures) is presented clearly.
- **The failure signature comparison table** (Phil vs reproduction) is excellent — makes the match easy to verify.
- **Implications for fixes** are concrete and actionable, with clear reasoning for why each engineering ticket matters.
- **Confidence assessment** is honest and well-calibrated — HIGH where evidence is strong, LOW where it is not.

Minor clarity issues:

- The whiteboard says "PARTIALLY REPRODUCED" but the thesis statement reads as a confident conclusion, not a partial one. The tension between these two framings could confuse a reader. The thesis should be hedged to match the verdict.
- The "multiplicative vulnerability" probability model (P = 1-(1-p)^2 ≈ 2p) is a nice mental model but presents a theoretical derivation as if it were measured. The actual data shows 0 vs 11, which is consistent with any model where two-hop > direct. The specific "2x" claim is a simplification.
- Phase 1 forensics are thorough to the point of being overwhelming. For someone unfamiliar, the critical insight (streams died during active token flow, not silence) could be made more prominent with a one-line bold summary at the top.

### Recommendations

To strengthen the verdict from SUPPORTED to PROVEN:

1. **Obtain Railway proxy logs (ENG-1939).** This is the single most impactful action. If Railway can provide edge proxy logs for the 12:47:38 UTC event window, the mechanism would be directly observable.

2. **Run extended soak tests.** The research caught 1 event in ~2 hours. Running the two-hop soak for 24-48 hours would establish a baseline event frequency and provide multiple failure instances to analyze for common patterns.

3. **Add server-side disconnect detection.** The server currently logs nothing when a two-hop proxy connection dies. Adding a middleware that detects client disconnection and logs the timestamp, connection age, and bytes sent would provide server-side confirmation timestamps for future events.

4. **Test with Railway private networking.** If Railway offers internal service networking that bypasses the edge proxy, testing the same soak through that path would directly validate the "edge proxy traversal count" hypothesis.

5. **Wait for another Railway platform incident.** Run the two-hop soak continuously or periodically. If the next Railway status page incident correlates with a spike in two-hop failures, that would strongly support the platform instability amplification claim.
