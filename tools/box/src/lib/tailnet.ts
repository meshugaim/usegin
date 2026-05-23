/**
 * Tailnet hygiene — telling real boxes apart from cruft.
 *
 * A devbox joins the tailnet as a node (tag:devbox). That node legitimately
 * persists while a box is `down`: it revives as the SAME node on `box up`
 * (slice 3, non-expiring tagged key). But once a box has neither a live server
 * NOR a snapshot to revive from — a deleted test box, a fully-pruned box — its
 * node is ORPHAN cruft.
 *
 * Identifying cruft (READ) needs no special creds: `tailscale status` cross-
 * referenced with the hcloud servers + snapshot lineages. DELETING a node needs
 * a Tailscale API token (an OAuth client with device-write), which `box status`
 * deliberately does not require — so we *report* prune candidates here, and
 * leave the deletion to the admin (or a future token-gated `box tailnet prune`).
 */

export interface TailnetNode {
  /** MagicDNS short label (= the box name for our fleet). */
  name: string;
  /** 100.x tailnet address. */
  ip?: string;
  online: boolean;
  /** Carries tag:devbox → part of our devbox fleet (vs a laptop/phone). */
  tagged: boolean;
}

interface TsPeer {
  HostName?: string;
  DNSName?: string;
  TailscaleIPs?: string[];
  Online?: boolean;
  Tags?: string[];
}

/** Parse `tailscale status --json` into nodes. Pure (json text → nodes); [] on junk. */
export function parseTailnetNodes(jsonText: string): TailnetNode[] {
  let data: { Self?: TsPeer; Peer?: Record<string, TsPeer> };
  try {
    data = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const peers: TsPeer[] = [...(data.Self ? [data.Self] : []), ...Object.values(data.Peer ?? {})];
  return peers
    .map((p) => ({
      name: (p.DNSName?.split(".")[0] || p.HostName || "").trim(),
      ip: (p.TailscaleIPs ?? []).find((a) => a.startsWith("100.")),
      online: p.Online ?? false,
      tagged: (p.Tags ?? []).includes("tag:devbox"),
    }))
    .filter((n) => n.name.length > 0);
}

export interface TailnetClassification {
  /** Node ↔ a running box. */
  live: TailnetNode[];
  /** Node ↔ a downed box that still has a snapshot — it'll revive on `box up`. */
  atRest: TailnetNode[];
  /** Node with no server AND no snapshot → cruft; the prune candidates. */
  orphans: TailnetNode[];
}

/**
 * Classify devbox (tag:devbox) tailnet nodes against the live servers + snapshot
 * lineages. Only tagged nodes are considered — laptops/phones (and any untagged
 * one-off) are left strictly alone, so this can never flag a personal device.
 * Pure: the node list + the two name-sets in → classification out.
 */
export function classifyDevboxNodes(
  nodes: TailnetNode[],
  liveServerNames: Set<string>,
  lineageNames: Set<string>,
): TailnetClassification {
  const out: TailnetClassification = { live: [], atRest: [], orphans: [] };
  for (const n of nodes) {
    if (!n.tagged) continue;
    if (liveServerNames.has(n.name)) out.live.push(n);
    else if (lineageNames.has(n.name)) out.atRest.push(n);
    else out.orphans.push(n);
  }
  return out;
}

/**
 * Render the tailnet-hygiene footer for `box status`: a one-liner when clean, and
 * an explicit prune list when there are orphans. Pure (classification → string).
 */
export function formatTailnetHygiene(c: TailnetClassification): string {
  const tracked = c.live.length + c.atRest.length + c.orphans.length;
  if (tracked === 0) return ""; // tailscale unavailable, or no devbox nodes — say nothing.

  if (c.orphans.length === 0) {
    return `Tailnet: ${c.live.length} live, ${c.atRest.length} at-rest (downed, revivable) — no orphans.`;
  }
  const lines = c.orphans.map((n) => `  ${n.name}${n.ip ? `  ${n.ip}` : ""}${n.online ? "  (online?!)" : "  offline"}`);
  return [
    `Tailnet orphans — ${c.orphans.length} node(s) with no server and no snapshot (cruft, safe to prune):`,
    ...lines,
    "  Delete in the Tailscale admin (Machines → … → Delete); `box` can't remove nodes without a Tailscale API token.",
  ].join("\n");
}

/** IO: read the local tailnet. Best-effort — [] when tailscale isn't available. */
export function readTailnetNodes(): TailnetNode[] {
  const proc = Bun.spawnSync(["tailscale", "status", "--json"], {
    stdout: "pipe",
    stderr: "ignore",
    stdin: "ignore",
  });
  if ((proc.exitCode ?? 1) !== 0) return [];
  return parseTailnetNodes(proc.stdout?.toString() ?? "");
}
