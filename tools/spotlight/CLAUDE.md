# spotlight-dev

Query local Spotlight (Sentry dev) traces, errors, and logs from the terminal.

Wraps the Spotlight sidecar's buffered event data — no time-window limitations, no MCP quirks.

## Quick Start

```bash
spotlight-dev traces                    # What's been happening?
spotlight-dev traces --slow 1000        # What's slow?
spotlight-dev trace <id>                # Drill into a trace
spotlight-dev errors                    # Any runtime failures?
spotlight-dev logs                      # Application logs
```

## When to Use

Use `spotlight-dev` (not the Spotlight MCP tools) for local dev observability. The CLI is more reliable — the MCP tools have time-window bugs that cause `Invalid time value` errors.

## Filtering

```bash
spotlight-dev traces --op http.server          # By span operation
spotlight-dev traces --transaction chat         # By transaction name (substring)
spotlight-dev traces --slow 500 --op http.server  # Combine filters
spotlight-dev traces --errors                   # Only failed traces
```

## JSON for Scripting

```bash
spotlight-dev traces --json | jq '.[] | {transaction, duration_ms}'
spotlight-dev trace <id> --json | jq 'sort_by(.timestamp)'
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

## Requirements

Spotlight sidecar must be running on localhost:8969 (started automatically by `just dev`).
