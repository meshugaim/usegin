/**
 * hcloud wrapper + pure helpers.
 *
 * We shell out to the `hcloud` CLI (same as the old `hetzner.sh`) so we reuse the
 * user's existing `hcloud context` / `HCLOUD_TOKEN` auth — no token handling here.
 *
 * The pure helpers (no IO) are unit-tested; the thin IO functions are exercised
 * end-to-end by the read-only `box status` command.
 */

import { formatEur, formatEurHourly, snapshotStorageCost } from "./cost";

// ---------- types ----------

export interface Snapshot {
  id: number;
  created: string;
  description?: string;
  image_size?: number;
  /** hcloud labels — carries `role=<name>-devbox`, the box→snapshot link. */
  labels?: Record<string, string>;
}

export interface ServerInfo {
  id: number;
  name: string;
  status: string;
  /** ISO creation timestamp from Hetzner's server JSON — drives "hours up" for cost. */
  created?: string;
  server_type?: { name: string };
  public_net?: { ipv4?: { ip: string } };
  datacenter?: { name: string };
}

/** Gross (incl-VAT) prices for a server type — what you actually pay. */
export interface ServerTypePrice {
  hourlyGross: number;
  monthlyCapGross: number;
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

/**
 * Box name behind a `role` label, or null if it isn't a devbox snapshot.
 *
 * The selector scheme is `role=<name>-devbox` (see `snapshotSelector`), so we
 * strip exactly one trailing `-devbox`. The default box `effi-devbox` therefore
 * round-trips: `effi-devbox-devbox` → `effi-devbox`.
 */
export function boxNameFromRole(role: string | undefined): string | null {
  if (!role) return null;
  const suffix = "-devbox";
  if (!role.endsWith(suffix) || role.length <= suffix.length) return null;
  return role.slice(0, -suffix.length);
}

/** A box's snapshot lineage, collapsed to a count + sizes — keyed by box name. */
export interface SnapshotGroup {
  name: string;
  snapshotCount: number;
  snapshotSizesGB: number[];
}

/**
 * Group a flat snapshot list by the box that owns it (via the `role` label),
 * sorted by box name. Snapshots without a `role=<name>-devbox` label are skipped
 * — only devbox snapshots map to a box. Pure: list in → groups out.
 */
export function groupSnapshotsByBox(snapshots: Snapshot[]): SnapshotGroup[] {
  const byName = new Map<string, Snapshot[]>();
  for (const snap of snapshots) {
    const name = boxNameFromRole(snap.labels?.role);
    if (!name) continue;
    (byName.get(name) ?? byName.set(name, []).get(name)!).push(snap);
  }
  return [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, snaps]) => ({
      name,
      snapshotCount: snaps.length,
      snapshotSizesGB: snaps.map((s) => s.image_size ?? 0),
    }));
}

/**
 * Choose which snapshots to prune, keeping the latest `keep` by creation time.
 *
 * Returns the ids to DELETE — the oldest `count - keep`, newest-first survivors.
 * Pure (snapshots in → ids out): the IO `box prune` does the deleting. A `keep`
 * &gt;= the snapshot count prunes nothing; `keep = 0` prunes every snapshot
 * (the caller's confirmation makes that footgun explicit). Negative `keep` is
 * floored at 0.
 */
export function selectSnapshotsToPrune(snapshots: Snapshot[], keep: number): number[] {
  const survivors = Math.max(0, Math.floor(keep));
  return [...snapshots]
    .sort((a, b) => b.created.localeCompare(a.created)) // newest first
    .slice(survivors)
    .map((s) => s.id);
}

