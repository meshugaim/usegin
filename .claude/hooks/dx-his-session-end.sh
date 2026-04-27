#!/usr/bin/env bash
# SessionEnd hook → dx his hook-session-end, PATH-resilient.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DX_BIN="$REPO_ROOT/tools/bin/dx"

if [[ ! -x "$DX_BIN" ]]; then
  echo '{"continue":true}'
  exit 0
fi

exec "$DX_BIN" his hook-session-end
