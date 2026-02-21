# Phase 3: SSE Stream Death Propagation Mechanism

## Summary

When Railway's proxy severs the TCP connection mid-stream, the death propagates through three layers with different behaviors: (1) Next.js proxy's `reader.read()` rejects with an error, Sentry's fetch instrumentation marks the `http.client` span as `internal_error` because `handlerData.error` is set instead of `handlerData.response`; (2) Python receives `GeneratorExit` from uvicorn when the ASGI send channel breaks, but Sentry has already set `span.status:ok` from the initial HTTP 200 `http.response.start` event; (3) the browser's `reader.read()` throws a `TypeError` caught by the `useChat` hook's catch block. Conversation persistence never fires because the `result` event is never yielded.

## The Full Death Path

### Step 0: Normal Operation (before death)

The SSE stream involves four actors connected by three TCP links:

```
Browser <--TCP1--> Railway Edge <--TCP2--> Next.js Proxy <--TCP3--> Python API
```

In Railway's architecture, TCP2 and TCP3 may traverse Railway's internal proxy/mesh, which is the entity that actually kills connections.

### Step 1: Railway Kills the Connection

Railway's proxy severs the TCP connection between the Next.js container and the Python container (or between Railway's edge and the Next.js container — we can't distinguish). The critical point: this happens at the TCP level, not at the HTTP/SSE level. There is no graceful HTTP signal.

**Evidence:** Phase 1 forensics showed 6-9ms span deltas between Next.js and Python spans ending, consistent with TCP RST propagation, not application-level coordination.

### Step 2: Python Side — GeneratorExit with Misleading `ok` Status

**File:** `/workspaces/test-mvp/python-services/agent_api/api/chat.py` (lines 34-119)

The endpoint returns a `StreamingResponse(event_generator(), ...)`. When the TCP connection breaks:

1. **Uvicorn/Starlette detects the broken connection.** The ASGI `send` channel raises an error when trying to write the next chunk. Starlette's `StreamingResponse.body_iterator` loop catches this and calls `.athrow(GeneratorExit)` or `.aclose()` on the async generator.

2. **The `event_generator()` receives `GeneratorExit`** at whatever `yield` statement it was suspended on. The code explicitly catches this (lines 89-99):

   ```python
   except GeneratorExit:
       duration = time.monotonic() - start_time
       total = sum(event_counts.values())
       silence_since_last = time.monotonic() - last_yield_time
       msg = (
           f"Stream cancelled {ctx} — {total} events in {duration:.1f}s, "
           f"reason=GeneratorExit, max_silence={max_silence_gap:.1f}s, "
           f"silence_at_death={silence_since_last:.1f}s"
       )
       logger.warning(msg)
       sentry_sdk.capture_message(msg, level="warning")
   ```

   This was added in commit `d90054d5` (ENG-1935). Before that commit, GeneratorExit was completely silent — not logged, not captured.

3. **Why Python Sentry shows `span.status:ok`:** The Sentry ASGI middleware (`sentry_sdk.integrations.asgi`, lines 239-250) sets the transaction status based on the `http.response.start` ASGI event:

   ```python
   async def _sentry_wrapped_send(event):
       if transaction is not None:
           is_http_response = (
               event.get("type") == "http.response.start"
               and "status" in event
           )
           if is_http_response:
               transaction.set_http_status(event["status"])
       return await send(event)
   ```

   The `http.response.start` event with `status=200` is sent **before any body bytes**. So Sentry sees status 200 and sets `span.status:ok`. The subsequent connection death never updates this — there is no ASGI event for "connection died mid-stream." The Sentry SDK has no hook into the generator lifecycle.

4. **What does NOT happen:** The `except Exception` block in `event_generator()` (lines 101-109) is NOT triggered by GeneratorExit. In Python, `GeneratorExit` inherits from `BaseException`, not `Exception`. This is why the "done" event is never sent — the normal completion path (line 79: `yield {'type': 'done'}`) is skipped entirely.

5. **Consequence: No conversation persistence.** The `result` event (which triggers both `record_usage` and `persist_session` in `chat_service.py` lines 239-269) is only emitted by `agent.stream_response()` at the end of `_process_messages()`. When GeneratorExit kills the outer generator, the inner generator chain is also torn down. The `result` event is never yielded, so `persist_session` is never called.

### Step 3: Next.js Proxy — The Source of `internal_error`

**File:** `/workspaces/test-mvp/nextjs-app/app/api/chat/stream/route.ts` (lines 1-95)

The proxy uses a `ReadableStream` that reads from the upstream Python response:

```typescript
const reader = upstream.getReader();
const loggedStream = new ReadableStream({
    async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
            controller.close();
            return;
        }
        controller.enqueue(value);
    },
    cancel() {
        reader.cancel();
    },
});
return new Response(loggedStream, { headers: { ... } });
```

