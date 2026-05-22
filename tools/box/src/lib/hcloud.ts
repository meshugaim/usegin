/**
 * hcloud wrapper + pure helpers.
 *
 * We shell out to the `hcloud` CLI (same as the old `hetzner.sh`) so we reuse the
 * user's existing `hcloud context` / `HCLOUD_TOKEN` auth — no token handling here.
 *
 * The pure helpers (no IO) are unit-tested; the thin IO functions are exercised
 * end-to-end by the read-only `box status` command.
 */

// ---------- types ----------

export interface Snapshot {
  id: number;
  created: string;
  description?: string;
  image_size?: number;
}

export interface ServerInfo {
  id: number;
  name: string;
  status: string;
  server_type?: { name: string };
  public_net?: { ipv4?: { ip: string } };
  datacenter?: { name: string };
}

export interface HcloudResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface BoxTarget {
  /** Positional/`--name` selector — may be a box NAME or a numeric Hetzner id. */
  selector?: string;
}

// ---------- pure helpers (unit-tested) ----------

/** Latest snapshot by creation time, or null if there are none. */
export function pickLatestSnapshot(images: Snapshot[]): Snapshot | null {
  if (images.length === 0) return null;
  return [...images].sort((a, b) => a.created.localeCompare(b.created)).at(-1) ?? null;
}

/** `hcloud server create` args for recreating a box from a snapshot. */
export function buildCreateFromSnapshotArgs(p: {
  name: string;
  type: string;
  image: string | number;
  location: string;
  sshKey: string;
  label: string;
}): string[] {
  return [
    "server", "create",
    "--name", p.name,
    "--type", p.type,
    "--image", String(p.image),
    "--location", p.location,
    "--ssh-key", p.sshKey,
    "--label", p.label,
  ];
}

/** `hcloud server create-image` args for snapshotting a box. */
export function buildSnapshotArgs(p: { name: string; description: string; label: string }): string[] {
  return [
    "server", "create-image", p.name,
    "--type", "snapshot",
    "--description", p.description,
    "--label", p.label,
  ];
}

/**
 * Resolve a {@link BoxTarget} to a concrete box NAME, given the default name and
 * the live server list. A selector that is all-digits and matches a server id
 * wins; otherwise the selector is treated as a name; otherwise the default.
 *
 * Returns the name to operate on, or an error when an id selector matches nothing.
 */
export function resolveTargetName(
  target: BoxTarget,
  defaultName: string,
  servers: ServerInfo[],
): { name?: string; error?: string } {
  const sel = target.selector?.trim();
  if (!sel) return { name: defaultName };

  if (/^\d+$/.test(sel)) {
    const byId = servers.find((s) => String(s.id) === sel);
    if (byId) return { name: byId.name };
    // All-digits but no id match — fall through and try it as a name, since a box
    // could conceivably be named with digits; only error if that misses too.
    const byName = servers.find((s) => s.name === sel);
    if (byName) return { name: byName.name };
    return { error: `No box with id or name "${sel}". Try \`box status\` to list boxes.` };
  }

  return { name: sel };
}

// ---------- IO (thin; validated via live `box status`) ----------

export function runHcloud(args: string[], opts: { inherit?: boolean } = {}): HcloudResult {
  const proc = Bun.spawnSync(["hcloud", ...args], {
    stdout: opts.inherit ? "inherit" : "pipe",
    stderr: opts.inherit ? "inherit" : "pipe",
    stdin: opts.inherit ? "inherit" : "ignore",
  });
  return {
    code: proc.exitCode ?? 1,
    stdout: opts.inherit ? "" : (proc.stdout?.toString() ?? ""),
    stderr: opts.inherit ? "" : (proc.stderr?.toString() ?? ""),
  };
}

/** Whether `hcloud` is installed and has a usable token. */
export function checkPrereqs(): { ok: boolean; error?: string } {
  const which = Bun.spawnSync(["sh", "-c", "command -v hcloud"], { stdout: "ignore", stderr: "ignore" });
  if ((which.exitCode ?? 1) !== 0) {
    return { ok: false, error: "hcloud CLI not found. Install: brew install hcloud (or https://github.com/hetznercloud/cli)" };
  }
  if (!process.env.HCLOUD_TOKEN) {
    const ctx = runHcloud(["context", "active"]);
    if (ctx.code !== 0 || !ctx.stdout.trim()) {
      return { ok: false, error: "No hcloud token. Run `hcloud context create <name>` (paste your API token) or export HCLOUD_TOKEN=..." };
    }
  }
  return { ok: true };
}

export function getServer(name: string): ServerInfo | null {
  const res = runHcloud(["server", "describe", name, "-o", "json"]);
  if (res.code !== 0) return null;
  try {
    return JSON.parse(res.stdout) as ServerInfo;
  } catch {
    return null;
  }
}

export function listServers(): ServerInfo[] {
  const res = runHcloud(["server", "list", "-o", "json"]);
  if (res.code !== 0) return [];
  try {
    return JSON.parse(res.stdout) as ServerInfo[];
  } catch {
    return [];
  }
}

export function listSnapshots(selector: string): Snapshot[] {
  const res = runHcloud(["image", "list", "--type", "snapshot", "--selector", selector, "-o", "json"]);
  if (res.code !== 0) return [];
  try {
    return JSON.parse(res.stdout) as Snapshot[];
  } catch {
    return [];
  }
}

export function serverIp(server: ServerInfo | null): string {
  return server?.public_net?.ipv4?.ip ?? "";
}

/**
 * Snapshot-recreate rotates the box's SSH host key (and the IP is often reused),
 * which causes "HOST KEY CHANGED" and refuses every ssh. Drop the stale entry.
 */
export function cleanHostkey(ip: string): void {
  if (!ip) return;
  Bun.spawnSync(["ssh-keygen", "-R", ip], { stdout: "ignore", stderr: "ignore" });
}
