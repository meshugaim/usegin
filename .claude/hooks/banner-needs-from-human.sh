#!/bin/bash
# SessionStart hook: print a loud banner for human-side pending items
# (auth, paste, click, decision — anything only a human at the keyboard
# can resolve, regardless of which human).
# Reads oria-crazy-world/ground/oria-crazy-space/_NEEDS-FROM-HUMAN.md
# (legacy path: _NEEDS-FROM-LIHU.md — kept as fallback during migration).
# Empty body or missing file = silent (no behavior change).
# Author: Zisser session 843f23c9 (2026-04-28). Renamed to "from-human"
# 2026-05-06 (identity-resolution Layer 3) — items belong to whichever
# human is at the keyboard, not Lihu specifically. Reversible: delete
# the hook entry from .claude/settings.json or delete the .md file.

set -u
OCW_BASE="${CLAUDE_PROJECT_DIR:-/workspaces/test-mvp}/oria-crazy-world/ground/oria-crazy-space"
NEEDS_FILE="$OCW_BASE/_NEEDS-FROM-HUMAN.md"
[ -f "$NEEDS_FILE" ] || NEEDS_FILE="$OCW_BASE/_NEEDS-FROM-LIHU.md"

# Silent if file missing or empty
[ -f "$NEEDS_FILE" ] || exit 0
[ -s "$NEEDS_FILE" ] || exit 0
# Silent if file body (ignoring frontmatter/comments) is effectively empty
content_lines=$(grep -v -E '^\s*$|^\s*>|^\s*<!--' "$NEEDS_FILE" | wc -l)
[ "$content_lines" -lt 3 ] && exit 0

cat <<BANNER
═══════════════════════════════════════════════════════════════════
🛑  HUMAN-SIDE PENDING ITEMS  (banner from .claude/hooks/banner-needs-from-human.sh)
═══════════════════════════════════════════════════════════════════

The following are *only* resolvable by a human (auth, paste, click, decision).
Open items live in: ${NEEDS_FILE#${CLAUDE_PROJECT_DIR:-/workspaces/test-mvp}/}

BANNER

cat "$NEEDS_FILE"

cat <<'BANNER'

═══════════════════════════════════════════════════════════════════
Clear an item: delete its block in the .md file (empty body = silent).
═══════════════════════════════════════════════════════════════════
BANNER
