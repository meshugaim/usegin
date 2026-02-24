# spotlight-dev

Query local Spotlight (Sentry dev) traces, errors, and logs from the terminal.

Wraps the Spotlight sidecar's buffered event data — no time-window limitations, no MCP quirks.

## Quick Start

```bash
spotlight-dev status                   # Is the sidecar running? How much data?
spotlight-dev traces                   # What's been happening?
spotlight-dev traces --slow 1000       # What's slow?
spotlight-dev trace <id>               # Drill into a trace
spotlight-dev errors                   # Any runtime failures?
spotlight-dev logs                     # Application logs
```

## When to Use

Use `spotlight-dev` (not the Spotlight MCP tools) for local dev observability. The CLI is more reliable — the MCP tools have time-window bugs that cause `Invalid time value` errors.

## Filtering

```bash
spotlight-dev traces --op http.server          # By span operation
spotlight-dev traces --transaction chat         # By transaction name (substring)
spotlight-dev traces --slow 500 --since 5m     # Slow traces in the last 5 minutes
spotlight-dev traces --errors                   # Only failed traces
spotlight-dev traces --no-cache                 # Force fresh fetch (bypass 30s cache)
```

`--since` accepts `Ns`, `Nm`, `Nh` (e.g., `30s`, `5m`, `1h`).

## JSON for Scripting

```bash
spotlight-dev traces --json | jq '.[] | {transaction, duration_ms}'
spotlight-dev trace <id> --json | jq .
```

## Reading the Output

Trace detail shows timing offsets (`+Nms`) relative to trace start — tells you whether spans ran in parallel or sequentially:

```
[http.server] GET /workspaces/[workspaceId]  2249ms
[function.server_action] getWorkspaces        230ms
[function.server_action] getWorkspace          195ms  +13ms    <- started 13ms after first
[function.server_action] getWorkspaceProjects  185ms  +45ms    <- started 45ms after first
```

Small offsets between spans = parallel. Large gaps = sequential waterfall.

Pageload traces include web vitals (TTFB, FCP, LCP) in the header — TTFB is the most useful signal for "page feels slow."

## Known Limitations

- **Child spans are not visible.** Spotlight's `tail` command only returns transaction-level spans. The 7 child spans inside a transaction (db queries, http calls) are only viewable in the Spotlight web UI at http://localhost:8969.
- **DB spans require auth.** Supabase query spans only appear for authenticated requests. Unauthenticated `curl` requests won't generate db spans.
- **Cache window.** Results are cached for 30s. Use `--no-cache` if you just generated new traffic and need it immediately.

## Requirements

Spotlight sidecar must be running on localhost:8969 (started automatically by `just dev`).
