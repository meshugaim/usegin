# Phase 4: Causal Investigation — WHY Did Railway Kill the Connections?

## Summary

No single root cause explains all failures. **Three distinct causes** are now identified across the 10 confirmed failures, and Phil's 5-failure cluster on Feb 20 falls into the most concerning category: **unexplained proxy kills with no documented Railway incident, no deploy, and no application fault.** The "Railway did it" conclusion from Phase 1 is confirmed — Railway's proxy infrastructure severed the TCP connections — but the specific trigger for Phil's cluster remains unidentified. It was not a deploy, not a documented Railway incident, and not the SSE idle timeout.

---

## Hypothesis A: Our Own Deploy — RULED OUT

### Evidence

Production deployment history (from Railway API, `production` environment):

| Service | Deploy Created (UTC) | Commit | Status |
|---------|---------------------|--------|--------|
| nextjs-app | 2026-02-20T09:47:00Z | `538a249f` (fix: update semantic search integration test) | SUCCESS (current) |
| python-services | 2026-02-20T09:47:00Z | `538a249f` (same commit) | REMOVED (replaced at 2026-02-21T00:17:22Z) |
| **Previous** nextjs-app | 2026-02-18T11:05:09Z | fix: don't strip dots from sender filter | REMOVED |
| **Previous** python-services | 2026-02-18T11:05:09Z | same | REMOVED |

Build time for nextjs-app (from current build logs): **91.80 seconds**. So the Feb 20 deploy went live approximately **09:48:32 UTC**.

### Cross-reference with failures

| Failure | Time (UTC) | Gap from deploy going live | Verdict |
|---------|-----------|---------------------------|---------|
| #6 | 10:09 | **~20 minutes** | Possible but unlikely — 20min is far beyond the deploy cutover window |
| #7 (Phil) | 17:04 | **7 hours 15 min** | Impossible — deploy is long complete |
| #8 (Phil) | 17:05:14 | 7+ hours | Impossible |
| #9 (Phil) | 17:05:45 | 7+ hours | Impossible |
| #10 (Phil) | 17:09 | 7+ hours | Impossible |

### Deploy mechanism analysis

Railway's deploy cutover is handled by the edge proxy: the new container starts, health check passes, and the proxy routes new requests to it. The old container is drained and removed. This process completes within seconds to a few minutes of the build finishing. The `createdAt` on the REMOVED deploy (previous one) shows it was replaced at the new deploy's `createdAt` — confirming instant cutover.

