#!/bin/bash
# SessionStart hook (nitsan-only): surface recent state of the personal scratchpad.
# Silent for any other live user.
#
# Order (oldest → newest, reads as a timeline):
#   - Last 5 commit diffs touching the scratchpad
#   - Staged (--cached) diff
#   - Unstaged diff
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

# --- Recent commit diffs (last 5, oldest-first, capped) ---------------------
#
# `git log --reverse` walks oldest→newest within the -n 5 slice. Full -p output
# can balloon; cap at 400 lines total — if over, fall back to per-commit --stat
# so the agent still sees what changed, just not line-level.

log_p=$(git -C "$REPO_ROOT" log -n 5 --reverse -p --pretty=format:'━━━ %h %ar %s' -- "$SCRATCHPAD" 2>/dev/null)
log_p_lines=$(printf '%s\n' "$log_p" | wc -l | tr -d ' ')
if [ "${log_p_lines:-0}" -gt 400 ]; then
  log_p=$(git -C "$REPO_ROOT" log -n 5 --reverse --stat --pretty=format:'━━━ %h %ar %s' -- "$SCRATCHPAD" 2>/dev/null)
  log_p="${log_p}

  (full -p output was ${log_p_lines} lines — collapsed to --stat; run \`git log -n 5 --reverse -p -- ${SCRATCHPAD}\` to read)"
fi

# --- Current diff: staged + unstaged ----------------------------------------
#
# Each is independently size-capped at 60 lines; over the cap we fall back to
# --stat with a pointer to the full command.

render_diff() {
  local label=$1 cached_flag=$2
  local lines body
  lines=$(git -C "$REPO_ROOT" diff $cached_flag -- "$SCRATCHPAD" 2>/dev/null | wc -l | tr -d ' ')
  [ "${lines:-0}" -eq 0 ] && return
  if [ "$lines" -le 60 ]; then
    body=$(git -C "$REPO_ROOT" diff $cached_flag -- "$SCRATCHPAD")
  else
    body=$(git -C "$REPO_ROOT" diff $cached_flag --stat -- "$SCRATCHPAD")
    body="${body}
  (${lines} lines of diff — run \`git diff $cached_flag -- ${SCRATCHPAD}\` to read)"
  fi
  echo
  echo "${label}:"
  echo "$body"
}

staged_lines=$(git -C "$REPO_ROOT" diff --cached -- "$SCRATCHPAD" 2>/dev/null | wc -l | tr -d ' ')
unstaged_lines=$(git -C "$REPO_ROOT" diff -- "$SCRATCHPAD" 2>/dev/null | wc -l | tr -d ' ')

# Suppress entirely if nothing to say.
[ -z "$log_p" ] && [ "${staged_lines:-0}" -eq 0 ] && [ "${unstaged_lines:-0}" -eq 0 ] && exit 0

cat <<BANNER
═══════════════════════════════════════════════════════════════════
📓  NITSAN SCRATCHPAD  (banner from .claude/hooks/banner-nitsan-scratchpad.sh)
═══════════════════════════════════════════════════════════════════
Path: $SCRATCHPAD
BANNER

if [ -n "$log_p" ]; then
  echo
  echo "Recent commit diffs (oldest → newest):"
  echo "$log_p"
fi

render_diff "Staged (--cached)" "--cached"
render_diff "Unstaged" ""

echo "═══════════════════════════════════════════════════════════════════"
