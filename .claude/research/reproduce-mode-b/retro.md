# Retro: Reproduce Mode B SSE Stream Death

## Part 1: What Happened

### The Setup

Phil Lau hit our app five times on February 20 and every single chat stream died mid-sentence. The user saw text appearing -- tokens flowing, the AI composing its answer -- and then nothing. Network error. No explanation. He tried again, and again, and again. Four times in six minutes during the evening session, plus once earlier that morning.

We already knew about Mode A -- Railway's 10-second idle timeout that kills SSE connections when no bytes flow for too long. That was ENG-1935, fixed with keepalive heartbeats. But Phil's failures didn't look like Mode A. The question for this session was: can we reproduce Mode B, the unexplained one, and figure out what's actually happening?

### Phase 1: The Forensic Reconstruction

The session started not by trying to reproduce anything, but by going back to the crime scene with better instruments. The researcher pulled every Sentry trace for Phil's five failures -- both the Next.js side and the Python side -- and reconstructed each one at millisecond precision. Every span, every Gemini API call, every silence gap, laid out in timeline tables.

This forensic work produced the session's single most important finding, and it came early: **Phil's streams died while tokens were actively flowing, not during silence gaps.**

This was the moment the investigation pivoted. The prior assumption had been that Mode B was somehow related to Mode A -- maybe a longer timeout, maybe a different threshold. But the data was unambiguous. Phil's successful streams that same day survived silence gaps of 9.2 and 9.9 seconds. His failed streams had *shorter* gaps -- 6.2 to 8.1 seconds -- and they died not during those gaps but *after* them, during the post-GFS phase when Claude was composing its final answer and text tokens were streaming to the browser.

The forensics also revealed a precise fingerprint: in every single failure, the Next.js span ended exactly 6-9 milliseconds before the Python span. Not 100ms. Not 1ms. Consistently 6-9ms across all five deaths. That timing is what TCP disconnect propagation looks like through Railway's internal network -- something upstream severs the connection, Next.js detects the broken pipe, and 6-9ms later the signal reaches Python's generator.

### Phase 2: Trying to Make It Happen

Armed with the forensic reconstruction, the researcher built an experiment server on Railway. The first step was replaying Phil's exact traffic patterns -- the precise timing of his SSE events, the silence gaps during GFS queries, the burst of tokens afterward. Five variants, one for each failure. They were run 20 times. Nothing broke.

Then came escalation: 5 concurrent connections, 10, 20, 50. Nothing. Rapid reconnection mimicking Phil's retry-every-few-seconds behavior. Nothing. Burst-after-silence transitions to test if the pattern of "long quiet then sudden data" triggered something. Nothing. A 500-connection soak test. Nothing.

At this point, over 1,100 direct connections had been tested with zero failures. Phil's traffic pattern was definitively not the trigger. Whatever killed his streams, it wasn't something the application was doing.

### The Architectural Insight

Here's where the researcher made a creative leap. Phil's traffic in production doesn't just traverse Railway's edge proxy once. It goes: Browser to Cloudflare to Railway Edge to Next.js (service 1), then Next.js proxies to Python (service 2) through Railway's infrastructure again. Two hops through Railway's proxy layer.

The experiment server got a new endpoint: `/two-hop/`. Instead of serving SSE directly, it proxied the request back through Railway's public edge to itself -- forcing the traffic through Railway's edge infrastructure twice, just like production. Same SSE payload, same timing, same server, but now with a double proxy chain.

### The Breakthrough

The two-hop tests started and initially looked like more of the same -- connections succeeding, streams completing. Then the soak test was running: 10 parallel clients, 50 iterations each, cycling through Phil's timing variants. Alongside it, Phil pattern replays and rapid reconnection tests were running through the two-hop path.

At 12:47:38 UTC on February 21, nine connections died simultaneously. Same second. curl exit code 18 -- "transfer closed with outstanding read data remaining." The streams were mid-sentence, actively sending tokens. No server-side error. No deployment. No Railway status page incident. Just... nine connections, severed at once.

Two more failures hit the Phil pattern replay and rapid reconnection tests at the same time. Eleven total, all at 12:47:38.

Meanwhile, the direct connection control group running in parallel: zero failures.

This was the reproduction -- or at least, the closest thing to it. An infrastructure event, invisible from the application layer, that killed every two-hop connection simultaneously while leaving every direct connection untouched.

### The Judges

Two judge agents evaluated the work independently. They were fair and their criticisms were substantive:

