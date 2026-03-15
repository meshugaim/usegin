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
CONTEXT_THRESHOLD=30
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
# Check context utilization
# ---------------------------------------------------------------------------
percent_raw=$("$TOOLS_DIR/bin/cctx" "$session_id" --percent 2>/dev/null || echo "")

if [ -z "$percent_raw" ]; then
  echo "[post-commit] Could not read context for session $session_id — skipping" >&2
  exit 0
fi

# Strip the % sign and convert to integer
percent=$(echo "$percent_raw" | sed 's/%//' | cut -d'.' -f1)

if [ -z "$percent" ] || ! [[ "$percent" =~ ^[0-9]+$ ]]; then
  echo "[post-commit] Could not parse context percent: '$percent_raw' — skipping" >&2
  exit 0
fi

echo "[post-commit] Context utilization: ${percent}% (threshold: ${CONTEXT_THRESHOLD}%)" >&2

if [ "$percent" -le "$CONTEXT_THRESHOLD" ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Context is over threshold — kill and rotate
# ---------------------------------------------------------------------------
echo "[post-commit] Context at ${percent}% (>${CONTEXT_THRESHOLD}%) — rotating session" >&2

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
  "context_percent": $percent,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "[post-commit] Rotation signal written to /tmp/auto-impl-rotation.json" >&2
echo "[post-commit] Auto-implement will spawn handoff writer and continue" >&2

exit 0
