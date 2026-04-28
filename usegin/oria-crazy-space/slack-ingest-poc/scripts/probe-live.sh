#!/usr/bin/env bash
# Live-wire half-test. Prints "ok=True" three times when wire is healthy.
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHONPATH=. exec uv run python scripts/probe_live.py "$@"
