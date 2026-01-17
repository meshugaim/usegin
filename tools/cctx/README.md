# cctx - Claude Context Utilization Checker

A CLI for checking context window utilization of Claude sessions. Designed to be easily used by agents to monitor their own context and the context of their subagents.

## Installation

```bash
cd tools/cctx && bun install
```

## Usage

### Basic usage (current session)

```bash
# Human-readable output
cctx

# Output:
# Session: b28d6d94...
# Model:   claude-opus-4-5-20251101
#
# Context: [██████████████████████░░░░░░░░░░░░░░░░░░] 55.9%
#
# Tokens:
#   Used:         111,812
#   Remaining:     88,188
#   Window:       200,000
```

### For agents (JSON output)

```bash
cctx --json
```

Returns structured data that agents can easily parse:

```json
{
  "session": {
    "sessionId": "b28d6d94-c0b3-48e8-be35-44bb8b5acb39",
    "contextTokens": 112245,
    "contextWindow": 200000,
    "utilization": 0.561225,
    "utilizationPercent": "56.1%",
    "usage": {
      "inputTokens": 10,
      "outputTokens": 1,
      "cacheReadInputTokens": 111804,
      "cacheCreationInputTokens": 431
    },
    "model": "claude-opus-4-5-20251101"
  }
}
```

### Other formats

```bash
# Single line (good for status lines)
cctx --compact
# 56.1% (112,245/200,000) - 87,755 remaining

# Just the percentage
cctx --percent
# 56.1%

# Key-value pairs (easy to parse with grep/awk)
cctx --kv
```

### Include subagents

```bash
cctx --subagents

# Shows context for all subagents:
# Subagents:
#   a44ffe6: 0.9% (1,890 tokens)
#   a73e150: 1.2% (2,347 tokens)
```

### Check specific session

```bash
# By session ID
cctx b28d6d94-c0b3-48e8-be35-44bb8b5acb39

# By prefix (at least 4 chars)
cctx b28d

# By path
cctx ~/.claude/projects/my-project/session.jsonl
```

## Exit codes

- `0` - Success, context utilization normal
- `1` - Error (session not found, parse error, etc.)
- `2` - Success, but context utilization is critical (>90%)

## For Agent Use

The CLI is designed to make it easy for Claude agents to check their own context:

```bash
# Quick check - are we running low?
if [ $(cctx --percent | sed 's/%//') -gt 80 ]; then
  echo "Context running low, consider compaction"
fi

# Get detailed info as JSON for programmatic use
CONTEXT=$(cctx --json)
```

Agents can also check subagent context to monitor spawned workers:

```bash
cctx --json --subagents | jq '.subagents[] | select(.context.utilization > 0.8)'
```
