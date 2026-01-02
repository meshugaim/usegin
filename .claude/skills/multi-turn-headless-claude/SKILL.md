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

For managed processes with pm2:

```bash
# Spawn and stream output (default - follows until done)
crun spawn "implement the feature"
# → (streams output, exits when done)

# Spawn in background (detached)
crun spawn --detach "fix the bug"
# → Started: abc123

# List running workers
crun list

# Send follow-up to existing session
crun send abc123 "also add tests"

# Kill a worker
crun kill abc123

# View output (short ID works)
session abc123
session 502de9c7  # prefix also works
```

### Non-blocking from Claude Code

When spawning workers from within Claude Code, use the Task tool with `run_in_background: true` to avoid blocking the parent agent:

```
Task tool with run_in_background: true
→ spawns worker
→ parent continues immediately
→ use TaskOutput to check results later
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

- `crun --help` - Background process management
- `session --help` - Session parsing and viewing
- `claude --help` - All CLI options
