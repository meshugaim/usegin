# Process Judge: Reproduce Mode B SSE Stream Death

## Process Assessment

### Verdict: ADEQUATE

The research demonstrates genuine investigative skill and produced a meaningful finding (the two-hop amplification effect). However, it suffers from a confirmation-oriented framing that overstates what was actually proven, underexplores alternative explanations, and treats a single correlated event as strong evidence for a specific causal mechanism.

---

### Strengths

**1. Forensic phase was excellent (Phase 1)**

The millisecond-precision reconstruction of all 5 failures is rigorous and auditable. Every claim traces back to a specific Sentry trace ID. The comparison table of failed vs. successful stream silence gaps is the strongest piece of evidence in the entire project — it cleanly eliminates Mode A (idle timeout) as the cause by showing successful streams survived longer gaps than the ones that killed failed streams. The 6-9ms death signature analysis across all 5 failures is a genuine forensic insight. Sources are cited throughout.

**2. Good experimental controls in direct-to-server tests**

Phase 2 systematically eliminated several hypotheses: Phil's specific traffic pattern, concurrency effects, rapid reconnection, and burst-after-silence transitions. Each was tested in isolation and all produced 0 failures across 1,142+ direct connections. The dead ends section on the whiteboard honestly documents these null results.

**3. The two-hop experiment was a creative and well-constructed idea**

Recognizing that the production architecture creates a double edge-proxy traversal, and building a self-proxy endpoint to reproduce that topology, shows genuine architectural thinking. The experiment code is clean, well-instrumented, and the proxy implementation faithfully mimics the production path.

**4. Evidence chain is auditable**

Phase files link to specific Sentry trace IDs, Railway log timestamps, and incident documentation. A reviewer could independently verify the forensic timeline by querying those trace IDs (assuming Sentry retention). The experiment server code is committed to the repo.

---

### Concerns

**1. A single correlated event is treated as proof of a systemic mechanism**

All 11 two-hop failures occurred at a single timestamp (12:47:38 UTC). This is literally one event, not a pattern. The whiteboard frames this as "partially reproduced" and assigns "HIGH confidence" to the claim that "two-hop amplifies vulnerability." But a single infrastructure event that happened to coincide with the test window does not demonstrate that the two-hop architecture caused the failures — it only shows that the two-hop connections were affected while direct connections were not during that specific event.

Alternative interpretation: whatever Railway did at 12:47:38 may have only affected the specific server process handling the proxied connections (which necessarily shares the process with the proxy handler), or it may have affected a specific connection pool (httpx in the proxy vs. direct curl), or it could be that the proxy introduced a different TCP behavior that makes connections more susceptible to specific infrastructure actions. The research does not consider these alternatives.

To demonstrate a systemic multiplier effect, the experiment would need multiple independent events across hours or days — not a single coincidence.

**2. The two-hop proxy is not architecturally equivalent to production**

The whiteboard claims the production path (Browser -> Cloudflare -> Railway Edge -> Next.js -> Railway Internal -> Python) is equivalent to the two-hop experiment path (Client -> Cloudflare -> Railway Edge -> Server -> httpx -> Cloudflare -> Railway Edge -> Server). But there are meaningful differences:

- **Production uses Railway's internal networking** between Next.js and Python (separate Railway services communicating via `.railway.internal`). The experiment goes through the public edge twice instead. These are different networking paths.
- **The proxy in the experiment uses httpx**, an HTTP client library, whereas Next.js uses its built-in fetch API. Different HTTP client implementations have different TCP keepalive, connection pooling, and error handling behaviors.
- **The experiment runs both endpoints in the same process**. Production runs them in separate containers/processes. The same-process path shares memory, event loops, and OS-level resources.

Phase 2 acknowledges this in Open Question #4 but doesn't flag it as a significant limitation of the central conclusion.

**3. Confirmation bias in framing**

The whiteboard thesis reads: "Phil Lau's Feb 20 incident was caused by Railway infrastructure events severing proxied SSE connections during active data flow." This was the hypothesis going in, and the framing throughout treats evidence as confirming it rather than testing it.

For example, the whiteboard says the failure signature "matches Phil exactly" and presents a comparison table. But the similarities listed (curl exit 18, mid-stream death, no server error) are generic properties of any connection severed by infrastructure — they don't specifically confirm the Railway two-hop hypothesis. Any proxy, load balancer, or network appliance that kills a connection would produce the same signature.

