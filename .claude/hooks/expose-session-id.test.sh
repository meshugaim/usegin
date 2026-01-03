#!/bin/bash
# Test for expose-session-id.sh hook

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/expose-session-id.sh"

# Create temp file for env output
ENV_FILE=$(mktemp)
trap "rm -f $ENV_FILE" EXIT

echo "Test 1: Hook sets CLAUDE_SESSION_ID when session_id is provided"
INPUT='{"session_id": "test-session-123", "trigger": "startup"}'
export CLAUDE_ENV_FILE="$ENV_FILE"
echo "$INPUT" | "$HOOK_SCRIPT"

if grep -q 'export CLAUDE_SESSION_ID="test-session-123"' "$ENV_FILE"; then
  echo "  PASS: CLAUDE_SESSION_ID was set correctly"
else
  echo "  FAIL: Expected CLAUDE_SESSION_ID to be set"
  cat "$ENV_FILE"
  exit 1
fi

# Clear the file for next test
> "$ENV_FILE"

echo "Test 2: Hook handles missing session_id gracefully"
INPUT='{"trigger": "startup"}'
echo "$INPUT" | "$HOOK_SCRIPT"

if [ ! -s "$ENV_FILE" ]; then
  echo "  PASS: No output when session_id is missing"
else
  echo "  FAIL: Expected no output, got:"
  cat "$ENV_FILE"
  exit 1
fi

# Clear the file for next test
> "$ENV_FILE"

echo "Test 3: Hook does nothing when CLAUDE_ENV_FILE is not set"
INPUT='{"session_id": "test-session-456"}'
# Unset CLAUDE_ENV_FILE
unset CLAUDE_ENV_FILE
echo "$INPUT" | "$HOOK_SCRIPT"
echo "  PASS: Hook exits cleanly without CLAUDE_ENV_FILE"

echo ""
echo "All tests passed!"
