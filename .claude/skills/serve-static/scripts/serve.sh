#!/usr/bin/env bash
# Serve a file or directory over HTTP on a free port and expose it to the
# user in whatever way makes sense for the current host:
#
#   - Gitpod / Ona   -> `ona environment port open <port>` -> public URL
#   - GitHub Codespaces -> `gh codespace ports visibility`    -> forwarded URL
#   - Tailnet (--host tailnet) -> bind 0.0.0.0 on a published port -> private
#       http://<tailnet-name>:<port> (only the user's own tailnet devices; for a
#       Hetzner/remote devbox on Tailscale, where localhost won't reach the user)
#   - Local / devcontainer / anything else -> plain http://localhost:<port>
#
# Prints a single URL on stdout. Stops at nothing else.
#
# Usage:
#   serve.sh <path> [--name <label>] [--admission creator_only|organization|everyone] [--host auto|gitpod|codespaces|tailnet|local]
#
# Defaults: --admission creator_only, --name serve-static, --host auto.
# `tailnet` is opt-in (never auto-detected): use it on a tailnet-joined remote box.

set -euo pipefail

path=""
name="serve-static"
admission="creator_only"
host="auto"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) name="$2"; shift 2;;
    --admission) admission="$2"; shift 2;;
    --host) host="$2"; shift 2;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# //; s/^#$//'
      exit 0;;
    *)
      if [[ -z "$path" ]]; then path="$1"; else
        echo "unexpected arg: $1" >&2; exit 2
      fi
      shift;;
  esac
done

if [[ -z "$path" ]]; then
  echo "usage: $0 <path> [--name <label>] [--admission ...] [--host ...]" >&2
  exit 2
fi

if [[ ! -e "$path" ]]; then
  echo "path not found: $path" >&2
  exit 2
fi

abs=$(realpath "$path")
if [[ -d "$abs" ]]; then
  serve_dir="$abs"
  open_file=""
else
  serve_dir=$(dirname "$abs")
  open_file=$(basename "$abs")
fi

# --- Detect host ------------------------------------------------------------

detect_host() {
  if [[ -n "${GITPOD_API_URL:-}" || -n "${GITPOD_WORKSPACE_ID:-}" ]] && command -v ona >/dev/null 2>&1; then
    echo "gitpod"; return
  fi
  if [[ "${CODESPACES:-}" == "true" && -n "${CODESPACE_NAME:-}" ]]; then
    echo "codespaces"; return
  fi
  echo "local"
}

if [[ "$host" == "auto" ]]; then
  host=$(detect_host)
fi

# --- Pick a free port -------------------------------------------------------
#
# tailnet mode must use a port the devcontainer *publishes* (appPort), else it's
# unreachable from the host/tailnet — so pick from the 9000-9009 ad-hoc range.
# Every other mode can use any free ephemeral port.

if [[ "$host" == "tailnet" ]]; then
  port=$(python3 - <<'PY'
import socket, sys
for p in range(9000, 9010):              # 9000-9009 ad-hoc appPort range
    s = socket.socket()
    try:
        s.bind(("0.0.0.0", p))
        s.close()
        print(p); sys.exit(0)
    except OSError:
        s.close()
sys.exit(1)
PY
  ) || { echo "no free port in the published 9000-9009 ad-hoc range — free one or widen appPort" >&2; exit 1; }
else
  port=$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
  )
fi

# --- Serve ------------------------------------------------------------------

log=/tmp/serve-static-${port}.log
pidfile=/tmp/serve-static-${port}.pid

# Bind host depends on environment:
# - Codespaces forwarding expects to reach the server; binding to 0.0.0.0 is safe
#   because the port gate is at the Codespaces layer.
# - Gitpod works the same way; 0.0.0.0 is fine.
# - Tailnet: must bind 0.0.0.0 so Docker's port publish (and the tailnet) can
#   reach it; a 127.0.0.1 bind inside the container would be unreachable.
# - Local: 127.0.0.1 is safer (won't leak onto the LAN).
bind_host=127.0.0.1
[[ "$host" != "local" ]] && bind_host=0.0.0.0

( cd "$serve_dir" && nohup python3 -m http.server "$port" --bind "$bind_host" >"$log" 2>&1 & echo $! >"$pidfile" )
sleep 0.3

# --- Expose + print URL -----------------------------------------------------

case "$host" in
  gitpod)
    base=$(ona environment port open "$port" --name "$name" --admission "$admission")
    ;;
  codespaces)
    # Make the port visible. `gh codespace ports visibility` requires a codespace
    # name and a visibility verb (private | org | public).
    vis=private
    case "$admission" in
      creator_only) vis=private;;
      organization) vis=org;;
      everyone)     vis=public;;
    esac
    gh codespace ports visibility "${port}:${vis}" -c "$CODESPACE_NAME" >/dev/null 2>&1 || true
    # URL format used by Codespaces port forwarding.
    domain="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
    base="https://${CODESPACE_NAME}-${port}.${domain}"
    ;;
  tailnet)
    # Private over the tailnet: only the user's own Tailscale devices can reach
    # it (never the public internet). Uses this box's MagicDNS name. Requires the
    # box's firewall to trust tailscale0 (golden base / harden-firewall.sh bakes it).
    # Use the MagicDNS short label (first component of Self.DNSName) — NOT
    # Self.HostName, which can be a human-readable name with spaces/punctuation.
    # This is the same name that resolves for `ssh dev@<box>` / http://<box>:port.
    ts_name=$(tailscale status --json 2>/dev/null \
      | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].split(".")[0])' 2>/dev/null \
      || hostname)
    if [[ -z "$ts_name" ]]; then
      echo "could not resolve this box's tailnet name (is tailscale up?)" >&2
      exit 1
    fi
    base="http://${ts_name}:${port}"
    ;;
  local)
    # No public exposure. VS Code / Cursor attached via remote dev will
    # typically auto-forward the port and the user's browser can reach
    # http://localhost:<port> on the client machine.
    base="http://localhost:${port}"
    ;;
  *)
    echo "unknown host: $host" >&2
    exit 2
    ;;
esac

if [[ -n "$open_file" ]]; then
  echo "${base%/}/${open_file}"
else
  echo "$base"
fi

# Stderr hint for later cleanup.
stop_hint="kill \$(cat $pidfile)"
case "$host" in
  gitpod)     stop_hint="$stop_hint && ona environment port close $port";;
  codespaces) stop_hint="$stop_hint && gh codespace ports visibility ${port}:private -c \$CODESPACE_NAME";;
esac
echo "[serve-static] host=$host port=$port pid=$(cat "$pidfile") stop: $stop_hint" >&2
