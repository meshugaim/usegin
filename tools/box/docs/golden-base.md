---
name: The golden base — identity-less image new boxes spin from
handle: golden-base
type: explanation
context: Understanding how box base finalize works, why ordering matters, and the two boot bugs that bricked early bases
tags: [golden-base, tailscale, finalize, hardening]
---

# The golden base

The **golden base** is the identity-less devbox snapshot that a brand-new
`box up <name>` spins from. It carries the installed toolchain + baked creds
(gh / claude / doppler) + Tailscale **installed but logged OUT**. Everything that
must be unique per box (tailnet node identity, hostname) is injected on first
boot, not baked. Found by the hcloud label `purpose=golden-base`; the *latest*
one wins, so a new finalize automatically becomes the default `box up` seed.

## Why identity-less

A snapshot is a **clone**. Anything baked is shared by every box spun from it.
Bake a *joined* Tailscale node and N boxes fight over one node key (the last to
boot steals it; they flap). So the base ships logged out, and each box runs a
fresh `tailscale up --authkey=… --hostname=<name>` on first boot to register its
OWN node. The reusable key is baked to a 0600 root file (`/etc/tailscale/authkey`),
NOT passed in spin-time user-data — keeping auth keys out of Hetzner instance
metadata. The per-box name (not secret) IS passed via user-data.

## `box base finalize` — turning a build box into the base

`box base finalize <box>` runs an ordered, partly-irreversible plan. The order is
load-bearing (see `planGoldenFinalize` in `src/lib/golden-base.ts`):

1. **bake-key** — write the reusable key to `/etc/tailscale/authkey` while the box
   is still reachable.
2. **firewall** —
   - *default* → **harden**: run `scripts/hetzner/harden-firewall.sh`, which
     REFUSES unless tailscale is up, so it must come BEFORE logout. Closes public
     `:22` → the base is tailnet-only.
   - *`--skip-harden`* → **open-ssh**: `ufw allow OpenSSH` instead, so the base
     (and every box spun from it) keeps `:22` OPEN and stays reachable by public
     IP even if the tailnet is down. The "bake reachable, prove, harden last"
     workflow.
3. **logout** — scrub the node identity AND wipe local tailscaled state. The box
   goes unreachable over the tailnet after this (still reachable by public IP
   under `--skip-harden`), so it's the last on-box step.
4. **snapshot** — `hcloud server create-image` → the golden image.

Run `box base finalize <box> --dry-run` to print the plan without executing. The
irreversible logout step is gated behind `--yes` (or `BOX_YES=1`).

## Two boot bugs that bricked early bases (root-caused live)

Both made boxes spun from a hardened base **silently unreachable** — and a
hardened, unreachable box has no door left (public `:22` closed, tailnet `:22`
dropped, no console without break-glass). Both are now fixed; this is the record
so they don't come back.

### 1. The brick — logout without a state wipe panics tailscaled

`tailscale logout` alone clears the node key but leaves
`/var/lib/tailscale/tailscaled.state` on disk with its tailnet-lock (tka) data.
With the key gone but tka state present, **tailscaled v1.98.x PANICS on the next
boot** (nil-pointer in `tkaSyncIfNeeded`). Every box spun from such a snapshot
can't start tailscaled and never joins the tailnet.

**Fix** (`buildFinalizeLogoutCommand`, commit `b2ca624cb`): finalize's scrub now
also stops tailscaled and `rm -rf`s the local state
(`tailscaled.state* + profile-data`), leaving a clean slate the first-boot
`tailscale up --authkey` registers fresh from. The scrub is deferred via
`systemd-run` (it severs our own SSH session), `timeout`-capped, and `;`-sequenced
so a slow/failed logout never delays the deterministic wipe.

### 2. The harden race — an interface-name ufw rule inert at boot

`harden-firewall.sh` trusted the tailnet with `ufw allow in on tailscale0` — an
**interface-name** rule. A box spun from a hardened snapshot loads its baked ufw
rules early in boot, BEFORE tailscaled has (re)created `tailscale0`. An
interface-match rule for an interface that doesn't exist yet is not reliably
active, so the spun box could come up with tailnet `:22` DROPPED even though it
later joined the tailnet (observed live: pinged fine, `:22` timed out).

**Fix** (`scripts/hetzner/harden-firewall.sh`): keep the interface rule (no
regression for the working case) and ADD a **source-CIDR backstop** over
Tailscale's address ranges — `100.64.0.0/10` (RFC-6598 CGNAT v4) and
`fd7a:115c:a1e0::/48` (ULA v6). Source-CIDR rules are interface-independent, so
they match from the first packet no matter when `tailscale0` appears. The backstop
is strictly additive (only ever ALLOWs), so it can't make a working box worse. It
trusts ALL tailnet ports (not just `:22`) on purpose — serve-static over the
tailnet uses ad-hoc ports 9000-9009.

## The "bake reachable, harden last" workflow

Because a box from a hardened base inherits `:22` closed, ANY first-boot failure
(tailnet join, cloud-init) on a hardened base is an unreachable brick — which is
exactly what made early bases impossible to debug. The safe loop:

1. `box base finalize <box> --skip-harden` → a reachable base (`:22` open).
2. Spin a box from it, prove the spin → join → work flow end-to-end.
3. Once proven, re-finalize the build box WITHOUT `--skip-harden` for the
   production (tailnet-only) base. The harden-race fix above makes that hardened
   base reliably reachable over the tailnet.
