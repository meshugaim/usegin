---
name: multi-turn-headless-claude
description: Technical patterns for running Claude non-interactively with session persistence. Triggered by "run claude headless", "spawn claude", "chain prompts", or "resume session programmatically".
---

# Multi-Turn Headless Claude

Run Claude non-interactively with session persistence for multi-turn orchestration.

## When to Use

- Agent spawning worker Claude
- Programmatic multi-turn conversations
- Background task execution

## Core Pattern

```bash
# Generate session ID
session_id=$(cat /proc/sys/kernel/random/uuid)

# First call
echo "prompt" | claude -p --session-id "$session_id"

# Resume later
echo "follow up" | claude -p -r "$session_id"
```

## Complex Prompts

Use temp file to avoid shell quoting issues:

```bash
cat > /tmp/prompt.txt << 'PROMPT'
Multi-line prompt here.
Can include "quotes" and $variables safely.
PROMPT

cat /tmp/prompt.txt | claude -p --session-id "$session_id"
```

## Output Formats

| Format | Flag | Use Case |
|--------|------|----------|
| Text (default) | none | Human readable |
| JSON | `--output-format json` | Parse session_id, costs |
| Stream JSON | `--output-format stream-json` | Real-time processing |

JSON output includes `session_id` for later resume:
```json
{"session_id": "abc123", "result": "...", "total_cost_usd": 0.25}
```

## Using crun (Recommended)

Thin wrapper around `claude -p` with conveniences:

```bash
# Run synchronously (blocks until complete)
crun "implement the feature"

# Run in background
crun "fix the bug" &

# Resume existing session
crun --resume abc123 "also add tests"

# With reminder presets
crun --remind tdd,commit-often "implement per spec"

# In specific directory
crun --cwd /path/to/repo "implement the feature"

# From prompt file
crun --prompt-file /tmp/task.txt

# View session transcript (short ID works)
session abc123
session 502de9c7  # prefix also works
```

### Logs

Logs are stored at `~/.crun/logs/` for later inspection.

### Non-blocking from Claude Code

When spawning workers from within Claude Code, use the Task tool with `run_in_background: true` to avoid blocking the parent agent:

```
Task tool with run_in_background: true
-> spawns worker
-> parent continues immediately
-> use TaskOutput to check results later
```

## Using session CLI

```bash
# View parsed transcript (short ID works)
session abc123
session 502de9c7  # prefix also works

# Check progress on running worker
session <id> | tail -50

# List recent sessions
session list -n 5 --output id

# Stream live output
claude -p "task" --output-format stream-json | session --stream
```

## Aliases

In this repo, `bun run c` is an alias for `claude`:

```bash
cat /tmp/prompt.txt | bun run c --session-id "$session_id"
```

## Patterns

### Fire and Forget

```bash
session_id=$(cat /proc/sys/kernel/random/uuid)
echo "do the thing" | claude -p --session-id "$session_id" &
echo "Spawned: $session_id"
```

### Wait for Completion

```bash
result=$(echo "do the thing" | claude -p --output-format json)
session_id=$(echo "$result" | jq -r '.session_id')
echo "Done: $session_id"
```

### Chain with Context

```bash
id=$(cat /proc/sys/kernel/random/uuid)

echo "Read the codebase and understand the auth system" | claude -p --session-id "$id"
echo "Now write tests for the auth system" | claude -p -r "$id"
echo "Run the tests and fix any failures" | claude -p -r "$id"
```

## Reference

- `crun --help` - Thin wrapper for claude -p
- `session --help` - Session parsing and viewing
- `claude --help` - All CLI options
