# Phase J: Process Judge

## Process Assessment

### Verdict: RIGOROUS

This is a well-conducted investigation. The research process exhibited strong epistemic discipline: it corrected its own earlier mistakes, clearly distinguished between proven facts and inferred conclusions, explored multiple hypotheses genuinely (not just confirming the first one), and left an auditable evidence trail from raw Sentry traces and Railway logs through to final conclusions. The phasing was well-structured and each phase built meaningfully on the prior one. My concerns are minor relative to the overall quality.

---

### Strengths

**1. Self-correction under pressure**

The single most impressive feature of this research is Phase 2's demolition of Phase 0's failure rate methodology. The orientation reported a 48% failure rate on Feb 10 based on comparing `agent_usage` vs `conversations` record counts. Phase 2 went to the actual code (`chat_service.py` lines 239-269), discovered both tables write at the same code point (the `result` event), and proved the methodology was invalid -- the "failures" were an artifact of comparing raw record counts to unique session counts. This was not a minor correction; it fundamentally changed the scope of the investigation from "massive chronic problem" to "10 confirmed failures in 14 days." Research that catches and corrects its own foundational errors earns trust.

**2. Genuine hypothesis elimination, not confirmation bias**

Phase 4 systematically tested and ruled out five distinct hypotheses (our deploy, documented Railway incident, idle timeout, concurrent load, user action) before settling on "undocumented proxy instability" as the residual explanation. Crucially, the deploy hypothesis was the most intuitive explanation and would have been easy to accept, but the 7-hour gap between deploy (09:47 UTC) and Phil's cluster (17:04 UTC) was honestly presented as disqualifying. The Cloudflare DNS incident was similarly investigated with precise timestamps and rejected because it started 75 minutes after Phil's last failure. This is how hypothesis testing should work.

**3. The 6-9ms signature as an anchor finding**

Phase 1 identified that in all 5 Feb 20 failures, the Next.js span ends 6-9ms before the Python span -- a consistent, measurable signal interpreted as TCP disconnect propagation time. This finding became the structural backbone of the entire investigation. It was verified across all failures, used to rule out application-level causes (Python never errors, it receives a disconnect), and explained in mechanical detail in Phase 3. Anchoring the investigation on a repeatable, quantitative observation rather than a narrative was the right call.

**4. Source diversity**

The investigation drew from: Sentry traces (both `python-fastapi` and `nextjs-app` projects), Railway application logs (4 log files preserved before 24h expiry), Railway deployment history via CLI, production Supabase data, Railway status page history, Cloudflare incident reports, the Railway changelog, actual source code (Python event generator, Next.js proxy, Sentry SDK internals in `node_modules`), and git commit history. No single source was treated as authoritative.

**5. The mechanism trace (Phase 3) was thorough**

Phase 3 traced the full death path from TCP severance through Python's `GeneratorExit`, the ASGI middleware's `span.status:ok` assignment (from `http.response.start` before body bytes), the Sentry fetch instrumentation's `internal_error` path (from `@sentry/core/build/esm/fetch.js:247-248`), to the browser's `TypeError` and `classifyError()` mapping. Going into the Sentry SDK source in `node_modules` to find the exact `endSpan()` logic that sets `internal_error` was above and beyond -- it definitively answered the question "who sets `internal_error`?" with a code citation.

**6. Clear confidence calibration**

The whiteboard's confidence assessment explicitly separates "Proven" (TCP-level kill with 6-9ms signature), "Strong inference" (DDoS rollout theory), and "Unknown" (whether this recurs). The final answer states "This is inference, not proof" about the DDoS theory. This kind of epistemic honesty is exactly what prevents downstream decision-makers from over-indexing on uncertain conclusions.

**7. Dead ends documented honestly**

Each phase documents its dead ends: the flawed DB methodology, Railway status page pagination, the Cloudflare timing mismatch, the deploy hypothesis. Dead ends are described with enough detail that a reader understands why they were abandoned.

---

### Concerns

**1. The DDoS theory rests on thin evidence**

The final answer in the whiteboard names "Railway's layer 4 DDoS protection rollout" as the most likely cause, citing Changelog #0278. But the changelog was not actually fetched or read -- Phase 4 says "The changelog page was not fetchable." The title "DDoS protection, Railway domains, better canvas state" is suggestive but not conclusive. "DDoS protection" appearing in a changelog title does not establish that it was rolled out on that day, that it affected existing connections, or that it operated in the way described. The reasoning chain from "changelog title mentions DDoS" to "L4 DDoS protection causes TCP resets during progressive rollout" involves multiple inferential steps, each unverified. The whiteboard presents this with appropriate caveats ("This is inference, not proof"), but the answer section leads with it as if it were the primary finding. A reader skimming the answer might miss the caveats.

