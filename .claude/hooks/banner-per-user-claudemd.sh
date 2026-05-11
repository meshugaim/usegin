#!/bin/bash
# SessionStart hook: surface <live_user>.CLAUDE.md at repo root.
# Silent if live user can't be resolved, or file is missing/empty.
#
# Identity: dx identify (single source of truth, same as live-user banner).

set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-/workspaces/test-mvp}"

if ! command -v dx >/dev/null 2>&1; then exit 0; fi
live_user=$(dx identify 2>/dev/null | awk -F'"' '/"user":/ {print $4; exit}')
[ -n "$live_user" ] || exit 0

personal_claudemd="${live_user}.CLAUDE.md"
[ -f "$REPO_ROOT/$personal_claudemd" ] || exit 0
[ -s "$REPO_ROOT/$personal_claudemd" ] || exit 0

cat <<BANNER
═══════════════════════════════════════════════════════════════════
📘  ${live_user^^} CLAUDE.md  (banner from .claude/hooks/banner-per-user-claudemd.sh)
═══════════════════════════════════════════════════════════════════
Path: $personal_claudemd
Per-user instructions, surfaced only when live user is ${live_user}.
Treat as additive to project CLAUDE.md.
───────────────────────────────────────────────────────────────────
BANNER

cat "$REPO_ROOT/$personal_claudemd"

echo "═══════════════════════════════════════════════════════════════════"
