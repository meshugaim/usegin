#!/bin/bash
# SessionStart hook: orient the agent about the current devcontainer env.
# Per-row suppression — only print rows that carry signal:
#
#   Host  : always (env id is the anchor for cross-env work)
#   Tmux  : only when TMUX is set AND the window name isn't the default
#   Git   : only when branch != main, OR working tree dirty, OR HEAD != @{u}
#   Agent : only when `just agent-dev` is running
#   Sync  : always — session-sync invisibility was the May-13 incident
#           (ENG-5989/ENG-5993); banner is now the user-facing channel
#           for daemon health (✅/⚠/❌ + remediation when not green).
#
# If only Host would print and there's nothing else, still print Host so the
# agent has the env id at hand for the rest of the session.
#
# Detection mirrors .claude/skills/serve-static/scripts/serve.sh, plus a
# devbox branch (Gitpod/Ona and Codespaces are caught first by their env vars):
#   Gitpod/Ona : GITPOD_API_URL || GITPOD_WORKSPACE_ID + `ona` CLI
#   Codespaces : CODESPACES == "true" + CODESPACE_NAME
#   devbox     : /sys/class/dmi/id/sys_vendor == "Hetzner" (a tools/box cloud
#                box; this devcontainer on Hetzner IS a devbox by definition)
#   else       : local
#
# Env id resolution on Gitpod/Ona is via `ona environment list` (~500ms),
# cached to /tmp/banner-env-id-$$ for the lifetime of the devcontainer
# (regenerated if missing).
#
# Devbox name resolution: the DMI vendor read is free (no network) and gates
# the whole thing — a laptop/CI host isn't "Hetzner" so it never touches the
# wire. Only on a real box do we read the name (the Hetzner server name ==
# `box up <name>`) from the cloud-metadata service at the link-local
# 169.254.169.254, cached to /tmp/banner-box-name so only the first session
# per container pays the curl. Overridable for tests via BANNER_DMI_VENDOR /
# BANNER_BOX_NAME / BANNER_BOX_NAME_CACHE.
#
# Hook is silent on any unexpected error — this is a nice-to-have, not a gate.

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
elif [ "${BANNER_DMI_VENDOR-$(cat /sys/class/dmi/id/sys_vendor 2>/dev/null)}" = "Hetzner" ]; then
  # A tools/box cloud devbox. The free DMI read above gated us here; now resolve
  # the box name (== the Hetzner server name) from cloud metadata, cached so
  # only the first session per container pays the curl.
  host="devbox"
  if [ -n "${BANNER_BOX_NAME+x}" ]; then
    box_name="$BANNER_BOX_NAME"           # test override — no network
  else
    box_cache="${BANNER_BOX_NAME_CACHE:-/tmp/banner-box-name}"
    if [ -s "$box_cache" ]; then
      box_name=$(cat "$box_cache")
    else
      box_name=""
      command -v curl >/dev/null 2>&1 && box_name=$(curl -s \
        --connect-timeout 1 --max-time 1 \
        http://169.254.169.254/hetzner/v1/metadata/hostname 2>/dev/null)
      # Only trust + cache a clean single-token hostname.
      [[ "$box_name" =~ ^[A-Za-z0-9._-]+$ ]] || box_name=""
      [ -n "$box_name" ] && echo "$box_name" > "$box_cache"
    fi
  fi
  host_detail="${box_name:-unknown}"
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

# --- Session-sync row -------------------------------------------------------
#
# Always-printed row covering daemon + auth + last-upload freshness. Inputs,
# each overridable for tests:
#
#   BANNER_SYNC_DAEMON_STATE       — `online` | `down` (skip live pidfile probe)
#   BANNER_SYNC_EFFI_AUTH_STATUS   — `effi auth status` output (skip live run)
#   SESSION_SYNC_STATE_DIR         — daemon's state dir (same var it reads)
#
# Severity (most-actionable wins, per AC):
#   ❌ DOWN          → no live daemon
#   ⚠ auth expired  → daemon up + token expired / not authenticated
#   ⚠ stale         → daemon up + auth ok + last upload >10 min ago
#   ✅ ok            → daemon up + auth ok + last upload <10 min ago
#
# Daemon liveness via `<stateDir>/daemon.pid` + `kill -0`. NOT pm2 status:
# pm2 jlist is ~290ms (banner budget is 500ms total) and, more importantly,
# pm2 reports "online" between auto-respawns even when the daemon is mid-
# crash-loop. The daemon-side pidfile is the canonical signal (see
# `tools/session-sync/src/lifecycle.ts`), and `kill -0` catches the
# common stale-pidfile case where an env was paused/killed without graceful
# shutdown (May-13 incident shape).
#
# "Last upload" is `max(.[].lastUploadedAt)` over state.json. Per-file
# rather than state-file mtime because heartbeats and safety-net writes
# touch the file without uploading anything — mtime would lie green during
# the May-13 silent-failure mode. See ENG-5993.

sync_row=""
sync_state_dir="${SESSION_SYNC_STATE_DIR:-$HOME/.local/state/session-sync}"
sync_state_file="$sync_state_dir/state.json"
sync_pidfile="$sync_state_dir/daemon.pid"
sync_stale_threshold_s=600  # 10 min

# daemon liveness — pidfile must exist AND its PID must be a live process.
sync_daemon_state="down"
if [ -n "${BANNER_SYNC_DAEMON_STATE:-}" ]; then
  sync_daemon_state="$BANNER_SYNC_DAEMON_STATE"
elif [ -s "$sync_pidfile" ]; then
  sync_pid=$(tr -dc '0-9' < "$sync_pidfile" 2>/dev/null)
  if [ -n "$sync_pid" ] && kill -0 "$sync_pid" 2>/dev/null; then
    sync_daemon_state="online"
  fi
fi

# auth — `effi auth status` exits 0 even on expired-token; parse the text.
sync_auth_tmp=$(mktemp)
trap 'rm -f "$sync_auth_tmp"' EXIT
if [ -n "${BANNER_SYNC_EFFI_AUTH_STATUS:-}" ]; then
  printf '%s' "$BANNER_SYNC_EFFI_AUTH_STATUS" > "$sync_auth_tmp"
elif command -v effi >/dev/null 2>&1; then
  # `effi auth status` writes its human report to stderr (stdout reserved for
  # machine-readable streams). Capture both so we don't whitewash future
  # additions to stdout, and so the parser sees the report either way.
  effi auth status > "$sync_auth_tmp" 2>&1
fi

sync_auth_state="unknown"
sync_auth_profile=""
if [ -s "$sync_auth_tmp" ]; then
  sync_auth_profile=$(awk -F': ' '/^Profile:/ {print $2; exit}' "$sync_auth_tmp")
  if grep -q "Token expired" "$sync_auth_tmp"; then
    sync_auth_state="expired"
  elif grep -qE "Not authenticated|No (active )?profile|not logged in" "$sync_auth_tmp"; then
    sync_auth_state="missing"
  elif grep -q "^Logged in as" "$sync_auth_tmp"; then
    sync_auth_state="ok"
  fi
fi

# last-upload age — max non-empty `lastUploadedAt` across state entries.
sync_age_s=""
sync_age_pretty=""
if [ -s "$sync_state_file" ] && command -v jq >/dev/null 2>&1; then
  sync_last_iso=$(jq -r '
    [.[]? | .lastUploadedAt? | select(. != null and . != "")] | max // empty
  ' "$sync_state_file" 2>/dev/null)
  if [ -n "$sync_last_iso" ]; then
    sync_then_s=$(date -d "$sync_last_iso" +%s 2>/dev/null || echo "")
    if [ -n "$sync_then_s" ]; then
      sync_age_s=$(( $(date +%s) - sync_then_s ))
      if   [ "$sync_age_s" -lt 60 ];    then sync_age_pretty="${sync_age_s}s"
      elif [ "$sync_age_s" -lt 3600 ];  then sync_age_pretty="$((sync_age_s / 60))m"
      elif [ "$sync_age_s" -lt 86400 ]; then sync_age_pretty="$((sync_age_s / 3600))h"
      else                                   sync_age_pretty="$((sync_age_s / 86400))d"
      fi
    fi
  fi
fi

if [ "$sync_daemon_state" = "online" ]; then
  if [ "$sync_auth_state" = "expired" ] || [ "$sync_auth_state" = "missing" ]; then
    sync_row="⚠  session-sync auth expired — effi auth refresh && bun pm2 restart session-sync"
  elif [ -n "$sync_age_s" ] && [ "$sync_age_s" -ge "$sync_stale_threshold_s" ]; then
    sync_row="⚠  session-sync stale — last upload ${sync_age_pretty} ago (expected <2m while active)"
  else
    detail="${sync_auth_profile:-unknown}"
    [ -n "$sync_age_pretty" ] && detail="${detail} · last upload ${sync_age_pretty} ago"
    sync_row="✅ session-sync online (${detail})"
  fi
else
  if [ "$sync_auth_state" = "expired" ] || [ "$sync_auth_state" = "missing" ]; then
    sync_row="❌ session-sync DOWN (auth) — effi auth refresh && bun pm2 start tools/session-sync/ecosystem.config.cjs"
  else
    sync_row="❌ session-sync DOWN — bun pm2 start tools/session-sync/ecosystem.config.cjs"
  fi
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
[ -n "$sync_row" ]  && echo "Sync:  $sync_row"

echo "═══════════════════════════════════════════════════════════════════"
