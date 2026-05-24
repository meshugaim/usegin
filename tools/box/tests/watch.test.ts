import { describe, it, expect } from "bun:test";
import {
  planWatch,
  boxesToDown,
  formatWatchReport,
  type WatchEntry,
} from "../src/lib/watch";
import type { LeasePolicy } from "../src/lib/lease";

const UP_SINCE = "2026-05-23T12:00:00.000Z";
const MIN = 60_000;
const HOUR = 60 * MIN;
const policy: LeasePolicy = { idleMs: 30 * MIN, hardCapMs: 8 * HOUR };
const at = (ms: number): Date => new Date(Date.parse(UP_SINCE) + ms);

describe("planWatch — threads through decideLeaseAction", () => {
  it("keeps an active box and downs an idle one in the same pass", () => {
    const entries: WatchEntry[] = [
      { name: "agent-a", upSince: UP_SINCE, lastActivity: at(20 * MIN).toISOString() },
      { name: "agent-b", upSince: UP_SINCE, lastActivity: at(10 * MIN).toISOString() },
    ];
    const decisions = planWatch(entries, policy, at(55 * MIN)); // 12:55

    // agent-a active at 12:20 → idle deadline 12:50, past → down.
    expect(decisions[0]).toMatchObject({ name: "agent-a", action: { action: "down", reason: "idle" } });
    // agent-b active at 12:10 → idle deadline 12:40, also past → down.
    expect(decisions[1]).toMatchObject({ name: "agent-b", action: { action: "down", reason: "idle" } });
  });

  it("downs at the hard cap even when the box looks active", () => {
    const entries: WatchEntry[] = [
      { name: "stuck", upSince: UP_SINCE, lastActivity: at(8 * HOUR).toISOString() },
    ];
    const decisions = planWatch(entries, policy, at(8 * HOUR + MIN));
    expect(decisions[0]!.action).toEqual({ action: "down", reason: "hard-cap" });
  });

  it("keeps a box with unknown activity (null) until the hard cap (false-down bias)", () => {
    const entries: WatchEntry[] = [
      { name: "unprobed", upSince: UP_SINCE, lastActivity: null, detail: "unreachable" },
    ];
    const decisions = planWatch(entries, policy, at(5 * HOUR));
    expect(decisions[0]!.action.action).toBe("keep");
  });
});

describe("planWatch — excluded boxes are NEVER downed (suicide guard)", () => {
  it("forces keep for an excluded box even when it is long idle past every deadline", () => {
    const entries: WatchEntry[] = [
      // Idle since 12:00, way past idle AND hard cap at now=20h — would be downed.
      { name: "effi-mgmt", upSince: UP_SINCE, lastActivity: UP_SINCE },
    ];
    const decisions = planWatch(entries, policy, at(20 * HOUR), { exclude: ["effi-mgmt"] });

    expect(decisions[0]!.action.action).toBe("keep");
    if (decisions[0]!.action.action === "keep") {
      expect(decisions[0]!.action.reason).toContain("excluded");
    }
  });

  it("excludes only the named boxes; others still get downed in the same pass", () => {
    const entries: WatchEntry[] = [
      { name: "effi-mgmt", upSince: UP_SINCE, lastActivity: UP_SINCE },
      { name: "agent-a", upSince: UP_SINCE, lastActivity: UP_SINCE },
    ];
    const decisions = planWatch(entries, policy, at(2 * HOUR), { exclude: ["effi-mgmt"] });

    expect(decisions[0]!.action.action).toBe("keep"); // mgmt excluded
    expect(decisions[1]!.action).toEqual({ action: "down", reason: "idle" }); // agent-a idle-downed
  });
});

describe("boxesToDown", () => {
  it("returns only the names the planner marked down", () => {
    const entries: WatchEntry[] = [
      { name: "keep-me", upSince: UP_SINCE, lastActivity: at(110 * MIN).toISOString() },
      { name: "down-me", upSince: UP_SINCE, lastActivity: UP_SINCE },
    ];
    const decisions = planWatch(entries, policy, at(2 * HOUR));
    expect(boxesToDown(decisions)).toEqual(["down-me"]);
  });
});

describe("formatWatchReport", () => {
  it("shows a countdown for keeps and a reason for downs", () => {
    const entries: WatchEntry[] = [
      { name: "agent-a", upSince: UP_SINCE, lastActivity: at(110 * MIN).toISOString(), detail: "active now" },
      { name: "agent-b", upSince: UP_SINCE, lastActivity: UP_SINCE, detail: "heartbeat 120m ago" },
    ];
    const report = formatWatchReport(planWatch(entries, policy, at(2 * HOUR)));

    expect(report).toContain("agent-a");
    expect(report).toContain("KEEP");
    expect(report).toContain("down in");
    expect(report).toContain("agent-b");
    expect(report).toContain("DOWN");
    expect(report).toContain("idle");
  });

  it("surfaces the activity-probe detail as the operator's evidence for the call", () => {
    // The probe's diagnostic note (heartbeat age, 'unreachable', 'unknown') is the
    // whole reason the box reads the way it does — the report must show it, not
    // collect it and drop it. Covers both a KEEP and a DOWN line.
    const entries: WatchEntry[] = [
      { name: "live", upSince: UP_SINCE, lastActivity: at(110 * MIN).toISOString(), detail: "heartbeat 10s ago" },
      { name: "gone", upSince: UP_SINCE, lastActivity: UP_SINCE, detail: "no activity signal (unknown)" },
    ];
    const report = formatWatchReport(planWatch(entries, policy, at(2 * HOUR)));

    expect(report).toContain("[heartbeat 10s ago]");
    expect(report).toContain("[no activity signal (unknown)]");
  });

  it("omits the detail segment when the probe gave no note", () => {
    const entries: WatchEntry[] = [
      { name: "bare", upSince: UP_SINCE, lastActivity: at(110 * MIN).toISOString() }, // no detail
    ];
    const report = formatWatchReport(planWatch(entries, policy, at(2 * HOUR)));
    expect(report).not.toContain("[");
  });

  it("omits the countdown when nothing will ever down the box", () => {
    const idleOnly: LeasePolicy = { idleMs: 30 * MIN, hardCapMs: null };
    const entries: WatchEntry[] = [
      { name: "forever", upSince: UP_SINCE, lastActivity: null },
    ];
    const report = formatWatchReport(planWatch(entries, idleOnly, at(99 * HOUR)));
    expect(report).toContain("KEEP");
    expect(report).not.toContain("down in");
  });

  it("handles an empty fleet", () => {
    expect(formatWatchReport([])).toBe("No running boxes to watch.");
  });
});
