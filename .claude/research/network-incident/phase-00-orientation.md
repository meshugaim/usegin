# Phase 0: Orientation — SSE Stream Timeout Incident

## Summary

On Feb 20, 2026 (~17:04-17:10 UTC), user Phil Lau attempted to chat 4 times in the "Goals Gap Analysis" project. Each time the SSE stream silently died, showing "Couldn't respond to your message - network error." All conversation content was permanently lost.

Investigation revealed this is a **chronic problem, not a one-time incident**, with stream failures dating back to at least Feb 10 and a 48% failure rate on the worst day. Two distinct failure modes were identified.

---

## What Happened (User Experience)

- **User:** Phil Lau (user_id: `6331895e-...`, email: lau@urbaninsight.com)
- **Project:** Goals Gap Analysis (id: `102a412f-...`)
- **Environment:** Production (`production-f045.up.railway.app`)
- **Time:** 17:04-17:10 UTC, Feb 20, 2026
- The user asked about "leadership touchpoints" — each attempt triggered GFS file search tool calls
- Each attempt: partial response started, then the SSE connection was silently severed
- User saw "network error" with no recovery option. All 4 conversations permanently lost.
- After attempt 3, the user waited ~4 minutes before trying again (attempt 4), suggesting frustration

## What Was Investigated

### 1. Sentry Traces (Both Projects)
- **nextjs-app:** 10 `internal_error` traces found across Feb 10-20. Each shows `http.client` span to `python-services.railway.internal:8080` with `internal_error` on an HTTP 200 — the stream started fine, then was severed.
- **python-fastapi:** Zero errors. Every `/api/chat/stream` trace shows `span.status:ok`. All Gemini API calls returned 200 OK.
- **Conclusion:** The Python backend was always healthy. The break is always outside the application.

### 2. Railway Logs (Preserved Before Expiry)
- Application logs captured ~1 hour after incident at `docs/incidents/2026-02-20-sse-timeout/`
- 4 files: `python-services-incident-project.json`, `python-services-gemini-api.json`, `nextjs-app-chat-proxy.json`, `python-services-error-logs.json`
- No errors in any of them. Only routine sync worker noise in error logs.
- All GFS queries and Gemini API calls completed successfully (200 OK).

### 3. Broader Failure Pattern (Feb 10-20)
Cross-referencing `agent_usage` against `conversations` (only written after stream completes):

| Date | Chats | Failed | Rate | Notes |
|------|-------|--------|------|-------|
| Feb 10 | 50 | 24 | **48%** | Railway major outage next day |
| Feb 11 | 13 | 5 | 38.5% | Railway anti-fraud outage (9.5h) |
| Feb 12 | 8 | 2 | 25% | |
| Feb 14-17 | 43 | 1 | **~2%** | Calm period (Railway stable) |
| Feb 18 | 17 | 3 | **17.6%** | Railway "Public Networking Traffic Timeouts" |
| Feb 20 | 10 | 2 | **20%** | Reported incident |

Multiple users/projects affected. Not isolated to one account.

### 4. Railway SSE Timeout Experiment (ENG-1937)
A dedicated experiment deployed a minimal SSE server to Railway and systematically tested:
- **Idle timeout:** ~10 seconds (no bytes on wire for >=11s kills the stream)
- **Total duration:** ~15 minutes hard limit
- **Keepalive effectiveness:** SSE comment lines (`: keepalive\n\n`) at <=10s intervals fully reset the idle timer
- **Recommended safe interval:** 5 seconds
- **Key finding:** Railway docs claim "60-second keep-alive timeout" but actual threshold is 6x more aggressive

### 5. Sentry Span Gap Analysis
Measuring silence gaps between SSE events to test the idle timeout theory:

**Streams that survived (barely):** max gaps of 8.1s, 9.2s, 9.7s, 9.9s — all under 10s
**Streams killed by idle timeout:** Feb 17 trace had a 24s gap (single GFS query)
**Feb 20 incident (NOT explained by idle timeout):** All 4 failures had gaps of 6.2-8.1s — under the 10s threshold. Same IP had successful streams with 8.1s gaps earlier that day.

