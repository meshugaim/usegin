---
name: effi-session-audit
description: Investigate real user sessions on production Effi to understand how the agent is actually performing — did it understand intent, did it loop, did it confabulate, was the user getting frustrated, did it call the right tools with the right arguments, did it read its own context. Use this skill whenever a user reports Effi being slow, broken, confusing, unhelpful, or "off" for a specific person; whenever we want to proactively audit Effi's behavior for a user, cohort, or window; whenever we're trying to understand why a particular session went sideways; whenever we see frustration signals in production usage; or whenever someone says "let's look at how Effi is doing." Trigger even when the request is framed as "let's dig into X's usage" or "why is Effi bad for Y" — session audit IS this skill. Do NOT trigger for infrastructure/build/CI failures, for fixing a known bug without investigation (use fix-bug), or for writing new Effi features.
---

# Effi Session Audit

Investigate real Effi user sessions on production to understand agent performance — not just latency, the whole picture. Did the agent understand what the user wanted? Did it loop? Confabulate? Call the wrong tool? Ignore information it already had? Was the user visibly frustrated?

The goal is **grounded insight**: findings that are tied to specific turns, specific tool calls, specific user messages — not vibes. Every claim in the output should cite a session, a timestamp, or a row.

This skill is heavy on *reading* and *aggregating* from production data and light on code changes. You write findings, not fixes. The human decides what gets filed.

## Pipeline

`user complaint / proactive audit` → **this skill** → `findings doc` → (human approves) → `Linear issue(s) with evidence` → `fix-bug` for each filed issue

## When to use vs. when not to

| Use this skill when… | Use something else when… |
|---|---|
| "X says Effi is slow/broken/confused" | Known bug with clear repro → `fix-bug` |
| "Audit Y's sessions last week" | CI failed → `investigate-ci` |
| "Why did that session go sideways?" | Sentry issue needs triaging → `sentry` |
| "Let's see how Effi is doing" | New feature / spec → `spec` |
| Investigating frustration signals | Deployment / release work |

## Output bias (default)

**Findings doc first, Linear issues only after the human approves.** Draft to `docs/scratchpad/<short-topic>/findings.md`. Bring it to the human, discuss, then file. Do not file issues eagerly on your own judgment — false positives here cost more than missed findings, because every issue becomes an agent's future work item.

Exception: if the human has already said "file what you find" up front, skip the approval gate and file with evidence.

## Workflow

```
orient → gather → read → synthesize → draft findings → approval gate → file
```

Every phase. Don't skip "read" — the tool_observations aggregate is seductive but thin. The JSONL is where agent behavior actually lives.

### Phase 1: Orient

Pin down the anchor and the window before querying anything.

- **Anchor**: user email, user_id, session_id, or a time window. Ask if unclear.
- **Window**: default 7 days. Widen if the anchor is quiet, narrow if noisy.
- **Known context**: is there a prior investigation (check `docs/scratchpad/`)? A related Linear issue? Prior findings that might still be stale?

Write a one-paragraph intent statement before querying. It forces clarity: *"Investigating guy@askeffi.ai's reports of slowness in the last 7 days; want to know whether it's a specific tool, a specific session type, or agent confusion."* A fuzzy intent produces a fuzzy investigation.

### Phase 2: Gather (Sentry + SQL)

Start quantitative. Build a picture of *what happened*, not *why* — that's the next phase.

- **Sentry**: `sentry trace search "user.email:<email> environment:production" --limit 30 --period 7d` for slow turns, span ops, failed spans, duration distribution. See `references/sentry-queries.md`.
- **Prod DB**: `mcp__supabase-prod__execute_sql` against `conversations`, `turns`, `tool_observations`, `agent_usage`, `meetings`, `auth.users`. See `references/sql-recipes.md` for proven queries (per-tool call counts / errors / p50/p95, frustration proxies, long-turn detection, etc.).

**Do not skip the aggregate view even if the user hands you one session.** Knowing the session's stats (turn count, tool_call_count, cost, duration) relative to that user's normal behavior is what lets you tell "one bad turn" from "this whole session is degenerate."

### Phase 3: Read (JSONL transcripts)

**This is the phase most investigators skip, and it's the phase where the real insights live.** SQL tells you `get_meeting` was called 6 times; the JSONL tells you *why* — what the agent was reasoning about, what tool result it saw, what the user said between calls.

