#!/usr/bin/env bash
# End-to-end demo. Live fetch -> normalize -> index -> query with citation.
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHONPATH=. exec uv run python scripts/run_e2e.py "$@"
