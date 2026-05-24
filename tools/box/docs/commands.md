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
box watch  [--idle --ttl ...]       cost-safety daemon: down idle/expired boxes (reads the lease store)
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

## `box watch` flags (cost-safety daemon)

Runs on the always-on mgmt box, in the **push-lease** model. Each pass it lists
running boxes, reads each one's last lease renewal from the persisted lease store,
and downs the idle/expired ones (snapshot + delete, same path as `box down`). It
does **not** SSH-probe the fleet — each working box pushes "I'm alive" via
`box renew` to `box mgmt lease-server`, which records the renewal in the store;
`box watch` is a **reader** of that store (the lease-server is its single writer).
Point both at the same file with `--store` (or `BOX_LEASE_STORE`). The **mgmt box
is always excluded** so the watcher can't down itself. A box with no lease — or
only a stale one renewed before the box's current boot (a revived name still
carrying a previous incarnation's lease) — is **never idle-downed**; only the hard
cap can touch it (bias against killing live work).

```
--idle <dur>       down a box after this much inactivity        (default: 30m)
--ttl <dur>        hard cap: down a box after this much uptime
                   regardless of activity                       (default: none)
--interval <dur>   time between watch passes                     (default: 60s)
--once             run a single pass and exit (cron-friendly)
--dry-run          report decisions but never actually down a box
--exclude <names>  comma-separated extra box names to never auto-down
--store <path>     lease store JSON to read (overrides BOX_LEASE_STORE;
                   point at the same file as lease-server)
```

Durations take a number + unit (`30m`, `8h`, `90s`, `2d`, or compound `1h30m`).
Activity = a box's last lease renewal: a working box (running `claude`, etc.)
renews via `box renew`; the renewal time is the box's `lastActivity`. With no
`--ttl`, a box with no (or only a stale, pre-boot) lease will never be downed; set
`--ttl` for a backstop.

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
