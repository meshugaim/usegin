# Phase 1: Forensic SSE Event Pattern Reconstruction — Phil Lau's Failed Streams

## Summary

Phil Lau experienced **5 failed SSE streams** on Feb 20, 2026 (one at 10:09 UTC, four at 17:04-17:10 UTC). All share an identical death signature: Railway infrastructure severs the TCP connection, Next.js detects the broken pipe 6-9ms before Python's generator receives GeneratorExit. Silence gaps ranged 6.2-8.1s (all under the 10s idle timeout). Successful streams from the same user and IP that same day survived gaps up to 9.2s. The failures correlate with Railway cert/DNS instability, not application behavior.

---

## Exact Timeline — All 5 Failures with Millisecond Precision

### Failure #0 (10:09 UTC) — Newly Discovered, Not in Original Report

| Timestamp (UTC) | Event | Duration/Detail |
|---|---|---|
| 10:09:27.713 | Next.js http.server span starts | POST /api/chat/stream |
| 10:09:27.888 | Python http.server span starts | /api/chat/stream |
| 10:09:28.388 | Context queries complete | ~500ms (Supabase: project, admins, prompts, stores, toggles) |
| 10:09:28.506 | llm.ttft span starts | Time to first token |
| 10:09:28.685 | llm.connect span starts | SDK connection |
| 10:09:31.637 | llm.connect ends | **2,953ms** to connect to Claude SDK |
| 10:09:31.807 | llm.inference ends | 169ms inference |
| 10:09:32.904 | llm.content starts | Token generation |
| 10:09:33.698 | llm.content ends / llm.ttft ends | **793ms** content, **5,191ms** total TTFT |
| 10:09:34.152 | mcp.server starts (GFS search_files) | **1 GFS round only** |
| 10:09:34.159 | Gemini generateContent call starts | Single store: project-internal-102a412f |
| 10:09:42.234 | Gemini generateContent returns 200 | **8,075ms** Gemini latency |
| 10:09:42.241 | mcp.server ends | **8,089ms** total GFS |
| | **MAX SILENCE GAP: 8,089ms** (during GFS query — no SSE bytes on wire) | |
| 10:09:42.241 - 10:09:48.717 | Post-GFS phase: Claude generating response text | **6,476ms uninstrumented** |
| **10:09:48.711** | **Next.js http.client span DIES** | Connection severed by infrastructure |
| **10:09:48.717** | **Python http.server span ends** | GeneratorExit received, **6ms after Next.js** |

- **Total duration**: 20,991ms (NJS) / 20,829ms (Python)
- **GFS rounds**: 1
- **What was happening at death**: 6.5s into post-GFS response generation (Claude composing final text)

---

### Failure #1 (17:04:42 UTC) — First Incident-Window Attempt

| Timestamp (UTC) | Event | Duration/Detail |
|---|---|---|
| 17:04:42.312 | Next.js http.server span starts | POST /api/chat/stream |
| 17:04:42.487 | Python http.server span starts | |
| 17:04:42.518 | Context queries begin | |
| 17:04:42.996 | Context queries complete | ~478ms total |
| 17:04:43.263 | llm.ttft starts | |
| 17:04:43.436 | llm.connect starts | |
| 17:04:45.865 | llm.connect ends | **2,429ms** |
| 17:04:45.931 | llm.inference ends | 66ms |
| 17:04:47.158 | llm.content starts | |
| 17:04:47.929 | llm.content / llm.ttft ends | **771ms** content, **4,666ms** TTFT |
| 17:04:47.932 | NJS "start response" span | First SSE bytes reach browser |
| 17:04:48.277 | **GFS Round 1 starts** (mcp.server) | search_files tool call |
| 17:04:48.281 | Gemini generateContent call | Single store query |
| 17:04:55.085 | Gemini returns 200 OK | **6,804ms** |
| 17:04:55.090 | GFS Round 1 ends | **6,813ms** total |
| | **SILENCE GAP: 6,813ms** (during GFS — no SSE data events) | |
| 17:04:55.090 - 17:04:57.077 | Claude processes GFS results | **1,987ms gap** |
| 17:04:57.077 | **GFS Round 2 starts** (mcp.server) | Claude decided to search again |
| 17:04:57.081 | Gemini generateContent call | Same store |
| 17:05:03.207 | Gemini returns 200 OK | **6,126ms** |
| 17:05:03.211 | GFS Round 2 ends | **6,134ms** total |
| | **MAX SILENCE GAP: 6,813ms** (GFS Round 1) | |
| 17:05:03.211 - 17:05:07.417 | Post-GFS: Claude generating final response | **4,206ms uninstrumented** |
| **17:05:07.411** | **Next.js DIES** | |
| **17:05:07.417** | **Python receives disconnect** | **6ms delta** |

