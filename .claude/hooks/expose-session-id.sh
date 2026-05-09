#!/bin/bash
# SessionStart hook:
#   1. Exports CLAUDE_SESSION_ID via $CLAUDE_ENV_FILE so the running shell
#      (and tools that source it) can read the session id.
#   2. Drops .claude/.session-id so sub-agents (which don't get SessionStart)
#      can pick it up via the prepare-commit-msg hook.
#   3. Emits a short stdout banner so Claude itself learns its own session id
#      and that $CLAUDE_SESSION_ID is set in the environment.

set -e

# Read hook input from stdin (JSON)
INPUT=$(cat)

# Parse session_id from input
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

[ -z "$SESSION_ID" ] && exit 0

# 1. Export into the session env (only when CLAUDE_ENV_FILE is set)
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export CLAUDE_SESSION_ID=\"$SESSION_ID\"" >> "$CLAUDE_ENV_FILE"
fi

# 2. Drop a well-known file for sub-agents
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$REPO_ROOT" ]; then
  echo "$SESSION_ID" > "$REPO_ROOT/.claude/.session-id"
fi

# 3. Banner — tells Claude its own session id and that the env var is set
cat <<BANNER
═══════════════════════════════════════════════════════════════════
🆔  SESSION ID  (banner from .claude/hooks/expose-session-id.sh)
═══════════════════════════════════════════════════════════════════
Session ID: ${SESSION_ID}
Also exported as \$CLAUDE_SESSION_ID (and in .claude/.session-id).
═══════════════════════════════════════════════════════════════════
BANNER
