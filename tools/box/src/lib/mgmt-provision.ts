/**
 * `box mgmt provision` — pure helpers (no IO).
 *
 * Provisioning stands up the always-on, lean MANAGEMENT box FROM SCRATCH (fresh
 * Ubuntu, not a snapshot): cloud-init-mgmt.yaml installs a lean toolchain
 * (bun + hcloud + tailscale + git, NO docker/node/devcontainer — see that file),
 * then this command joins the tailnet, runs setup-mgmt.sh (clone repo, install
 * the two push-lease systemd units), and places the hcloud token. The box is
 * then snapshotted as its OWN lineage (`role=<mgmtName>-devbox`) so `box mgmt up`
 * can revive it fast.
 *
 * Lean-vs-golden-base: the golden base (golden-base.ts) is the HEAVY devbox image
 * work boxes spin from; the mgmt box is a DIFFERENT, lean image with its own
 * lineage. That's why `box mgmt up` never falls back to the golden base — they're
 * separate purposes (a devbox runs your code; the mgmt box only runs `box` +
 * tailscale + the lease daemons).
 *
 * Why secrets are post-boot, not in metadata: the tailscale auth key and the
 * hcloud token are SECRETS; Hetzner instance user-data (cloud-init) is readable
 * metadata. So this command passes the authkey over ssh at `tailscale up` time
 * and scp's the token over the (tailnet/ssh) connection — neither ever lands in
 * user-data. This mirrors golden-base.ts's reasoning for the work boxes (the
 * per-box NAME, which is non-secret, IS passed via cloud-init; keys never are).
 *
 * The builders here return argv arrays / command strings so the wiring is
 * unit-tested without touching any live box; mgmt.ts does the IO.
 */

import { isValidBoxName } from "./golden-base";

/**
 * Default hcloud server type for the LEAN mgmt box. Single source of truth shared
 * by both `box mgmt provision` (fresh create) and `box mgmt up` (revive), so a box
 * provisioned at this size is revived at the SAME size — they must not drift. The
 * mgmt box only runs `box` + tailscale + two lightweight push-lease daemons, so a
 * small shared-vCPU type is right; it deliberately does NOT inherit the work-box
 * `BOX_TYPE` default (cpx42, locked to >=320GB-disk snapshots), which would make
 * the always-on mgmt box needlessly expensive. `--size` still overrides per call.
 */
export const MGMT_DEFAULT_SIZE = "cx22";

/**
 * Absolute path to the lean mgmt cloud-init, resolved relative to THIS module so
 * it works regardless of cwd (the box CLI runs from anywhere). From
 * tools/box/src/lib/, four `..` reaches the repo root — same scheme base.ts uses
 * for harden-firewall.sh. Passed to `--user-data-from-file` for the fresh create.
 */
export function mgmtCloudInitPath(): string {
  return new URL("../../../../scripts/hetzner/cloud-init-mgmt.yaml", import.meta.url).pathname;
}

/** Absolute path to setup-mgmt.sh (run on the box over ssh), same scheme. */
export function setupMgmtScriptPath(): string {
  return new URL("../../../../scripts/hetzner/setup-mgmt.sh", import.meta.url).pathname;
}

/**
 * Absolute path to the LOCAL repo root, resolved relative to THIS module (same
 * four-`..` scheme as the artifact paths) so it works from any cwd. This is the
 * source `box mgmt provision` rsyncs onto the box — the operator's working tree,
 * including any uncommitted local fixes. Trailing slash trimmed for clean joins.
 */
export function repoRootPath(): string {
  return new URL("../../../../", import.meta.url).pathname.replace(/\/$/, "");
}

/** On-box path of the dev user's hcloud config (token lives here). */
export const MGMT_HCLOUD_CONFIG_PATH = "/home/dev/.config/hcloud/cli.toml";

