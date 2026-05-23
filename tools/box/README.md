# box

Devbox fleet lifecycle CLI — start/stop/connect cloud dev boxes by `name | id`.
Portable bun tool; reuses your existing `hcloud` auth. Slice 2 of the
[Devbox Fleet](../../docs/design/devbox-fleet-slices.md) build; it ports
`scripts/hetzner/hetzner.sh` (which it will replace).

## Commands

```
box up     [name] [--size <type>]   recreate a box from its latest snapshot (fast)
box down   [box] [-y]               snapshot + DELETE a box (the only way to stop billing)
box park   [box]                    snapshot but KEEP it running (freeze a checkpoint)
box prune  [box] [--keep N] [-y]    delete OLD snapshots, keep the latest N (frees storage)
box work   [box]                    ssh in and attach the devcontainer tmux
box ssh    [box] [-- cmd]           shell into a box as the dev user
box status [box] [--json]           server state + snapshots + cost (no arg = whole fleet)
box base   finalize <box> [...]     turn a build box into the golden base (`box docs show golden-base`)
box mgmt   up|ssh|status            manage the always-on mgmt box
box docs   [list|show <ref>]        browse embedded docs (golden-base, commands, troubleshooting)
```

`[box]` is a box **name or numeric Hetzner id**; omit it to use the configured
default box.

`box status` with no arg lists the whole fleet: running boxes (with €/hr) **and
downed boxes** — a box you `down`ed has no live server but still costs snapshot
storage, so it shows as a `down (snapshot only)` row with a `box up` hint rather
than vanishing. `box prune` trims a box's snapshot lineage (which `down`/`park`
grow without bound) down to the latest N (default 3); it's destructive, so it
takes the same `-y`/`BOX_YES` confirmation as `down`.

`box ssh`/`box work` go **tailnet-first** (slice 3): if you're on the tailnet and
the box's name resolves, they `ssh dev@<name>` directly — no IP, no host-key churn,
and **no hcloud token needed** (so token-free work boxes can connect). If the box
isn't on the tailnet (or you pass a numeric id), they fall back to `hcloud server
ssh` by IP (break-glass). A fresh box joins the tailnet via `tailscale up`
(interactive for now; a baked reusable key comes with the golden base), then
`scripts/hetzner/harden-firewall.sh` closes public `:22`.

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
| `BOX_YES=1` | skip the `down`/`prune` confirmation | — |

Auth comes from your `hcloud context` (or `HCLOUD_TOKEN`).

> Default `BOX_TYPE=cpx42`: the current snapshot is locked to ≥320 GB-disk types,
> and cpx42 is the cheapest that fits. Slice 5 generalises sizing.

## Run

```
bun tools/bin/box status        # or `box status` with tools/bin on PATH
bun test tools/box              # unit tests (pure logic)
```

## Status

Core lifecycle (`up`/`down`/`park`/`prune`/`work`/`ssh`/`status`, name|id
addressing, `--size`, multi-box + downed-box status, cost figures, snapshot
pruning) is in. Not yet done: `provision` (first-time golden base), restoring a
*specific* (non-latest) snapshot, Tailscale addressing, the `watch`/`mgmt`/`serve`
verbs (later slices). The old `hetzner.sh` + `just hetzner-*` recipes are retired
in the cleanup slice once `box` fully covers them.
