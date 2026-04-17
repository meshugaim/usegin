# Proven SQL recipes for Effi session audit

Read-only queries against production Supabase (`mcp__supabase-prod__execute_sql`).

**Never write to prod.** All queries here are `SELECT` only. If you need aggregates, compute in the query; don't materialize a table.

## Table shapes (as of 2026-04-17)

```
auth.users           : id, email
conversations        : id, claude_session_id, user_id, project_id, organization_id,
                       storage_path, message_count, total_input_tokens,
                       total_output_tokens, total_cost_usd, is_error,
                       created_at, updated_at
agent_usage          : id, claude_session_id, user_id, project_id, organization_id,
                       user_role, model, input_tokens, output_tokens,
                       cache_read_input_tokens, cache_creation_input_tokens,
                       cost_usd, duration_ms, duration_api_ms, num_turns,
                       is_error, created_at, auth_mode, sentry_trace_id
turns                : id, agent_usage_id, turn_index, text_preview,
                       thinking_preview, tool_call_count, duration_ms,
                       sentry_trace_id, created_at
tool_observations    : id, turn_id, sequence, tool_name, tool_input (jsonb),
                       result_count, error, duration_ms, created_at
meetings             : id, connection_id, title, date, speakers,
                       duration_seconds, summary, action_items,
                       enrichment_status, transcript_text, external_id,
                       deleted_at, …
```

Schemas drift. If a query errors on a missing column, re-check:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='<table>' ORDER BY ordinal_position;
```

## R1. Find a user's id from their email

```sql
SELECT id, email FROM auth.users WHERE email = '<email>';
```

## R2. List a user's recent sessions (ordered by activity)

```sql
SELECT claude_session_id, project_id, storage_path, message_count,
       total_input_tokens, total_output_tokens, total_cost_usd,
       is_error, created_at, updated_at
FROM conversations
WHERE user_id = '<user_id>'
ORDER BY updated_at DESC
LIMIT 30;
```

Interpretation hints:
- `message_count` >> typical (say 100+) often means the session had loops or was long-running / resumed.
- Very low cost with high message_count → thin turns; possible looping with tool-only turns.
- `is_error = true` → backend error somewhere in the session.

## R3. Per-tool aggregate for a user (the big one)

Use this first. It answers: which tools does this user hit, how often, how slow, how often do they error?

```sql
WITH user_turns AS (
  SELECT t.id AS turn_id
  FROM turns t
  JOIN agent_usage au ON au.id = t.agent_usage_id
  WHERE au.user_id = '<user_id>'
    AND au.created_at > NOW() - INTERVAL '7 days'
)
SELECT
  tool_name,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE error IS NOT NULL) AS errors,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::int AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95_ms,
  MAX(duration_ms) AS max_ms,
  SUM(duration_ms) AS total_ms
FROM tool_observations
JOIN user_turns USING (turn_id)
GROUP BY tool_name
ORDER BY total_ms DESC NULLS LAST;
```

Swap `user_id` for `claude_session_id` to audit a single session.

## R4. Tool errors with actual input and snippet

```sql
WITH user_turns AS (
  SELECT t.id AS turn_id
  FROM turns t
  JOIN agent_usage au ON au.id = t.agent_usage_id
  WHERE au.user_id = '<user_id>'
    AND au.created_at > NOW() - INTERVAL '7 days'
)
SELECT tool_name, LEFT(error, 300) AS error_snippet, tool_input, created_at
FROM tool_observations
JOIN user_turns USING (turn_id)
WHERE error IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

The `tool_input` JSONB is the most useful column here — it's what the LLM actually sent.

## R5. Bucket errors by pattern

