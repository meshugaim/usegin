/**
 * `box watch` planning + reporting — pure. No IO.
 *
 * The watcher (slice 7) runs a pass per interval: read each box's uptime + last
 * activity (IO, elsewhere), then decide keep/down. This module is the pure middle:
 * given the per-box facts + policy + `now`, it produces the decisions and the
 * human report. The IO command layer (`commands/watch.ts`) feeds it live data and
 * acts on the `down` decisions. Keeping this pure makes the two load-bearing
 * invariants unit-testable: (1) excluded boxes are NEVER downed, (2) the
 * keep/down call exactly mirrors `decideLeaseAction`.
 */

import {
  decideLeaseAction,
  type LeaseAction,
  type LeasePolicy,
} from "./lease";
import { leaseActivity, type LeaseStore } from "./lease-store";
import { formatDuration } from "./duration";

/** Per-box facts the planner reasons over (gathered by the IO layer). */
export interface WatchEntry {
  name: string;
  /** ISO time the box came up (Hetzner `created`) — the hard-cap anchor. */
  upSince: string;
  /** ISO time of last activity, or null when unknown (see `leaseWatchActivity`). */
  lastActivity: string | null;
  /** Human note about the activity reading, surfaced in the report. */
  detail?: string;
}

export interface WatchDecision {
  name: string;
  lastActivity: string | null;
  detail: string;
  action: LeaseAction;
}

/**
 * Turn a box's persisted lease into a {@link WatchEntry}'s `lastActivity` +
 * `detail` (push model, slice 7). Pure: (store, name, upSince) → reading. This
 * replaces the old SSH probe (`activity.ts`) — instead of the watcher reaching
 * INTO each box, each working box pushes "I'm alive" to mgmt (`box renew`), mgmt
 * persists it, and the reaper reads the renewal back out of the store here.
 *
 * **The stale-lease guard (the load-bearing bit).** A box name can be revived:
 * `box down nitsan-dev` then `box up nitsan-dev` gives the new server a fresh
 * `upSince` (Hetzner `created`), but the mgmt store may still hold the PREVIOUS
 * incarnation's lease. If we passed that stale renewal straight through, a
 * freshly-spun box could be idle-downed on an old box's activity — a false-down,
 * the worst failure (see lease.ts). So a lease whose `lastRenewal` predates this
 * box's boot (`< upSince`) is treated as unknown (`null` → never idle-downed,
 * only the hard cap applies), exactly the safe value the false-down bias wants.
 * Boundary: `lastRenewal === upSince` counts as VALID (renewed at the moment of
 * boot is this incarnation's lease, not a previous one's) — strictly-before only.
 *
 * `now`-free on purpose: the relative "ago" rendering already lives in
 * `formatWatchReport` (via `decideLeaseAction`'s countdown); the detail here is a
 * static note ("lease renewed <iso>") so this stays a trivially-testable pure fn.
 */
export function leaseWatchActivity(
  store: LeaseStore,
  name: string,
  upSince: string,
): { lastActivity: string | null; detail: string } {
  const lastRenewal = leaseActivity(store, name);
  if (lastRenewal == null) {
    return { lastActivity: null, detail: "no lease yet (unknown)" };
  }
  // Stale-lease guard: a renewal from before this box booted belongs to a
  // previous incarnation of the name — ignore it so we don't false-down a fresh
  // box on a dead box's activity. `===` upSince is valid (this incarnation's).
  // Compare epoch-ms via getTime(), NOT lexical string compare: `created` and
  // `lastRenewal` are usually both ISO-Z, but the instant their formats differ
  // (offset vs Z, ms precision) a string compare would silently misjudge.
  if (new Date(lastRenewal).getTime() < new Date(upSince).getTime()) {
    return { lastActivity: null, detail: "lease predates boot — ignored (unknown)" };
  }
  return { lastActivity: lastRenewal, detail: `lease renewed ${lastRenewal}` };
}

/**
 * Decide keep/down for every box. Pure: entries + policy + now → decisions.
 *
 * Excluded boxes (the always-on mgmt box that hosts the watcher, plus any the
 * user names) are forced to `keep` BEFORE `decideLeaseAction` is consulted — the
 * watcher must never down the box it runs on (that would be suicide), and this
 * guarantee is independent of any activity reading. Everything else goes through
 * the tested lease/hard-cap logic.
 */
export function planWatch(
  entries: WatchEntry[],
  policy: LeasePolicy,
  now: Date,
  opts: { exclude?: string[] } = {},
): WatchDecision[] {
  const excluded = new Set(opts.exclude ?? []);
  return entries.map((e) => {
    const detail = e.detail ?? "";
    if (excluded.has(e.name)) {
      return {
        name: e.name,
        lastActivity: e.lastActivity,
        detail,
        action: { action: "keep", reason: "excluded (never auto-downed)", downInMs: null },
      };
    }
    const action = decideLeaseAction(
      { lastActivity: e.lastActivity, upSince: e.upSince },
      policy,
      now,
    );
    return { name: e.name, lastActivity: e.lastActivity, detail, action };
  });
}

/** Boxes the planner decided to down — the IO layer's action list. */
export function boxesToDown(decisions: WatchDecision[]): string[] {
  return decisions.filter((d) => d.action.action === "down").map((d) => d.name);
}

/**
 * Render a watch pass as a human report — one aligned line per box:
 *   `<name>  KEEP  <reason>  [<detail>]  (down in <dur>)`  or
 *   `<name>  DOWN  <reason>  [<detail>]`
 * Pure (decisions → string). The `[<detail>]` segment is the lease reading's
 * diagnostic note (`lease renewed <iso>`, `lease predates boot — ignored
 * (unknown)`, `no lease yet (unknown)`, `excluded — not checked`, …) — the
 * operator's evidence for trusting the keep/down call — and is omitted only when
 * there's no note. The
 * `(down in …)` suffix appears only when there's an upcoming deadline; a box
 * nothing will ever down (no cap + unknown activity) shows no suffix so the
 * report doesn't imply a countdown that won't fire.
 */
export function formatWatchReport(decisions: WatchDecision[]): string {
  if (decisions.length === 0) {
    return "No running boxes to watch.";
  }
  const nameWidth = Math.max(...decisions.map((d) => d.name.length));
  return decisions
    .map((d) => {
      const name = d.name.padEnd(nameWidth);
      const note = d.detail.trim() ? `  [${d.detail.trim()}]` : "";
      if (d.action.action === "down") {
        return `  ${name}  DOWN  ${d.action.reason}${note}`;
      }
      const countdown =
        d.action.downInMs != null ? `  (down in ${formatDuration(d.action.downInMs)})` : "";
      return `  ${name}  KEEP  ${d.action.reason}${note}${countdown}`;
    })
    .join("\n");
}
