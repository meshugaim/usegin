#!/bin/bash
# Tests for banner-env-status.sh — focused on the Sync row added by ENG-5993.
#
# Daemon liveness, auth state, and state-file inputs are stubbed via env
# vars (see the row's comment block in banner-env-status.sh). Each case
# asserts on the rendered `Sync:` line; the other rows are out of scope.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/banner-env-status.sh"

TMPROOT=$(mktemp -d)
trap "rm -rf $TMPROOT" EXIT

AUTH_OK="Profile: dev@askeffi.ai:prod
Logged in as dev@askeffi.ai
API: https://app.askeffi.ai"

AUTH_EXPIRED="Profile: dev@askeffi.ai:prod
Logged in as dev@askeffi.ai
API: https://app.askeffi.ai
Token expired — run 'effi auth refresh' or 'effi auth login'"

AUTH_MISSING="Not authenticated"

# Build a state.json with one entry whose lastUploadedAt is N seconds ago.
# Echoed timestamp uses UTC ISO-8601 (matches the daemon's writer).
write_state() {
  local dir="$1" age_s="$2"
  local iso
  iso=$(date -u -d "@$(( $(date +%s) - age_s ))" +"%Y-%m-%dT%H:%M:%S.000Z")
  mkdir -p "$dir"
  cat >"$dir/state.json" <<JSON
{
  "/home/x/.claude/projects/p/abc.jsonl": {
    "contentHash": "deadbeef",
    "lastUploadedSize": 100,
    "sessionId": "abc",
    "storagePath": "abc/2026-05-14/abc.jsonl.gz",
    "lastUploadedAt": "$iso"
  }
}
JSON
}

run() {
  local daemon="$1" auth="$2" age_s="${3:-}"
  local statedir="$TMPROOT/state-$RANDOM"
  if [ -n "$age_s" ]; then
    write_state "$statedir" "$age_s"
  else
    mkdir -p "$statedir"
  fi
  BANNER_SYNC_DAEMON_STATE="$daemon" \
    BANNER_SYNC_EFFI_AUTH_STATUS="$auth" \
    SESSION_SYNC_STATE_DIR="$statedir" \
    bash "$HOOK_SCRIPT"
}

assert_sync_contains() {
  local label="$1" haystack="$2" needle="$3"
  local sync_line
  sync_line=$(echo "$haystack" | grep "^Sync:" || true)
  if echo "$sync_line" | grep -qF "$needle"; then
    echo "  PASS: $label"
  else
    echo "  FAIL: $label"
    echo "    expected substring: $needle"
    echo "    got Sync line:      $sync_line"
    exit 1
  fi
}

echo "Test 1: online + auth ok + fresh upload (~30s) → ✅"
OUT=$(run online "$AUTH_OK" 30)
assert_sync_contains "renders ✅" "$OUT" "✅ session-sync online"
assert_sync_contains "includes profile" "$OUT" "dev@askeffi.ai:prod"
assert_sync_contains "shows age" "$OUT" "last upload 30s ago"

echo "Test 2: online + auth ok + stale upload (~25 min) → ⚠ stale"
OUT=$(run online "$AUTH_OK" 1500)
assert_sync_contains "renders ⚠ stale" "$OUT" "⚠  session-sync stale"
assert_sync_contains "shows minutes age" "$OUT" "25m ago"
assert_sync_contains "names the expected freq" "$OUT" "expected <2m while active"

echo "Test 3: online + auth expired → ⚠ auth expired"
OUT=$(run online "$AUTH_EXPIRED" 30)
assert_sync_contains "renders ⚠ auth" "$OUT" "⚠  session-sync auth expired"
assert_sync_contains "remediation includes refresh+restart" "$OUT" \
  "effi auth refresh && bun pm2 restart session-sync"

echo "Test 4: daemon down + auth ok → ❌ DOWN"
OUT=$(run down "$AUTH_OK" 30)
assert_sync_contains "renders ❌ DOWN" "$OUT" "❌ session-sync DOWN"
assert_sync_contains "no (auth) qualifier" "$OUT" "bun pm2 start tools/session-sync"
# Negative assertion — make sure we DIDN'T print the (auth) variant.
if echo "$OUT" | grep -q "DOWN (auth)"; then
  echo "  FAIL: unexpected '(auth)' qualifier on plain-DOWN case"
  exit 1