```sql
WITH user_turns AS (
  SELECT t.id AS turn_id
  FROM turns t
  JOIN agent_usage au ON au.id = t.agent_usage_id
  WHERE au.user_id = '<user_id>'
    AND au.created_at > NOW() - INTERVAL '7 days'
)
SELECT
  tool_name,
  CASE
    WHEN error LIKE '%not of type %' THEN 'A: wrong type'
    WHEN error LIKE '%required property%' THEN 'B: wrong param name'
    WHEN error LIKE '%invalid input syntax for type uuid%' THEN 'C: truncated/bad UUID'
    WHEN error LIKE '%rate limit%' THEN 'D: rate limited'
    WHEN error LIKE '%timeout%' THEN 'E: timeout'
    ELSE 'other'
  END AS bucket,
  COUNT(*) AS n
FROM tool_observations
JOIN user_turns USING (turn_id)
WHERE error IS NOT NULL
GROUP BY 1, 2 ORDER BY 3 DESC;
```

Extend the `CASE` with new buckets as you discover them. The interesting ones go into `pitfalls.md`.

## R6. Repeated-tool-call detection within one turn (loop hunting)

```sql
WITH user_turns AS (
  SELECT t.id AS turn_id, au.claude_session_id, t.created_at
  FROM turns t
  JOIN agent_usage au ON au.id = t.agent_usage_id
  WHERE au.user_id = '<user_id>'
    AND au.created_at > NOW() - INTERVAL '7 days'
)
SELECT
  claude_session_id,
  turn_id,
  tool_name,
  COUNT(*) AS calls_in_turn,
  COUNT(DISTINCT tool_input::text) AS distinct_inputs
FROM tool_observations
JOIN user_turns USING (turn_id)
GROUP BY 1, 2, 3
HAVING COUNT(*) >= 3
ORDER BY calls_in_turn DESC
LIMIT 20;
```

Rows where `calls_in_turn` is large and `distinct_inputs = 1` are pure loops. `distinct_inputs` close to `calls_in_turn` means the agent iterated over different targets — sometimes legitimate.

## R7. Long-running turns

```sql
SELECT au.claude_session_id, t.turn_index, t.duration_ms,
       t.tool_call_count, LEFT(t.text_preview, 200) AS preview
FROM turns t
JOIN agent_usage au ON au.id = t.agent_usage_id
WHERE au.user_id = '<user_id>'
  AND au.created_at > NOW() - INTERVAL '7 days'
ORDER BY t.duration_ms DESC NULLS LAST
LIMIT 15;
```

## R8. Coverage / quality checks for supporting data

Before recommending a fix ("just read it from the DB"), verify the data actually exists. Example pattern — transcripts:

```sql
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE transcript_text IS NOT NULL AND transcript_text <> '') AS with_transcript,
       COUNT(*) FILTER (WHERE transcript_text IS NULL OR transcript_text = '') AS missing
FROM meetings
WHERE deleted_at IS NULL;
```

## R9. Enrichment status distribution (adjacent concern)

```sql
SELECT enrichment_status, COUNT(*) FROM meetings
WHERE deleted_at IS NULL
GROUP BY 1 ORDER BY 2 DESC;
```

High `pending` with low `enriched` is usually a pipeline issue, not a session-audit finding — but worth noting as "adjacent" in the report.

## Tips

- **Paste the full UUID** in queries — no `::text LIKE '%prefix%'`. It encourages truncated-UUID thinking.
- **Always filter `deleted_at IS NULL`** on `meetings` and similar soft-deleted tables unless you explicitly want the full set.
- **Prefer CTEs with descriptive names** (e.g., `WITH user_turns AS (…)`). Copy-paste friendly across queries.
- **Window** — default to 7 days. Widen if the anchor is quiet, narrow for incident-like investigations.
- **Tabulate before you tell a story.** `tool_observations` aggregated by `tool_name` is where most audits start.

## When you add a new recipe

Rule of thumb: if you wrote the same query twice across two audits, it belongs here. Give it an R-number, a one-line description, and parameterize it with `<placeholder>`s so the next investigator can paste-and-edit.
