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
# Silent only if dx itself is missing. On unresolved user, print a loud
# "unknown" banner with the raw signals — silence is the wrong failure
# mode (the agent then defaults to whatever name the persona prose names,
# and we get cross-human misaddressing). See
# zisser/plans/2026-05-05-identity-resolution.md for the cluster.

set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-/workspaces/test-mvp}"
DX="$REPO_ROOT/tools/bin/dx"

[ -x "$DX" ] || exit 0

OUT=$("$DX" identify --json 2>/dev/null) || exit 0

USER=$(echo "$OUT" | jq -r '.user // empty')
SIGNALS=$(echo "$OUT" | jq -r '[.signals[] | "\(.signal)=\(.value)"] | join(", ")')

CONFIG="$REPO_ROOT/.dx/config.json"
TEAM=""
if [ -f "$CONFIG" ]; then
  TEAM=$(jq -r '.users | keys | join(", ")' "$CONFIG" 2>/dev/null)
fi

if [ -n "$USER" ]; then
  cat <<BANNER
═══════════════════════════════════════════════════════════════════
👤  LIVE USER: ${USER}
═══════════════════════════════════════════════════════════════════
Source of truth: \`dx identify\` (signals: ${SIGNALS}).

Team roster (from \`.dx/config.json\` users): ${TEAM:-unknown}.
Other teammates' names show up in shared auto-memory because the store is
team-shared across devcontainers, so it's not a reliable signal for who's
in the chat right now. Address the live user directly as "you" rather
than pairing them with another teammate's name.

If this isn't right: \`dx identify --as <name>\` to correct, or just trust
the in-chat signals.
═══════════════════════════════════════════════════════════════════
BANNER
else
  cat <<BANNER
═══════════════════════════════════════════════════════════════════
👤  LIVE USER: unknown — \`dx identify\` couldn't resolve
═══════════════════════════════════════════════════════════════════
Signals: ${SIGNALS}

Team roster (from \`.dx/config.json\` users): ${TEAM:-unknown}.

Nothing in \`.dx/config.json users[]\` matched these signals. Until
this is fixed:

  • Trust in-chat signals (signature, language, "I'm <name>").
  • DO NOT default to a name from persona prose (e.g. "Lihu speaks"
    in zisser/CLAUDE.md, "Hi Lihu" in handoff docs, "Known Users"
    tables in skills) — those are defaults, not facts about who is
    typing right now.
  • Fix it in this session: \`dx identify --as <name>\` (writes a
    cache the next session will pick up). For permanent fix, add
    aliases to \`.dx/config.json\`.
═══════════════════════════════════════════════════════════════════
BANNER
fi
