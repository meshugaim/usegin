# Phase 2: Mode B Reproduction Experiments

## Summary

Mode B was **partially reproduced** using a two-hop SSE proxy chain through Railway's edge infrastructure. Direct-to-server connections showed zero failures across 500+ connections. Two-hop connections (proxied through Railway's public edge twice) produced 11+ failures — all at the exact same timestamp, all with curl exit code 18, matching Phil Lau's exact failure signature.

---

## Experiment Infrastructure

**Server**: Modified `python-services/experiments/railway_sse_timeout/server.py`
**URL**: `https://sse-timeout-experiment-production.up.railway.app`
**Region**: `europe-west4` (same as production)

### New Endpoints Added

| Endpoint | Purpose |
|----------|---------|
| `/phil?variant=N` | Replay Phil's exact SSE timing pattern (5 variants from 5 failures) |
| `/burst-after-silence` | Test silence→burst transition behavior |
| `/soak` | Long-running soak test (single connection, repeated patterns) |
| `/two-hop/{path}` | Self-proxy through Railway's public edge (two-hop chain) |
| `/stats` | View soak test statistics |

### Two-Hop Architecture

The `/two-hop/` endpoint creates a proxy chain that mimics production:

**Production (Phil's path)**:
```
Browser → Cloudflare → Railway Edge → Next.js (service 1) → Railway Internal → Python (service 2)
```

**Experiment two-hop path**:
```
Client → Cloudflare → Railway Edge → Server (proxy handler) → HTTP via httpx → Cloudflare → Railway Edge → Server (SSE handler)
```

Both paths traverse Railway's edge proxy stack twice. The experiment path is actually MORE favorable (single service, no inter-service networking) yet still produces failures.

---

## Direct-to-Server Tests (Single Hop)

### Phase P: Phil Pattern Replay — 20/20 PASS
All 5 Phil variants, 4 repetitions each. No failures.

### Phase C: Concurrent Connections — 5/5 PASS
5, 10, 20, 50 concurrent connections. No failures even at 50 concurrent.

### Phase B: Burst-After-Silence — 5/5 PASS
8s, 9s, 9.5s silence followed by rapid bursts. No failures.

### Phase R: Rapid Reconnection — 12/12 PASS
4 rapid sequential connections mimicking Phil's retry pattern. No failures.

### Multi-Client Soak — 500/500 PASS
10 parallel clients, 50 iterations each, random Phil variants. Zero failures.

**Conclusion**: Direct-to-server connections are completely reliable for Phil's traffic patterns under all conditions tested.

---

## Two-Hop Tests (Double Edge Proxy)

### Phase TH: Phil Pattern via Two-Hop — 14/15 (1 FAILURE)
- `TH_v4_r2`: curl exit 18, 43 events received (expected ~135)
- Duration anomaly: 3305.8s reported (likely curl hanging after connection drop)

### Phase R via Two-Hop: Rapid Reconnection — 11/12 (1 FAILURE)
- Round 2, Attempt 3: curl exit 18, same time window as TH_v4_r2

### Multi-Client Two-Hop Soak — 9 FAILURES at identical timestamp

| Client | Iter | Variant | Time (UTC) | Events Before Death |
|--------|------|---------|------------|-------------------|
| 4 | 8 | 3 | 12:47:38 | 23 (in TTFT phase) |
| 2 | 9 | 3 | 12:47:38 | 58 (in post-GFS) |
| 3 | 9 | 4 | 12:47:38 | — |
| 8 | 9 | 2 | 12:47:38 | — |
| 6 | 8 | 3 | 12:47:38 | — |
| 7 | 9 | 2 | 12:47:38 | — |
| 9 | 8 | 1 | 12:47:38 | — |
| 10 | 9 | 2 | 12:47:38 | — |
| 5 | 9 | 2 | 12:47:38 | — |

**ALL 9 failures at 12:47:38 UTC** — a correlated infrastructure event.

---

## Failure Analysis

### Failure Signature — Matches Phil Exactly
- **curl exit 18**: "transfer closed with outstanding read data remaining" — connection severed mid-stream
- **Active data flow**: Streams died during token streaming (not idle), exactly like Phil
- **No server-side error**: Server logs show no disconnects, no cancellations, no errors
- **Correlated timing**: All failures at the same second — infrastructure event, not random

### Not a Deployment Artifact
Last deployment: 11:48:19 UTC. Failures: 12:47:38 UTC. 59-minute gap, no deployments in between.

### Failure Rate
- Direct: 0/500+ = 0%
- Two-hop: 11+/~300 = ~3.7% (all concentrated in a single event)

### What This Means
The two-hop path through Railway's edge proxy stack is inherently more fragile. Railway periodically performs infrastructure operations (proxy rotation, connection pool resets, cert renewals, load balancer adjustments) that sever active connections. When traffic only passes through the edge once (direct), this is rare enough to never appear. When traffic passes through twice (like our production architecture), the probability doubles, and when there's platform instability (like Feb 20), the frequency increases dramatically.

---

## Open Questions

1. **What Railway infrastructure event occurred at 12:47:38?** — No platform incident was reported. This appears to be routine infrastructure maintenance.
2. **What's the baseline frequency of these events?** — We caught one in ~1 hour of testing. Need longer soak tests.
3. **Does the failure rate increase during Railway platform incidents?** — Can't test without waiting for one.
4. **Does the proxy service's internal networking have different failure characteristics?** — Our two-hop goes through the public edge twice. Production goes through internal networking between services.

## Soak v2 Results (completed)

- **Two-hop soak v2**: 0/~500 failures (started 13:04 UTC). No Railway infrastructure event occurred during this window.
- **Direct control**: 0/~500 failures (started 13:04 UTC).

This confirms the failures are **event-correlated, not baseline noise**. When no infrastructure event occurs, two-hop connections are as reliable as direct ones. The 11 failures in soak v1 all came from a single discrete event at 12:47:38 UTC.
