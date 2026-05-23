/**
 * Layer-0 golden base — pure helpers (no IO).
 *
 * The golden base is the *identity-less* devbox image that NEW boxes spin from
 * (slice 5's `box up --name --size`). It carries the installed toolchain +
 * baked creds (gh / claude / doppler) + Tailscale *installed but logged OUT*.
 * Everything that must be unique per box is injected on first boot, not baked.
 *
 * The design landmine (see docs/design/slices/04-layer0-golden-base.md): a
 * snapshot is a *clone*, so anything baked is SHARED by every spun box. Bake a
 * *joined* Tailscale node and N boxes fight over one node key. So the base ships
 * logged out, and each box runs a fresh `tailscale up --authkey=… --hostname=…`
 * on first boot to register its OWN node.
 *
 * Where the authkey lives — the subtle bit. The golden base has public :22
 * CLOSED (harden-firewall, baked), so a fresh box is unreachable until it's on
 * the tailnet: it has to self-join on first boot, which means the key must be
 * present locally. We bake the key into the IMAGE (a 0600 root file at
 * {@link GOLDEN_BASE_AUTHKEY_PATH}) rather than passing it in spin-time
 * user-data — keeping auth keys out of Hetzner instance metadata (the same
 * principle scripts/hetzner/cloud-init.yaml states). The per-box NAME, which is
 * not secret, IS passed via user-data (see {@link buildFirstBootUserData}).
 */

import { buildSnapshotArgs, pickLatestSnapshot, type Snapshot } from "./hcloud";

/**
 * hcloud label marking the identity-less golden base image. Distinct from the
 * per-box `role=<name>-devbox` lineage (see config.snapshotSelector): the golden
 * base is the fallback a brand-new box (with no per-box snapshot of its own)
 * spins from. `box up --name <new>` (slice 5) selects on this label.
 */
export const GOLDEN_BASE_LABEL = "purpose=golden-base";

/** The label selector to find the golden base image. */
export function goldenBaseSelector(): string {
  return GOLDEN_BASE_LABEL;
}

/** A one-line summary of the golden base for `box status` (the spin-from seed). */
export interface GoldenBaseInfo {
  id: number;
  /** Min disk (GB) any box spun from it needs; null if hcloud didn't report it. */
  diskSizeGB: number | null;
  created: string;
}

/**
 * Summarise the golden base from the `purpose=golden-base` snapshot list — the
 * latest one (what a fresh `box up` would spin from). Returns null when none
 * exist (i.e. the base hasn't been built yet — `box status` says so explicitly).
 * Pure: snapshots in → summary out.
 */
export function summarizeGoldenBase(snaps: Snapshot[]): GoldenBaseInfo | null {
  const latest = pickLatestSnapshot(snaps);
  if (!latest) return null;
  return { id: latest.id, diskSizeGB: latest.disk_size ?? null, created: latest.created };
}

/** Render the golden-base line for `box status` (pure: info → string). */
export function formatGoldenBaseLine(info: GoldenBaseInfo | null): string {
  if (!info) {
    return "Golden base: none yet — build one with `box base finalize <build-box>` (slice 4).";
  }
  const floor = info.diskSizeGB != null ? `spins onto >=${info.diskSizeGB}GB types` : "disk size unknown";
  return `Golden base: image ${info.id} · ${floor} · built ${info.created.slice(0, 10)}`;
}

/** Where `box up` resolved its disk image from, and whether identity is fresh. */
export interface SpinSource {
  image: number;
  source: "per-box" | "golden-base";
  /**
   * golden-base spins are identity-LESS → the box must establish a fresh tailnet
   * identity on first boot (inject {@link buildFirstBootUserData}). per-box spins
   * are identity-FUL (the snapshot captured the joined node) → it auto-reconnects
   * as the SAME node, so we must NOT re-run `tailscale up` (that would duplicate it).
   */
  identityless: boolean;
}

/**
 * Decide which image `box up <name>` spins from. A box's OWN latest snapshot
 * (`role=<name>-devbox`) always wins — it carries that box's state + identity.
 * Only a brand-new name with no lineage falls back to the golden base, and that
 * spin needs first-boot identity injection. Returns null when neither exists.
 *
 * Pure (two snapshots in → choice out) so the precedence + the identityless flag
 * are unit-tested without any hcloud calls.
 */
