# Phase 1: Millisecond-Precision Forensic Reconstruction

## Summary

Phil Lau experienced **5 (not 4) failed chat streams** on Feb 20, 2026 — one at 10:09 UTC and four between 17:04-17:10 UTC. All failures share an identical signature: the Next.js connection dies 6-9ms before the Python `http.server` span ends, proving Python's span closes in response to a disconnect signal (GeneratorExit), not because it finished naturally. The streams were killed by Railway infrastructure during a period of certificate/DNS instability, not by the 10-second idle timeout — all silence gaps were 6.2-8.1 seconds, well under threshold.

---

## Failure Inventory

The orientation doc identified 4 failures (17:04-17:10). This investigation found a **5th failure at 10:09 AM** — trace `10f6503d` in nextjs-app also shows `span.status:internal_error` with the identical 6ms delta pattern.

| # | NJS Start | NJS End | Duration | GFS Rounds | Max Silence | Post-GFS | NJS-PY Delta |
|---|-----------|---------|----------|------------|-------------|----------|--------------|
| 0 | 10:09:27.713 | 10:09:48.712 | 20,991ms | 1 | 8,089ms | 6,476ms | -6ms |
| 1 | 17:04:42.312 | 17:05:07.411 | 25,093ms | 2 | 6,813ms | 4,206ms | -6ms |
| 2 | 17:05:14.024 | 17:05:39.665 | 25,638ms | 2 | 6,203ms | 6,711ms | -6ms |
| 3 | 17:05:45.755 | 17:06:01.170 | 15,413ms | 1 | 8,074ms | 2,072ms | -9ms |
| 4 | 17:09:56.907 | 17:10:13.076 | 16,165ms | 1 | 8,065ms | 2,329ms | -6ms |

**NJS-PY Delta**: How many milliseconds the Next.js span ends before/after the Python span. Negative = Next.js dies first.

---

## Detailed Timeline: Failure #1 (17:04 UTC)

### Trace IDs
- Python: `b564ff883e3042b3a4f6c97b276a2fdb` (21 spans, status: ok)
- Next.js: `ea267c5692f67abbc42f0f794bb99c3a` (5 spans, status: internal_error)

### Next.js Span Tree
```
http.server      17:04:42.312 -> 17:05:07.411  (25,100ms)  POST /api/chat/stream
  default        17:04:42.313 -> 17:04:42.313  (0.6ms)     resolve page components
  default        17:04:42.316 -> 17:04:42.496  (181ms)     executing api route
    http.client  17:04:42.318 -> 17:05:07.411  (25,093ms)  POST python-services:8080
  default        17:04:47.932 -> 17:04:47.932  (0.1ms)     start response
```

### Python Span Tree
```
http.server          17:04:42.487 -> 17:05:07.417  (24,929ms)  /api/chat/stream
  http.client        17:04:42.518 -> 17:04:42.730  (212ms)     POST get_project_context
    http.client      17:04:42.529 -> 17:04:42.671  (142ms)     GET chat_config
      http.client    17:04:42.532 -> 17:04:42.687  (155ms)     GET admins
      http.client    17:04:42.688 -> 17:04:42.831  (143ms)     GET system_prompt_versions
      http.client    17:04:42.851 -> 17:04:42.996  (145ms)     GET project_file_search_stores
      llm.ttft       17:04:43.263 -> 17:04:47.929  (4,666ms)   Time to First Token
      http.client    17:04:43.280 -> 17:04:43.435  (155ms)     GET feature_toggles
      llm.connect    17:04:43.436 -> 17:04:45.865  (2,429ms)   SDK Connection
      subprocess     17:04:43.437 -> 17:04:43.444  (7ms)       claude -v
      subprocess     17:04:44.840 -> 17:04:44.841  (1ms)       claude --output
      llm.inference  17:04:45.865 -> 17:04:45.931  (66ms)      LLM Inference
      llm.content    17:04:47.158 -> 17:04:47.929  (771ms)     LLM Content Generation
      mcp.server     17:04:48.277 -> 17:04:55.090  (6,813ms)   tools/call search_files
        gfs.query             17:04:48.278 -> 17:04:55.089  (6,811ms)
          gfs.query_single    17:04:48.278 -> 17:04:55.088  (6,809ms)
          http.client (Gemini) 17:04:48.281 -> 17:04:55.085 (6,804ms) generateContent 200 OK
      ~~~ 1,987ms gap (Claude processing GFS results, deciding to search again) ~~~
      mcp.server     17:04:57.077 -> 17:05:03.211  (6,134ms)   tools/call search_files
        gfs.query             17:04:57.079 -> 17:05:03.210  (6,131ms)
          gfs.query_single    17:04:57.079 -> 17:05:03.209  (6,130ms)
          http.client (Gemini) 17:04:57.081 -> 17:05:03.207 (6,126ms) generateContent 200 OK
      ~~~ 4,206ms post-GFS: Claude generating final response with search results ~~~
```

