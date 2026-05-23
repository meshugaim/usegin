---
name: box command reference
handle: commands
type: reference
context: Quick reference for every box subcommand and the env vars that configure them
tags: [reference, commands, config]
---

# box command reference

`[box]` is a box **name or numeric Hetzner id**; omit it to use the configured
default box (`BOX_NAME`).

```
box up     [name] [--size <type>]   recreate a box from its latest snapshot (or the
                                    golden base if it has none) — fast
box down   [box] [-y]               snapshot + DELETE a box (the only way to stop billing)
box park   [box]                    snapshot but KEEP it running (freeze a checkpoint)
box prune  [box] [--keep N] [-y]    delete OLD snapshots, keep the latest N (frees storage)
box work   [box]                    ssh in and attach the devcontainer tmux
box ssh    [box] [-- cmd]           shell into a box as the dev user (break-glass: -- cmd)
box status [box] [--json]           server state + snapshots + cost (no arg = whole fleet)
box base finalize <box> [...]       turn a build box into the golden base (see `docs show golden-base`)
box mgmt   up|ssh|status            manage the always-on mgmt box
box docs   [list|show <ref>]        browse this embedded documentation
```

## Addressing & connectivity

`box ssh` / `box work` go **tailnet-first**: if the box's name resolves on the
tailnet they `ssh dev@<name>` directly — no IP, no host-key churn, no hcloud token
needed. Otherwise (or for a numeric id) they fall back to `hcloud server ssh` by
IP (break-glass).

`box ssh <box> -- <cmd>` runs a one-shot command (break-glass plumbing fixed in
`0283b28ef` — hcloud arg order).

## `box base finalize` flags

```
--dry-run              print the plan, execute nothing
--yes                  skip the irreversible-step (logout) confirmation
--skip-harden          leave public :22 OPEN — bake a reachable base to prove the
                       flow; re-finalize WITHOUT this for production
--authkey-file <path>  file holding the reusable, non-expiring Tailscale auth key
                       (or set BOX_TS_AUTHKEY_FILE)
```

## Config (env)

`BOX_*` preferred; legacy `HETZNER_*` honoured.

| var | meaning | default |
|-----|---------|---------|
| `BOX_NAME` | default box name | `effi-devbox` |
| `BOX_MGMT_NAME` | always-on mgmt box name | `effi-mgmt` |
| `BOX_TYPE` | hcloud server type | `cpx42` |
| `BOX_LOCATION` | hcloud location | `nbg1` |
| `BOX_BASE_IMAGE` | base image (provision) | `ubuntu-24.04` |
| `BOX_SSH_KEY` | registered hcloud ssh-key name | — (required for `up`) |
| `BOX_TS_AUTHKEY_FILE` | reusable Tailscale key file (finalize) | — |
| `BOX_YES=1` | skip `down`/`prune`/finalize confirmation | — |

Auth comes from your `hcloud context` (or `HCLOUD_TOKEN`).
