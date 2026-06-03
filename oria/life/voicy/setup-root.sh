#!/usr/bin/env bash
# One-shot privileged setup. Run:  sudo bash setup-root.sh [uid] [gid]
#   1. Patches Voicy to drop the "Manual Paste Required" dialog and keep the
#      transcription on the clipboard for manual Ctrl+V (backs up the originals).
#   2. Installs ydotool + runs ydotoold as a root service (socket owned by you),
#      so the Ctrl+Space -> voicy-talk hotkey can inject keys on Wayland.
set -euo pipefail

UID_ARG="${1:-1000}"; GID_ARG="${2:-1000}"
RES=/opt/Voicy/resources

# ---- 1. Patch Voicy bundle (with backup) ------------------------------------
if [ -f /tmp/app.asar.new ] && [ -d /tmp/app.asar.new.unpacked ]; then
  echo "==> Backing up + patching Voicy app.asar"
  [ -e "$RES/app.asar.bak" ]          || cp -a "$RES/app.asar"          "$RES/app.asar.bak"
  [ -e "$RES/app.asar.unpacked.bak" ] || cp -a "$RES/app.asar.unpacked" "$RES/app.asar.unpacked.bak"
  install -m 0644 -o root -g root /tmp/app.asar.new "$RES/app.asar"
  rm -rf "$RES/app.asar.unpacked"
  cp -a /tmp/app.asar.new.unpacked "$RES/app.asar.unpacked"
  chown -R root:root "$RES/app.asar.unpacked"
  echo "    done (restore with: cp -a $RES/app.asar.bak $RES/app.asar)"
else
  echo "==> SKIP patch: /tmp/app.asar.new missing"
fi

# ---- 2. ydotool + daemon ----------------------------------------------------
echo "==> Installing ydotool"
dnf install -y ydotool

echo "==> Writing + enabling ydotoold service"
cat > /etc/systemd/system/ydotoold.service <<EOF
[Unit]
Description=ydotoold (uinput virtual input daemon)
After=multi-user.target

[Service]
ExecStart=/usr/bin/ydotoold --socket-path=/run/.ydotool_socket --socket-own=${UID_ARG}:${GID_ARG}
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now ydotoold.service
sleep 1
systemctl --no-pager --full status ydotoold.service | head -5 || true
ls -l /run/.ydotool_socket || true
echo "==> Done."