**2. The Feb 10 and Feb 11 failures received less scrutiny**

Phase 1 reconstructed all 5 Feb 20 failures with millisecond-precision timelines, but failures #1-3 (Feb 10-11) got minimal forensic attention. Phase 2 notes their anomalous durations (192.4s, 308.6s) and Phase 4 acknowledges "we lack silence gap data for these older traces." Since these 3 failures represent 30% of the total and could be Mode A (idle timeout) rather than Mode B2 (proxy instability), the failure taxonomy's claim that 7/10 are "undocumented proxy instability" may be overstated. If 2 of those 3 were actually Mode A, the taxonomy shifts to 5/10 Mode B2 -- still the majority, but a meaningfully different picture. The research acknowledges this gap ("suspected failures" in the taxonomy) but the whiteboard presents 7/10 as settled.

**3. No attempt to reproduce or verify the Railway timeout discrepancy**

The whiteboard lists "Railway documents 60s keep-alive but we measured ~10s -- possible DDoS-related change" as finding #9. This is a significant discrepancy that could validate the DDoS theory if the timeout changed around Feb 20. But no one tested whether the timeout is still 10s (which would be easy -- rerun the ENG-1937 experiment). If the timeout was always 10s, the discrepancy is unrelated to DDoS. If it changed to 10s around Feb 20, that would be strong corroborating evidence. This was a missed opportunity for verification.

**4. The "local dev" classification for failure #3 (Feb 11) is asserted but not well-supported**

Phase 4 classifies failure #3 (Feb 11, 02:09) as "localhost/local dev" and excludes it from the production analysis. Phase 2 lists it as having "39 spans in trace (complex), 1 error" but does not explain how it was determined to be local dev. This classification matters because removing it changes the denominator. The evidence trail for this determination is thin.

**5. Client-side investigation was essentially skipped**

The research notes zero client-side Sentry replays and attributes this to ad blockers. But no attempt was made to check browser-side Sentry error events (as opposed to replays), or to examine whether the `Sentry.captureException` call in `use-chat.ts` line 216 actually produced events. The browser is one of the four actors in the death path, and its perspective was entirely absent. Phase 3 traces the browser code path theoretically but never checks what data actually exists on the client side.

---

### Gaps

**1. No post-Feb 20 validation**

The whiteboard's open questions ask "Have failures stopped since the DDoS rollout completed?" but Phase 4 does not check. Feb 21 had zero failures in the Sentry 14-day window, which is noted but not investigated. Checking whether failures continued on Feb 21 (the day after the supposed DDoS rollout completed) would be a cheap, high-value test of the theory.

**2. No Railway support contact was made**

ENG-1939 ("request Railway proxy logs") is listed as a backlog human action item. The research correctly identifies this as outside its scope, but it could have been escalated during the investigation. Railway support could confirm or deny proxy-layer changes on Feb 20 in minutes.

**3. No analysis of successful streams bracketing the failures**

