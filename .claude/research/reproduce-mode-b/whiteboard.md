# Research: Reproduce Phil Lau's Mode B SSE Stream Death

## Thesis
Phil Lau's Feb 20 incident is consistent with Railway infrastructure events severing proxied SSE connections during active data flow. We observed that two-hop connections (traversing Railway's edge proxy twice) were affected by an infrastructure event while direct connections were not. The failure is not triggered by any application behavior — it's probabilistic and tied to Railway infrastructure operations.

## Verdict: PARTIALLY REPRODUCED — SUPPORTED (not proven)

We reproduced a failure with the exact same signature as Phil's: curl exit 18 on HTTP 200, mid-stream death during active token flow, no server-side error, correlated timestamp across all failures. This happened by routing Phil's traffic pattern through a two-hop Railway edge proxy chain. A single infrastructure event at 12:47:38 UTC on Feb 21 killed 9 simultaneous two-hop connections while zero direct connections were affected.

**What "partially" means**: We caught a real infrastructure event that matches the signature. But we cannot trigger it on demand, we observed only 1 event, and our two-hop approximation differs from the production topology (public edge re-entry vs. Railway internal networking between services).

---

## What Is PROVEN (high confidence, directly observed)

1. **Phil's streams died during active data flow, not silence gaps.** Forensic reconstruction at ms precision shows all 5 failures during post-GFS token streaming. Successful streams survived longer silence gaps (9.9s) than failed ones experienced (6.2-8.1s). This rules out the 10s idle timeout. *(Phase 1)*

2. **Phil's traffic pattern does not trigger failures.** 20 exact replays, 50 concurrent, rapid reconnection, burst-after-silence — 0/1,142 direct connections failed. *(Phase 2)*

3. **The 6-9ms NJS→Python death delta is a consistent fingerprint.** All 5 failures show identical propagation timing. *(Phase 1)*

## What Is SUPPORTED (strong circumstantial evidence)

4. **Two-hop connections are more vulnerable than direct.** 0/1,142 direct failures vs 11/827 two-hop failures. However: all 11 were from a single event, and soak v2 (500 connections, no event occurred) had 0 failures — so the vulnerability is event-correlated, not baseline noise.

5. **The failure signature matches Phil's.** Both: HTTP 200 + connection death, mid-stream active data, no server error, correlated timing across simultaneous connections. *Caveat*: these are generic properties of any infrastructure-level connection severance — they don't uniquely fingerprint Railway's edge proxy.

6. **Application-level prevention is unlikely.** Streams die during active data flow with no server error and no application trigger. *Caveat*: no defensive measures were tested (TCP keepalive tuning, HTTP/2 PING frames, etc.).

## What Is BEST-GUESS (inference, not proven)

7. **Railway infrastructure events are the specific root cause.** All evidence is consistent with this, and no alternative fits better. But no Railway proxy logs, no Railway confirmation, no controlled trigger. The mechanism (proxy rotation? cert renewal? connection pool reset?) is unknown.

8. **The two-service architecture creates multiplicative exposure.** Plausible but based on 1 event. The probability model (2x exposure) is theoretical — we'd need multiple independent events to validate statistically.

---

## Experimental Evidence

### Direct-to-server (single edge traversal): 0 failures

| Test | Connections | Failures |
|------|------------|----------|
| Phil pattern replay (5 variants × 4 reps) | 20 | 0 |
| Concurrent 5-50x | 105 | 0 |
| Burst-after-silence | 5 | 0 |
| Rapid reconnection | 12 | 0 |
| Multi-client soak v1 | 500 | 0 |
| Multi-client soak v2 (control) | ~500 | 0 |
| **Total** | **~1,142** | **0** |

### Two-hop (double edge traversal): 11 failures

| Test | Connections | Failures | Notes |
|------|------------|----------|-------|
| Phil pattern via two-hop | 15 | 1 | All at 12:47:38 UTC |
| Rapid reconnection via two-hop | 12 | 1 | Same event |
| Multi-client two-hop soak v1 | ~300 | 9 | Same event, same second |
| Multi-client two-hop soak v2 | ~500 | 0 | No event occurred |
| **Total** | **~827** | **11** | **All from 1 event** |