export function chooseSpinSource(perBox: Snapshot | null, golden: Snapshot | null): SpinSource | null {
  if (perBox) return { image: perBox.id, source: "per-box", identityless: false };
  if (golden) return { image: golden.id, source: "golden-base", identityless: true };
  return null;
}

/**
 * On-box path of the baked, reusable, non-expiring Tailscale auth key. Baked
 * into the golden image (0600, root) so every spun box can self-join the tailnet
 * on first boot without the key ever touching instance metadata.
 */
export const GOLDEN_BASE_AUTHKEY_PATH = "/etc/tailscale/authkey";

/**
 * Validate a box name as a DNS label — it becomes the OS hostname AND the
 * Tailscale `--hostname` (which seeds the MagicDNS name). RFC-1123 label rules:
 * 1–63 chars, lowercase letters/digits/hyphens, no leading/trailing hyphen.
 *
 * Guarding here keeps a bad name out of the first-boot cloud-config (where it
 * would otherwise produce a box that's unreachable by name, or a shell-injection
 * vector via `--hostname`).
 */
export function isValidBoxName(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name);
}

/**
 * Build the spin-time `--user-data` cloud-config for a box spun FROM the golden
 * base. It carries the per-box identity bits (NOT the key — that's baked):
 *
 *   1. set the OS hostname to the box name (also seeds Tailscale's MagicDNS name),
 *   2. run a fresh `tailscale up` reading the baked key, registering this box as
 *      its OWN tailnet node under its own name.
 *
 * Reusable key ⇒ many distinct nodes; non-ephemeral ⇒ the node persists across
 * the box's own down/up; `--hostname` ⇒ a stable, predictable MagicDNS name.
 *
 * Pure: name in → cloud-config string out. Throws on an invalid name so a
 * malformed value can never reach the shell command.
 */
export function buildFirstBootUserData(name: string): string {
  if (!isValidBoxName(name)) {
    throw new Error(
      `invalid box name "${name}": must be a DNS label (1–63 chars, lowercase a–z, 0–9, hyphens; no leading/trailing hyphen)`,
    );
  }
  // The key is read from the baked file at runtime — it is NOT interpolated into
  // this user-data, so it never lands in Hetzner instance metadata.
  return [
    "#cloud-config",
    `hostname: ${name}`,
    `fqdn: ${name}`,
    "preserve_hostname: false",
    "runcmd:",
    `  - hostnamectl set-hostname ${name}`,
    `  - tailscale up --authkey="$(cat ${GOLDEN_BASE_AUTHKEY_PATH})" --hostname=${name}`,
    "",
  ].join("\n");
}

/**
 * `hcloud server create-image` args for the identity-less golden base snapshot.
 * Same shape as a per-box park snapshot, but stamped with {@link GOLDEN_BASE_LABEL}
 * instead of a per-box role label, so it's found as the spin-from base — not as
 * any one box's lineage.
 */
export function buildGoldenSnapshotArgs(p: { name: string; description: string }): string[] {
  return buildSnapshotArgs({ name: p.name, description: p.description, label: GOLDEN_BASE_LABEL });
}

/**
 * Wrap a shell command so it survives SSH argv-flattening.
 *
 * `ssh host a b c` joins everything after the host with spaces and the REMOTE
 * shell re-splits the result, so a multi-word command passed as separate args
 * loses its grouping — e.g. `ssh host bash -c "x && y"` arrives as
 * `bash -c x && y`, and `bash -c` sees only `x` (verified live: it ran `sudo`
 * with no command → a sudo usage error). The fix: build ONE string here,
 * single-quoting the command, and pass that as a single ssh arg; the remote
 * `bash -c` then receives the whole thing intact. Embedded single quotes are
 * escaped POSIX-style (`'\''`).
 */
export function wrapBashC(remoteCmd: string): string {
  return `bash -c ${singleQuote(remoteCmd)}`;
}

/**
 * POSIX single-quote a string into ONE shell word: wrap in `'…'`, and render any
 * embedded single quote as `'\''` (close-quote, escaped-quote, reopen-quote).
 * Safe to nest — the output of one call can be embedded in another (we rely on
 * that for the deferred logout, which is a `bash -c` inside another `bash -c`).
 */
function singleQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Local Tailscale state the finalize identity-scrub must REMOVE — not just
 * `tailscale logout`. Logout clears the node key but leaves these on disk; with
 * the tailnet-lock (tka) state still present and the key gone, tailscaled
 * v1.98.x PANICS on the next boot (nil-pointer in tkaSyncIfNeeded). Every box
 * spun from such a snapshot then can't start tailscaled and never joins the
 * tailnet — a silent brick (worse when :22 is hardened shut: unreachable).
 * Wiping these leaves a clean slate the first-boot `tailscale up --authkey`
 * registers fresh from. Root-caused live on a debug box (see
 * docs/design/slices/04-layer0-golden-base.md).
 */
export const TAILSCALE_STATE_PATHS =
  "/var/lib/tailscale/tailscaled.state* /var/lib/tailscale/profile-data";

/** Transient systemd unit name for the deferred, self-severing logout. */
const LOGOUT_UNIT = "box-ts-logout";

/** Cap (seconds) on the best-effort `tailscale logout` so the wipe never waits on it. */
const LOGOUT_TIMEOUT_S = 8;

/**
 * The deferred identity-scrub command for finalize's logout step. Run on the
 * build box over SSH; it does, in order:
 *
 *   1. `tailscale logout`         — deregister the node control-side, so the base
 *                                   doesn't leave an orphan tailnet node behind,
 *   2. `systemctl stop tailscaled`+ `rm -rf` {@link TAILSCALE_STATE_PATHS}
 *                                 — wipe the LOCAL state, or the snapshot boots
 *                                   into the tka panic (see that constant).
 *
 * Deferred via `systemd-run --on-active` because step 1/2 sever our own tailnet
 * SSH session — running synchronously returns a broken-pipe failure even on
 * success (this bit us live). Scheduling it a few seconds out lets the ssh call
 * return 0 first; `--collect` reaps the transient unit afterwards. The scrub is
 * a `bash -c` (statements joined by `;`, not `&&`) so the wipe runs even if the
 * logout fails — and the logout is `timeout`-capped: `tailscale logout` contacts
 * the control server and can run many seconds (observed live), but the wipe must
 * NOT wait on it, or the snapshot (taken after a fixed delay) could fire before
 * the state is gone and re-capture the poisoned state. The wipe is fast and
 * deterministic; logout is best-effort orphan-node hygiene.
 *
 * Pure (no args, no IO) → unit-tested without touching live infra.
 */
export function buildFinalizeLogoutCommand(): string {
  const scrub = `timeout ${LOGOUT_TIMEOUT_S}s tailscale logout; systemctl stop tailscaled; rm -rf ${TAILSCALE_STATE_PATHS}`;
  return `sudo systemd-run --on-active=3s --unit=${LOGOUT_UNIT} --collect bash -c ${singleQuote(scrub)}`;
}

/**
 * Seconds to wait for the deferred scrub to complete before snapshotting:
 * the +3s timer + the {@link LOGOUT_TIMEOUT_S}s logout cap + a margin for the
 * (fast) stop + state wipe. base.ts sleeps this long before `create-image`.
 */
export const FINALIZE_SCRUB_WAIT_S = 15;

/** The repo's checkout path on a box (the dev user's home — see `box work`). */
export const BOX_REPO_DIR = "~/test-mvp";

/**
 * Remote command to recreate the build box's devcontainer from the CURRENT
 * committed `devcontainer.json`, BEFORE the base is finalized.
 *
 * Why this exists: a container's port publishing (`-p` / appPort), mounts, and
 * runArgs are frozen at `docker create` time and are immutable for its life.
 * `container.sh start` / `box work` only START the existing container, and
 * `box base finalize` only snapshots the box as-is — so a create-time
 * `devcontainer.json` change (e.g. a new appPort range) NEVER lands in the
 * golden base no matter how many times the base is rebuilt; the stale container
 * is carried forward into every snapshot. (Same class as the snapshot-vs-shim
 * trap in CLAUDE.md / ENG-6037.) `container.sh rebuild` is
 * `devcontainer up --remove-existing-container`, which DELETES and recreates the
 * container from the current config so the change lands.
 *
 * The recreate WIPES in-container creds (gh/claude/doppler live in the writable
 * layer, no home volume) — so this runs BEFORE the operator's logins, never
 * inside `finalize` (which is post-login): re-login, then `box base finalize`.
 * `git pull --ff-only` first so the box's `devcontainer.json` is current; it's
 * fail-loud (a non-fast-forward stops before rebuilding from stale config), and
 * skippable with `pull: false` when the operator manages the repo themselves.
 *
 * Pure (params → string) → unit-tested without touching live infra.
 */