Pull one or more session JSONLs from the prod `conversations` storage bucket and read them end-to-end (or the relevant windows). See `scripts/fetch_session.sh` for the fetch command.

Read with these questions in mind — and see `references/signals.md` and `references/pitfalls.md` for the living lists, which you should extend as you find new patterns:

- What did the user actually ask for? Was the agent answering *that* question?
- Did the agent call tools it needed to? Skip tools it needed? Call the wrong one?
- Did it re-ask itself things it already knew from earlier in the session?
- Did the user have to re-phrase, clarify, or restate? Those are frustration signals.
- When tool results came back empty/partial/wrong, how did the agent react?
- Is the final answer actually supported by the tool outputs it got?

### Phase 4: Synthesize

Group findings into **bug-shaped** (reproducible, specific, code-level) vs. **pattern-shaped** (heuristic, cross-session, points at system design) vs. **adjacent** (noticed but not the reported problem).

Every finding must cite: session_id or trace_id, timestamp, and the relevant quote or data. If you can't cite it, you don't have a finding — go back to Phase 3.

### Phase 5: Draft findings doc

Write to `docs/scratchpad/<short-topic>/findings.md`. Structure:

```markdown
# <Topic> — Effi session audit

Investigation date: YYYY-MM-DD. Anchor: <email/session/window>. Investigator: <agent>.

## TL;DR
One-paragraph: what you found, ranked.

## Context
Who, when, window, why investigating.

## Quantitative picture
Tool usage table, latency percentiles, error rates, anything from Phase 2 that matters.

## Findings
### Finding 1 — <short title> [bug | pattern | adjacent]
What. Evidence (session, timestamp, quote/data). Fix direction (optional).

### Finding 2 — …

## Data sources
What you used, what you didn't, what's worth pulling next time.

## Candidate Linear issues (not yet filed)
One bullet per candidate with a one-line title and which Finding it maps to.
```

### Phase 6: Approval gate

Bring the doc to the human. Prioritize the candidate issues by impact. Ask which to file. **Do not file before this check** unless pre-authorized.

### Phase 7: File

For each approved candidate: `plan search` to avoid duplicates, then `plan create` with a full description including evidence and a link back to the findings doc. Use `--related-to` to connect siblings from the same audit — future agents finding one issue should see the others.

## Data sources — quick reference

| Source | Best for | How |
|---|---|---|
| Sentry traces | "what was slow, in what shape" | `sentry trace search "user.email:<email> environment:production"` |
| `tool_observations` table | Per-tool aggregate: calls, errors, latency, actual `tool_input` JSONB | `mcp__supabase-prod__execute_sql` |
| `turns` table | Per-turn duration, tool_call_count, sentry_trace_id | `mcp__supabase-prod__execute_sql` |
| `agent_usage` table | Session-level tokens, cost, model, user_role | `mcp__supabase-prod__execute_sql` |
| `conversations` table | Session list, storage path, message count, cost, is_error | `mcp__supabase-prod__execute_sql` |
| JSONL transcripts | Ground truth: user messages, agent thinking, tool calls, tool results | `scripts/fetch_session.sh` (wraps `bunx supabase storage cp`) |
| `meetings`, `drive_files`, etc. | Validate whether data the agent claimed was actually available | `mcp__supabase-prod__execute_sql` |
| Code | Root-cause grounding for bug-shaped findings | `Read`, `Grep` |

Detailed SQL and Sentry recipes: `references/sql-recipes.md`, `references/sentry-queries.md`.

## Growth sections — extend as you learn

Two living reference files are designed to be extended every time you run this skill:

- `references/signals.md` — frustration / confusion signals. New signal noticed? Add it with an example and a one-line heuristic for how to spot it.
- `references/pitfalls.md` — common agent failure patterns (loops, confabulation, parameter mismatches, stale-context reuse, etc.). Seed examples included; add what you find.

When you add to these files, keep the entry shape: **Name → One-line description → How to detect → Real example (anonymized if needed, with a session or trace id)**. That shape is what makes these useful the next time.

## Scope discipline

- You are not fixing bugs in this skill. You are surfacing them. Resist the urge to patch.
- Do not write to remote databases. Ever. Read-only prod.
- The findings doc is the work artifact. Don't over-produce (slides, dashboards, summaries of summaries).
- If an adjacent issue is clearly serious but outside the audit anchor, note it as "adjacent" and let the human decide whether to expand scope.
