/**
 * Activity detection for `box watch` (slice 7) — the IO that feeds the pure
 * `decideLeaseAction` (see `./lease.ts`). One thin IO function reads a box's
 * activity over the tailnet; one pure function turns the probe's output into a
 * `lastActivity` timestamp. The pure half is exhaustively unit-tested.
 *
 * **Why relative (seconds-ago), not an absolute timestamp.** The watcher runs on
 * the mgmt box and the probe runs on the work box — two clocks. If the probe
 * reported an absolute time and the box's clock were skewed, `decideLeaseAction`
 * (which compares against the WATCHER's `now`) could mis-judge the idle window.
 * So the probe reports a box-local *age in seconds* and the parser anchors it to
 * the watcher's `now` — skew cancels out.
 *
 * **Why this signal, and the false-down bias.** Killing live work is the worst
 * failure (cost-safety memory), so the probe only reports "active" from signals
 * it trusts and reports `NONE` otherwise — `NONE`/unreachable → `lastActivity =
 * null` → `decideLeaseAction` never idle-downs it (only the hard cap can). The
 * trusted signals, favouring explicit over raw load (per the slice-7 design):
 *   1. a running `claude` process (the dominant case: agent or interactive run),
 *   2. an *attached* tmux client (a human actively at the box's tmux),
 *   3. an explicit heartbeat file `~/.box-activity` an agent can touch.
 *
 * **The self-probe trap.** The probe must NOT count its own SSH session as
 * activity, or every box looks busy forever and nothing is ever downed. So it
 * keys on a `claude` process / *attached* tmux client / heartbeat file — never
 * on `who`/login sessions, which would include the probe's own pts.
 */

import { buildTailnetSshArgs, runSshCapture } from "./hcloud";

/**
 * The remote probe, run as one ssh command. Emits exactly one line:
 *   - `ACTIVE`        — a claude process or an attached tmux client right now.
 *   - `IDLE <n>`      — n seconds since the heartbeat file was last touched.
 *   - `NONE`          — no trusted signal (→ treated as unknown, never idle-downed).
 * `[c]laude` is the classic pgrep self-match dodge (the pattern itself won't match
 * the pgrep process). `stat -c %Y` is GNU coreutils (the boxes are Ubuntu).
 */
export const ACTIVITY_PROBE = [
  "if pgrep -f '[c]laude' >/dev/null 2>&1 || tmux list-clients >/dev/null 2>&1; then",
  "  echo ACTIVE;",
  'elif [ -f "$HOME/.box-activity" ]; then',
  '  echo "IDLE $(( $(date +%s) - $(stat -c %Y "$HOME/.box-activity") ))";',
  "else",
  "  echo NONE;",
  "fi",
].join(" ");

export interface ActivityReading {
  /**
   * ISO time of last observed activity, anchored to the watcher's `now`, or
   * `null` when activity is unknown (probe said NONE, was unparseable, or the box
   * was unreachable). `null` is the safe value: never idle-downed.
   */
  lastActivity: string | null;
  /** Human-readable note for the watch report (`active now`, `idle 12m`, …). */
  detail: string;
}

/**
 * Turn the probe's stdout into an {@link ActivityReading}, anchored to `now`.
 * Pure: (probe output, now) → reading. No clock, no IO.
 *
 * `ACTIVE` → activity is *now*. `IDLE <n>` → n seconds before now (a negative n
 * from clock weirdness is clamped to 0, i.e. "just now"). Anything else
 * (`NONE`, empty, garbage) → `null`, so the box is treated as possibly-working.
 */
export function parseActivity(output: string, now: Date): ActivityReading {
  const line = output.trim().split("\n").pop()?.trim() ?? "";

  if (line === "ACTIVE") {
    return { lastActivity: now.toISOString(), detail: "active now (claude/tmux)" };
  }

  const idle = /^IDLE\s+(-?\d+)$/.exec(line);
  if (idle) {
    const secs = Math.max(0, Number(idle[1]));
    const last = new Date(now.getTime() - secs * 1000);
    return { lastActivity: last.toISOString(), detail: `heartbeat ${secs}s ago` };
  }

  if (line === "NONE") {
    return { lastActivity: null, detail: "no activity signal (unknown)" };
  }

  return { lastActivity: null, detail: "unreadable activity probe (unknown)" };
}

/**
 * IO: read a box's activity over the tailnet by name and parse it against `now`.
 * A failed ssh (box off the tailnet / unreachable) is reported as unknown
 * (`lastActivity: null`) — the safe direction: the watcher will never idle-down a
 * box it couldn't probe; only the hard cap applies. Validated live, not in unit
 * tests (the parser carries the logic; this just wires ssh → parser).
 */
export function readActivity(name: string, now: Date): ActivityReading {
  const res = runSshCapture(buildTailnetSshArgs({ name, command: [ACTIVITY_PROBE] }));
  if (res.code !== 0) {
    return { lastActivity: null, detail: "unreachable (ssh failed → unknown)" };
  }
  return parseActivity(res.stdout, now);
}
