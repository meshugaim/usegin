#!/bin/bash
# SessionStart hook: Exposes session ID
# Writes to /tmp/claude-session-id for bash commands to read
# Note: CLAUDE_ENV_FILE doesn't persist to main session due to scope isolation

set -e

# Read hook input from stdin (JSON)
INPUT=$(cat)

# Parse session_id from input
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

if [ -n "$SESSION_ID" ]; then
  # Write to known location for bash commands to read
  echo "$SESSION_ID" > /tmp/claude-session-id
fi
