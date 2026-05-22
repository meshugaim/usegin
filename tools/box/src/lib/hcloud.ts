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

/**
 * Render the multi-box `box status` (no-arg) summary — one line per running box
 * (name, type, status, ip, datacenter, snapshot count, and `€/hr` when a price is
 * known) plus a total footer, then (when any price/snapshot cost is known) a cost
 * footer with total €/hr across running boxes + total snapshot storage €/mo.
 *
 * Pure (string in → string out) so it's unit-testable against a synthetic
 * `BoxSummaryRow[]`; the command layer only feeds it live data + prints the result.
 */
export function formatAllBoxesSummary(rows: BoxSummaryRow[]): string {
  if (rows.length === 0) {
    return "No boxes running. `box up` brings the default box up from its latest snapshot.";
  }
  const lines = rows.map(({ server, snapshotCount, price }) => {
    const type = server.server_type?.name ?? "?";
    const ip = serverIp(server) || "?";
    const dc = server.datacenter?.name ?? "?";
    const snaps = `${snapshotCount} snap${snapshotCount === 1 ? "" : "s"}`;
    const cost = price ? `  ${formatEurHourly(price.hourlyGross)}` : "";
    return `  ${server.name}  ${type}  ${server.status}  ${ip}  ${dc}  ${snaps}${cost}`;
  });
  const total = `${rows.length} box${rows.length === 1 ? "" : "es"} running — billing per hour. \`box status <box>\` for detail; \`box down <box>\` to stop one.`;

  // Cost footer only when we actually resolved some cost data — keeps the
  // dependency-free output byte-identical when prices are unavailable.
  const totalHourly = rows.reduce((sum, r) => sum + (r.price?.hourlyGross ?? 0), 0);
  const allSnapshotSizes = rows.flatMap((r) => r.snapshotSizesGB ?? []);
  const hasCost = rows.some((r) => r.price) || allSnapshotSizes.length > 0;
  if (!hasCost) {
    return [...lines, "", total].join("\n");
  }
  const storage = snapshotStorageCost(allSnapshotSizes);
  const costFooter = `total ${formatEurHourly(totalHourly)} across running boxes · ${formatEur(storage)}/mo snapshot storage`;
  return [...lines, "", total, costFooter].join("\n");
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
  /** Total snapshot storage cost per month across all listed boxes. */
  storageEurMonthly: number;
}

/** Envelope for the multi-box `box status --json` output: rows + fleet totals. */
export interface AllBoxesJson {
  boxes: BoxSummaryJson[];
  totals: BoxTotalsJson;
}

/**
 * Build the full multi-box `box status --json` envelope — the per-box array plus
 * a `totals` object (total €/hr across running boxes, total snapshot storage €/mo).
 */
export function buildAllBoxesJsonWithTotals(rows: BoxSummaryRow[]): AllBoxesJson {
  const costEurHourly = rows.reduce((sum, r) => sum + (r.price?.hourlyGross ?? 0), 0);
  const storageEurMonthly = snapshotStorageCost(rows.flatMap((r) => r.snapshotSizesGB ?? []));
  return {
    boxes: buildAllBoxesJson(rows),
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
 * Snapshot-recreate rotates the box's SSH host key (and the IP is often reused),
 * which causes "HOST KEY CHANGED" and refuses every ssh. Drop the stale entry.
 */
export function cleanHostkey(ip: string): void {
  if (!ip) return;
  Bun.spawnSync(["ssh-keygen", "-R", ip], { stdout: "ignore", stderr: "ignore" });
}