When Railway kills the upstream connection:

1. **`reader.read()` rejects.** The `await reader.read()` call in the `pull()` function throws an error (likely a `TypeError: terminated` or similar from the fetch body stream being prematurely closed). This error is **unhandled** within the `pull()` function — there is no try/catch around `reader.read()`.

2. **The error propagates to the ReadableStream.** An unhandled error in `pull()` puts the ReadableStream into an errored state. The Response object now represents a partially-written, errored stream.

3. **The route handler itself already returned successfully.** The `POST` function returned `new Response(loggedStream, ...)` immediately after setting up the stream. The HTTP 200 status and headers were already sent to the browser. The `try/catch` at lines 81-94 only catches errors from `fetch()` itself (connection refused, DNS failure, etc.) — not errors that happen later during streaming.

**How `internal_error` gets set on the Sentry span:**

There are **two distinct Sentry spans** on the Next.js side:

**Span A: `http.server` (the route handler transaction)**

Sentry wraps route handlers via `wrapRouteHandlerWithSentry` (file: `@sentry/nextjs/build/esm/common/wrapRouteHandlerWithSentry.js`). After the handler returns, it reads `response.status`:

```javascript
const response = await handleCallbackErrors(
    () => originalFunction.apply(thisArg, args),
    error => { ... captureException ... },
    () => { waitUntil(flushSafelyWithTimeout()); },
);
try {
    if (response.status) {
        setHttpStatus(activeSpan, response.status);
        setHttpStatus(rootSpan, response.status);
    }
} catch { /* best effort */ }
```

The handler returns a Response with status 200 (the streaming body hasn't started yet). So `setHttpStatus(span, 200)` is called, which sets `span.status:ok`. The later stream error does NOT update this.

However, `handleCallbackErrors` will catch if the handler promise rejects. In our case it resolves (the Response object was created successfully).

**Span B: `http.client` (the outbound fetch to Python)**

This is created by Sentry's `nativeNodeFetchIntegration` (via OpenTelemetry's `UndiciInstrumentation`) or by the fetch instrumentation in `@sentry/core/build/esm/fetch.js`. The `endSpan` function (line 235-251) is the critical piece:

```javascript
function endSpan(span, handlerData) {
    if (handlerData.response) {
        setHttpStatus(span, handlerData.response.status);
        // ... content-length handling ...
    } else if (handlerData.error) {
        span.setStatus({ code: SPAN_STATUS_ERROR, message: 'internal_error' });
    }
    span.end();
}
```

When the upstream (Python) connection dies mid-stream, the fetch response body errors out. The Sentry instrumentation captures this as `handlerData.error` (no response available because the stream broke). This sets `span.status: internal_error` on the `http.client` span.

Additionally, `@sentry/core/build/esm/tracing/errors.js` registers a global error handler:

```javascript
function errorCallback() {
    const activeSpan = getActiveSpan();
    const rootSpan = activeSpan && getRootSpan(activeSpan);
    if (rootSpan) {
        rootSpan.setStatus({ code: SPAN_STATUS_ERROR, message: 'internal_error' });
    }
}
```

If the stream error propagates as an unhandled error/rejection in the Node.js process, this global handler will set `internal_error` on the root span too.

**Result:** The `http.client` span shows `internal_error` with an HTTP 200 response code. This is the signature found in all 10 incident traces.

### Step 4: Browser Side — What the User Sees

**File:** `/workspaces/test-mvp/nextjs-app/hooks/use-chat.ts` (lines 52-245)

The browser reads from the proxy's Response stream:

```typescript
const reader = response.body?.getReader();
while (!streamComplete) {
    const { done, value } = await reader.read();
    if (done) break;
    // ... parse SSE events ...
}
```

When Railway kills the connection between edge and browser (or the proxy stream errors):

1. **`reader.read()` throws a `TypeError`.** The browser's Fetch API throws when the underlying connection is broken mid-stream. The error message varies by browser but is typically something like `"network error"` or `"Failed to fetch"`.

2. **The `catch` block handles it** (lines 214-244):

   ```typescript
   } catch (error) {
       console.error("Chat error:", error);
       Sentry.captureException(error, { ... });
       const classification = error instanceof Error
           ? classifyError(error)
           : { type: "server", message: "Something went wrong. Please try again." };
       showError(classification.message);
       // ... show error item in timeline ...
   }
   ```

3. **`classifyError`** (file: `/workspaces/test-mvp/nextjs-app/lib/chat-errors.ts`) maps the error. If the error message includes "Failed to fetch" or "NetworkError", it returns `"Connection lost. Please try again."` Otherwise it returns the raw error message.

