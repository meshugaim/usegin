---
name: When a box is unreachable
handle: troubleshooting
type: how-to
context: A box won't accept SSH — diagnose stale host keys, hardened-base bricks, and break-glass paths
tags: [troubleshooting, ssh, tailscale, break-glass]
---

# When a box is unreachable

Work down this list — the cheap, common causes first.

## 1. Stale host key (the usual false alarm)

Hetzner **reuses public IPs**. A freshly spun box often lands on the IP of one
you just deleted, so your `~/.ssh/known_hosts` has the OLD host key and SSH
refuses with a host-key-mismatch — which `accept-new` does NOT override (it only
adds *missing* keys, not *changed* ones). A polling loop on public `:22` will
report "unreachable" when the box is actually fine.

```bash
ssh-keygen -R <public-ip>          # drop the stale key
ssh-keygen -R <box-name>           # …and the tailnet-name entry if present
```

Then retry. This is the single most common "unreachable" cause when respinning.

## 2. Is it actually up and on the tailnet?

```bash
box status <box>                   # server state + IP
tailscale status | grep <box>      # is it on the tailnet? what's its 100.x?
ping <box>                         # tailnet reachability (MagicDNS)
```

If it pings over the tailnet but `:22` times out, suspect a firewall problem
(next section), not a dead box.

## 3. Hardened-base brick (historical — should be fixed)

A box spun from a HARDENED golden base has public `:22` closed by design, so if
anything on first boot failed it could be unreachable on every path. Two now-fixed
bugs caused this (see `box docs show golden-base`):

- **tailscaled panic** from a logout-without-state-wipe base → never joins the
  tailnet. Fixed in finalize (`b2ca624cb`).
- **ufw interface-rule race** → on the tailnet but tailnet `:22` dropped. Fixed by
  the source-CIDR backstop in `harden-firewall.sh`.

If you hit this on a base built before those fixes: re-bake the base (the brick is
in the snapshot, not recoverable per-box). Prefer the **bake-reachable-first**
workflow (`box base finalize --skip-harden`) so the base is provable before you
harden it.

## 4. Break-glass — when the tailnet is down

Public `:22` is closed on a hardened box, so the out-of-band path is Hetzner's web
console (no open port required). For a one-shot command over hcloud's break-glass
SSH (works by IP, needs an hcloud token):

```bash
box ssh <box> -- "<command>"       # one-shot break-glass exec
```

To pre-authorize a stable admin range on the public side when hardening, set
`BREAKGLASS_CIDR=<cidr>` before running `harden-firewall.sh`.
