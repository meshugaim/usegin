#!/bin/bash
# Test for expose-session-id.sh hook

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/expose-session-id.sh"

ENV_FILE=$(mktemp)
trap "rm -f $ENV_FILE" EXIT

echo "Test 1: Hook sets CLAUDE_SESSION_ID and emits banner when session_id is provided"
INPUT='{"session_id": "test-session-123", "trigger": "startup"}'
export CLAUDE_ENV_FILE="$ENV_FILE"
OUTPUT=$(echo "$INPUT" | "$HOOK_SCRIPT")

if grep -q 'export CLAUDE_SESSION_ID="test-session-123"' "$ENV_FILE"; then
  echo "  PASS: CLAUDE_SESSION_ID was set correctly"
else
  echo "  FAIL: Expected CLAUDE_SESSION_ID to be set"
  cat "$ENV_FILE"
  exit 1
fi

if echo "$OUTPUT" | grep -q "Session ID: test-session-123" \
   && echo "$OUTPUT" | grep -q '\$CLAUDE_SESSION_ID'; then
  echo "  PASS: Banner names session id and env var"
else
  echo "  FAIL: Expected banner with session id and env-var name, got:"
  echo "$OUTPUT"
  exit 1
fi

> "$ENV_FILE"

echo "Test 2: Hook handles missing session_id gracefully"
INPUT='{"trigger": "startup"}'
OUTPUT=$(echo "$INPUT" | "$HOOK_SCRIPT")

if [ ! -s "$ENV_FILE" ] && [ -z "$OUTPUT" ]; then
  echo "  PASS: No env-file write and no banner when session_id is missing"
else
  echo "  FAIL: Expected silence, got env=$(cat "$ENV_FILE") stdout=$OUTPUT"
  exit 1
fi

> "$ENV_FILE"

echo "Test 3: Hook still emits banner when CLAUDE_ENV_FILE is not set"
INPUT='{"session_id": "test-session-456"}'
unset CLAUDE_ENV_FILE
OUTPUT=$(echo "$INPUT" | "$HOOK_SCRIPT")

if echo "$OUTPUT" | grep -q "Session ID: test-session-456"; then
  echo "  PASS: Banner emitted even without CLAUDE_ENV_FILE"
else
  echo "  FAIL: Expected banner without CLAUDE_ENV_FILE, got:"
  echo "$OUTPUT"
  exit 1
fi

echo ""
echo "All tests passed!"