4. **User sees**: An error card in the chat timeline with the classified message, plus a toast notification via `showError()`. The incident report says users saw "Couldn't respond to your message - network error."

5. **Critical gap**: The browser has no way to know whether the stream died because of Railway, the user's network, or a Python error. It only knows `reader.read()` threw.

### Step 5: Consequences

When the stream dies:

| What | Happens? | Why |
|------|----------|-----|
| `done` event sent | No | GeneratorExit kills generator before it yields `done` |
| `result` event sent | No | Same — generator chain torn down |
| `record_usage` called | Yes | Usage was already recorded when `result` event was yielded to `event_generator`. Wait — NO. Looking at the code more carefully: `record_usage` is called from `chat_service.py` when the `result` event flows through the outer generator. If GeneratorExit kills `event_generator` before `result` is yielded by the inner chain, usage is NOT recorded. But if `result` was already yielded to the SSE stream and the death happens during write... it depends on timing. |
| `persist_session` called | No | Same as above — requires `result` event |
| Sentry: Python span | `ok` | Set from HTTP 200 at stream start |
| Sentry: Next.js http.client | `internal_error` | Fetch stream error → `handlerData.error` path |
| Sentry: Next.js http.server | Likely `ok` | Handler returned Response(200) successfully |
| Browser Sentry | `captureException` | Catches the TypeError from broken stream |

## The Post-GFS Blind Spot

### What code runs in this phase

After GFS queries complete, the response generation phase is:

1. **Claude SDK streaming** — `agent.stream_response()` → `_process_messages()` → `client.receive_response()` iterates over `AssistantMessage` and `StreamEvent` objects from the Claude Agent SDK.

2. **Span tracking** — `_handle_stream_event()` creates `llm.thinking` and `llm.content` spans based on `content_block_start`/`content_block_stop` events.

3. **Event yielding** — Each message is processed through `process_message()` and yielded up through the generator chain to `event_generator()` which formats as SSE.

### Why there are no spans during the GFS-to-death gap

The gap between GFS completion and stream death corresponds to:
- Claude processing the GFS results (thinking)
- Claude generating the response text (content generation)

These phases DO have Sentry spans (`llm.thinking`, `llm.content`) created by `_handle_stream_event()` in `agent.py` lines 32-73. However, these spans are only started on `content_block_start` and finished on `content_block_stop`. If the stream dies mid-block (before `content_block_stop`), the span is started but never finished — it would be an orphan span that may or may not appear in Sentry.

The `llm.inference` span (time from `query()` to first SDK message) covers the initial latency. After that, each thinking/content block has its own span. But the "waiting for Claude to start thinking" gap (between GFS tool result being sent and Claude beginning its thinking block) has no span. This is the true blind spot.

### Could we add spans here?

Yes. A span could be added between:
- When the last tool result is sent to Claude (after GFS)
- When the first `content_block_start` event arrives

This would measure "Claude processing time after tool use." However, this requires knowing that the last tool call has completed, which is complex in the multi-turn SDK flow.

## Detection Possibilities

### Can Next.js proxy detect upstream disconnection?

**Partially.** Currently, the `pull()` function has no error handling:

```typescript
async pull(controller) {
    const { done, value } = await reader.read();
    if (done) { controller.close(); return; }
    controller.enqueue(value);
},
```

If we wrapped `reader.read()` in a try/catch, we could:
- Log the stream death with timing
- Send a Sentry breadcrumb or capture_message
- Attempt to send a final SSE error event to the browser (may fail if downstream is also broken)
- Trigger conversation persistence from the proxy side (would require a separate API call)

**Cannot retry** — the SSE protocol has no replay mechanism, and the browser has already received partial content.

### Can Python detect client disconnection before completing?

**Yes, it already does** — via `GeneratorExit`. The code added in `d90054d5` captures this:

```python
except GeneratorExit:
    sentry_sdk.capture_message(msg, level="warning")
```

However, this only tells us "client disconnected." It cannot distinguish:
- Railway killed the connection (Mode A: idle timeout, Mode B: infrastructure)
- User closed their browser tab
- Browser navigated away

There is no metadata in `GeneratorExit` about why the connection closed.

### Can we distinguish "Railway killed it" from "user closed tab"?

**Not with certainty.** However, heuristics can help:

1. **Timing:** If the stream dies during active content generation (low silence gap), it's more likely infrastructure than user action. Users don't usually close tabs mid-sentence.

2. **The `silence_at_death` metric** (from `d90054d5`) helps: if death comes after a long silence (~10s), it's likely Mode A (idle timeout). If during active generation, it's Mode B or user action.

3. **A client-side heartbeat/disconnect endpoint** (ENG-1948) would let the browser report "I'm still here" or "user navigated away" — giving the server the other half of the story.

## The Sentry `internal_error` Question — Definitive Answer

