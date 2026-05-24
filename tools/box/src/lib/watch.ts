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
import { formatDuration } from "./duration";

/** Per-box facts the planner reasons over (gathered by the IO layer). */
export interface WatchEntry {
  name: string;
  /** ISO time the box came up (Hetzner `created`) — the hard-cap anchor. */
  upSince: string;
  /** ISO time of last activity, or null when unknown (see `activity.ts`). */
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
 * Pure (decisions → string). The `[<detail>]` segment is the activity-probe's
 * diagnostic note (`heartbeat 12m ago`, `unreachable (ssh failed → unknown)`,
 * `excluded — not probed`, …) — the operator's evidence for trusting the
 * keep/down call — and is omitted only when the probe gave no note. The
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
