#!/usr/bin/env bash
# Fetch a prod Effi session JSONL from the Supabase `conversations` bucket.
#
# Requires:
#   - SUPABASE_ACCESS_TOKEN in env (supabase personal access token)
#   - `bunx supabase` on PATH
#
# Usage:
#   fetch_session.sh <user_id> <session_id> [out_path]
#   fetch_session.sh <storage_path>        [out_path]   # single-arg form
#
# storage_path shape: "<user_id>/<session_id>.jsonl"
#
# The bucket is `conversations` and the prod project ref is
# `becbrfnfxrgezhtkrsrm`. We link once per workdir, then `storage cp`.
#
# Read-only. Does not write to prod.

set -euo pipefail

PROD_PROJECT_REF="becbrfnfxrgezhtkrsrm"
BUCKET="conversations"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <user_id> <session_id> [out_path]" >&2
  echo "   or: $0 <user_id>/<session_id>.jsonl [out_path]" >&2
  exit 2
fi

if [[ "$1" == */* ]]; then
  storage_path="$1"
  out_path="${2:-$(basename "$storage_path")}"
else
  user_id="$1"
  session_id="$2"
  storage_path="${user_id}/${session_id}.jsonl"
  out_path="${3:-${session_id}.jsonl}"
fi

# Need a workdir with a Supabase link. Use a per-user cache dir; create once.
link_dir="${TMPDIR:-/tmp}/effi-audit-link-${USER:-anon}"
mkdir -p "$link_dir"
cd "$link_dir"
if [[ ! -f supabase/.temp/project-ref || "$(cat supabase/.temp/project-ref 2>/dev/null)" != "$PROD_PROJECT_REF" ]]; then
  bunx supabase link --project-ref "$PROD_PROJECT_REF" >/dev/null
fi

bunx supabase storage cp \
  "ss:///${BUCKET}/${storage_path}" \
  "$out_path" \
  --experimental >/dev/null

# Print the absolute path of the downloaded file to stdout.
realpath "$out_path"