Phase 1 mentions successful streams at 10:10 (1 minute after failure #6) and 17:32 (23 minutes after the cluster), and Phase 2 lists successful spans, but there is no systematic comparison of what made successful streams different from failed ones during the same instability windows. Were successful streams shorter? Did they avoid GFS? Were they routed through different proxy instances? Even a negative finding ("no distinguishing characteristic") would strengthen the infrastructure theory.

**4. No investigation of Railway's internal architecture**

The research assumes "Railway's proxy killed it" based on the 6-9ms delta, but does not explore what Railway's proxy architecture actually looks like. Railway publishes documentation about their metal infrastructure, edge proxy, and networking stack. Understanding whether there are multiple proxy layers (edge, internal mesh, per-service sidecar) would help narrow where in the stack the kill occurs and whether DDoS protection would operate at that layer.

---

### Recommendations

The verdict is RIGOROUS, so these are refinements rather than requirements:

1. **Rerun the ENG-1937 timeout experiment** to check if the 10s threshold changed. If it is now 60s (matching Railway's docs), the DDoS rollout theory gains strong corroboration. If still 10s, the timeout discrepancy is unrelated and should be dropped from the narrative.

2. **Soften the DDoS framing** in the whiteboard answer. The current answer leads with "Railway's layer 4 DDoS protection rollout on Feb 20 most likely killed Phil's connections." A more accurate framing: "Railway's proxy infrastructure killed the connections at the TCP level. The specific trigger is unknown, but Railway's DDoS protection rollout (Changelog #0278) is the strongest candidate among the hypotheses we could evaluate." The distinction matters because the current framing could be cited as established fact in downstream decisions.

3. **Check Feb 21 failure count** to validate the theory. If the DDoS rollout completed on Feb 20 and failures stopped on Feb 21, that is meaningful temporal correlation. If failures continued, the theory needs revision.

4. **Classify Feb 10-11 failures more carefully** or mark them explicitly as "unclassified" rather than defaulting to Mode B2. The 7/10 count drives the "70% undocumented" narrative, which rests on unverified assumptions about older traces.

---

## Answer Assessment

### Verdict: SUPPORTED

The research provides a well-evidenced, multi-layered answer. The core mechanical finding (Railway's proxy killed the connections at the TCP level) is proven. The causal explanation for *why* Railway's proxy did this (DDoS protection rollout) is a strong inference -- the best available explanation after systematic elimination of alternatives -- but it is not directly confirmed. The research is honest about this distinction.

### The Question

Why did Phil Lau's SSE chat streams silently fail 5 times on Feb 20, 2026, and what was the actual mechanism behind those failures?

### The Answer

Railway's proxy infrastructure severed the TCP connections at the network layer, killing Phil's streams mid-flight. The most likely trigger was Railway's layer 4 DDoS protection rollout (Changelog #0278, shipped Feb 20), which would operate at exactly the TCP level where the kills occurred. All alternative causes were systematically ruled out: the application was healthy (zero Python errors, all Gemini calls 200 OK), the SSE idle timeout was not reached (silence gaps were 6.2-8.1s, under the 10s threshold), the team's own deploy was 7+ hours earlier, and the documented Railway DNS/cert incidents bracket but do not cover Phil's 17:04-17:09 failure window.

### Evidence Classification

**1. "Railway's proxy killed the connections at the TCP level" -- PROVEN**
- The 6-9ms delta between Next.js and Python span endings across all 5 failures is a direct measurement of TCP RST propagation time (Phase 1, failure table and detailed timelines).
- Zero application errors in Python, Railway logs, or Gemini API (Phase 1 log analysis, Phase 0 Sentry traces).
- The mechanism was traced through code: Sentry auto-sets `internal_error` on the fetch span when `handlerData.error` fires, and Python's `span.status:ok` comes from the HTTP 200 `http.response.start` event sent before body streaming begins (Phase 3, with specific Sentry SDK source citations).

**2. "Not the SSE idle timeout (Mode A)" -- PROVEN**
- Maximum silence gaps across all 5 failures: 6.2s, 6.8s, 8.1s, 8.1s, 8.1s -- all under the experimentally confirmed 10s threshold (Phase 1 failure table, Phase 0 SSE timeout experiment ENG-1937).
- A successful stream from the same IP earlier that day had an 8.1s gap and survived (Phase 1, comparison analysis).

**3. "Not our deploy" -- PROVEN**
- Deploy went live at ~09:48 UTC. Phil's cluster started at 17:04 UTC -- a 7+ hour gap (Phase 4, deploy timeline with Railway API data).

**4. "Not a documented Railway incident" -- PROVEN**
- Only 1 of 10 total failures correlates with a documented Railway status page incident (Feb 19 networking timeouts). Phil's failures fall in a 12.5-hour gap between the cert issue resolution (04:30 UTC) and the DNS incident start (18:24 UTC) (Phase 4, cross-reference table with minute-level precision).

**5. "DDoS protection rollout was the trigger" -- BEST-GUESS (strong inference)**
- Railway shipped Changelog #0278 ("DDoS protection") on Feb 20 -- same day as Phil's failures (Phase 4, source cited).
- Railway docs confirm DDoS protection operates at "network layer 4 and below" -- the exact layer where the kills occurred (Phase 4).
- DDoS protection rollout would explain: connection kills without app errors, clustering by region/shard, no status page entry (intentional change vs. outage), and intermittent failures across the day (Phase 4 analysis).
- **However**: the changelog content was not fully fetchable; the temporal correlation is same-day but not same-hour; no Railway engineer has confirmed the theory. This is elimination-based reasoning ("everything else is ruled out") rather than direct observation.

**6. "70% of failures (7/10) are undocumented proxy instability" -- STRONGLY SUPPORTED**
- The taxonomy classifying all 10 failures into Mode A (1), Mode B1 (1), Mode B2 (7), and Local Dev (1) is well-supported by cross-referencing Sentry data with Railway status page timelines and deploy history (Phase 4, failure taxonomy).
- **Caveat (aligning with the process judge)**: The Feb 10-11 failures (#1-3) received less forensic scrutiny than the Feb 20 cluster. If 2 of those 3 were actually Mode A (idle timeout -- plausible given their anomalous durations of 192s and 309s), the Mode B2 count drops to 5/10. The 7/10 figure is the upper bound, not a certainty.

**7. "The original 48% failure rate was wrong" -- PROVEN**
- Code inspection of `chat_service.py` lines 239-269 shows both `agent_usage` and `conversations` write on the same `result` event trigger. Production data confirms 74 = 74 unique sessions across both tables (Phase 2, methodology correction with code citation).

**8. "Failed streams leave no trace in the database" -- PROVEN**
- Direct consequence of finding #7, confirmed by code path analysis: GeneratorExit kills the generator before the `result` event is yielded, so neither `record_usage` nor `persist_session` fires (Phase 3, Step 5 consequences table).

### Gaps

**1. No direct confirmation of the DDoS theory.**
The research acknowledges this explicitly ("This is inference, not proof"). The recommended follow-up -- contacting Railway support (ENG-1939) -- is identified but is a human action item that was not executed during the research. This is the single biggest gap, and it is appropriately flagged.

**2. Feb 10 failures remain undercharacterized.**
Failures #1 and #2 (Feb 10, durations 309s and 192s) have no silence gap analysis. The research notes these might be Mode A (idle timeout during very long operations) or Mode B2, but does not resolve this. Given these are the earliest failures in the dataset and represent a different failure signature (much longer durations), this gap is minor but worth noting.

**3. No client-side evidence.**
Zero Sentry replays or client-side error reports were available. The research correctly identifies this as a structural blind spot (ad blockers, same network disruption affecting reporting) but cannot close it. As the process judge notes, no attempt was made to check whether the `Sentry.captureException` in `use-chat.ts` actually produced events on the client side.

**4. Whether failures have stopped post-DDoS rollout is unknown.**
Only 1 day of post-incident data existed at the time of research. This is an inherent limitation, but checking Feb 21 failure counts would have been a cheap validation step.

**5. No comparison of successful vs. failed streams during instability windows.**
Phase 1 mentions successful streams at 10:10 and 17:32 but does not systematically analyze what made them survive. Were they shorter? Did they avoid GFS? Were they routed differently? Even a null result ("no distinguishing feature") would strengthen the infrastructure theory.

### Clarity

The whiteboard is excellent as a standalone document. It answers the question directly, states its confidence level, and provides enough context for a reader unfamiliar with the investigation. Specific strengths:

- The driving question is precise and focused.
- The answer leads with the conclusion and immediately follows with the evidence chain.
- The "Corrections to Prior Understanding" table prevents readers from carrying forward stale assumptions from earlier incident documentation.
- The "Kill Signature" table with 6-9ms deltas is compact, precise, and self-explanatory.
- The failure taxonomy gives a complete picture of all 10 failures, not just Phil's 5.
- The confidence assessment at the bottom cleanly separates proven, inferred, and unknown.
- Dead ends are documented, preventing future investigators from re-exploring exhausted paths.

One clarity issue worth noting: the whiteboard's answer section leads with the DDoS theory ("Railway's layer 4 DDoS protection rollout on Feb 20 most likely killed Phil's connections") which could be read as more certain than the evidence supports. The caveats appear further down. A reader who only reads the first paragraph of the answer might take the DDoS theory as established fact. The process judge raises the same concern. The body of the whiteboard handles this well with explicit "This is inference, not proof" language, but the opening framing could be more carefully hedged.

### Recommendations

1. **Contact Railway support** (ENG-1939). This is the single action most likely to move the verdict from SUPPORTED to PROVEN. A Railway engineer confirming or denying proxy-layer changes on Feb 20 would resolve the investigation definitively.

2. **Rerun the ENG-1937 timeout experiment.** If the idle timeout has changed back to 60s (matching Railway docs), that would be strong corroborating evidence for the DDoS theory having caused infrastructure changes. If still 10s, the discrepancy is unrelated.

3. **Check Feb 21+ failure counts in Sentry.** If failures stopped after Feb 20, the temporal correlation with the DDoS rollout strengthens significantly. If they continued, the theory needs revision.

4. **Soften the DDoS framing in the whiteboard's opening answer.** The proven finding is "Railway's proxy killed the connections at the TCP level." The DDoS theory is the best-guess trigger. Leading with the proven finding and presenting the DDoS theory as the leading hypothesis (rather than the answer) would more accurately reflect the evidence.

5. **Characterize Feb 10-11 failures** or reclassify them as "unresolved" rather than defaulting to Mode B2. The 7/10 Mode B2 count is an upper bound and should be presented as such.