The **process judge** rated the work ADEQUATE. Its strongest criticism: this was a single event, not a pattern. All 11 failures came from one moment in time. The framing treated it as evidence of a systemic mechanism, but one event could be coincidence. The two-hop approximation also wasn't architecturally identical to production -- the experiment proxied through the public edge twice, while production uses Railway's internal networking between services. And "cannot be prevented at the application level" was stated confidently but never actually tested.

The **answer judge** rated the conclusion SUPPORTED. It agreed the evidence chain was strong -- convergent signals from forensics, elimination of application triggers, and the two-hop differential -- but noted the research couldn't trigger failures on demand and relied on a single observed event. The most actionable recommendation: get Railway's proxy logs for 12:47:38 UTC. That would be the single most impactful upgrade from "supported" to "proven."

The director accepted both assessments, weakened confidence levels on several claims, and added an experiment limitations section to the whiteboard. Honest science.

### What We're Left With

The whiteboard's verdict: **PARTIALLY REPRODUCED -- SUPPORTED (not proven).**

What's proven: Phil's streams died during active data flow (not idle timeouts), and his traffic pattern alone doesn't cause failures. What's supported: the two-hop architecture amplifies vulnerability to Railway infrastructure events. What's best-guess: Railway infrastructure operations (proxy rotation, cert renewal, connection pool resets -- we don't know which) are the specific root cause.

The practical takeaways are clear:
- **ENG-1938 (heartbeats)** fixes Mode A but not Mode B. Still worth doing.
- **ENG-1943 (partial persistence)** is the real Mode B mitigation. Can't prevent the disconnect, but can prevent data loss by saving incrementally.
- **ENG-1948 (client error reporting)** is essential for detecting Mode B in the wild, since server-side logs show nothing.
- **ENG-1939 (Railway proxy logs)** would turn "supported" into "proven."

---

## Part 2: Session Retro

### What Went Well

**The forensic-first approach was the right call.** Starting with millisecond-precision reconstruction of the existing failures before attempting reproduction meant the entire session was grounded in evidence. The Phase 1 finding that streams died during active data flow (not silence gaps) completely reframed the problem and prevented wasting time on idle-timeout-adjacent hypotheses. This is the right pattern for any "reproduce a production issue" investigation: understand the incident forensically before trying to recreate it.

**Systematic hypothesis elimination was thorough.** Before introducing the two-hop variable, every plausible application-level trigger was tested and eliminated: traffic pattern, concurrency, rapid reconnection, burst-after-silence. This made the two-hop finding much stronger because it came after ruling out alternatives, not in lieu of checking them.

**The two-hop insight was creative and architecturally grounded.** Recognizing that the production topology creates double edge traversal, and building a self-proxy endpoint to approximate it, was the key experimental design decision. It came from actually thinking about the network path rather than just replaying the application-level behavior.

**The judgment phase worked.** Both judges produced substantive, non-rubber-stamp assessments. The process judge's criticism about single-event overconfidence was genuinely useful -- the whiteboard was revised to weaken claims that had been overstated. The answer judge's point about Railway proxy logs being the single most impactful upgrade was a clear actionable recommendation. The dual-judge pattern earned its keep here.

**Evidence trail is excellent.** Every claim traces to a specific Sentry trace ID, Railway log timestamp, or experiment result. The phase files are detailed enough that someone could independently verify the forensic timeline. This is the research skill working as intended -- the whiteboard holds the distilled narrative, the phase files hold the auditable evidence.

### What Didn't Go Well

**Only caught one infrastructure event.** The entire two-hop finding rests on a single event at 12:47:38. If the soak test had run for 24 hours instead of 2, we might have caught 5-10 events and had statistical confidence. The session was time-bounded, but the research would have benefited from planning for longer-duration observation from the start.

**The two-hop approximation has known architectural gaps that weaken the conclusion.** The experiment routes through Railway's public edge twice (same server proxying to itself). Production routes through Railway's internal networking between two separate containers. These are different network paths with potentially different resilience characteristics. The judges correctly flagged this. A two-service experiment on Railway would have been a more faithful reproduction, though it requires more infrastructure setup.

**Soak v2 results never got written back to Phase 2.** The whiteboard references soak v2 (0/500 failures), but the phase-02 file still says "Results will be added when complete." This is a documentation gap -- the phase file is incomplete. Minor, but it means someone reading just phase-02 would miss the important 0/500 control result.

**No TCP-level diagnostics on the failure.** When the 12:47:38 event happened, curl was running with basic output options. Running with `--trace-ascii` or having tcpdump running would have revealed whether the connection was killed by RST, FIN, or TLS alert -- which would narrow down the exact Railway mechanism. This is data that can't be recovered after the fact.

