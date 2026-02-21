# Phase 2: Statistical Profile of SSE Stream Failures

## Summary

Stream failures are **invisible in the database** -- both `agent_usage` and `conversations` are written at the same code point (when the `result` event fires), so failed streams leave no trace in Supabase. The orientation's failure rate methodology (comparing `agent_usage` vs `conversations` counts) was based on a flawed assumption that `agent_usage` records all attempts. It does not. The only reliable source of truth for failures is **Sentry traces** where `span.status:internal_error` on `http.client` spans indicates a severed stream.

Sentry shows **10 confirmed stream failures** in the Feb 7-21 window. Failures cluster temporally (4 consecutive failures in 6 minutes on Feb 20), occur without concurrent load, and correlate with Railway platform incidents rather than any application-level pattern.

---

## Critical Methodology Correction

### The Orientation's Numbers Were Wrong

The Phase 0 orientation reported failure rates of 48% (Feb 10), 38.5% (Feb 11), etc., derived from:
> "A usage record without a matching conversation = likely failed stream"

**This methodology is invalid.** Code inspection reveals:

- **`agent_usage` and `conversations` are both written at the same point** -- inside the `stream_chat_response()` method in `chat_service.py` (lines 239-269), both fire as `asyncio.create_task()` when a `"result"` event is received.
- If the stream dies before the `result` event, **neither table gets a record**.
- Production data confirms: 74 unique sessions in `agent_usage` = 74 unique sessions in `conversations` for Feb 7-21. Zero orphans.

The apparent "failures" in the orientation came from comparing raw record counts (each message in a multi-turn conversation creates a separate `agent_usage` row) against unique session counts in `conversations`. This is an apples-to-oranges comparison.

### Correct Data Sources

| Source | What it captures | Captures failures? |
|--------|-----------------|-------------------|
| `agent_usage` table | Successful POST requests (got `result` event) | **No** |
| `conversations` table | Successful sessions (stream completed) | **No** |
| Sentry `internal_error` spans | Streams severed mid-flight | **Yes** |
| Railway logs | Application logs (~24h retention) | Partially |

**Sentry is the only reliable source of truth for stream failures.**

---

## Failure Inventory: 10 Confirmed Failures (Feb 7-21)

All from Sentry query: `span.status:internal_error /api/chat/stream` on `nextjs-app` project, 14d window.

| # | Timestamp (UTC) | Duration | Trace ID | Day | Notes |
|---|----------------|----------|----------|-----|-------|
| 1 | Feb 10, 21:21 | **308.6s** | `9f1f82774a6e` | Mon | http.server span, 1 error in trace |
| 2 | Feb 10, 23:58 | **192.4s** | `1b91a349a15b` | Mon | http.client, 5 spans |
| 3 | Feb 11, 02:09 | **61.8s** | `98e91643fb1d` | Tue | 39 spans in trace (complex), 1 error |
| 4 | Feb 17, 15:10 | **47.0s** | `7bae5f89b368` | Mon | Confirmed idle timeout (24s gap) |
| 5 | Feb 19, 15:05 | **8.2s** | `d5a19720dd8c` | Wed | Short failure |
| 6 | Feb 20, 10:09 | **21.0s** | `10f6503d4c29` | Thu | Different user than 7-10 |
| 7 | Feb 20, 17:04 | **25.1s** | `ea267c5692f6` | Thu | Phil Lau attempt 1 |
| 8 | Feb 20, 17:05 | **25.6s** | `0d3173a5f9ea` | Thu | Phil Lau attempt 2 |
| 9 | Feb 20, 17:05 | **15.4s** | `2dc4d3fec663` | Thu | Phil Lau attempt 3 |
| 10 | Feb 20, 17:09 | **16.2s** | `4643e777b81e` | Thu | Phil Lau attempt 4 |

### Temporal Distribution

| Date | Failures | Railway Incident |
|------|----------|-----------------|
| Feb 10 | 2 | Railway major outage next day |
| Feb 11 | 1 | Anti-fraud misconfiguration (9.5h outage) |
| Feb 12-16 | 0 | Calm period |
| Feb 17 | 1 | (Confirmed idle timeout -- Mode A) |
| Feb 18 | 0 | Railway "Public Networking Traffic Timeouts" |
| Feb 19 | 1 | Railway timeout issue continued |
| Feb 20 | 5 | Certificate + DNS failures (Cloudflare) |
| Feb 21 | 0 | |

---

## Distinguishing Characteristics

### 1. Duration: Failed Streams Are NOT Longer

| Metric | Failed (n=10) | Successful (n=197 DB records) |
|--------|--------------|-------------------------------|
| Mean | 72.1s | 35.8s |
| Median | **25.4s** | **24.1s** |
| Min | 8.2s | 1.4s |
| Max | 308.6s | 220.8s |
| Stdev | 98.4s | -- |