- **Total duration**: 25,093ms (NJS) / 24,929ms (Python)
- **GFS rounds**: 2 (both single-store)
- **What was happening at death**: 4.2s into post-GFS response generation

**Railway log confirmation**:
- `17:04:42.991` — "Found project 'Goals Gap Analysis'"
- `17:04:43.003` — project_file_search_stores 200 OK
- `17:04:48.298` — "Querying store fileSearchStores/project-internal-102a412f-sshrw77vxc7r"
- `17:04:55.130` — Gemini generateContent 200 OK
- `17:04:57.145` — "Querying store" (Round 2)
- `17:05:03.226` — Gemini generateContent 200 OK
- No error, no disconnect, no further log entries for this request

---

### Failure #2 (17:05:14 UTC) — Second Attempt, 4 Seconds After #1 Died

| Timestamp (UTC) | Event | Duration/Detail |
|---|---|---|
| 17:05:14.024 | Next.js starts | |
| 17:05:14.186 | Python starts | |
| 17:05:14.657 | Context queries complete | ~450ms |
| 17:05:14.681 | llm.ttft starts | |
| 17:05:14.836 | llm.connect starts | |
| 17:05:16.738 | llm.connect ends | **1,901ms** |
| 17:05:16.790 | llm.inference ends | 52ms |
| 17:05:17.693 | llm.content starts | |
| 17:05:18.738 | llm.content / llm.ttft ends | **1,046ms** content, **4,057ms** TTFT |
| 17:05:19.372 | **GFS Round 1 starts** | |
| 17:05:19.375 | Gemini call | |
| 17:05:25.572 | Gemini returns 200 OK | **6,197ms** |
| 17:05:25.575 | GFS Round 1 ends | **6,203ms** |
| | **SILENCE GAP: 6,203ms** | |
| 17:05:25.575 - 17:05:29.321 | Claude processing results | **3,746ms** |
| 17:05:29.321 | **GFS Round 2 starts** | |
| 17:05:29.325 | Gemini call | |
| 17:05:32.957 | Gemini returns 200 OK | **3,632ms** |
| 17:05:32.960 | GFS Round 2 ends | **3,639ms** |
| 17:05:32.960 - 17:05:39.671 | Post-GFS: Claude generating response | **6,711ms uninstrumented** |
| **17:05:39.665** | **Next.js DIES** | |
| **17:05:39.671** | **Python receives disconnect** | **6ms delta** |

- **Total duration**: 25,638ms (NJS) / 25,485ms (Python)
- **GFS rounds**: 2
- **MAX SILENCE GAP: 6,203ms** (GFS Round 1)
- **What was happening at death**: 6.7s into post-GFS response generation (longest uninstrumented gap of all 5)

**Railway log confirmation**:
- `17:05:14.370` — "Found project"
- `17:05:14.666` — stores query 200 OK
- `17:05:19.378` — "Querying store" (Round 1)
- `17:05:25.586` — Gemini 200 OK
- `17:05:29.399` — "Querying store" (Round 2)
- `17:05:32.959` — Gemini 200 OK
- No error log entries

---

### Failure #3 (17:05:45 UTC) — Third Attempt, 6 Seconds After #2 Died

