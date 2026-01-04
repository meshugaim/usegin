#!/bin/bash
# Hook to inject workflow reminders into context
# Outputs reminders as a formatted block that Claude will see

set -e

# Get session ID from environment
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
REMINDERS_FILE="$HOME/.crun/workflows/${SESSION_ID}.txt"

# Check if reminders file exists and has content
if [ -f "$REMINDERS_FILE" ] && [ -s "$REMINDERS_FILE" ]; then
  echo "[WORKFLOW REMINDERS]"
  cat "$REMINDERS_FILE" | while read -r line; do
    echo "- $line"
  done
  echo "[/WORKFLOW REMINDERS]"
fi