The **medians are nearly identical** (25.4s vs 24.1s). The mean is skewed by two very long-running failures on Feb 10 (192.4s, 308.6s). Excluding those outliers, the 8 remaining failures average 27.5s -- indistinguishable from the normal population.

**Verdict: Duration is not a predictor.** Streams fail at all durations. Short (8.2s) and long (308.6s) streams both fail. The failure mechanism is external to the application.

### 2. User Distribution: Concentrated

| User | Total DB Records | Known Failures | Notes |
|------|-----------------|----------------|-------|
| Phil Lau (`6331895e`) | 15 (all pre-Feb 7) | 4 (Feb 20) | Last success: Feb 3 |
| User `84fa4b3e` | 132 | 0 confirmed | Heaviest user, no failures in Sentry |
| User `7023dc9d` | 40 | 1-2 (Feb 20 10:09?) | Second heaviest |
| Other users | various | 1-4 | Feb 10-11 failures, user unknown |

Phil Lau accounts for 4 of 10 failures (40%), but this is a single incident -- 4 rapid retries over 6 minutes. The Feb 10-11 failures likely hit different users (Sentry doesn't include `user.email` in span data for these traces). The Feb 17 failure is a confirmed idle timeout (Mode A) from a different user.

**Verdict: Failure is not user-specific.** Phil Lau's cluster is a temporal event, not a user-targeting pattern.

### 3. Project Distribution

The Feb 20 Phil Lau failures all targeted project `102a412f` (Goals Gap Analysis), which uses file search (GFS). This project has file search stores that trigger multi-round GFS queries creating longer silence gaps.

However, the Feb 10-11 failures targeted different projects. The Feb 17 failure (confirmed idle timeout) also used file search.

**Verdict: Projects with file search are more vulnerable to Mode A (idle timeout) failures**, but Mode B failures hit regardless of project type.

### 4. Time of Day: No Clear Pattern

| Hour (UTC) | Total Spans | Failures | Failure Rate |
|------------|------------|----------|-------------|
| 02:00 | 3 | 0 | 0% |
| 10:00 | 19 | 1 | 5.3% |
| 15:00 | 20 | 1 | 5.0% |
| 17:00 | 8 | 4 | **50%** |
| 21:00 | ? | 1 | ? |
| 23:00 | ? | 1 | ? |

The 17:00 UTC spike is a single incident (Phil Lau's 4 retries). Other failures are scattered across the day. Note: 21:00 and 23:00 UTC failures (Feb 10) are outside our 100-span window so we don't know total volume at those hours.

**Verdict: No systematic time-of-day pattern.** The 17:00 spike is a single incident, not a recurring pattern.

### 5. Concurrency: Failures Occur in ISOLATION

5 of 6 recent failures (in our analysis window) had **zero concurrent requests**. The Feb 20 17:04-17:10 failures were the only active streams at the time. No other users were competing for resources.

The one exception: the Feb 19 15:05 failure had one concurrent successful stream (15:04, 12.7s).

**Verdict: Concurrency is NOT a factor.** Failures happen when the system is idle, not under load. This rules out resource contention, queue saturation, or connection pool exhaustion.

---

## The Feb 20 Incident Window (17:00-17:30 UTC)

| Time | Duration | Outcome | Notes |
|------|----------|---------|-------|
| 17:04:42 | 25.1s | FAILED | Phil Lau attempt 1 |
| 17:05:14 | 25.6s | FAILED | Attempt 2 (32s after attempt 1) |
| 17:05:45 | 15.4s | FAILED | Attempt 3 (31s after attempt 2) |
| 17:09:56 | 16.2s | FAILED | Attempt 4 (4min gap -- user frustration) |
| 17:32:56 | 8.3s | SUCCESS | Phil or another user, ~23min later |

All 4 failures had **silence gaps of 6.2-8.1s** (from the orientation doc) -- well under the 10s idle timeout. The Python side completed successfully (span.status:ok). This is definitively **Mode B** (infrastructure failure, not idle timeout).

Railway had certificate + DNS failures (Cloudflare-related) on Feb 20. The failure window aligns with this platform incident.

There were 53 total `http.client` spans visible in Sentry for Feb 20, with 5 failures (9.4% failure rate). However, this 53 includes spans from all hours; the failure rate during the 17:00 hour specifically was 4/5 = 80%.

### Was it just Phil?

Looking at the 10:09 failure (failure #6), which is 7 hours before Phil's cluster: it has a different trace pattern and occurred during a high-concurrency window (17 spans in the 10:xx hour). So at least one other user was affected on Feb 20.

---

## Two Failure Modes (Confirmed by Statistics)

### Mode A: SSE Idle Timeout (~10s silence)

**Confirmed failures:** 1 (Feb 17, 47.0s duration, 24s silence gap)
**Suspected failures:** Feb 10 long-duration failures (192.4s, 308.6s) may have hit the 15-minute hard limit or had extended silence gaps.

**Characteristics:**
- Longer duration streams (multi-round GFS queries)
- Silence gap > 10s between SSE events
- Projects with file search stores
- Fix: SSE keepalive comments every 5s (ENG-1938, not yet implemented)

### Mode B: Railway Infrastructure Failures

**Confirmed failures:** 5 (4x Phil Lau Feb 20, 1x Feb 19)
**Suspected failures:** Feb 10-11 failures (correlated with Railway outage)

**Characteristics:**
- Silence gaps under 10s (not idle timeout)
- Correlated with Railway platform incidents (cert/DNS, networking timeouts)
- No concurrent load
- No application errors
- No application-level fix exists; detection and resilience are the responses

---

## Production Database Overview (for context)

| Metric | Value |
|--------|-------|
| Total `agent_usage` records (all time) | 714 |
| Total unique sessions | 268 |
| Total users | 33 |
| Total projects | 44 |
| Date range | Dec 26, 2025 - Feb 21, 2026 |
| Mean request duration | 35.8s |
| Median request duration | 24.1s |

### Duration Distribution of Successful Streams (Feb 7-21)

| Bucket | Count | % |
|--------|-------|---|
| < 5s | 17 | 8.6% |
| 5-10s | 17 | 8.6% |
| 10-20s | 46 | 23.4% |
| 20-30s | 34 | 17.3% |
| 30-60s | 48 | 24.4% |
| 60-120s | 23 | 11.7% |
| 120s+ | 12 | 6.1% |

Most requests fall in the 10-60s range (65%). The 120s+ bucket (6.1%) represents long multi-turn sessions with multiple tool calls.

---

## Open Questions

1. **True total failure count is unknown.** Sentry only captures failures where the Next.js proxy received a response (HTTP 200) and then the stream was severed. Pre-connection failures (HTTP 502/503) or client-side-only failures would not appear as `internal_error` spans. The 10 confirmed failures are a lower bound.

2. **Feb 10 failure durations are anomalous.** 192.4s and 308.6s are far longer than any other failure. Were these long-running streams that hit the ~15-minute Railway hard limit? Or were they long-running streams that had an extended silence gap? The orientation doesn't have gap analysis for these older traces.

3. **Why did the original investigation report 48% failure rate on Feb 10?** The methodology was wrong (comparing raw record counts to unique sessions), but the *perception* of massive failures on Feb 10 may have come from user reports or other signals. Were there more failures that Sentry didn't capture?

4. **Phil Lau had zero successful DB records after Feb 3.** Did he not use the app between Feb 3 and Feb 20? Or did every attempt fail? If the latter, that suggests a persistent per-user issue (unlikely given Mode B is infrastructure-level).

5. **Sentry `user.email` is null for all failure spans.** This is because the Next.js chat proxy doesn't set Sentry user context from the request body. Adding `user_id` to Sentry context in the proxy would help future failure attribution (partially addressed by ENG-1902 on the Python side, but the Next.js side still needs it).

---

## Sources

### Database Queries (Production)
- Supabase Management API: `POST /v1/projects/becbrfnfxrgezhtkrsrm/database/query`
- Tables: `agent_usage`, `conversations`
- Join key: `claude_session_id` (shared between tables)

### Sentry Queries
- `span.status:internal_error /api/chat/stream` on `nextjs-app` (14d, returned 10 results)
- `span.op:http.client span.description:*python-services.railway.internal*` on `nextjs-app` (14d, 100 results, window Feb 19-21)
- `span.op:http.server transaction:/api/chat/stream` on `python-fastapi` (14d, 100 results, window Feb 16-21)
- Individual trace inspection via `sentry trace show <trace-id> --spans`

### Code Files
- `/workspaces/test-mvp/python-services/agent_api/chat_service.py` -- lines 239-269: `agent_usage` and `conversations` both fire on `result` event
- `/workspaces/test-mvp/python-services/agent_api/usage_service.py` -- `record_usage()` implementation
- `/workspaces/test-mvp/python-services/agent_api/conversation_service.py` -- `persist_session()` implementation
- `/workspaces/test-mvp/python-services/agent_api/api/chat.py` -- SSE event generator with gap logging

### Railway Logs (Preserved)
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/nextjs-app-chat-proxy.json`
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-incident-project.json`

### Prior Investigation
- `/workspaces/test-mvp/.claude/research/network-incident/phase-00-orientation.md`

## Dead Ends

1. **`agent_usage` vs `conversations` comparison** -- The core methodology from the orientation was invalid. Both tables write at the same code point, making the comparison meaningless. Every session in `agent_usage` has a matching `conversations` record. Failed streams are invisible in both.

2. **Searching for `user.email` in failed Sentry spans** -- All `user.email` fields are null. The Next.js proxy doesn't set Sentry user context.

3. **Attempting to use `mcp__supabase-staging__execute_sql` for production queries** -- The staging MCP tool queries the staging database, not production. Had to use the Supabase Management API directly via curl.
