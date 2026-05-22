# box

Devbox fleet lifecycle CLI — start/stop/connect cloud dev boxes by `name | id`.
Portable bun tool; reuses your existing `hcloud` auth. Slice 2 of the
[Devbox Fleet](../../docs/design/devbox-fleet-slices.md) build; it ports
`scripts/hetzner/hetzner.sh` (which it will replace).

## Commands

```
box up    [name]          recreate a box from its latest snapshot (fast)
box down  [box] [-y]      snapshot + DELETE a box (the only way to stop billing)
box work  [box]           ssh in and attach the devcontainer tmux
box ssh   [box] [-- cmd]  shell into a box as the dev user
box status[box] [--json]  server state + snapshots + cost reminder
```

`[box]` is a box **name or numeric Hetzner id**; omit it to use the configured
default box.

## Config

Env vars (`BOX_*` preferred; legacy `HETZNER_*` honoured so an exported
`hetzner.conf` keeps working):

| var | meaning | default |
|-----|---------|---------|
| `BOX_NAME` | default box name | `effi-devbox` |
| `BOX_TYPE` | hcloud server type | `cpx42` |
| `BOX_LOCATION` | hcloud location | `nbg1` |
| `BOX_BASE_IMAGE` | base image (provision) | `ubuntu-24.04` |
| `BOX_SSH_KEY` | registered hcloud ssh-key name | — (required for `up`) |
| `BOX_YES=1` | skip the `down` confirmation | — |

Auth comes from your `hcloud context` (or `HCLOUD_TOKEN`).

> Default `BOX_TYPE=cpx42`: the current snapshot is locked to ≥320 GB-disk types,
> and cpx42 is the cheapest that fits. Slice 5 generalises sizing.

## Run

```
bun tools/bin/box status        # or `box status` with tools/bin on PATH
bun test tools/box              # unit tests (pure logic)
```

## Status

Slice 2 (core lifecycle: up/down/work/ssh/status, name|id addressing). Not yet
done: `provision`, `park`/`snap`, Tailscale addressing, multi-box `--size`, the
`watch`/`mgmt`/`serve` verbs (later slices). The old `hetzner.sh` + `just
hetzner-*` recipes are retired in the cleanup slice once `box` fully covers them.