export function buildRebuildContainerCommand(
  opts: { repoDir?: string; pull?: boolean } = {},
): string {
  const repoDir = opts.repoDir ?? BOX_REPO_DIR;
  const steps = [`cd ${repoDir}`];
  if (opts.pull ?? true) steps.push("git pull --ff-only");
  steps.push("./scripts/container.sh rebuild");
  return steps.join(" && ");
}

/** One step of `box base finalize` — turning a working build box into the base. */
export interface FinalizeStep {
  id: "bake-key" | "harden" | "open-ssh" | "logout" | "snapshot";
  /** Where it runs: over SSH on the box, or against the hcloud API. */
  kind: "ssh" | "hcloud";
  title: string;
  /** Human-readable detail. Never contains the key material (stays out of logs). */
  detail: string;
  /** True for steps that can't be cleanly undone (drives the confirm gate). */
  irreversible: boolean;
}

/**
 * The ordered plan that turns a *working, logged-in* build box into the
 * identity-less golden base. Pure (name in → steps out) so the sequence — and
 * its critical ordering — is unit-tested without touching live infra.
 *
 * Ordering is load-bearing:
 *   1. bake the reusable key to disk (while the box is still reachable),
 *   2. firewall step:
 *        - default → harden: run `harden-firewall.sh`, which REFUSES unless
 *          tailscale is up, so it must come BEFORE logout (else it locks nothing
 *          and bails). The base ships with public :22 CLOSED (tailnet-only).
 *        - {@link FinalizeOpts.skipHarden} → open-ssh: ensure public :22 is OPEN
 *          instead. For the "bake reachable, harden last" workflow — a box spun
 *          from a hardened base inherits :22 CLOSED, so we must actively re-open
 *          it, or the unhardened base is no more reachable than a hardened one.
 *          Lets you prove the whole spin→join→work flow on a reachable box,
 *          then re-finalize WITHOUT --skip-harden for the production base.
 *   3. logout — scrub the node identity AND wipe local tailscaled state (see
 *      {@link buildFinalizeLogoutCommand}: logout alone leaves a snapshot that
 *      panics tailscaled on boot); the box goes unreachable after this (over the
 *      tailnet; still reachable by public IP when skipHarden), so it's the last
 *      on-box step,
 *   4. snapshot via the hcloud API (no SSH needed) → the golden image.
 */
export interface FinalizeOpts {
  /** Leave public :22 OPEN (skip hardening) — the "bake reachable, harden last" path. */
  skipHarden?: boolean;
}

export function planGoldenFinalize(name: string, opts: FinalizeOpts = {}): FinalizeStep[] {
  const firewall: FinalizeStep = opts.skipHarden
    ? {
        id: "open-ssh",
        kind: "ssh",
        title: "Keep public :22 OPEN (NOT hardened)",
        detail:
          "ufw allow OpenSSH — base stays reachable by public IP for proving the spin→join→work flow; " +
          "re-finalize WITHOUT --skip-harden to close :22 for production",
        irreversible: false,
      }
    : {
        id: "harden",
        kind: "ssh",
        title: "Harden firewall (close public :22)",
        detail: "run harden-firewall.sh — tailnet-only ingress; runs while tailscale is still up",
        irreversible: false,
      };
  return [
    {
      id: "bake-key",
      kind: "ssh",
      title: "Bake reusable Tailscale authkey",
      detail: `write key → ${GOLDEN_BASE_AUTHKEY_PATH} (0600 root) so spun boxes self-join`,
      irreversible: false,
    },
    firewall,
    {
      id: "logout",
      kind: "ssh",
      title: "Scrub tailnet identity",
      detail:
        "tailscale logout + stop tailscaled + wipe local state — base ships logged OUT with a CLEAN " +
        "tailscaled.state (logout alone leaves state that panics tailscaled on boot); box goes unreachable after this",
      irreversible: true,
    },
    {
      id: "snapshot",
      kind: "hcloud",
      title: "Snapshot the golden base",
      detail: `create-image ${name} → label ${GOLDEN_BASE_LABEL}`,
      irreversible: false,
    },
  ];
}