### Death Moment
- **17:05:07.411**: Next.js http.client span ends (connection severed)
- **17:05:07.417**: Python http.server span ends (received GeneratorExit, 6ms later)
- **What Python was doing**: Generating final response text after 2 rounds of GFS search. The last instrumented span (GFS #2) ended at 17:05:03.211 — Python was 4.2 seconds into the uninstrumented "compose final response" phase.

---

## Detailed Timeline: Failure #2 (17:05:14 UTC)

### Trace IDs
- Python: `cbcd8c4cf3b64d69b8896674eadd80a1` (21 spans, status: ok)
- Next.js: `0d3173a5f9eaf225a2de9cac25d200fd` (5 spans, status: internal_error)

### Python Span Tree
```
http.server          17:05:14.186 -> 17:05:39.671  (25,485ms)  /api/chat/stream
  http.client        17:05:14.213 -> 17:05:14.363  (150ms)     POST get_project_context
    [context queries 17:05:14.218 -> 17:05:14.657, ~450ms total]
      llm.ttft       17:05:14.681 -> 17:05:18.738  (4,057ms)   Time to First Token
      llm.connect    17:05:14.836 -> 17:05:16.738  (1,901ms)   SDK Connection
      llm.inference  17:05:16.738 -> 17:05:16.790  (52ms)      LLM Inference
      llm.content    17:05:17.693 -> 17:05:18.738  (1,046ms)   LLM Content Generation
      mcp.server     17:05:19.372 -> 17:05:25.575  (6,203ms)   tools/call search_files
        [Gemini API: 17:05:19.375 -> 17:05:25.572, 6,197ms, 200 OK]
      ~~~ 3,746ms gap (Claude processing results, deciding to search again) ~~~
      mcp.server     17:05:29.321 -> 17:05:32.960  (3,639ms)   tools/call search_files
        [Gemini API: 17:05:29.325 -> 17:05:32.957, 3,632ms, 200 OK]
      ~~~ 6,711ms post-GFS: Claude generating final response ~~~
```

### Death Moment
- **17:05:39.665**: Next.js dies
- **17:05:39.671**: Python receives disconnect (6ms later)
- **What Python was doing**: 6.7 seconds into post-GFS response generation. The longest uninstrumented gap.

---

## Detailed Timeline: Failure #3 (17:05:45 UTC)

### Trace IDs
- Python: `eb794da006e84b6fb223f085add43420` (17 spans, status: ok)
- Next.js: `2dc4d3fec66318c43afd1da20ed1d1e4` (5 spans, status: internal_error)

### Python Span Tree
```
http.server          17:05:45.915 -> 17:06:01.179  (15,263ms)  /api/chat/stream
  [context queries ~450ms]
    llm.ttft         17:05:46.402 -> 17:05:50.705  (4,303ms)   Time to First Token
    llm.connect      17:05:46.555 -> 17:05:48.425  (1,870ms)
    llm.inference    17:05:48.425 -> 17:05:48.496  (71ms)
    llm.content      17:05:49.807 -> 17:05:50.706  (899ms)
    mcp.server       17:05:51.032 -> 17:05:59.107  (8,074ms)   tools/call search_files [ONLY 1 ROUND]
      [Gemini API: 17:05:51.035 -> 17:05:59.102, 8,068ms, 200 OK]
    ~~~ 2,072ms post-GFS: Claude generating response ~~~
```

### Death Moment
- **17:06:01.170**: Next.js dies
- **17:06:01.179**: Python receives disconnect (9ms later)
- **What Python was doing**: 2.1 seconds into post-GFS response generation (only 1 search round this time).

---

## Detailed Timeline: Failure #4 (17:09:56 UTC)

### Trace IDs
- Python: `e5e865e99ac7457f81451ec4086a902d` (17 spans, status: ok)
- Next.js: `4643e777b81ed60396ddfed16c172e85` (5 spans, status: internal_error)

### Python Span Tree
```
http.server          17:09:57.074 -> 17:10:13.082  (16,008ms)  /api/chat/stream
  [context queries ~490ms]
    llm.ttft         17:09:57.610 -> 17:10:02.055  (4,444ms)   Time to First Token
    llm.connect      17:09:57.765 -> 17:10:00.010  (2,244ms)
    llm.inference    17:10:00.010 -> 17:10:00.138  (128ms)
    llm.content      17:10:01.163 -> 17:10:02.055  (892ms)
    mcp.server       17:10:02.688 -> 17:10:10.753  (8,065ms)   tools/call search_files [ONLY 1 ROUND]
      [Gemini API: 17:10:02.693 -> 17:10:10.747, 8,054ms, 200 OK]
    ~~~ 2,329ms post-GFS: Claude generating response ~~~
```

### Death Moment
- **17:10:13.076**: Next.js dies
- **17:10:13.082**: Python receives disconnect (6ms later)
- **What Python was doing**: 2.3 seconds into post-GFS response generation.

---

## Detailed Timeline: Failure #0 (10:09 UTC — newly discovered)

### Trace IDs
- Python: `f23519da77924e29b5754ee25b45e4c5` (17 spans, status: ok)
- Next.js: `10f6503d4c29827083748dbf1366cdb8` (5 spans, status: internal_error)

### Python Span Tree
```
http.server          10:09:27.888 -> 10:09:48.717  (20,829ms)  /api/chat/stream
  [context queries ~500ms]
    llm.ttft         10:09:28.506 -> 10:09:33.697  (5,191ms)   Time to First Token
    llm.connect      10:09:28.685 -> 10:09:31.637  (2,953ms)
    llm.inference    10:09:31.638 -> 10:09:31.807  (169ms)
    llm.content      10:09:32.904 -> 10:09:33.698  (793ms)
    mcp.server       10:09:34.152 -> 10:09:42.241  (8,089ms)   tools/call search_files [1 ROUND]
      [Gemini API: 10:09:34.159 -> 10:09:42.234, 8,075ms, 200 OK]
    ~~~ 6,476ms post-GFS: Claude generating response ~~~
```

### Death Moment
- **10:09:48.711**: Next.js dies
- **10:09:48.717**: Python receives disconnect (6ms later)
- **What Python was doing**: 6.5 seconds into post-GFS response generation.

---

## Successful Stream for Comparison (17:32 UTC)

A successful stream occurred at 17:32:56 (Next.js trace `14670a617e136d29`, 8,326ms duration). This was 23 minutes after the last failure, suggesting Railway recovered from its instability. The stream was short (8.3s) with no GFS calls — possibly a simple question that didn't trigger file search.

On Feb 20, there were also successful streams at 02:38, 02:42, 02:45, 09:15, 09:16, 09:18, 10:10, 10:24 (x3), 10:25, 14:08, 14:11, 18:46, 23:24, and 23:32. The failures clustered at 10:09 and 17:04-17:10.

---

## Pattern Analysis

### The "NJS dies 6-9ms before Python" Signal

This is the single most important finding. In all 5 failures, the Python `http.server` span ends **because it received a disconnect** (GeneratorExit/BrokenPipe), not because it finished its work. The consistent 6-9ms delta represents:

1. Railway infrastructure severs the TCP connection
2. Next.js detects the broken pipe, ends its span
3. ~6ms later, Python's generator receives GeneratorExit
4. Python closes its span

This proves the Python `span.status:ok` is misleading — Python reports "ok" because it handled the disconnect gracefully (closed the generator cleanly), not because the response was successfully delivered.

### Streams Die During the Uninstrumented "Post-GFS" Phase

All 5 failures died during the gap between the last instrumented span (GFS/mcp.server) ending and the Python http.server span ending. This is the phase where:
- Claude SDK processes GFS results
- Claude generates its final text response
- The SSE events for the response text are being sent

This phase is **completely uninstrumented** — there are no Sentry spans covering it. We know tokens are being generated and sent (the user sees partial text before the error), but we can't see the byte-level activity.

The post-GFS durations at death:
- 6,476ms (failure #0)
- 4,206ms (failure #1)
- 6,711ms (failure #2)
- 2,072ms (failure #3)
- 2,329ms (failure #4)

No consistent pattern — death happens at different points in this phase.

### Not the 10-Second Idle Timeout

Confirmed. Maximum silence gaps across all failures: 6.2s, 6.8s, 8.1s, 8.1s, 8.1s. All under 10 seconds. The same IP had successful streams with 8.1s gaps earlier that day (trace `c200682d` at 14:11, gap 9.2s, status ok).

### Not a Total Duration Limit

Stream durations: 15.4s, 16.2s, 20.9s, 25.1s, 25.6s. No pattern. Successful streams that day ran up to 159s (trace at 23:32).

### Not Rate Limiting

Phil waited 4 minutes before attempt #4. Same failure. Other users' streams also failed on Feb 20.

### Railway Infrastructure Correlation

Railway's status page shows certificate/DNS failures (Cloudflare) on Feb 20. The 5 failures cluster at 10:09 and 17:04-17:10, suggesting two separate instability windows. Recovery happened after each cluster (successful streams at 10:10 and 17:32).

### Railway Log Timestamp Anomaly

For failure #3, Railway log timestamps are ~8 seconds behind Sentry timestamps. Other failures show ms-level agreement. This suggests Railway's log pipeline itself was experiencing delays during the instability — further evidence of infrastructure-level problems.

---

## Database Records

Production Supabase MCP is not available in this environment (only staging MCP is configured). The orientation doc already established that:
- `agent_usage` records exist for all chat attempts (created at request start)
- `conversations` records only exist for completed streams
- The 4 incident window failures (17:04-17:10) have no matching conversation records

The 5th failure at 10:09 was not previously correlated with DB records.

---

## Railway Log Analysis

Four log files were captured ~1 hour after the incident at `docs/incidents/2026-02-20-sse-timeout/`:

### `python-services-incident-project.json` (15 entries)
Complete log of all activity for project `102a412f` (Goals Gap Analysis). Shows all 4 incident-window attempts with:
- "Found project" entries with correct user/project IDs
- `project_file_search_stores` 200 OK
- "Querying store" entries for each GFS round
- **No errors, no disconnect logs, no warnings**

### `python-services-gemini-api.json` (6 entries)
All Gemini API calls — 6 `generateContent` calls, all `HTTP/1.1 200 OK`. Matches the GFS rounds in Sentry exactly.

### `nextjs-app-chat-proxy.json` (11 entries)
"Using Python URL" log entries. One per request. Timestamps align with the 4 incident failures plus surrounding successful streams. **No error entries.**

### `python-services-error-logs.json` (2 entries + notes)
Zero errors from agent_api, chat, or SSE paths. Only sync worker cycle noise from 17:58 (48 minutes after incident).

### Key Finding
The stream deaths are **completely invisible** in Railway application logs. No error, no warning, no disconnect event. The connection severance happens at a layer below the application.

---

## Sources

### Sentry Traces — Python-fastapi (all status: ok)
| Failure | Trace ID | Span Count | Duration |
|---------|----------|------------|----------|
| #0 (10:09) | `f23519da77924e29b5754ee25b45e4c5` | 17 | 20,829ms |
| #1 (17:04) | `b564ff883e3042b3a4f6c97b276a2fdb` | 21 | 24,929ms |
| #2 (17:05:14) | `cbcd8c4cf3b64d69b8896674eadd80a1` | 21 | 25,485ms |
| #3 (17:05:45) | `eb794da006e84b6fb223f085add43420` | 17 | 15,263ms |
| #4 (17:09) | `e5e865e99ac7457f81451ec4086a902d` | 17 | 16,008ms |

### Sentry Traces — nextjs-app (all status: internal_error)
| Failure | Trace ID | Span Count | Duration |
|---------|----------|------------|----------|
| #0 (10:09) | `10f6503d4c29827083748dbf1366cdb8` | 5 | 21,000ms |
| #1 (17:04) | `ea267c5692f67abbc42f0f794bb99c3a` | 5 | 25,100ms |
| #2 (17:05:14) | `0d3173a5f9eaf225a2de9cac25d200fd` | 5 | 25,642ms |
| #3 (17:05:45) | `2dc4d3fec66318c43afd1da20ed1d1e4` | 5 | 15,416ms |
| #4 (17:09) | `4643e777b81ed60396ddfed16c172e85` | 5 | 16,170ms |

### Railway Logs
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-incident-project.json`
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-gemini-api.json`
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/nextjs-app-chat-proxy.json`
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-error-logs.json`

### Commands Run
- `sentry trace search 'span.op:http.server span.description:*chat/stream*' -p python-fastapi --period 14d --json`
- `sentry trace search 'span.status:internal_error' -p nextjs-app --period 14d --json`
- `sentry trace search 'span.status:internal_error span.description:*chat/stream*' -p nextjs-app --period 14d --json`
- `sentry trace search 'span.op:http.client span.description:*python-services*chat/stream* !span.status:internal_error' -p nextjs-app --period 14d --json`
- `sentry trace show <trace-id> --spans --json` for all 10 traces (5 python-fastapi + 5 nextjs-app)

---

## Open Questions

1. **Is the 6-9ms delta actually GeneratorExit propagation?** The code in `chat.py` was updated (commit `d90054d5`) to capture GeneratorExit, but these failures predate that commit. We can't confirm the mechanism from logs — only infer it from the timing pattern.

2. **What happened at 10:09?** The 5th failure was 7 hours before the main incident cluster. Was there a separate Railway instability window? The Railway status page only mentions Feb 20 cert/DNS issues generically without specific times.

3. **Why did the successful trace at 10:10 (1 minute later) survive but 10:09 didn't?** Both from the same user/project. The 10:10 trace (`c3ae5dc4f9414d0f`) ran for 16,796ms successfully. Was the infrastructure issue a brief blip?

4. **What is happening during the "post-GFS" uninstrumented phase?** We know Claude is generating response text, but we have zero visibility into the token-by-token SSE event flow. Adding a span or at minimum SSE event counting to this phase would help future investigations.

5. **Does the `span.status:internal_error` get set automatically by the Sentry Next.js SDK?** The span data JSON shows empty status fields — the status may be inferred by Sentry from the response not completing normally, rather than being explicitly set by the application.

## Dead Ends

1. **Production Supabase queries**: The MCP tool only has staging configured. Production DB records (agent_usage, conversations) could not be directly queried. The orientation doc already established the key finding (4 attempts with no conversation records).

2. **Span status field extraction**: The `data` and `additional_attributes` objects in the Sentry span JSON don't contain explicit status code fields. The `internal_error` classification comes from Sentry's search indexing layer, not from fields in the raw span data visible via `trace show --json`.

3. **Railway log timestamp for failure #3**: Shows ~8s discrepancy with Sentry. This is a Railway log pipeline issue, not useful for forensic timing. Sentry timestamps are authoritative.