/** `hcloud server create` args for recreating a box from a snapshot. */
export function buildCreateFromSnapshotArgs(p: {
  name: string;
  type: string;
  image: string | number;
  location: string;
  sshKey: string;
  label: string;
  /** Path to a cloud-init user-data file (first-boot identity for golden-base spins). */
  userDataFile?: string;
}): string[] {
  return [
    "server", "create",
    "--name", p.name,
    "--type", p.type,
    "--image", String(p.image),
    "--location", p.location,
    "--ssh-key", p.sshKey,
    "--label", p.label,
    ...(p.userDataFile ? ["--user-data-from-file", p.userDataFile] : []),
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
 * Resolve the hcloud server type for an `up`, with `--size` overriding config.
 *
 * Precedence: an explicit `--size` flag  >  the configured `BOX_TYPE`/default.
 * The flag wins for a single invocation without mutating the box's config, so a
 * sizing experiment is `box up --size cpx31` and the default stays `BOX_TYPE`.
 */
export function resolveSize(p: { sizeFlag?: string; configType: string }): string {
  const flag = p.sizeFlag?.trim();
  return flag || p.configType;
}

/**
 * A box plus its snapshot lineage — the unit the all-boxes summary renders.
 *
 * `price` and `snapshotSizesGB` are optional cost inputs the command layer fills
 * from read-only Hetzner lookups; when absent (e.g. price lookup failed, or in
 * pure tests that don't care about cost) the row renders exactly as before — no
 * €/hr suffix, no cost footer — so the dependency-free view stays intact.
 */
export interface BoxSummaryRow {
  server: ServerInfo;
  snapshotCount: number;
  /** Gross prices for this box's type, or null if the lookup failed/was skipped. */
  price?: ServerTypePrice | null;
  /** Sizes (GB) of this box's snapshots, for the storage-cost total. */
  snapshotSizesGB?: number[];
}

/** Pluralise "snap"/"snaps" for a snapshot count. */
function snapsLabel(n: number): string {
  return `${n} snap${n === 1 ? "" : "s"}`;
}

/**
 * Render the multi-box `box status` (no-arg) summary — one line per running box
 * (name, type, status, ip, datacenter, snapshot count, and `€/hr` when a price is
 * known), then a line per DOWNED box (snapshot-only state: name, snapshot count,
 * storage €/mo), then a sentence per group, then (when any cost is known) a cost
 * footer with total €/hr across running boxes + total snapshot storage €/mo
 * (counting both running and downed snapshots).
 *
 * Downed boxes are the ergonomic fix for "I `box down`ed it and it vanished": a
 * box you've taken down has no live server, so it would otherwise drop out of the
 * fleet view entirely even though you keep paying for its snapshots. Listing it
 * (with a `box up` hint) keeps the thing you're billed for visible.
 *
 * Pure (data in → string out) so it's unit-testable against synthetic inputs; the
 * command layer feeds it live data + prints the result. `downed` defaults to `[]`,
 * so the running-only output is byte-identical to before.
 */
export function formatAllBoxesSummary(rows: BoxSummaryRow[], downed: SnapshotGroup[] = []): string {
  if (rows.length === 0 && downed.length === 0) {
    return "No boxes running. `box up` brings the default box up from its latest snapshot.";
  }

  const runningLines = rows.map(({ server, snapshotCount, price }) => {
    const type = server.server_type?.name ?? "?";
    const ip = serverIp(server) || "?";
    const dc = server.datacenter?.name ?? "?";
    const cost = price ? `  ${formatEurHourly(price.hourlyGross)}` : "";
    return `  ${server.name}  ${type}  ${server.status}  ${ip}  ${dc}  ${snapsLabel(snapshotCount)}${cost}`;
  });
  const downedLines = downed.map((d) =>
    `  ${d.name}  down (snapshot only)  ${snapsLabel(d.snapshotCount)}  ${formatEur(snapshotStorageCost(d.snapshotSizesGB))}/mo`,
  );

  const sentences: string[] = [];
  if (rows.length > 0) {
    sentences.push(`${rows.length} box${rows.length === 1 ? "" : "es"} running — billing per hour. \`box status <box>\` for detail; \`box down <box>\` to stop one.`);
  }
  if (downed.length > 0) {
    sentences.push(`${downed.length} down (snapshot only) — \`box up <box>\` to revive; \`box prune <box>\` to trim snapshots.`);
  }

  const lines = [...runningLines, ...downedLines];

  // Cost footer only when we actually resolved some cost data — keeps the
  // dependency-free output byte-identical when no prices and no snapshot sizes.
  const totalHourly = rows.reduce((sum, r) => sum + (r.price?.hourlyGross ?? 0), 0);
  const allSnapshotSizes = [
    ...rows.flatMap((r) => r.snapshotSizesGB ?? []),
    ...downed.flatMap((d) => d.snapshotSizesGB),
  ];
  const hasCost = rows.some((r) => r.price) || allSnapshotSizes.length > 0;
  if (!hasCost) {
    return [...lines, "", ...sentences].join("\n");
  }
  const storage = snapshotStorageCost(allSnapshotSizes);
  const footerParts: string[] = [];
  if (rows.some((r) => r.price)) footerParts.push(`total ${formatEurHourly(totalHourly)} across running boxes`);
  footerParts.push(`${formatEur(storage)}/mo snapshot storage`);
  const costFooter = footerParts.join(" · ");
  return [...lines, "", ...sentences, costFooter].join("\n");
}

/** JSON shape for one box in the all-boxes `box status --json` array. */
export interface BoxSummaryJson {
  name: string;
  id: number;
  type: string | null;
  status: string;
  ip: string;
  datacenter: string | null;
  snapshotCount: number;
  /** Gross hourly rate (incl-VAT); present only when the price lookup succeeded. */
  costEurHourly?: number;
  /** Gross monthly cap (incl-VAT); present only when the price lookup succeeded. */
  costCapEurMonthly?: number;
}

/**
 * Build the JSON array for the multi-box `box status --json` (no-arg) output.
 *
 * Per-row cost keys are added only when a price is known, so rows without a
 * resolved price keep their original shape (the dependency-free contract).
 */
export function buildAllBoxesJson(rows: BoxSummaryRow[]): BoxSummaryJson[] {
  return rows.map(({ server, snapshotCount, price }) => ({
    name: server.name,
    id: server.id,
    type: server.server_type?.name ?? null,
    status: server.status,
    ip: serverIp(server),
    datacenter: server.datacenter?.name ?? null,
    snapshotCount,
    ...(price ? { costEurHourly: price.hourlyGross, costCapEurMonthly: price.monthlyCapGross } : {}),
  }));
}

/** Totals across all running boxes for the all-boxes `--json` envelope. */
export interface BoxTotalsJson {
  /** Sum of gross hourly rates across boxes with a known price. */
  costEurHourly: number;
  /** Total snapshot storage cost per month across ALL boxes (running + downed). */
  storageEurMonthly: number;
}

/** JSON shape for a downed (snapshot-only) box in the all-boxes output. */
export interface DownedBoxJson {
  name: string;
  snapshotCount: number;
  storageEurMonthly: number;
}

/** Envelope for the multi-box `box status --json` output: rows + downed + totals. */
export interface AllBoxesJson {
  boxes: BoxSummaryJson[];
  downed: DownedBoxJson[];
  totals: BoxTotalsJson;
}

/**
 * Build the full multi-box `box status --json` envelope — the running per-box
 * array, the downed (snapshot-only) boxes, and a `totals` object (total €/hr
 * across running boxes, total snapshot storage €/mo across running + downed).
 *
 * `downed` defaults to `[]`; the totals always include downed snapshot storage
 * when present, so a downed box's ongoing cost shows up in the JSON too.
 */
export function buildAllBoxesJsonWithTotals(rows: BoxSummaryRow[], downed: SnapshotGroup[] = []): AllBoxesJson {
  const costEurHourly = rows.reduce((sum, r) => sum + (r.price?.hourlyGross ?? 0), 0);
  const storageEurMonthly = snapshotStorageCost([
    ...rows.flatMap((r) => r.snapshotSizesGB ?? []),
    ...downed.flatMap((d) => d.snapshotSizesGB),
  ]);
  return {
    boxes: buildAllBoxesJson(rows),
    downed: downed.map((d) => ({
      name: d.name,
      snapshotCount: d.snapshotCount,
      storageEurMonthly: snapshotStorageCost(d.snapshotSizesGB),
    })),
    totals: { costEurHourly, storageEurMonthly },
  };
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

/** One entry of the `prices[]` array in `hcloud server-type describe -o json`. */
export interface ServerTypePriceEntry {
  location?: string;
  price_hourly?: { gross?: string };
  price_monthly?: { gross?: string };
}

/**
 * Pull the gross (incl-VAT) hourly + monthly-cap prices out of a server-type's
 * `prices[]`, preferring the box's `location` and falling back to the first entry.
 *
 * Pure (parsed JSON in → numbers out) so the location-preference + string→number
 * coercion is unit-tested without shelling out. Returns null when there are no
 * usable price entries (so the command can degrade to a no-cost line).
 */
export function parseServerTypePrice(
  prices: ServerTypePriceEntry[] | undefined,
  location?: string,
): ServerTypePrice | null {
  if (!prices || prices.length === 0) return null;
  const chosen =
    (location ? prices.find((p) => p.location === location) : undefined) ?? prices[0]!;
  const hourlyGross = Number(chosen.price_hourly?.gross);
  const monthlyCapGross = Number(chosen.price_monthly?.gross);
  if (Number.isNaN(hourlyGross) || Number.isNaN(monthlyCapGross)) return null;
  return { hourlyGross, monthlyCapGross };
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

/**
 * Every devbox snapshot in one read-only call (`--selector role` = "has a role
 * label"), labels included so {@link groupSnapshotsByBox} can attribute each to
 * its box. One list call for the whole fleet, instead of one per box.
 */
export function listAllDevboxSnapshots(): Snapshot[] {
  const res = runHcloud(["image", "list", "--type", "snapshot", "--selector", "role", "-o", "json"]);
  if (res.code !== 0) return [];
  try {
    return JSON.parse(res.stdout) as Snapshot[];
  } catch {
    return [];
  }
}

/** Delete one snapshot by id (`hcloud image delete`). Destructive — `box prune` only. */
export function deleteSnapshot(id: number): HcloudResult {
  return runHcloud(["image", "delete", String(id)]);
}

/**
 * Read-only price lookup for a server type: `hcloud server-type describe -o json`,
 * then {@link parseServerTypePrice} (prefer the box's location, else first entry).
 *
 * Returns null on any failure (missing type, CLI error, no prices) so `box status`
 * degrades gracefully — a box without a resolvable price just omits its cost line
 * rather than erroring the whole status. Strictly read-only.
 */
export function getServerTypePrice(type: string, location?: string): ServerTypePrice | null {
  const res = runHcloud(["server-type", "describe", type, "-o", "json"]);
  if (res.code !== 0) return null;
  try {
    const parsed = JSON.parse(res.stdout) as { prices?: ServerTypePriceEntry[] };
    return parseServerTypePrice(parsed.prices, location);
  } catch {
    return null;
  }
}

export function serverIp(server: ServerInfo | null): string {
  return server?.public_net?.ipv4?.ip ?? "";
}

/**
 * Drop a stale known-hosts entry for a host token — an IP (break-glass path) or a
 * tailnet NAME (tailnet path). cloud-init regenerates the box's SSH host key on
 * each `up` (new instance-id), and the public IP is often reused, so without this
 * the next connect fails with "HOST KEY CHANGED" / "REMOTE HOST IDENTIFICATION".
 * Confirmed live in slice 3: a snapshot down/up changed the box's host key, so the
 * tailnet name's entry churns too — hence box ssh/work clean by NAME, not just IP.
 */
export function cleanHostkey(host: string): void {
  if (!host) return;
  Bun.spawnSync(["ssh-keygen", "-R", host], { stdout: "ignore", stderr: "ignore" });
}

// ---------- tailnet (slice 3) ----------

/**
 * Whether a box is reachable from here by its tailnet NAME — i.e. this machine is
 * on the tailnet and MagicDNS knows the node. Drives box ssh/work's "tailnet
 * first, hcloud break-glass second" path, and lets token-free work boxes (slice 6)
 * connect with no hcloud call at all. Cheap + read-only: `tailscale ip -4 <name>`.
 */
export function tailnetReachable(name: string): boolean {
  if (!name) return false;
  const proc = Bun.spawnSync(["tailscale", "ip", "-4", name], { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
  return (proc.exitCode ?? 1) === 0 && /(^|\n)100\./.test(proc.stdout?.toString() ?? "");
}

/**
 * `ssh` argv for connecting to a box over the tailnet by name. Pure (params in →
 * argv out) so it's unit-tested. `StrictHostKeyChecking=accept-new` plus the
 * caller's prior `cleanHostkey(name)` together absorb the host-key churn (see
 * {@link cleanHostkey}); the tailnet's WireGuard transport + node identity already
 * authenticate the box, so SSH host-key TOFU is belt-only here.
 */
export function buildTailnetSshArgs(p: { name: string; user?: string; tty?: boolean; command?: string[] }): string[] {
  return [
    "-o", "StrictHostKeyChecking=accept-new",
    ...(p.tty ? ["-t"] : []),
    `${p.user ?? "dev"}@${p.name}`,
    ...(p.command ?? []),
  ];
}

/** Run a local `ssh` inheriting the terminal (interactive shells + TTY commands). */
export function runSsh(args: string[]): HcloudResult {
  const proc = Bun.spawnSync(["ssh", ...args], { stdout: "inherit", stderr: "inherit", stdin: "inherit" });
  return { code: proc.exitCode ?? 1, stdout: "", stderr: "" };
}
