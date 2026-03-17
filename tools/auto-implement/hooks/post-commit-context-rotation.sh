#!/usr/bin/env bash
#
# Auto-implement hook: post-commit context rotation
#
# Installed to .git/hooks/post-commit during auto-implement sessions.
# After every commit, checks context utilization via `cctx`.
# If >65%, kills the Claude process and spawns a handoff writer.
#
# Reads session_id, spec_id, and claude_pid from /tmp/auto-impl-context.json
# (written by auto-implement at session start).
#
# Exit codes:
#   0 = always (post-commit hooks should not block)
#
set -uo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
# Rotate when fewer than this many tokens remain.
# Works correctly for both 200K and 1M context windows.
REMAINING_TOKEN_THRESHOLD=75000
CONTEXT_FILE="/tmp/auto-impl-context.json"
TOOLS_DIR="$(git rev-parse --show-toplevel)/tools"

# ---------------------------------------------------------------------------
# Read context file
# ---------------------------------------------------------------------------
if [ ! -f "$CONTEXT_FILE" ]; then
  echo "[post-commit] No context file at $CONTEXT_FILE — skipping rotation check" >&2
  exit 0
fi

session_id=$(cat "$CONTEXT_FILE" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)
spec_id=$(cat "$CONTEXT_FILE" | grep -o '"spec_id":"[^"]*"' | head -1 | cut -d'"' -f4)
claude_pid=$(cat "$CONTEXT_FILE" | grep -o '"claude_pid":[0-9]*' | head -1 | grep -o '[0-9]*')

if [ -z "$session_id" ]; then
  echo "[post-commit] No session_id in context file — skipping" >&2
  exit 0
fi

# ---------------------------------------------------------------------------
# Check context utilization (remaining tokens)
# ---------------------------------------------------------------------------
kv_raw=$("$TOOLS_DIR/bin/cctx" "$session_id" --kv 2>/dev/null || echo "")

if [ -z "$kv_raw" ]; then
  echo "[post-commit] Could not read context for session $session_id — skipping" >&2
  exit 0
fi

# Extract remaining tokens and utilization percent from key-value output
remaining=$(echo "$kv_raw" | grep '^remaining_tokens=' | cut -d'=' -f2)
percent=$(echo "$kv_raw" | grep '^utilization_percent=' | cut -d'=' -f2)

if [ -z "$remaining" ] || ! [[ "$remaining" =~ ^[0-9]+$ ]]; then
  echo "[post-commit] Could not parse remaining tokens from cctx — skipping" >&2
  exit 0
fi

echo "[post-commit] Remaining: ${remaining} tokens (${percent} used), rotate when < ${REMAINING_TOKEN_THRESHOLD} remaining" >&2

if [ "$remaining" -ge "$REMAINING_TOKEN_THRESHOLD" ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Context is low — kill and rotate
# ---------------------------------------------------------------------------
echo "[post-commit] Only ${remaining} tokens remaining (< ${REMAINING_TOKEN_THRESHOLD}) — rotating session" >&2

# Kill the Claude process
if [ -n "$claude_pid" ] && kill -0 "$claude_pid" 2>/dev/null; then
  echo "[post-commit] Killing Claude process $claude_pid" >&2
  kill "$claude_pid" 2>/dev/null || true
fi

# Write a signal file for auto-implement to detect the rotation
# (auto-implement polls for this and spawns the handoff writer + next session)
cat > /tmp/auto-impl-rotation.json << EOF
{
  "reason": "context_rotation",
  "killed_session_id": "$session_id",
  "spec_id": "$spec_id",
  "remaining_tokens": $remaining,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "[post-commit] Rotation signal written to /tmp/auto-impl-rotation.json" >&2
echo "[post-commit] Auto-implement will spawn handoff writer and continue" >&2

exit 0