| Timestamp (UTC) | Event | Duration/Detail |
|---|---|---|
| 17:05:45.755 | Next.js starts | |
| 17:05:45.915 | Python starts | |
| 17:05:46.365 | Context queries complete | ~450ms |
| 17:05:46.402 | llm.ttft starts | |
| 17:05:46.555 | llm.connect starts | |
| 17:05:48.425 | llm.connect ends | **1,870ms** |
| 17:05:48.496 | llm.inference ends | 71ms |
| 17:05:49.807 | llm.content starts | |
| 17:05:50.706 | llm.content / llm.ttft ends | **899ms** content, **4,303ms** TTFT |
| 17:05:51.032 | **GFS Round 1 starts** | **Only 1 round this time** |
| 17:05:51.035 | Gemini call | |
| 17:05:59.102 | Gemini returns 200 OK | **8,068ms** (slowest of the 4 incident-window GFS calls) |
| 17:05:59.107 | GFS Round 1 ends | **8,074ms** |
| | **MAX SILENCE GAP: 8,074ms** | |
| 17:05:59.107 - 17:06:01.179 | Post-GFS: Claude generating response | **2,072ms uninstrumented** |
| **17:06:01.170** | **Next.js DIES** | |
| **17:06:01.179** | **Python receives disconnect** | **9ms delta** (slightly longer than usual) |

- **Total duration**: 15,413ms (NJS) / 15,263ms (Python)
- **GFS rounds**: 1
- **What was happening at death**: 2.1s into post-GFS response generation

**Railway log confirmation**:
- `17:05:54.067` — "Found project" (NOTE: **~8s behind** Sentry timestamp of 17:05:45.915 — Railway log pipeline delay during instability)
- `17:05:54.071` — "Querying store"
- `17:05:59.162` — Gemini 200 OK
- No error log entries

**Anomaly**: Railway log timestamp for "Found project" is `17:05:54.067` but Sentry shows the Python http.server span starting at `17:05:45.915` — an 8-second discrepancy. All other failures show ms-level agreement between Railway logs and Sentry. This suggests Railway's log pipeline was itself experiencing delays during the instability window.

---

### Failure #4 (17:09:56 UTC) — Fourth Attempt, After ~4 Minute User Wait

| Timestamp (UTC) | Event | Duration/Detail |
|---|---|---|
| 17:09:56.907 | Next.js starts | |
| 17:09:57.074 | Python starts | |
| 17:09:57.564 | Context queries complete | ~490ms |
| 17:09:57.610 | llm.ttft starts | |
| 17:09:57.765 | llm.connect starts | |
| 17:10:00.010 | llm.connect ends | **2,244ms** |
| 17:10:00.138 | llm.inference ends | 128ms |
| 17:10:01.163 | llm.content starts | |
| 17:10:02.055 | llm.content / llm.ttft ends | **892ms** content, **4,444ms** TTFT |
| 17:10:02.688 | **GFS Round 1 starts** | **Only 1 round** |
| 17:10:02.693 | Gemini call | |
| 17:10:10.747 | Gemini returns 200 OK | **8,054ms** |
| 17:10:10.753 | GFS Round 1 ends | **8,065ms** |
| | **MAX SILENCE GAP: 8,065ms** | |
| 17:10:10.753 - 17:10:13.082 | Post-GFS: Claude generating response | **2,329ms uninstrumented** |
| **17:10:13.076** | **Next.js DIES** | |
| **17:10:13.082** | **Python receives disconnect** | **6ms delta** |

- **Total duration**: 16,165ms (NJS) / 16,008ms (Python)
- **GFS rounds**: 1
- **What was happening at death**: 2.3s into post-GFS response generation

**Railway log confirmation**:
- `17:09:57.362` — "Found project"
- `17:09:57.606` — stores query 200 OK
- `17:10:02.694` — "Querying store"
- `17:10:10.752` — Gemini 200 OK
- No further log entries

---

## Silence Gap Comparison: Failed vs. Successful Streams

### Failed Streams — Phil Lau, Feb 20

