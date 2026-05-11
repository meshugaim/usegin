#!/bin/bash
# SessionStart hook: orient the agent about the current devcontainer env.
# Per-row suppression — only print rows that carry signal:
#
#   Host  : always (env id is the anchor for cross-env work)
#   Tmux  : only when TMUX is set AND the window name isn't the default
#   Git   : only when branch != main, OR working tree dirty, OR HEAD != @{u}
#   Agent : only when `just agent-dev` is running
#
# If only Host would print and there's nothing else, still print Host so the
# agent has the env id at hand for the rest of the session.
#
# Detection mirrors .claude/skills/serve-static/scripts/serve.sh:
#   Gitpod/Ona : GITPOD_API_URL || GITPOD_WORKSPACE_ID + `ona` CLI
#   Codespaces : CODESPACES == "true" + CODESPACE_NAME
#   else       : local
#
# Env id resolution on Gitpod/Ona is via `ona environment list` (~500ms),
# cached to /tmp/banner-env-id-$$ for the lifetime of the devcontainer
# (regenerated if missing). Hook is silent on any unexpected error — this is
# a nice-to-have, not a gate.

set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-/workspaces/test-mvp}"

# --- Host detection ---------------------------------------------------------

host=""
host_detail=""

if { [ -n "${GITPOD_API_URL:-}" ] || [ -n "${GITPOD_WORKSPACE_ID:-}" ]; } && command -v ona >/dev/null 2>&1; then
  host="Gitpod/Ona"
  cache=/tmp/banner-env-id
  if [ -s "$cache" ]; then
    env_id=$(cat "$cache")
  else
    # `ona environment list` prints the running envs for this account; in
    # practice that's just this one. Take the first id, short-form.
    env_id=$(ona environment list --field id 2>/dev/null | awk 'NR==1 && $1 ~ /^[0-9a-f]{8}-/ {print substr($1,1,8); exit}')
    [ -n "$env_id" ] && echo "$env_id" > "$cache"
  fi
  host_detail="env ${env_id:-unknown}"
elif [ "${CODESPACES:-}" = "true" ] && [ -n "${CODESPACE_NAME:-}" ]; then
  host="Codespaces"
  host_detail="$CODESPACE_NAME"
else
  host="local"
  host_detail="$(hostname)"
fi

# --- Tmux row ---------------------------------------------------------------

tmux_row=""
if [ -n "${TMUX:-}" ] && command -v tmux >/dev/null 2>&1; then
  tmux_label=$(tmux display-message -p '#S:#W' 2>/dev/null || true)
  window=${tmux_label##*:}
  # Suppress default-looking labels — purely numeric, "bash"/"zsh", empty.
  # The human-set window name is the signal (e.g. "gaps", "wip", "review").
  if [ -n "$window" ] && [ "$window" != "bash" ] && [ "$window" != "zsh" ] \
     && ! [[ "$window" =~ ^[0-9]+$ ]]; then
    tmux_row="$tmux_label"
  fi
fi

# --- Git row ----------------------------------------------------------------

git_row=""
if git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
  dirty=$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  ahead_behind=$(git -C "$REPO_ROOT" rev-list --left-right --count HEAD...@{u} 2>/dev/null || echo "0	0")
  ahead=$(echo "$ahead_behind" | awk '{print $1}')
  behind=$(echo "$ahead_behind" | awk '{print $2}')

  parts=()
  [ "$branch" != "main" ] && parts+=("$branch")
  [ "${ahead:-0}" -gt 0 ] && parts+=("$ahead ahead")
  [ "${behind:-0}" -gt 0 ] && parts+=("$behind behind")
  [ "${dirty:-0}" -gt 0 ] && parts+=("$dirty dirty")

  if [ ${#parts[@]} -gt 0 ]; then
    git_row="${parts[0]}"
    for p in "${parts[@]:1}"; do git_row="${git_row} · ${p}"; done
  fi
fi

# --- Agent dev-server row ---------------------------------------------------

agent_row=""
# Cheap port probe — no `just` subprocess. Matches ports in justfile (63000/58000/8969).
running_ports=()
for port in 63000 58000 8969; do
  if (echo > /dev/tcp/127.0.0.1/$port) 2>/dev/null; then
    running_ports+=("$port")
  fi
done
if [ ${#running_ports[@]} -gt 0 ]; then
  agent_row="dev running on $(IFS=/; echo "${running_ports[*]}")"
fi

# --- Emit -------------------------------------------------------------------

cat <<BANNER
═══════════════════════════════════════════════════════════════════
🌐  ENV STATUS  (banner from .claude/hooks/banner-env-status.sh)
═══════════════════════════════════════════════════════════════════
Host:  ${host} · ${host_detail}
BANNER

[ -n "$tmux_row" ]  && echo "Tmux:  $tmux_row"
[ -n "$git_row" ]   && echo "Git:   $git_row"
[ -n "$agent_row" ] && echo "Agent: $agent_row"

echo "═══════════════════════════════════════════════════════════════════"