fi
echo "  PASS: omits '(auth)' qualifier when auth is ok"

echo "Test 5: daemon down + auth expired → ❌ DOWN (auth) with combined fix"
OUT=$(run down "$AUTH_EXPIRED" 30)
assert_sync_contains "renders ❌ DOWN (auth)" "$OUT" "❌ session-sync DOWN (auth)"
assert_sync_contains "combined remediation" "$OUT" \
  "effi auth refresh && bun pm2 start tools/session-sync/ecosystem.config.cjs"

echo "Test 6: down + auth missing → ❌ DOWN (auth)"
OUT=$(run down "$AUTH_MISSING")
assert_sync_contains "renders ❌ DOWN (auth) for missing creds" "$OUT" \
  "❌ session-sync DOWN (auth)"

echo "Test 7: online + auth ok + no state.json → ✅ without age suffix"
OUT=$(run online "$AUTH_OK")
assert_sync_contains "still renders ✅" "$OUT" "✅ session-sync online"
if echo "$OUT" | grep "^Sync:" | grep -q "last upload"; then
  echo "  FAIL: rendered 'last upload' clause with no state.json"
  echo "$OUT"
  exit 1
fi
echo "  PASS: omits 'last upload' clause when state.json is absent"

echo "Test 8: budget — full hook runs in <500ms"
START=$(date +%s%N)
run online "$AUTH_OK" 30 >/dev/null
END=$(date +%s%N)
ELAPSED_MS=$(( (END - START) / 1000000 ))
if [ "$ELAPSED_MS" -lt 500 ]; then
  echo "  PASS: ran in ${ELAPSED_MS}ms (<500ms budget)"
else
  echo "  FAIL: ran in ${ELAPSED_MS}ms (≥500ms budget)"
  exit 1
fi

# --- Host row: devbox detection (DMI-gated, metadata name) ------------------
#
# The Host row reads /sys/class/dmi/id/sys_vendor (free) to gate a Hetzner
# devbox, then resolves the box name from cloud metadata. Both inputs are
# stubbed (BANNER_DMI_VENDOR / BANNER_BOX_NAME) so these never touch /sys or
# the network — important since the CI/dev machine running the test may itself
# be a Hetzner box. Sync stubs keep the Sync row inert.

assert_host_contains() {
  local label="$1" haystack="$2" needle="$3"
  local host_line
  host_line=$(echo "$haystack" | grep "^Host:" || true)
  if echo "$host_line" | grep -qF "$needle"; then
    echo "  PASS: $label"
  else
    echo "  FAIL: $label"
    echo "    expected substring: $needle"
    echo "    got Host line:      $host_line"
    exit 1
  fi
}

mkdir -p "$TMPROOT/hoststate"
HOST_SYNC_STUBS=(
  BANNER_SYNC_DAEMON_STATE=online
  BANNER_SYNC_EFFI_AUTH_STATUS="$AUTH_OK"
  SESSION_SYNC_STATE_DIR="$TMPROOT/hoststate"
)

echo "Test 9: DMI vendor Hetzner + box name → Host: devbox · <name>"
OUT=$(env "${HOST_SYNC_STUBS[@]}" BANNER_DMI_VENDOR=Hetzner BANNER_BOX_NAME=nitsan-dev bash "$HOOK_SCRIPT")
assert_host_contains "shows devbox + box name" "$OUT" "devbox · nitsan-dev"

echo "Test 10: non-Hetzner DMI vendor → Host: local · <hostname>"
OUT=$(env "${HOST_SYNC_STUBS[@]}" BANNER_DMI_VENDOR=QEMU bash "$HOOK_SCRIPT")
assert_host_contains "falls back to local" "$OUT" "local · $(hostname)"

echo "Test 11: Hetzner but name unresolved → Host: devbox · unknown"
OUT=$(env "${HOST_SYNC_STUBS[@]}" BANNER_DMI_VENDOR=Hetzner BANNER_BOX_NAME= bash "$HOOK_SCRIPT")
assert_host_contains "devbox without a name shows unknown" "$OUT" "devbox · unknown"

echo ""
echo "All tests passed!"