**The `internal_error` status is set AUTOMATICALLY by Sentry's fetch instrumentation, NOT by our code.**

The exact mechanism:

1. Next.js proxy calls `fetch(pythonUrl/api/chat/stream)` — Sentry's `nativeNodeFetchIntegration` (via OpenTelemetry UndiciInstrumentation) creates an `http.client` span.

2. The fetch response starts with HTTP 200. If the response body were consumed successfully, `endSpan()` would set status from `handlerData.response.status` (200 → `ok`).

3. When the stream breaks, the fetch body errors. The instrumentation calls `endSpan()` with `handlerData.error` set (and no usable `handlerData.response`). The code path at `@sentry/core/build/esm/fetch.js:247-248`:

   ```javascript
   } else if (handlerData.error) {
       span.setStatus({ code: SPAN_STATUS_ERROR, message: 'internal_error' });
   }
   ```

4. This is pure Sentry SDK auto-instrumentation. Our code never calls `setStatus`, `setHttpStatus`, or any span status API on this span.

5. The root span (`http.server`) status depends on whether the stream error propagates as an unhandled error in the Node.js runtime. The global error handler in `@sentry/core/build/esm/tracing/errors.js` would set `internal_error` on the root span if it sees a global error or unhandled rejection.

## Sources

### Files Read
- `/workspaces/test-mvp/nextjs-app/app/api/chat/stream/route.ts` — Next.js SSE proxy
- `/workspaces/test-mvp/python-services/agent_api/api/chat.py` — Python chat endpoint with GeneratorExit handling
- `/workspaces/test-mvp/python-services/agent_api/chat_service.py` — Chat service adapter layer
- `/workspaces/test-mvp/python-services/agent_api/agent/agent.py` — Core agent with stream_response and _process_messages
- `/workspaces/test-mvp/nextjs-app/hooks/use-chat.ts` — Browser-side stream consumer
- `/workspaces/test-mvp/nextjs-app/lib/chat-errors.ts` — Error classification
- `/workspaces/test-mvp/nextjs-app/lib/api-client.ts` — Sentry trace header propagation
- `/workspaces/test-mvp/nextjs-app/sentry.server.config.ts` — Next.js Sentry server config
- `/workspaces/test-mvp/nextjs-app/sentry.edge.config.ts` — Next.js Sentry edge config
- `/workspaces/test-mvp/nextjs-app/instrumentation.ts` — Instrumentation setup
- `/workspaces/test-mvp/nextjs-app/next.config.ts` — withSentryConfig wrapper
- `/workspaces/test-mvp/python-services/agent_api/main.py` — Python Sentry init
- `/workspaces/test-mvp/docs/incidents/2026-02-20-sse-timeout/README.md` — Incident documentation

### Sentry SDK Sources (node_modules)
- `@sentry/nextjs/build/esm/common/wrapRouteHandlerWithSentry.js` — Route handler wrapping
- `@sentry/core/build/esm/fetch.js` — Fetch span instrumentation, `endSpan()` function
- `@sentry/core/build/esm/tracing/spanstatus.js` — `setHttpStatus()` and `getSpanStatusFromHttpCode()`
- `@sentry/core/build/esm/tracing/errors.js` — Global error handler setting `internal_error`
- `@sentry/core/build/esm/utils/handleCallbackErrors.js` — Error handling wrapper
- `sentry_sdk/integrations/asgi.py` (Python) — ASGI middleware `set_http_status` from `http.response.start`

### Git History
- Commit `d90054d5` — "fix: add SSE silence gap logging and stream death Sentry capture (ENG-1935)"

## Open Questions

1. **Does the `pull()` error in the ReadableStream propagate as an unhandled rejection?** This would determine whether the global Sentry error handler fires and sets `internal_error` on the `http.server` root span as well. The incident data shows `internal_error` on `http.client` — need to verify root span status.

2. **Timing of `result` event vs. stream death.** If the `result` event was yielded before the connection broke (i.e., it was buffered in the SSE stream), `record_usage` would have fired as a background task. Need to check whether `agent_usage` records exist for the failed streams (the incident doc suggests they do, since the failure rate was calculated by comparing `agent_usage` counts to `conversations` counts).

3. **Could the Next.js proxy buffer and retry?** SSE doesn't support client-side replay. But could the proxy detect the break, persist partial conversation data, and tell the browser "stream died, here's what we got"? This would require significant architectural changes.

4. **Would an error event in `pull()` close the downstream too?** If we add error handling in `pull()`, can we still send a final SSE error event to the browser, or is the downstream already broken by then? This depends on whether Railway killed both connections simultaneously or just the upstream.

## Dead Ends

None — all investigation paths yielded useful findings. The codebase was straightforward to trace, and the Sentry SDK source was readable.