## What Was Found / Root Cause Analysis

### Two Confirmed Failure Modes

**Mode A: Railway ~10s SSE idle timeout**
- Confirmed by experiment (ENG-1937) and corroborated by Feb 17 trace (24s gap killed)
- Cause: Multi-round GFS file search creates 13-18s silence (Claude thinking + GFS query + result processing)
- Fix: SSE keepalive comments every 5 seconds (ENG-1938) — NOT YET IMPLEMENTED

**Mode B: Unknown infrastructure failures**
- The Feb 20 incident was Mode B. Silence gaps were 6.2-8.1s (under 10s threshold)
- Connections died during a period that correlates with Railway platform incidents (cert/DNS issues on Feb 20)
- No application-level fix exists
- Better detection (Sentry capture, silence gap logging, client-side reporting) would quantify impact

### Railway Platform Incidents (Overlapping)
| Date | Railway incident |
|------|-----------------|
| Feb 11 | Anti-fraud misconfiguration (9.5h outage) |
| Feb 18 | "Public Networking Traffic Timeouts" |
| Feb 19 | Same issue recurred (~7h) |
| Feb 20 | Certificate + DNS failures (Cloudflare) |

## What Remains Unknown or Uncertain

1. **What specifically kills Mode B connections?** Railway proxy logs would tell us, but we don't have them and Railway hasn't been contacted yet (ENG-1939).
2. **Client-side details of failures?** Zero Sentry replays, zero client-side error reports (Sentry client SDK blocked by ad blockers or the same network issue).
3. **Exact idle timeout threshold precision?** Experiment tested 10s (pass) vs 11s (fail), but real-world jitter exists. Streams surviving at 9.9s is close to the edge.
4. **Why did the ENG-1938 description originally say "50-80+ seconds" idle timeout?** This was corrected after the experiment showed 10s, but the original issue description may still have stale numbers.
5. **Is Railway's 10s idle timeout consistent or variable?** Could it tighten during platform stress?
6. **ENG-1816 (SSE parser bug):** A separate bug where the client-side SSE parser fails on chunk boundaries ~50% of complex responses. This was fixed (commit `57bf7b59`) but is a different failure mode — JSON parse errors, not network errors. May still contribute to user-perceived "failures."

## Linear Issues Tracking This

### Parent Issue
- **ENG-1935** — `bug: SSE stream timeout during multi-round GFS file search — user conversation lost` (Backlog, unassigned)

### Sub-Issues of ENG-1935

| Issue | Title | Status | Notes |
|-------|-------|--------|-------|
| **ENG-1937** | experiment: characterize Railway SSE timeout thresholds | **Done** | Confirmed 10s idle, 15min total |
| **ENG-1940** | chore: add stream lifecycle logging to chat event generator | **Done** | GeneratorExit logging, event counts |
| **ENG-1941** | chore: add timing logs for GFS queries and Claude API rounds | **Done** | Descoped — Sentry already covers it |
| **ENG-1942** | chore: add structured logging to Next.js chat proxy | **Done** | Start/end logs with context |
| **ENG-1938** | fix: add SSE heartbeat to prevent idle timeout | **Backlog** | THE FIX for Mode A — not implemented |
| **ENG-1943** | feat: persist partial conversations on stream failure | **Backlog** | Prevents data loss on any failure |
| **ENG-1948** | feat: server-side stream error reporting endpoint (phone home) | **Backlog** | Client-side "phone home" for failures |
| **ENG-1954** | fix: capture mid-stream SSE failures to Sentry in Next.js proxy | **Backlog** | try/catch in pull() callback |
| **ENG-1939** | chore: request Railway proxy logs for incident window | **Backlog** | Human action — contact Railway support |

