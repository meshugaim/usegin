#!/bin/bash
# SessionStart hook: orient the agent about the live user — the human
# currently in the chat (as opposed to the git owner or anyone named in
# shared memory).
#
# Single source of truth: `dx identify --json`. Memory at
# ~/.claude/projects/-workspaces-test-mvp/memory/ is shared across the team
# (devcontainer-cloned), so per-human identity must NOT come from there.
# This banner is the canonical answer; in-chat signals (signature, language,
# topic) override if they conflict.
#
# Silent if dx is missing or returns no match — the agent then falls back
# to second-person ("you") per reference_memory_is_team_shared.md.

set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-/workspaces/test-mvp}"
DX="$REPO_ROOT/tools/bin/dx"

[ -x "$DX" ] || exit 0

OUT=$("$DX" identify --json 2>/dev/null) || exit 0

USER=$(echo "$OUT" | jq -r '.user // empty')
[ -n "$USER" ] || exit 0

SIGNALS=$(echo "$OUT" | jq -r '[.signals[] | "\(.signal)=\(.value)"] | join(", ")')

cat <<BANNER
═══════════════════════════════════════════════════════════════════
👤  LIVE USER: ${USER}
═══════════════════════════════════════════════════════════════════
Source of truth: \`dx identify\` (signals: ${SIGNALS}).

The auto-memory store is team-shared across devcontainers — never trust
it for per-human identity. When a memory note attributes a preference to
"the user", check whether the live user is the same person who gave the
feedback before applying it.

If wrong: \`dx identify --as <name>\` to correct, or trust in-chat signals.
═══════════════════════════════════════════════════════════════════
BANNER
