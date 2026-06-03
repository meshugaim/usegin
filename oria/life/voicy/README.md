# Voicy — global Ctrl+Space dictation on Wayland

Setup built 2026-06-03 on this PC (Fedora 44, GNOME 50, **Wayland-only**).

## The problem

Voicy (Electron STT, installed at `/opt/Voicy/`) can't register a global hotkey
here:

- Fedora 44 + GNOME 50 is **Wayland-only** — GNOME 50 removed the Xorg session,
  so switching to X11 (where Voicy's hotkey would just work) isn't an option.
- Electron 33's `globalShortcut` **fails to register on Wayland** — confirmed in
  `~/.config/voicy-desktop/logs/main.log` (`Failed to register shortcut`).
- `xdotool`/XTEST can't inject keys or focus windows on GNOME Wayland either.
- Net: Voicy only records while one of its own windows is **focused**, and on
  Wayland its result only reaches the **clipboard** (auto-paste is disabled).

## The setup

| Piece | Where | What |
|---|---|---|
| `voicy-talk` | this dir → symlinked at `~/.local/bin/voicy-talk` | brings Voicy to front (relaunch → single-instance focus) then injects `Ctrl+Alt+Space` via **ydotool** |
| GNOME shortcut `dictate` | `gsettings` media-keys custom-keybinding | **Ctrl+Space** → `voicy-talk` |
| Voicy's own shortcut | `~/.config/voicy-desktop/config.json` → `recordingShortcut` | remapped to **`Ctrl+Alt+Space`** (private combo, so it doesn't clash with the global Ctrl+Space) |
| `ydotoold` | `/etc/systemd/system/ydotoold.service` (root) | uinput input daemon; socket `/run/.ydotool_socket` owned by uid 1000 |
| **patched** `app.asar` | `/opt/Voicy/resources/app.asar` (backup `app.asar.bak`) | removed the "Manual Paste Required" dialog **and** stopped `preserveClipboard` from wiping the transcription, so the text stays on the clipboard for manual paste |

`setup-root.sh` (here) is the one-shot privileged installer: patches the bundle
(with backup), installs `ydotool`, and enables `ydotoold`. Already run on this PC.

## How to use

1. **Ctrl+Space** anywhere → Voicy fronts and starts recording
2. talk
3. **Ctrl+Space** again → stops; transcription lands on the clipboard
4. **Ctrl+V** (or **Ctrl+Shift+V** in a terminal) where you want it

**Inherent caveat:** Ctrl+Space pulls Voicy to the front while recording — on
Wayland it can't record in the background, so it must be the focused window to
hear the key. You then switch back and paste.

## Reapplying after a Voicy update

A Voicy app update **overwrites the patched `app.asar`** (the dialog returns and
the clipboard-wipe bug comes back). To reapply:

```bash
cd /tmp && rm -rf voicy_x && npx --yes @electron/asar extract /opt/Voicy/resources/app.asar /tmp/voicy_x
# re-apply the edit in main.js (the WAYLAND FALLBACK block in the
#   ipcMain.on("transcription-complete") handler — see git history of this dir)
npx @electron/asar pack /tmp/voicy_x /tmp/app.asar.new --unpack "**/*.node" --unpack-dir "**/koffi"
sudo bash setup-root.sh 1000 1000   # backs up + swaps in /tmp/app.asar.new
```

## Offline fallback (staged, unused)

`dictate-toggle` (here → symlinked at `~/.local/bin/dictate-toggle`) is a
fully background, no-focus-steal alternative: records with `pw-record`,
transcribes with `whisper-cpp` (model `~/.local/share/whisper-dictation/ggml-small.bin`),
and types via `ydotool`. Lower quality than Voicy's cloud, but never steals
focus. To switch Ctrl+Space to it, repoint the GNOME `dictate` keybinding's
command to `dictate-toggle`.

## Related

- Tikur: `~/usegin/.claude/tikur-records/2026-06-03-live-probe-stole-focus-started-recording.md`
- Memories: `voicy-dictation`, `probe-side-effects-on-live-session`