The "Correlated timing" comparison is misleading: Phil had 4 failures in a 6-minute window; the experiment had 9 failures in 1 second. These are qualitatively different patterns. The 6-minute window for Phil could indicate a sustained degradation; the 1-second burst indicates a single discrete event. Presenting them as matching signatures overstates the similarity.

**4. "Cannot be prevented at application level" is stated with HIGH confidence but not tested**

The whiteboard assigns HIGH confidence to this claim, but no experiment tested whether application-level changes (connection timeouts, retry logic, TCP keepalive settings, HTTP/2 vs HTTP/1.1) could mitigate Mode B. The experiment only tested whether Phil's traffic pattern could trigger the failure — it did not test defensive measures. The claim may be correct, but it's an inference, not a finding.

**5. The broader pattern data was underutilized**

The incident report (README.md) contains a valuable table of failure rates correlated with Railway platform incidents across Feb 10-20. Phase 1 references this but Phase 2 doesn't attempt to correlate the experiment's failure event with any Railway status page entry. The Phase 2 observation "No platform incident was reported" for the 12:47:38 event is noted but not explored — this is actually a challenge to the thesis (Phil's failures correlated with known incidents; the experiment's failure did not) and should have been given more weight.

**6. Soak v2 results are incomplete**

Phase 2 mentions "Soak v2: 500 two-hop connections (started 13:04 UTC)" and "Results will be added when complete." The whiteboard includes this data (showing 0/500 failures), but Phase 2 itself was never updated. The 0/500 result in soak v2 is actually significant — it means the two-hop path ran 500 connections without failure when no infrastructure event occurred, which weakens the "multiplicative vulnerability" framing and strengthens the "rare discrete event" interpretation.

---

### Gaps

**1. No long-duration soak test**

The research caught a single infrastructure event in roughly 1-2 hours of testing. To establish a baseline frequency and confirm the two-hop amplification hypothesis, a 24-48 hour soak test running both direct and two-hop connections simultaneously would be necessary. This would yield multiple events (or confirm they're very rare), enabling statistical comparison of failure rates between the two paths.

**2. No Railway status/incident correlation for the observed event**

The 12:47:38 event had no corresponding Railway status page entry. Was there a deployment to any Railway infrastructure component? Was there elevated error rates across other Railway customers? Without this context, the research can't distinguish "Railway routine maintenance affected two-hop connections" from "something else happened at 12:47:38 that coincidentally affected the test."

**3. No testing of Railway private networking**

Production services communicate via Railway's internal networking (`.railway.internal`). The experiment exclusively tested public edge traversal. An experiment using two actual Railway services communicating via internal networking would be a much closer reproduction of the production architecture.

**4. No client-side error analysis**

The curl exit code 18 was noted but not deeply analyzed. What does the TCP layer look like? Did the server send a RST? A FIN? Was there a TLS alert? Running the experiment with `--trace` or Wireshark-level capture on a failure would reveal the exact disconnect mechanism, which could distinguish Railway proxy rotation from other causes.

**5. No testing of mitigation strategies**

The whiteboard recommends ENG-1943 (partial persistence) as "THE fix" for Mode B, but no experiment tested any mitigation. Testing whether TCP keepalive, HTTP/2 PING frames, or more aggressive application-level heartbeats during active streaming reduce Mode B frequency would be valuable — even if the hypothesis is that they can't help, demonstrating that experimentally would strengthen the conclusion.

---

### Recommendations

To strengthen this to RIGOROUS, the following additional work would be needed:

1. **Run a 24-48 hour parallel soak test** with simultaneous direct and two-hop connections, logging all events. Multiple independent infrastructure events would either confirm or refute the two-hop amplification hypothesis. If 0 events are caught in 48 hours, the frequency is too low for the two-hop amplification to matter practically.

2. **Deploy a two-service experiment** using Railway's actual internal networking (not public edge self-proxy). This directly tests the production topology instead of an approximation.

3. **Add TCP-level diagnostics** (curl `--trace-ascii`, or a tcpdump capture) to understand the exact disconnect mechanism when failures occur.

4. **Weaken the thesis framing** to match the evidence. "We observed that two-hop connections were affected by a single Railway infrastructure event while direct connections were not" is what was demonstrated. "The two-service architecture is the vulnerability" is an extrapolation that requires more events to support.

5. **Test at least one mitigation strategy** before concluding that Mode B cannot be mitigated at the application level.