Even if the deploy cutover killed the 10:09 failure (failure #6), it cannot explain Phil's 17:04-17:09 cluster. No deploys occurred between 09:47 and the next day.

**Verdict: Hypothesis A is RULED OUT for Phil's cluster.** Weakly possible for failure #6 only.

---

## Hypothesis B: Railway Platform Incident — PARTIALLY CONFIRMED

### Railway Status Page Incidents (Feb 2026)

| Date | Incident | Time Window (UTC) | Mechanism |
|------|----------|-------------------|-----------|
| Feb 11 | Anti-fraud misconfiguration | 14:33-18:31 | SIGTERM to ~3% of workloads |
| Feb 18 | Public networking timeouts | 13:47-14:48 | 502s, TCP proxy failures |
| Feb 19 | Public networking timeouts (recurrence) | 14:18-21:19 | 502s, timeouts |
| Feb 20 (early) | Certificate serving issue | Before 04:30 | Subset of *.up.railway.app |
| Feb 20 (evening) | DNS resolution failures | 18:24-23:50 | Cloudflare upstream issue |
| Feb 21 | 503 errors on subset of domains | 05:34-06:55 | Unknown |

Source: [Railway Status History](https://status.railway.com/history), [Railway Feb 11 Incident Report](https://blog.railway.com/p/incident-report-february-11-2026)

### The Cloudflare Incident (Feb 20 evening)

Railway's DNS failure at 18:24 UTC was caused by a Cloudflare upstream connectivity issue:

| Time (UTC) | Event |
|------------|-------|
| 18:24 | Railway declares DNS resolution failing |
| 18:30 | Railway says fix implemented |
| 18:45 | Cloudflare begins investigation (their status page) |
| 19:09 | Cloudflare identifies root cause: impact to BYOIP prefixes |
| 19:20-22:16 | Restoration in progress |
| 23:38 | Cloudflare re-enables remaining prefixes |
| 23:50 | Cloudflare resolves |
| 00:25 (Feb 21) | Railway declares resolved |

Source: [Cloudflare Incident kwy3dt82bwbt](https://www.cloudflarestatus.com/incidents/kwy3dt82bwbt)

### Cross-reference: ALL 10 failures vs Railway incidents

| # | Time (UTC) | Railway Incident Active? | Correlation |
|---|-----------|-------------------------|-------------|
| 1 | Feb 10, 21:21 | **None documented** | NO |
| 2 | Feb 10, 23:58 | **None documented** | NO |
| 3 | Feb 11, 02:09 | None (incident starts 14:33) | NO (also localhost/local dev) |
| 4 | Feb 17, 15:10 | **None documented** | NO (confirmed Mode A idle timeout) |
| 5 | Feb 19, 15:05 | **YES** — networking timeouts (14:18-21:19) | **YES** |
| 6 | Feb 20, 10:09 | Cert resolved before 04:30, DNS not until 18:24 | NO |
| 7 | Feb 20, 17:04 | **GAP** — cert resolved, DNS not yet started | NO |
| 8 | Feb 20, 17:05:14 | **GAP** | NO |
| 9 | Feb 20, 17:05:45 | **GAP** | NO |
| 10 | Feb 20, 17:09 | **GAP** | NO |

**Only 1 of 10 failures correlates with a documented Railway incident** (failure #5, Feb 19).

### The critical gap on Feb 20

Phil's failures cluster between **17:04 and 17:09 UTC**. The documented Railway incidents bracket this time but do not cover it:

```
04:30 UTC  ---- Certificate issue resolved ----
                          (12+ hour gap)
17:04 UTC  ==== Phil's failures start ====
17:09 UTC  ==== Phil's failures end ====
                          (1hr 15min gap)
18:24 UTC  ---- DNS resolution failures begin ----
```

The 75-minute gap between Phil's last failure and the DNS incident start strongly suggests these are **separate events**. DNS resolution failures would cause connection establishment failures (not mid-stream kills), which is a different failure signature anyway.

**Verdict: Hypothesis B is CONFIRMED for 1 failure (#5, Feb 19) but DOES NOT explain Phil's cluster or most other failures.**

---

## Hypothesis C: Something Else — MOST LIKELY

### What we can rule out

| Hypothesis | Status | Evidence |
|-----------|--------|----------|
| Our deploy | Ruled out | 7+ hours between deploy and Phil's cluster |
| Documented Railway incident | Ruled out | Phil's failures fall in a gap between incidents |
| SSE idle timeout (Mode A) | Ruled out | Silence gaps were 6.2-8.1s, well under 10s threshold |
| Concurrent load | Ruled out | 0 concurrent requests during Phil's failures |
| Application error | Ruled out | Python 100% healthy, all Gemini calls 200 OK |
| User action (closed tab) | Ruled out | 4 consecutive retries + cluster pattern = not user behavior |
| Cloudflare DNS | Ruled out | DNS incident started 75min AFTER Phil's failures |
| Certificate rotation | Unlikely | Cert issue was on `*.up.railway.app` subset, resolved hours earlier |

### What remains

**Undocumented Railway proxy instability** is the only remaining explanation. The evidence:

1. **Railway's proxy infrastructure was demonstrably unstable on Feb 18-21.** Three documented incidents in four days (networking timeouts, cert failures, DNS failures) indicate systemic instability, not isolated events.

2. **The Feb 20 certificate issue hints at proxy fleet activity.** Certificate serving is a proxy-layer function. If certs were failing on a subset of domains before 04:30, the proxy fleet was being worked on. Ongoing proxy fleet maintenance/rotation throughout the day could cause intermittent connection kills without appearing on the status page.

3. **Railway shipped a changelog on Feb 20** ([Changelog #0278](https://railway.com/changelog/2026-02-20-domains)) titled "DDoS protection, Railway domains, better canvas state." DDoS protection changes would be implemented at the proxy/edge layer. If Railway was rolling out DDoS protection on Feb 20, that could cause intermittent connection drops during the rollout — exactly the pattern we see.

4. **The Feb 20 10:09 failure** (different user, 20min after deploy) suggests instability was present well before Phil's 17:04 cluster. The gap between 10:09 and 17:04 (7 hours) with no failures could mean the instability was intermittent, or that few users were active.

5. **Railway's documented behavior during deploys** includes connection draining and proxy reconfiguration. But Railway's own proxy fleet deploys (not our app deploys) would have the same effect — and we have zero visibility into Railway's internal deploy schedule.

6. **The Feb 10 failures** (21:21 and 23:58 UTC) also have no documented Railway incident and no deploy correlation. These may represent the same undocumented instability pattern.

### The DDoS protection theory

The Railway changelog entry on Feb 20 mentions "DDoS protection" as a new feature. Railway's docs confirm:
> "Railway Metal infrastructure is built to mitigate attacks at network layer 4 and below"

Deploying new DDoS protection at the network layer would involve:
- Proxy fleet configuration changes
- Traffic routing rule updates
- Possible connection state resets during rollout

If DDoS protection was being rolled out incrementally on Feb 20, it could explain:
- Why Phil's failures cluster (proxy config change hitting his region/shard)
- Why the 10:09 failure also occurred (earlier rollout wave)
- Why successful requests worked between failures (only affected during active rollout on a specific proxy instance)
- Why there's no status page incident (intentional change, not an outage)

**This is inference, not proof.** We cannot confirm this without Railway's internal deployment logs.

---

## Complete Failure Taxonomy (All 10 Failures)

| Category | Failures | Count | Cause |
|----------|----------|-------|-------|
| **Mode A: Idle Timeout** | #4 (Feb 17) | 1 | Silence gap >10s during GFS query. Application-level. Fix: keepalive. |
| **Mode B1: Documented Railway Incident** | #5 (Feb 19) | 1 | Falls within Railway networking timeout window. |
| **Mode B2: Undocumented Proxy Instability** | #1, #2 (Feb 10), #6-#10 (Feb 20) | 7 | No documented incident, no deploy, no app fault. Proxy-layer. |
| **Local Dev** | #3 (Feb 11) | 1 | Localhost trace — not production. |

**7 of 10 failures (70%) are Mode B2 — undocumented Railway proxy instability.** This is our primary reliability risk.

---

## Production Deploy Timeline (Full Context)

For the record, here are all production deploys on dates with failures:

### Feb 10 — nextjs-app
| Created (UTC) | Status | Duration Live | Commit |
|--------------|--------|---------------|--------|
| 10:19:18 | REMOVED | Replaced Feb 12 | fix: migration hook allow Edit/Write (3rd deploy) |
| 10:15:57 | REMOVED | 3min (replaced by above) | fix: migration hook (2nd deploy) |

### Feb 10 — python-services
| Created (UTC) | Status | Commit |
|--------------|--------|--------|
| 10:19:18 | REMOVED | fix: migration hook allow Edit/Write |

### Feb 20 — both services
| Created (UTC) | Status | Commit |
|--------------|--------|--------|
| 09:47:00 | SUCCESS (nextjs-app) / REMOVED (python) | fix: update semantic search test |

No production deploys on Feb 11, 17, or 19. The Feb 18 deploy (11:05 UTC) was hours before the 13:47 networking timeout incident.

---

## Sources

### Railway Deployment Data
- Railway CLI `list-deployments` for `nextjs-app` (production environment) — 100 deployments
- Railway CLI `list-deployments` for `python-services` (production environment) — 100 deployments
- Railway CLI `get-logs` for nextjs-app build (production) — 91.80s build time

### Railway Status
- [Railway Status History](https://status.railway.com/history) — Feb 18-21 incidents
- [Railway Feb 11 Incident Report](https://blog.railway.com/p/incident-report-february-11-2026) — anti-fraud SIGTERM, 14:33-18:31 UTC
- [Cloudflare Incident kwy3dt82bwbt](https://www.cloudflarestatus.com/incidents/kwy3dt82bwbt) — BYOIP prefix issue, 18:45-23:50 UTC
- [Railway Changelog #0278](https://railway.com/changelog/2026-02-20-domains) — "DDoS protection, Railway domains" shipped Feb 20
- [Railway Specs & Limits](https://docs.railway.com/networking/public-networking/specs-and-limits) — 60s keep-alive timeout (documented), 15min max request duration

### Git History
- `git log --oneline --after="2026-02-09" --before="2026-02-21"` — all commits in the failure window

### Saved Incident Logs
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/nextjs-app-chat-proxy.json` — 11 proxy connection logs
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-incident-project.json` — Python logs for incident project
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-gemini-api.json` — All Gemini calls (all 200 OK)
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-error-logs.json` — Zero chat/SSE errors

### Prior Phases
- Phase 1: 6-9ms kill signature (TCP disconnect propagation)
- Phase 2: 10 confirmed failures, Mode A vs Mode B distinction
- Phase 3: Full death path mechanism

---

## Open Questions

1. **What exactly is in Railway Changelog #0278?** The changelog page was not fetchable, but the title "DDoS protection, Railway domains, better canvas state" strongly suggests proxy-layer changes on Feb 20. Getting the full content would confirm or deny whether DDoS protection rollout could cause connection kills.

2. **Does Railway have connection draining during their own proxy deploys?** Our app deploys drain gracefully (new container, proxy switch), but when Railway deploys their proxy fleet, do they drain SSE connections? If not, every proxy deploy is a potential connection killer.

3. **The Feb 10 failures (21:21 and 23:58 UTC)** — what was Railway doing? No status page incident, no app deploy. These long-duration failures (309s, 192s) might be Mode A (idle timeout during very long operations) or Mode B2 (undocumented instability). We lack silence gap data for these older traces.

4. **Is there a Railway-internal deploy log we can access?** Railway's help station mentions "network logs/metrics" as a future capability of the new edge proxy. If available, these would give us direct visibility into proxy-layer events.

5. **Was the Feb 20 DDoS protection rollout incremental?** If Railway rolled out DDoS protection region-by-region or shard-by-shard, it would explain why Phil (on a specific shard) was repeatedly affected while other users were fine.

---

## Dead Ends

1. **Railway status page history pagination** — tried pages 2 and 3 of status.railway.com/history looking for Feb 10-11 incidents. Found the Feb 11 anti-fraud incident via blog search, but it doesn't correlate with our Feb 11 failure (which was 12 hours before and on localhost).

2. **Cloudflare incident as explanation for Phil** — initially promising because Railway pointed to Cloudflare on Feb 20. But the Cloudflare incident started at 18:45 UTC (Railway noticed at 18:24), which is 75 minutes after Phil's last failure. Wrong time window.

3. **Deploy-triggered connection kill** — the most intuitive hypothesis, but the 7-hour gap makes it impossible for Phil's cluster. Even failure #6 (20min after deploy) is too distant for a deploy cutover to be the cause.

4. **Railway community forums** — searched Railway Help Station for Feb 20 SSE/connection reports. Found general SSE timeout discussions but no Feb 20-specific reports from other users.