### Key: Not random noise — event-correlated
All 11 failures at the same second. When no event occurred (soak v2), 0/500 failed. This is an infrastructure event, not a baseline failure rate.

---

## Failure Signature Comparison

| Attribute | Phil's Incident | Our Reproduction | Match? |
|-----------|----------------|-----------------|--------|
| HTTP status at death | 200 (stream started OK) | 200 | Yes |
| Error type | internal_error / network error | curl exit 18 | Similar |
| Stream state at death | Active token flow | Active token flow | Yes |
| Server-side error | None | None | Yes |
| Silence gap cause? | No (6.2-8.1s) | No (mid-stream) | Yes |
| Correlated timing | 4 in 6 min | 9 in 1 second | Different pattern* |
| Infrastructure context | Railway cert/DNS incident | No known incident | Different* |

*Phil's 4 failures in 6 minutes suggests sustained degradation; our 9 in 1 second suggests a discrete event. Phil's happened during a known Railway incident; ours happened during normal operations. These are qualitatively different, though the mechanism may be the same.

## Experiment Limitation: Two-Hop Approximation ≠ Production

| Aspect | Production | Experiment |
|--------|-----------|------------|
| Services | 2 separate containers | 1 server self-proxying |
| Inter-service path | Railway internal networking | Public edge (re-entry) |
| HTTP client | Next.js fetch() | httpx AsyncClient |
| Proxy process | Separate Node.js process | Same Python process |

The experiment's two-hop is an approximation. Production traffic goes through Railway's internal networking between services, which may have different resilience characteristics.

---

## Implications for Fixes

**ENG-1938 (SSE Heartbeat)**: Prevents Mode A (idle timeout) only. Mode B kills active streams — heartbeats don't help. **Still implement it** — Mode A is the more common, preventable failure.

**ENG-1943 (Partial Persistence)**: The right response to Mode B. Can't prevent the disconnect, but CAN prevent data loss by persisting incrementally. **Highest impact for Mode B.**

**ENG-1948 (Client Error Reporting)**: Essential for Mode B detection. Client Sentry is blocked by ad blockers. A first-party error endpoint gives reliable monitoring.

**ENG-1939 (Railway Proxy Logs)**: The single most impactful action to upgrade this research from SUPPORTED to PROVEN. Would reveal the exact mechanism.

---

## Judgment Assessment

**Process Judge**: ADEQUATE. Valid criticisms: single event treated too confidently, two-hop not architecturally equivalent, confirmation bias in framing, "cannot prevent" not tested. Recommends: 24-48h soak, actual two-service experiment, TCP-level diagnostics.

**Answer Judge**: SUPPORTED. Strong circumstantial evidence, honest confidence calibration, well-structured whiteboard. Key gap: can't trigger on demand, only 1 event observed. Recommends: Railway proxy logs (ENG-1939) as the single most impactful upgrade path.

**Director response**: Both assessments accepted. Confidence levels adjusted downward — "two-hop amplifies" moved from HIGH to SUPPORTED. Thesis reworded to match evidence strength. Experiment limitations section added. The framing changes are incorporated above.

---

## To Upgrade to PROVEN

1. **Obtain Railway proxy logs** for 12:47:38 UTC Feb 21 (ENG-1939)
2. **Run 24-48h parallel soak** — catch multiple events for statistical confidence
3. **Deploy actual two-service experiment** using Railway internal networking
4. **Add TCP-level diagnostics** — curl `--trace-ascii` on failures to see RST vs FIN vs TLS alert
5. **Test mitigation strategies** — TCP keepalive tuning, HTTP/2 PING frames

---

## Files

- `phase-01-forensics.md` — ms-level reconstruction of all 5 Phil failures
- `phase-02-reproduction.md` — experiment design, results, failure analysis
- `judgment-process.md` — process judge assessment
- `judgment-answer.md` — answer judge assessment