### Related Issues (Not Sub-Issues)
- **ENG-1902** — add user/project context to chat Sentry spans (Backlog) — partial fix landed in `ed0b155a`
- **ENG-1904** — recover chat response on mid-stream failure instead of regenerating (Backlog) — depends on ENG-1943
- **ENG-1946** — distributed tracing broken between Next.js and Python (Backlog) — separate trace IDs per service
- **ENG-1947** — production incident debug runbook for agents (Done) — `.claude/rules/incident-debug-runbook.md`
- **ENG-1816** — SSE stream parser fails on chunk boundaries (Backlog) — client-side JSON parse bug, separately fixed

## Code Changes Already Made

### Commit `ed0b155a` — Stream lifecycle logging (ENG-1940, ENG-1942, ENG-1902)
**Files:** `python-services/agent_api/api/chat.py`, `python-services/agent_api/chat_service.py`, `nextjs-app/app/api/chat/stream/route.ts`
- Python: stream end summary with event counts, duration, termination reason; exception logging
- Python: Sentry user/project/session tags on chat spans
- Next.js: structured start/end logging with user context, duration, status

### Commit `d90054d5` — SSE silence gap logging + Sentry capture (ENG-1935)
**Files:** `python-services/agent_api/api/chat.py`, `docs/incidents/.../README.md`
- Warns when SSE silence gap > 10s
- Captures GeneratorExit to Sentry (was only logging to Railway)
- Includes `max_silence` and `silence_at_death` measurements
- Updated incident docs with two-failure-mode analysis

### Commit `1f0045a8` — Railway SSE timeout experiment (ENG-1937)
**Files:** `python-services/experiments/railway_sse_timeout/` (server.py, run_tests.sh, RESULTS.md, Dockerfile)
- Full experiment code and results

### Commit `fefdb4b3` — Production incident debug runbook (ENG-1947)
**Files:** `.claude/rules/incident-debug-runbook.md`
- Auto-loaded rule for all agents investigating production issues

### Commit `d8ecc520` — Bump Sentry session replay + update incident doc
- Sentry session replay bumped to 100%

### What Has NOT Been Implemented Yet
- **SSE heartbeat/keepalive** (ENG-1938) — the primary fix for Mode A failures
- **Partial conversation persistence** (ENG-1943) — prevents data loss
- **Client-side phone home** (ENG-1948) — reliable failure reporting
- **Next.js proxy Sentry capture** (ENG-1954) — try/catch in pull() callback
- **Railway proxy log request** (ENG-1939) — human action item

## Sources

- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/README.md`
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/nextjs-app-chat-proxy.json`
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-gemini-api.json`
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-incident-project.json`
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/python-services-error-logs.json`
- `/workspaces/test-mvp/python-services/agent_api/api/chat.py` (current state)
- `/workspaces/test-mvp/nextjs-app/app/api/chat/stream/route.ts` (current state)
- `/workspaces/test-mvp/python-services/experiments/railway_sse_timeout/RESULTS.md`
- Linear issues: ENG-1935, ENG-1937, ENG-1938, ENG-1939, ENG-1940, ENG-1941, ENG-1942, ENG-1943, ENG-1946, ENG-1947, ENG-1948, ENG-1954, ENG-1902, ENG-1904, ENG-1816
- Git commits: `d90054d5`, `ed0b155a`, `1f0045a8`, `fefdb4b3`, `d8ecc520`

## Open Questions

1. Should the keepalive (ENG-1938) be implemented in Python or Next.js? The ENG-1938 description says Python, but the Next.js proxy is also a valid injection point.
2. How does the keepalive interact with the ReadableStream proxy in Next.js? Will SSE comments pass through transparently?
3. For partial persistence (ENG-1943), what's the right granularity? Per-event? Per-tool-call-round?
4. Is the ~2% baseline failure rate during calm periods (Feb 14-17) acceptable, or does that also need investigation?
5. Has the ENG-1816 SSE parser fix (commit `57bf7b59`) been deployed to production? If not, some "network error" reports might actually be parser failures.
