---
name: sentry
description: Debug production issues using the Sentry CLI. Triggered by "check sentry", "sentry issues", "debug production error", or when investigating errors/traces/replays.
---

# Sentry CLI

Use this skill to investigate production issues via Sentry.

## CLI Location

```bash
# The handmade sentry CLI wraps @sentry/cli with project defaults
bun run /workspaces/test-mvp/tools/sentry-cli/src/index.ts <command>

# Alias for convenience (if installed)
sentry <command>
```

The CLI auto-injects `--org askeffi` for commands that need it.

## Custom Commands

### Issue Summary

Get issue details with event statistics:

```bash
sentry issue <issue-id>
sentry issue NEXTJS-APP-123
sentry issue PYTHON-FASTAPI-45 --json
```

Shows: title, status, first/last seen, event count, user impact, browser/OS breakdown.

### Events

List or show events for an issue:

```bash
# List recent events
sentry events list <issue-id>
sentry events list NEXTJS-APP-123 -n 20

# Show specific event (or latest)
sentry events show <issue-id> [event-id]
sentry events show NEXTJS-APP-123
sentry events show NEXTJS-APP-123 abc123def456 --json
```

Shows: stack trace, breadcrumbs, tags, user info, request data.

### Traces

Inspect distributed traces:

```bash
# Show trace summary
sentry trace show <trace-id>
sentry trace show abc123...def456 --spans  # Include span tree

# Search for spans
sentry trace search "span.description:*addProjectMember*"
sentry trace search "span.op:db" --period 7d --limit 50
sentry trace search "transaction:*checkout*" -p nextjs-app
```

Shows: span count, errors, operation breakdown, root transactions, server actions with context.

### Replays

Analyze session replays:

```bash
sentry replay <replay-id>
sentry replay abc123...def456 --type click  # Filter by event type
sentry replay abc123...def456 --json

# Event types: mutation, click, input, scroll, error, hydration
```

Shows: timeline of user actions, DOM mutations, errors, with timestamps.

## Passthrough Commands

Any unrecognized command passes through to `@sentry/cli`:

```bash
# List issues (passthrough to @sentry/cli)
sentry issues list --project nextjs-app
sentry issues list --project python-fastapi

# List releases
sentry releases list

# Other @sentry/cli commands work too
sentry projects list
```

## Common Workflows

### 1. Investigate a Production Error

```bash
# Start with issue list
sentry issues list --project nextjs-app

# Get issue summary with stats
sentry issue NEXTJS-APP-123

# Look at the latest event details
sentry events show NEXTJS-APP-123

# If there's a trace, dive deeper
sentry trace show <trace-id-from-event> --spans
```

### 2. Debug a Slow Request

```bash
# Search for slow spans
sentry trace search "span.duration:>1000" --period 24h

# Inspect specific trace
sentry trace show <trace-id> --spans
```

### 3. Understand User Journey

```bash
# If there's a replay attached to an error
sentry replay <replay-id>

# Filter to see just clicks and errors
sentry replay <replay-id> --type click
sentry replay <replay-id> --type error
```

### 4. Find Related Traces

```bash
# Search by operation
sentry trace search "span.op:function.server_action"

# Search by description pattern
sentry trace search "span.description:*createWorkspace*"

# Search by user
sentry trace search "user.email:foo@example.com"
```

## Projects

- `nextjs-app` - Next.js frontend
- `python-fastapi` - Python API backend

## JSON Output

All commands support `--json` for programmatic use:

```bash
sentry issue NEXTJS-APP-123 --json | jq '.stats.browsers'
sentry events show NEXTJS-APP-123 --json | jq '.stacktrace'
```

## See Also

- [Production Incident Debug Runbook](../../../docs/runbooks/incident-debug.md) — investigation procedure, service→project mapping, span operations, key signals
- [working-with-sentry skill](../working-with-sentry/SKILL.md) — SDK configuration and GitHub integration
- [Sentry CLI Documentation](https://docs.sentry.io/cli/)
