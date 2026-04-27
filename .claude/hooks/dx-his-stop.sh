#!/usr/bin/env bash
# Stop hook → dx his hook-stop, PATH-resilient.
#
# Hook subprocesses don't always inherit the user's PATH (esp. when invoked
# by Claude Code from a different cwd). We resolve the dx CLI through the
# repo's own tools/bin instead of relying on `dx` being on PATH.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DX_BIN="$REPO_ROOT/tools/bin/dx"

if [[ ! -x "$DX_BIN" ]]; then
  # If the bin shim isn't there for some reason, allow stop and don't surface
  # the failure to Claude — telemetry is best-effort, never block on it.
  echo '{"continue":true}'
  exit 0
fi

exec "$DX_BIN" his hook-stop