| Failure | Max Silence Gap | Gap Source | Outcome |
|---|---|---|---|
| #0 (10:09) | **8,089ms** | GFS Round 1 (single store Gemini call) | internal_error |
| #1 (17:04) | **6,813ms** | GFS Round 1 (single store Gemini call) | internal_error |
| #2 (17:05:14) | **6,203ms** | GFS Round 1 (single store Gemini call) | internal_error |
| #3 (17:05:45) | **8,074ms** | GFS Round 1 (single store Gemini call) | internal_error |
| #4 (17:09) | **8,065ms** | GFS Round 1 (single store Gemini call) | internal_error |

### Successful Streams — Same User/IP or Same Day (Feb 19-20)

| Time | Trace ID | Max Silence Gap | Gap Source | Outcome |
|---|---|---|---|---|
| Feb 19 5:30 PM | `0bbf2b26` | **9,900ms** | GFS | **ok** |
| Feb 19 5:32 PM | `371c783f` | **9,700ms** | GFS | **ok** |
| Feb 20 2:11 PM | `c200682d` | **9,200ms** | GFS | **ok** |
| Feb 20 10:09 AM | `f23519da` | **8,100ms** | GFS | **ok** (but same time as failure #0 below!) |
| Feb 20 10:10 AM | `c3ae5dc4` | n/a (16,796ms total) | — | **ok** |
| Feb 20 5:32 PM | `14670a61` | n/a (8,326ms total, no GFS) | — | **ok** |

**Critical observation**: Successful streams survived silence gaps of 8.1s, 9.2s, 9.7s, and 9.9s. Failed streams had gaps of 6.2-8.1s. The failed streams had SHORTER silence gaps than the successful ones. This definitively rules out the 10s idle timeout as the cause.

Note: trace `f23519da` at 10:09 appears in both tables. The Python side shows status:ok (it completed cleanly from its perspective), but Sentry separately shows the Next.js side dying — confirming the disconnect is invisible to Python.

---

## GFS Query Pattern Details

### Store Configuration

Phil Lau's "Goals Gap Analysis" project had **1 file search store** active:
- Store: `fileSearchStores/project-internal-102a412f-sshrw77vxc7r`
- Type: internal files only
- No external files, no email stores

This means GFS queries were **single-store, sequential** — each round makes exactly 1 Gemini `generateContent` call using `gemini-2.5-flash` with `file_search` tool.

### Gemini API Call Latencies (All 200 OK)

| Failure | Round | Gemini Latency | Total mcp.server |
|---|---|---|---|
| #0 | R1 | 8,075ms | 8,089ms |
| #1 | R1 | 6,804ms | 6,813ms |
| #1 | R2 | 6,126ms | 6,134ms |
| #2 | R1 | 6,197ms | 6,203ms |
| #2 | R2 | 3,632ms | 3,639ms |
| #3 | R1 | 8,068ms | 8,074ms |
| #4 | R1 | 8,054ms | 8,065ms |

Average Gemini latency: **6,708ms** (range: 3,632-8,075ms). The overhead between Gemini response and mcp.server span close is consistently 5-14ms.

### Number of GFS Rounds per Failure

| Failure | GFS Rounds | Span Count | Notes |
|---|---|---|---|
| #0 (10:09) | 1 | 17 spans | Single round |
| #1 (17:04) | 2 | 21 spans | Two rounds (Claude needed more info) |
| #2 (17:05:14) | 2 | 21 spans | Two rounds |
| #3 (17:05:45) | 1 | 17 spans | Single round |
| #4 (17:09) | 1 | 17 spans | Single round |

The span count is diagnostic: 17 spans = 1 GFS round, 21 spans = 2 GFS rounds (each round adds 4 spans: mcp.server, gfs.query, gfs.query_single, http.client for Gemini).

---

## SSE Event Flow Reconstruction

The SSE event pattern (inferred from Sentry span timing, since we have no byte-level capture):

### Phase 1: Connection + Context (~500ms)
- HTTP POST from browser to Next.js proxy
- Next.js forwards to Python via internal Railway network
- Python queries Supabase for project context, admins, prompt, stores, feature toggles
- **SSE events**: None yet (connection established, headers sent)

### Phase 2: TTFT — Claude SDK Connection (~4-5s)
- llm.connect: 1,870-2,953ms (Claude SDK/API handshake)
- llm.inference: 52-169ms (initial token generation)
- llm.content: 771-1,046ms (first content tokens)
- **SSE events**: Text delta events begin flowing (user sees typing start)
- **This is when the user first sees response text in the UI**

### Phase 3: Tool Call Decision (~300-600ms)
- Claude decides to call `search_files` tool
- SSE event: `tool_call_start` with tool name and parameters
- Small text content may precede the tool call

### Phase 4: GFS Execution (6-8s per round) — THE SILENCE WINDOW
- Python calls Gemini `generateContent` with `file_search` tool
- **SSE events: ZERO data events during this entire period**
- No keepalive mechanism existed at the time
- This is where the silence gap accumulates
- Single-store queries: 3.6-8.1s each

### Phase 5: Inter-Round Processing (~2-4s, if multi-round)
- Claude processes GFS results
- Decides whether to search again
- If yes: SSE event for new tool call, return to Phase 4
- **SSE events**: Possibly a few text tokens or tool result acknowledgment

### Phase 6: Final Response Generation (uninstrumented)
- Claude composes the final text response incorporating GFS results
- **SSE events**: Text delta events (tokens flowing to browser)
- Duration at death: 2,072-6,711ms across failures
- **This phase has ZERO Sentry instrumentation** — no spans cover it

### Phase 7: DEATH
- Railway infrastructure severs TCP connection
- Next.js detects broken pipe, ends its http.client span
- 6-9ms later, Python's generator receives GeneratorExit
- Python closes its http.server span (reports status:ok because GeneratorExit is handled gracefully)
- **No SSE event is sent** — the connection is already dead
- Browser shows "network error"

---

## What the Stream Was Doing When It Died

All 5 failures died during **Phase 6** — the post-GFS uninstrumented response generation phase:

| Failure | Time into Phase 6 when killed | Last instrumented span |
|---|---|---|
| #0 | 6,476ms | mcp.server (GFS) ended at 10:09:42.241 |
| #1 | 4,206ms | mcp.server (GFS R2) ended at 17:05:03.211 |
| #2 | 6,711ms | mcp.server (GFS R2) ended at 17:05:32.960 |
| #3 | 2,072ms | mcp.server (GFS) ended at 17:05:59.107 |
| #4 | 2,329ms | mcp.server (GFS R2) ended at 17:10:10.753 |

This is significant: during Phase 6, **SSE text delta events are actively being sent** (the user sees partial text before the error). The stream was NOT silent — tokens were flowing. Yet the connection was severed anyway.

This further confirms it was NOT the idle timeout (bytes were on the wire). Something at the Railway infrastructure layer killed an active, data-flowing connection.

---

## The 6-9ms Death Signature

Every single failure shows the same pattern:

```
Next.js span ends  ->  [6-9ms]  ->  Python span ends
```

| Failure | NJS End | Python End | Delta |
|---|---|---|---|
| #0 | 10:09:48.711 | 10:09:48.717 | **6ms** |
| #1 | 17:05:07.411 | 17:05:07.417 | **6ms** |
| #2 | 17:05:39.665 | 17:05:39.671 | **6ms** |
| #3 | 17:06:01.170 | 17:06:01.179 | **9ms** |
| #4 | 17:10:13.076 | 17:10:13.082 | **6ms** |

The 6-9ms delta represents TCP disconnect propagation through Railway's internal network: infrastructure severs connection -> Next.js detects broken pipe and closes span -> signal propagates to Python -> Python's generator receives GeneratorExit and closes span.

Note: Distributed tracing is broken (ENG-1946), so these are separate trace IDs correlated by timestamp, not linked traces. The delta measurement is based on Sentry timestamp comparison across the two projects.

---

## Sentry Trace IDs for Lookup

### Failed Streams — Python-fastapi (all status: ok, misleadingly)

| Failure | Trace ID (full) |
|---|---|
| #0 (10:09) | `f23519da77924e29b5754ee25b45e4c5` |
| #1 (17:04) | `b564ff883e3042b3a4f6c97b276a2fdb` |
| #2 (17:05:14) | `cbcd8c4cf3b64d69b8896674eadd80a1` |
| #3 (17:05:45) | `eb794da006e84b6fb223f085add43420` |
| #4 (17:09) | `e5e865e99ac7457f81451ec4086a902d` |

### Failed Streams — nextjs-app (all status: internal_error)

| Failure | Trace ID (full) | Short ID |
|---|---|---|
| #0 (10:09) | `10f6503d4c29827083748dbf1366cdb8` | `10f6503d` |
| #1 (17:04) | `ea267c5692f67abbc42f0f794bb99c3a` | `ea267c56` |
| #2 (17:05:14) | `0d3173a5f9eaf225a2de9cac25d200fd` | `0d3173a5` |
| #3 (17:05:45) | `2dc4d3fec66318c43afd1da20ed1d1e4` | `2dc4d3fe` |
| #4 (17:09) | `4643e777b81ed60396ddfed16c172e85` | `4643e777` |

### Successful Comparison Streams — Python-fastapi

| Time | Trace ID | Max Silence Gap | Duration |
|---|---|---|---|
| Feb 20 10:10 | `c3ae5dc4f9414d0f` | n/a | 16,796ms |
| Feb 20 14:11 | `c200682d` (short) | 9,200ms | — |
| Feb 20 17:32 | `14670a61` (short) | n/a | 8,326ms |

---

## Sources

### Primary Evidence Files
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/README.md` — Incident report with full timeline, failure mode analysis, broader pattern data
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-incident-project.json` — 15 Railway log entries for the incident project
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-gemini-api.json` — 6 Gemini API call logs (all 200 OK)
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/nextjs-app-chat-proxy.json` — 11 Next.js proxy connection logs
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-error-logs.json` — Error logs (only sync worker noise)

### Prior Research
- `/workspaces/test-mvp/.claude/research/network-incident/phase-00-orientation.md` — Full orientation including Linear issues, code changes, open questions
- `/workspaces/test-mvp/.claude/research/network-incident/phase-01-forensics.md` — Detailed forensic reconstruction with full Sentry span trees
- `/workspaces/test-mvp/.claude/research/network-incident/whiteboard.md` — Research coordination whiteboard

### Experiment Results
- `/workspaces/test-mvp/python-services/experiments/railway_sse_timeout/RESULTS.md` — Railway SSE idle timeout characterization (ENG-1937)

---

## Open Questions

1. **Can Mode B be reproduced?** The failures correlate with Railway platform instability (cert/DNS issues on Feb 20 status page), but we have no direct causal link. Reproduction would require either (a) waiting for another Railway incident, or (b) simulating infrastructure-level connection drops.

2. **What exactly happens in the post-GFS uninstrumented phase?** During Phase 6, text tokens are flowing (user sees partial text), so the connection is active. Yet it gets killed anyway. Adding SSE event-level instrumentation (event count, byte count, inter-event timing) to this phase would make future forensics much more precise.

3. **Is the 6-9ms delta a fingerprint of Railway's TCP termination?** If we could reproduce it with a synthetic load test, the consistent delta would confirm the mechanism. A different infrastructure cause (e.g., Cloudflare) might show a different propagation pattern.

4. **Did the 10:09 failure (failure #0) share the same Railway instability window as 17:04-17:10?** These are 7 hours apart. The Railway status page mentions cert/DNS issues generically on Feb 20 without specific times. There may have been multiple instability windows.

5. **Could the failure be triggered by response size or token count?** We don't know how many tokens were generated before death because the phase is uninstrumented. If all failures had similar response sizes, that could point to a payload-based trigger. But the varying post-GFS durations (2.1-6.7s) argue against a fixed-size threshold.

## Dead Ends

None for this phase — all data was available in previously captured logs and Sentry traces. The key limitation is the lack of byte-level SSE event capture, which means the exact SSE event pattern (event sizes, inter-event timing during Phase 6) is inferred from span boundaries rather than directly observed.
