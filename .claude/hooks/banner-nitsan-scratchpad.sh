#!/bin/bash
# SessionStart hook (nitsan-only): surface recent state of the personal scratchpad.
# Silent for any other live user.
#
# Order (oldest → newest, reads as a timeline):
#   - Last 5 commit diffs touching the scratchpad
#   - Staged (--cached) diff
#   - Unstaged diff
#
# Output passes through `rtk` (Rust token-optimizing CLI) when available — drops
# `index`/`diff --git`/`---`/`+++` headers, keeps hunks. Falls back to raw git
# if rtk is missing.
#
# Identity: dx identify (single source of truth, same as live-user banner).

set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-/workspaces/test-mvp}"
SCRATCHPAD="docs/plan/nitsan.scratchpad.md"

# --- Identity gate ----------------------------------------------------------

if ! command -v dx >/dev/null 2>&1; then exit 0; fi
live_user=$(dx identify 2>/dev/null | awk -F'"' '/"user":/ {print $4; exit}')
[ "$live_user" = "nitsan" ] || exit 0

[ -f "$REPO_ROOT/$SCRATCHPAD" ] || exit 0

# --- rtk wrappers -----------------------------------------------------------
#
# rtk's own stderr ("/!\ No hook installed") is suppressed here; that warning
# is for the user, not the agent. If rtk isn't on PATH, fall back to raw git.

USE_RTK=0
if command -v rtk >/dev/null 2>&1; then USE_RTK=1; fi

g() {
  # `g <git-args...>` — runs through rtk if available, raw git otherwise.
  if [ "$USE_RTK" = 1 ]; then
    rtk git "$@" 2>/dev/null
  else
    git -C "$REPO_ROOT" "$@"
  fi
}

# --- Recent commit diffs (last 5, oldest-first) -----------------------------
#
# Loop SHAs and call `rtk git show <sha> -- <file>` per commit so we keep
# compact-diff output AND commit metadata (author/subject/date). `rtk git log
# -p` elides hunk content, which defeats the banner.

shas=$(git -C "$REPO_ROOT" log -n 5 --reverse --pretty=format:'%H' -- "$SCRATCHPAD" 2>/dev/null)

log_block=""
if [ -n "$shas" ]; then
  while IFS= read -r sha; do
    [ -z "$sha" ] && continue
    show_out=$(g show "$sha" -- "$SCRATCHPAD")
    log_block+="$show_out"$'\n\n'
  done <<< "$shas"
fi

# --- Current staged + unstaged diffs ----------------------------------------

render_diff() {
  local label=$1 cached_flag=$2
  local lines body
  lines=$(git -C "$REPO_ROOT" diff $cached_flag -- "$SCRATCHPAD" 2>/dev/null | wc -l | tr -d ' ')
  [ "${lines:-0}" -eq 0 ] && return
  body=$(g diff $cached_flag -- "$SCRATCHPAD")
  echo
  echo "${label}:"
  echo "$body"
}

staged_lines=$(git -C "$REPO_ROOT" diff --cached -- "$SCRATCHPAD" 2>/dev/null | wc -l | tr -d ' ')
unstaged_lines=$(git -C "$REPO_ROOT" diff -- "$SCRATCHPAD" 2>/dev/null | wc -l | tr -d ' ')

# Suppress entirely if nothing to say.
[ -z "$log_block" ] && [ "${staged_lines:-0}" -eq 0 ] && [ "${unstaged_lines:-0}" -eq 0 ] && exit 0

cat <<BANNER
═══════════════════════════════════════════════════════════════════
📓  NITSAN SCRATCHPAD  (banner from .claude/hooks/banner-nitsan-scratchpad.sh)
═══════════════════════════════════════════════════════════════════
Path: $SCRATCHPAD
BANNER

if [ -n "$log_block" ]; then
  echo
  echo "Recent commit diffs (oldest → newest):"
  printf '%s' "$log_block"
fi

render_diff "Staged (--cached)" "--cached"
render_diff "Unstaged" ""

echo "═══════════════════════════════════════════════════════════════════"
