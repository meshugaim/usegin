---
name: fetching-ci-logs
description: Fetch and display CI logs from GitHub Actions. Triggered by phrases like "fetch CI logs", "get test failures", "why did CI fail", "show me the CI logs", or "what went wrong in CI".
---

# Fetching CI Logs

Retrieve CI logs from GitHub Actions to debug failures and understand test results.

## When to Use

- "fetch CI logs"
- "get test failures"
- "why did CI fail"
- "show me the CI logs for run X"
- "what went wrong in CI"
- "debug the CI failure"

## CLI Reference

```bash
# Show help
ci-logs --help

# Fetch logs for specific run ID
ci-logs 20295739941

# Auto-detect most recent failed run
ci-logs --failed

# Show only failed step logs
ci-logs --failed --failures-only

# Filter to specific job (e.g., e2e tests)
ci-logs --failed --job e2e

# Limit output lines
ci-logs --failed --failures-only --limit 100

# JSON output
ci-logs --failed --json
```

## Common Workflows

### Debug a CI Failure

```bash
# 1. See what failed
ci-logs --failed --failures-only

# 2. Filter to specific job if needed
ci-logs --failed --failures-only --job e2e
```

### Check Specific Run

```bash
# Get run IDs from GitHub
gh run list --limit 5

# Fetch logs for specific run
ci-logs 20295739941
```

### Analyze Test Failures

```bash
# Get full logs with error context
ci-logs --failed --failures-only | grep -A10 "Error:"
```

## Output Format

The CLI outputs:
- Run metadata (ID, title, branch, status, timestamp)
- Log content from failed steps
- Tab-separated format: `job-name<tab>step-name<tab>log-line`

## Tips

| Tip | Description |
|-----|-------------|
| Use `--failures-only` | Filters to only show failed steps |
| Use `--job` | Filter logs by job name (e.g., `e2e`, `build`) |
| Pipe to grep | Further filter output (e.g., `ci-logs --failed \| grep Error`) |
| Check `gh run list` | To find run IDs for specific commits |
