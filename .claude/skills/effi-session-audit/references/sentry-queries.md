# Proven Sentry queries for Effi session audit

Use the `sentry` CLI on PATH (org defaults to `askeffi`). All queries are read-only.

For JSON output (jq-friendly), pass `--json`.

## Q1. Slowest /api/chat/stream transactions for a user

```
sentry trace search \
  "user.email:<email> environment:production transaction:/api/chat/stream is_transaction:true" \
  --limit 30 --period 7d --json
```

Useful jq: sort and extract.
```
| jq -r '[.[] | {dur: .["span.duration"], t: .timestamp, trace: .trace}]
         | sort_by(-.dur) | .[] | "\(.dur|round)ms \(.t) \(.trace)"'
```

## Q2. Top spans inside a trace (to find the bottleneck)

```
sentry trace search "trace:<trace_id> (span.op:llm.* OR span.op:mcp.server OR span.op:http.client OR span.op:db.query)" \
  --limit 100 --period 14d --json
```

jq: top durations.
```
| jq -r '[.[] | {d: .["span.duration"], op: .["span.op"], desc: .["span.description"]}]
         | sort_by(-.d) | .[:15] | .[] | "\(.d|round)ms \(.op) \(.desc)"'
```

## Q3. Error spans for a user

```
sentry trace search \
  "user.email:<email> environment:production (span.op:mcp.server OR span.op:function OR span.op:http.server) span.status:internal_error" \
  --limit 20 --period 7d --json
```

## Q4. Slow child span by type (e.g., all slow MCP calls)

```
sentry trace search \
  "user.email:<email> environment:production span.op:mcp.server span.duration:>10000" \
  --limit 50 --period 7d --json
```

## Q5. Trace detail (span tree, errors, breakdown)

```
sentry trace show <trace_id>
sentry trace show <trace_id> --spans   # full tree
```

## Tips

- `user.email:guy@askeffi.ai` — case-sensitive.
- Use `environment:production`; omit for all envs.
- `is_transaction:true` filters to the root transaction spans (one per request).
- `span.duration` is in milliseconds; pair with `:>N` operators.
- When Sentry's summary shape doesn't include what you need (e.g., MCP tool arguments aren't in span tags), switch to `tool_observations` SQL — Sentry gives timing, SQL gives payloads.
- The conversation-JSONL storage path shows up in Sentry as a `http.client POST …/storage/v1/object/conversations/{user_id}/{session_id}.jsonl`. Useful as an independent way to locate the session for a given trace.
