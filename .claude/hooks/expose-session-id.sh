#!/bin/bash
# SessionStart hook: Exposes session ID as CLAUDE_SESSION_ID environment variable
# This allows the running session to retrieve its own session ID programmatically

set -e

# Only proceed if CLAUDE_ENV_FILE is set (SessionStart hook)
if [ -z "$CLAUDE_ENV_FILE" ]; then
  exit 0
fi

# Read hook input from stdin (JSON)
INPUT=$(cat)

# Parse session_id from input
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

if [ -n "$SESSION_ID" ]; then
  echo "export CLAUDE_SESSION_ID=\"$SESSION_ID\"" >> "$CLAUDE_ENV_FILE"

  # Also write to a well-known file so sub-agents (which don't get
  # SessionStart) can pick it up via the prepare-commit-msg hook.
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -n "$REPO_ROOT" ]; then
    echo "$SESSION_ID" > "$REPO_ROOT/.claude/.session-id"
  fi
fi
