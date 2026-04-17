# Common agent pitfalls

Living catalog of concrete failure patterns seen in Effi production. Unlike `signals.md` (which is about detecting that *something* is wrong), this file is about pattern-matching a specific *kind* of problem once you've seen evidence.

Entry shape: **Pattern name → One-line description → Root cause category → How to confirm → Real example → Typical fix direction**.

Extend as you find new patterns.

---

## Tool-schema confusion

### Parameter name mismatch across sibling tools
**Description:** LLM calls tool A with a param name that works for sibling tool B, because the tools in the same family use inconsistent naming.
**Root cause:** schema inconsistency across a tool family.
**How to confirm:** `tool_observations.error` says `'X' is a required property` and `tool_input` contains a related-but-wrong key. Check the sibling tools' schemas to see the inconsistency.
**Example:** `get_drive_file` requires `drive_file_id`, but sibling `get_file` uses `file_id`; LLM extrapolates `get_X → X_id` and calls `get_drive_file({"file_id": ...})`. (ENG-5009)
**Fix direction:** rename to follow the pattern the LLM expects, or accept both aliases in the handler.

### Stringified integers
**Description:** LLM emits numeric params as strings (e.g. `"limit": "20"`); strict schema rejects them.
**Root cause:** LLM JSON tokenization variance.
**How to confirm:** `error` contains `'<n>' is not of type 'integer'`.
**Example:** `browse_emails({"limit": "20", …})` — rejected. (ENG-5011)
**Fix direction:** coerce at the handler edge (`int(x)`) before validation.

### Truncated UUIDs fed back as input
**Description:** LLM sees an 8-char UUID prefix somewhere in its context (a log line, a user-facing message) and uses that as a tool input.
**Root cause:** display truncation (`id[:8]`) on the same path LLM reads from.
**How to confirm:** `error` contains `invalid input syntax for type uuid` and `tool_input` has an 8-char hex string.
**Example:** `get_meeting({"meeting_id": "b4fe0577", …})` — only first 8 chars of the real UUID. (ENG-5010)
**Fix direction:** never surface truncated IDs on a path the LLM reads, or render with the full ID alongside; optionally resolve short prefixes in handlers.

---

## Data-fetching pathologies

### Live fetch when cache exists
**Description:** tool hits a slow external API for data already persisted in DB.
**Root cause:** code didn't get updated after the column was added; or the column is added but the tool's SELECT doesn't include it.
**How to confirm:** long `mcp.server tools/call X` span dominated by an `http.client` to an external service, while the same data is visible in a DB column. Check the tool's SQL SELECT for the missing column.
**Example:** `get_meeting(include_transcript=True)` live-fetches from Unified.to via a linear recording-list scan, while `meetings.transcript_text` has 100% coverage. (ENG-5006)
**Fix direction:** add column to SELECT, read off the row, drop the live-fetch.

### Linear-scan fallback for missing id
**Description:** tool's direct-get path 404s for a subset of data, falls back to paginating-and-scanning an entire list.
**Root cause:** upstream provider doesn't populate the id that the direct-get expects.
**How to confirm:** Sentry trace shows many sequential `http.client GET …/recording` calls inside one tool span.
**Example:** Unified.to's `get_calendar_recording(id=…)` 404s for Fathom (Fathom recordings don't carry a Unified.to `id`); code falls back to paginating `list_calendar_recordings` (`unified_client._fetch_recording_raw` in `python-services/agent_api/unified_client.py`).
**Fix direction:** capture the right id at sync time, or persist the output we need and skip the scan entirely (see "Live fetch when cache exists").

### Tool called multiple times in one turn for same data
**Description:** agent invokes the same tool 3–6 times in one turn with same/near-identical args.
**Root cause:** either the tool returned partial/empty data on earlier calls, the agent forgot the earlier result, or the system prompt encourages "re-check before answering."
**How to confirm:** `tool_observations` grouped by `turn_id, tool_name, tool_input` with count > 2. Read the JSONL to see what changed between calls.
**Example:** one 490s `/api/chat/stream` for guy@askeffi.ai called `get_meeting` 6 times in a single turn.
**Fix direction:** depends on why — per-turn memoization, better result signaling, or system prompt tweak.

---

## Context / reasoning pitfalls

### Ignoring information already in context
**Description:** agent calls a tool to retrieve info that was given in the system prompt, an earlier tool result, or an earlier user message.
**Root cause:** prompt is too long, badly structured, or context got pushed out.
**How to confirm:** JSONL shows info X present in message N; tool call for info X happens at message N+M without X appearing to have been used.
**Fix direction:** prompt restructuring, shorter context, or explicit instruction to check before fetching.

### Confabulated answer
**Description:** agent's final message asserts facts not present in any tool result.
**Root cause:** tool returned empty/sparse, but agent filled gaps from priors.
**How to confirm:** read the tool results in the JSONL, then the agent's final message; check if claims are traceable to tool output.
**Fix direction:** instruct agent to say "I don't know" when tools return empty; add structural hints to tool output so empty is unambiguous.

### Tool-choice mismatch for intent
**Description:** user asks about X, agent calls a tool for Y.
**Root cause:** tool descriptions overlap, or a "primary" tool is over-broadly described in the system prompt.
**How to confirm:** JSONL — first user message is about X; first tool call is for Y.
**Fix direction:** sharpen tool descriptions to disambiguate; consider routing layer.

---

## Enrichment / data-quality pitfalls

### "Tool works, but quality degrades due to missing enrichment"
**Description:** tool returns the row, but enrichment_status=pending means summary/action_items/etc. are empty.
**Root cause:** enrichment pipeline is stuck or hasn't run.
**How to confirm:** for affected entity table, `SELECT enrichment_status, COUNT(*)` shows near-100% pending.
**Example:** across Guy's 290 meetings, 0 were `enriched`; `get_meeting` still returned but without summary/action_items. (Noted in the Guy audit, 2026-04-17; not filed.)
**Fix direction:** separate investigation — why isn't enrichment running? Not a session-audit-level finding, but worth surfacing as adjacent.

---

## Observability gaps noticed while auditing

When the audit is hard because data we'd *like* to see isn't instrumented, capture that too. These become their own findings.

### "Span duration says X but doesn't decompose why"
If a slow span (e.g. `mcp.server tools/call X`) isn't decomposed into its internal work, we're forced to read the JSONL to understand why. Worth flagging as a tracing improvement.

### "User/session linkage requires JOINs across tables"
Any audit that needs three JOINs to get from `user.email` to `turns` is a friction point. If you find yourself writing the same multi-JOIN CTE twice, add it to `sql-recipes.md` as a view candidate.

---

## How to extend this file

When you find a new pattern:

1. Write the entry using the shape at the top.
2. Tie it to a real example — session id, trace id, or an ENG-xxxx link is best.
3. If the fix direction is obvious, state it; if not, say "unknown — worth investigating."
4. Commit and push the change alongside the findings doc. The skill gets smarter with every audit.