**"Cannot be prevented" was asserted without testing any prevention.** The judges correctly called this out. No experiment tested TCP keepalive tuning, HTTP/2 PING frames, or any application-level defensive measure. The claim may well be correct (active data flow was already happening when the connection was severed), but stating it with confidence without testing it is a gap.

**The research skill's phase structure was slightly awkward for experiment-heavy work.** Phase 1 (forensics) was a natural research phase. Phase 2 (reproduction) involved iterative experiment design and execution -- deploying code, running tests, analyzing results, redesigning, redeploying. This is more of an engineering loop than a research phase, and the phase manager abstraction wasn't perfectly suited to it. The researcher ended up doing a lot of direct experiment execution.

### Specific Improvement Suggestions

**For the research skill:**

1. **Add an "experiment phase" archetype** alongside the current lightweight/heavy distinction. Research that involves deploying infrastructure, running experiments, and analyzing results has a different cadence than research that involves reading code and documents. The experiment archetype would include: deploy infrastructure, run baseline, introduce variable, run treatment, analyze differential. The note-to-self ritual still applies, but the phase manager's operating mode would be different.

2. **Judgment should have access to raw phase files, not just the whiteboard.** The judges wrote insightful critiques but couldn't independently verify claims against raw data. If they could read phase files directly, they could check whether the whiteboard's framing matches the underlying evidence.

3. **Pre-register the convergence criteria.** Before Phase 2 started, the whiteboard should have stated: "We will consider Mode B reproduced if we observe curl exit 18 during active data flow with no server-side error, on at least N independent events." This would have prevented the framing where a single event was initially treated as strong evidence.

**For the experiment infrastructure:**

4. **The Railway SSE experiment server should have a built-in tcpdump/trace mode.** When failures are rare and unpredictable, every failure is precious. The experiment server should always be capturing TCP-level diagnostics so that when a failure does occur, the full picture is available. Even just running curl with `--trace-ascii` to a file for every connection would help.

5. **Build a two-service Railway experiment template.** The current experiment is a single service proxying to itself. For the next round of investigation, having a proper two-service setup (one Next.js-like proxy, one Python-like SSE generator, communicating via Railway internal networking) would eliminate the biggest architectural gap the judges identified. This could be a reusable template for any Railway networking investigation.

6. **Add disconnect detection to the experiment server.** When a two-hop connection dies, the proxy handler should detect the downstream client disconnection and log it with timestamp, connection age, bytes sent, and the two-hop request ID. Currently, the server logs show nothing when connections are killed -- which mirrors production's blind spot but shouldn't mirror it in experiments designed to study this exact phenomenon.

**For future Mode B investigation:**

7. **Run a 48-hour parallel soak.** Deploy the experiment server, start 10 two-hop and 10 direct connections running simultaneously, log everything. Let it run over a weekend. If Railway infrastructure events happen at the frequency suggested by catching one in 2 hours, a 48-hour soak should catch dozens. That turns a single anecdote into a statistical pattern.

8. **File ENG-1939 (Railway proxy logs) as the top priority.** The judges are right -- this is the single most impactful action. Getting Railway's edge proxy logs for the 12:47:38 event would reveal the exact mechanism and turn "supported" into "proven."

9. **Test mitigation strategies.** Before concluding Mode B is unpreventable, run the two-hop soak with: (a) TCP keepalive at 5-second intervals, (b) HTTP/2 with PING frames, (c) application-level heartbeat bytes interleaved with data. If any of these prevent failures during an infrastructure event, that changes the engineering response from "accept and recover" to "prevent."

**For the codebase:**

10. **Add SSE event-level instrumentation to the post-GFS response phase.** Phase 1 identified that all five failures occurred during the "uninstrumented" post-GFS phase. Adding a span that covers this phase -- with event count, byte count, and inter-event timing -- would make future forensics dramatically more precise. Currently there's a 2-7 second black box between the last GFS span and the death.

11. **Implement ENG-1943 (partial persistence) regardless of Mode B root cause.** Whether Mode B is Railway infrastructure, cosmic rays, or something else entirely, the user experience fix is the same: save conversation state incrementally so that a mid-stream death doesn't lose the entire response. This is the one recommendation that doesn't depend on proving the root cause.

12. **Add a server-side stream completion signal.** Currently, when a stream dies from Mode B, the server logs show nothing wrong -- Python handles GeneratorExit gracefully and reports status:ok. Adding an explicit "stream completed successfully" log entry (and Sentry span) would make it trivial to detect Mode B from server-side telemetry: any request that has a Python http.server span but no completion signal is a suspected Mode B death.