/** On-box destination the local working tree is rsync'd to (the repo root). */
export const MGMT_REPO_DEST = "/home/dev/test-mvp/";

/**
 * The working-tree paths rsync'd onto the mgmt box — the minimum the lean box
 * needs to run the `box` CLI straight from source: the `tools/` workspace, the
 * `scripts/` (systemd units + setup), and the workspace-root manifest/lockfile +
 * tsconfig so `bun install` resolves the same dep tree. NOT the whole repo (no
 * nextjs-app/python-services — the mgmt box never builds or runs them).
 */
export const MGMT_REPO_RSYNC_PATHS = [
  "tools",
  "scripts",
  "package.json",
  "bun.lock",
  "tsconfig.json",
] as const;

/** Local source the token is read from when scp-placing it (hcloud's default). */
export function localHcloudConfigPath(home: string | undefined): string {
  return `${home ?? "."}/.config/hcloud/cli.toml`;
}

/**
 * The remote command that joins the tailnet on the mgmt box. The authkey is
 * passed OVER SSH at runtime (this command string), never baked into instance
 * metadata — the same out-of-metadata rule golden-base.ts states.
 *
 * `--hostname=<mgmtName>` seeds a stable MagicDNS name so `box mgmt ssh` /
 * `box renew` can reach the box by name. Throws on an invalid name so a
 * malformed value can never reach the shell (it becomes both the OS hostname-ish
 * tailnet name and a `--hostname` flag).
 *
 * NOTE: the key is interpolated into the returned string — the CALLER must pass
 * it as a single ssh arg (so ssh argv-flattening doesn't split it) and must keep
 * it out of any logged/echoed output. We do NOT log this string anywhere.
 *
 * FOLLOW-UP (post-first-live-run hardening): the key lands in the box's remote
 * argv (visible in `ps` on the box for the few seconds `tailscale up` runs). Not
 * in metadata, not logged — low severity on a single-operator box — but golden-
 * base.ts:146 does it cleaner: scp the key to a 0600 temp file and read it via
 * `--authkey="$(cat tmp)"`, then rm. Match that pattern once the live flow is
 * proven, to keep the key entirely out of argv.
 */
export function buildTailscaleUpCommand(p: { name: string; authkey: string }): string {
  if (!isValidBoxName(p.name)) {
    throw new Error(
      `invalid mgmt box name "${p.name}": must be a DNS label (1–63 chars, lowercase a–z, 0–9, hyphens; no leading/trailing hyphen)`,
    );
  }
  return `sudo tailscale up --authkey="${p.authkey}" --hostname=${p.name}`;
}

/**
 * `rsync` argv to push the local working tree onto the box, AUTH-FREE. Pure
 * (params in → argv out) so it's unit-tested. Returns the args AFTER `rsync`.
 *
 * Why rsync, not `git clone`: the repo is PRIVATE and a fresh lean box has no git
 * auth (no gh, no deploy key) — a clone fails before setup can run. rsync over the
 * existing ssh connection needs no repo credentials, so the box gets the exact
 * local tree (including uncommitted local fixes) without any auth plumbing.
 *
 *   -a   archive (recursive, preserves perms/times) — a faithful copy
 *   -z   compress on the wire
 *   --delete   make the dest mirror the source (drop files removed locally), so a
 *              re-provision/re-run doesn't leave stale files on the box
 *   -e "ssh -o StrictHostKeyChecking=accept-new"   transport over ssh with the
 *              SAME host-key opt buildBreakGlassArgs uses — a fresh box's new host
 *              key is accepted non-interactively (paired with the caller's
 *              cleanHostkey); otherwise rsync's ssh child hangs on the prompt.
 *   --exclude node_modules / .git   skip the heavy/irrelevant trees: node_modules
 *              is reinstalled on the box (`bun install`), and .git isn't needed (and
 *              its absence is WHY setup uses `bun install --ignore-scripts` — the
 *              root `prepare`/husky hook needs .git).
 *
 * `host` is the box's public IP (break-glass path — rsync runs before/independent
 * of the tailnet name resolving). Dest is the repo root {@link MGMT_REPO_DEST}.
 */
