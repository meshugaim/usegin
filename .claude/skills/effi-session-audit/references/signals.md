# Frustration and confusion signals

This file is a **living list**. Each time you run an audit, extend this list with signals you saw that weren't captured here. Keep the entry shape: **Name → How to detect → Example (with session or trace id)**.

The signals here help you scan a JSONL or an aggregate view and say "yep, this one's worth reading." They're heuristics, not rules — a single signal rarely means anything; a pattern of them is what matters.

## User-side signals (from user messages in JSONL)

### Repeated intent
**How to detect:** user re-asks the same question within a session, sometimes rephrased. Look for semantic duplicates, not just exact matches. Consecutive user messages that restate the ask.
**Why it matters:** the agent's answer didn't land. Either factually wrong, or missed the intent.

### Clarification / correction messages
**How to detect:** user messages containing "no, I meant…", "not that…", "actually, I was asking about…", "you misunderstood…", "that's wrong", "not what I want".
**Why it matters:** direct evidence the agent got it wrong.

### Short, clipped messages later in session
**How to detect:** early messages are full sentences; later ones shrink to "no", "wrong", "never mind", single words. Compare average message length at start vs. end.
**Why it matters:** classic frustration curve. User stopped investing because they stopped trusting.

### Abandoned session
**How to detect:** session ends mid-turn (no final user acknowledgment), message_count plateaus, `updated_at` stops well before the user's normal activity window.
**Why it matters:** user gave up.

### Switching topics without resolution
**How to detect:** user asks question A, gets an answer, then asks question B without confirming A worked. Sometimes they come back to A later.
**Why it matters:** softer signal — could be workflow, could be giving up on A.

## Agent-side signals (from agent behavior in JSONL and SQL)

### Tool looping
**How to detect:** same tool called with same/near-identical args ≥3 times in one turn. In SQL, `tool_observations` grouped by (turn_id, tool_name, tool_input) with count > 2.
**Why it matters:** something's wrong with the loop exit condition — the agent keeps "trying again" but nothing changes.

### High tool_call_count single turn
**How to detect:** turn with `tool_call_count` >> the session's median. Compare against the user's typical turns, not a global baseline.
**Why it matters:** the agent is thrashing. Either a genuine hard query, or (more often) a symptom of some tool giving bad/empty results.

### Long thinking without action
**How to detect:** `llm.thinking` spans much longer than `llm.content`, or many consecutive `thinking` messages in JSONL with no tool calls between.
**Why it matters:** agent is stuck reasoning, not actioning.

### Tool input errors burst
**How to detect:** several `tool_observations` rows in a row with `error IS NOT NULL` from the same turn. The agent is fumbling parameters and retrying.
**Why it matters:** schema confusion or context drift.

### Final answer unsupported by tool outputs
**How to detect:** read the tool results in the JSONL, then read the final agent message. Does the answer actually use what came back? Or does it assert facts no tool returned?
**Why it matters:** confabulation. High-severity signal.

### Ignoring information already in context
**How to detect:** agent calls a tool to get info it was already told earlier in the session (in system prompt, earlier tool result, or earlier user message).
**Why it matters:** context-reading failure. Often means the prompt is too long or badly structured.

### Tool choice mismatched to intent
**How to detect:** user asks about X; agent calls tool Y which is obviously for Z. Example: user asks about meetings, agent calls `semantic_search` over files only.
**Why it matters:** routing problem — either in the system prompt, the tool descriptions, or genuine agent confusion.

## How to use this list

1. After Phase 2 (SQL aggregate), scan for signals that show up in aggregate: tool input errors, high `tool_call_count`, long `duration_ms`.
2. Pick 1–3 sessions where aggregate signals concentrate and pull their JSONLs.
3. Read those JSONLs specifically for the JSONL-only signals: repeated intent, confabulation, ignored context.
4. When you find a signal the list didn't warn you about — **add it here**, with the session id.