export function buildRepoRsyncArgs(p: { host: string; user?: string; repoRoot?: string }): string[] {
  const root = (p.repoRoot ?? ".").replace(/\/$/, "");
  return [
    "-az",
    "--delete",
    "-e", "ssh -o StrictHostKeyChecking=accept-new",
    "--exclude", "node_modules",
    "--exclude", ".git",
    ...MGMT_REPO_RSYNC_PATHS.map((rel) => `${root}/${rel}`),
    `${p.user ?? "dev"}@${p.host}:${MGMT_REPO_DEST}`,
  ];
}

/**
 * The remote command that runs setup-mgmt.sh on the box. The script is streamed
 * to the box's `bash -s` over ssh stdin (so we don't depend on it already being
 * present on a fresh box). The repo is already present on the box (rsync'd by the
 * provision command before this runs), so setup-mgmt.sh takes no repo-URL arg — it
 * just installs deps + the units against the rsync'd tree.
 *
 * `bash -s` reads the script from stdin. Pure: the caller pipes the script body
 * via stdin and this is the command.
 */
export function buildRunSetupCommand(): string {
  return `bash -s`;
}

/**
 * `scp` argv to place the local hcloud token file onto the box over the tailnet
 * (by name). Pure (params in → argv out) so it's unit-tested. The token never
 * touches argv/logs — scp copies the FILE; we never read or echo its contents.
 * `StrictHostKeyChecking=accept-new` mirrors buildTailnetSshArgs (host-key churn
 * across `up` is absorbed by the caller's cleanHostkey + the tailnet's own
 * WireGuard authentication).
 *
 * Destination is a temp path in dev's home; the caller then `mkdir -p` the
 * config dir + `mv` + `chmod 600` over ssh (scp can't create the parent dir or
 * set the mode atomically). Returns the args AFTER `scp`.
 */
export function buildTokenScpArgs(p: { name: string; localPath: string; user?: string; remoteTmp?: string }): string[] {
  const remoteTmp = p.remoteTmp ?? "/home/dev/.hcloud-cli.toml.tmp";
  return [
    "-o", "StrictHostKeyChecking=accept-new",
    p.localPath,
    `${p.user ?? "dev"}@${p.name}:${remoteTmp}`,
  ];
}

/**
 * The remote command that installs the scp'd token into place: create the config
 * dir, move the temp file in, and lock it down to 0600. Run over ssh after the
 * scp. Pure: the temp path in → the install command out. No token material is in
 * this string (only paths) — the secret rode in via the scp'd file.
 */
export function buildTokenInstallCommand(p: { remoteTmp?: string } = {}): string {
  const remoteTmp = p.remoteTmp ?? "/home/dev/.hcloud-cli.toml.tmp";
  const dir = MGMT_HCLOUD_CONFIG_PATH.slice(0, MGMT_HCLOUD_CONFIG_PATH.lastIndexOf("/"));
  return [
    `mkdir -p ${dir}`,
    `mv ${remoteTmp} ${MGMT_HCLOUD_CONFIG_PATH}`,
    `chmod 600 ${MGMT_HCLOUD_CONFIG_PATH}`,
  ].join(" && ");
}

/**
 * The remote command that polls for the cloud-init-done marker — first-boot has
 * finished installing bun/hcloud/tailscale once /home/dev/.cloud-init-done
 * exists. The provision command runs this over ssh (break-glass by public IP,
 * since the box isn't on the tailnet yet) before running setup-mgmt.sh, so we
 * don't race cloud-init. `test -f` returns non-zero until the marker appears.
 */
export function buildCloudInitDoneCheck(): string {
  return "test -f /home/dev/.cloud-init-done";
}
