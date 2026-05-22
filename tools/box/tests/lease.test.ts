import { describe, it, expect } from "bun:test";
import {
  decideLeaseAction,
  type LeaseState,
  type LeasePolicy,
} from "../src/lib/lease";

// All times are fixed (no clock): the box came up at 12:00 and we reason about a
// 30-min idle window and an 8-hour hard cap unless a case overrides them.
const UP_SINCE = "2026-05-22T12:00:00.000Z";
const MIN = 60_000;
const HOUR = 60 * MIN;

const idleAndCap: LeasePolicy = { idleMs: 30 * MIN, hardCapMs: 8 * HOUR };

/** Convenience for an ISO time `n` ms after the box came up. */
const afterUp = (ms: number): Date => new Date(Date.parse(UP_SINCE) + ms);

describe("decideLeaseAction — idle window", () => {
  it("keeps an active box within the idle window, with downInMs to the idle deadline", () => {
    const state: LeaseState = {
      lastActivity: "2026-05-22T12:20:00.000Z", // 20m in
      upSince: UP_SINCE,
    };
    const now = afterUp(25 * MIN); // 5m of quiet, still inside the 30m window

    const res = decideLeaseAction(state, idleAndCap, now);

    expect(res.action).toBe("keep");
    // Idle deadline is 12:50 (activity 12:20 + 30m); now is 12:25 → 25m to go.
    // That is sooner than the hard cap (20:00), so it's the nearest deadline.
    expect(res).toMatchObject({ action: "keep", downInMs: 25 * MIN });
  });

  it("downs a box that has been idle past the window", () => {
    const state: LeaseState = {
      lastActivity: "2026-05-22T12:20:00.000Z", // 20m in
      upSince: UP_SINCE,
    };
    const now = afterUp(55 * MIN); // 35m of quiet > 30m window

    const res = decideLeaseAction(state, idleAndCap, now);

    expect(res).toEqual({ action: "down", reason: "idle" });
  });

  it("downs exactly at the idle boundary (now === idleDeadline)", () => {
    const state: LeaseState = {
      lastActivity: "2026-05-22T12:20:00.000Z",
      upSince: UP_SINCE,
    };
    const now = new Date("2026-05-22T12:50:00.000Z"); // 12:20 + 30m exactly

    const res = decideLeaseAction(state, idleAndCap, now);

    expect(res).toEqual({ action: "down", reason: "idle" });
  });

  it("keeps one ms before the idle boundary", () => {
    const state: LeaseState = {
      lastActivity: "2026-05-22T12:20:00.000Z",
      upSince: UP_SINCE,
    };
    const now = new Date("2026-05-22T12:49:59.999Z"); // 1ms before deadline

    const res = decideLeaseAction(state, idleAndCap, now);

    expect(res).toMatchObject({ action: "keep", downInMs: 1 });
  });
});

describe("decideLeaseAction — hard cap is the backstop", () => {
  it("downs a box past the hard cap even while it is ACTIVE (cap wins over a live lease)", () => {
    const state: LeaseState = {
      // Just touched activity — the idle rule would keep it alive forever.
      lastActivity: "2026-05-22T19:59:00.000Z",
      upSince: UP_SINCE,
    };
    const now = afterUp(8 * HOUR + MIN); // 8h1m uptime > 8h cap

    const res = decideLeaseAction(state, idleAndCap, now);

    // Hard cap is the backstop for a stuck/looping box or a fooled lease detector.
    expect(res).toEqual({ action: "down", reason: "hard-cap" });
  });

  it("downs exactly at the hard-cap boundary (now === hardDeadline)", () => {
    const state: LeaseState = {
      lastActivity: "2026-05-22T19:59:00.000Z", // active
      upSince: UP_SINCE,
    };
    const now = afterUp(8 * HOUR); // exactly at the cap

    const res = decideLeaseAction(state, idleAndCap, now);

    expect(res).toEqual({ action: "down", reason: "hard-cap" });
  });

  it("prefers hard-cap over idle when BOTH deadlines have passed", () => {
    const state: LeaseState = {
      lastActivity: "2026-05-22T13:00:00.000Z", // idle deadline 13:30, long gone
      upSince: UP_SINCE,
    };
    const now = afterUp(8 * HOUR + HOUR); // both idle (13:30) and cap (20:00) passed

    const res = decideLeaseAction(state, idleAndCap, now);

    expect(res).toEqual({ action: "down", reason: "hard-cap" });
  });

  it("keeps with downInMs to the hard cap when the cap is the nearest deadline", () => {
    const state: LeaseState = {
      // Activity is recent enough that the idle deadline is FURTHER out than the cap.
      lastActivity: "2026-05-22T19:50:00.000Z", // idle deadline 20:20
      upSince: UP_SINCE, // hard cap 20:00 — nearer
    };
    const now = afterUp(7 * HOUR); // 19:00

    const res = decideLeaseAction(state, idleAndCap, now);

    // Nearest of {idle 20:20, cap 20:00} is the cap; 20:00 - 19:00 = 1h.
    expect(res).toMatchObject({ action: "keep", downInMs: HOUR });
  });
});

describe("decideLeaseAction — bias against false-down (lastActivity null)", () => {
  it("keeps a box with UNKNOWN activity while within the hard cap (never idle-downs)", () => {
    const state: LeaseState = { lastActivity: null, upSince: UP_SINCE };
    const now = afterUp(5 * HOUR); // well past any idle window, but under the cap

    const res = decideLeaseAction(state, idleAndCap, now);

    // Unreadable activity = possibly-working. Only the hard cap may down it.
    expect(res.action).toBe("keep");
    // downInMs counts down to the hard cap (the only deadline that applies).
    expect(res).toMatchObject({ action: "keep", downInMs: 3 * HOUR }); // 20:00 - 17:00
  });

  it("downs a box with UNKNOWN activity once past the hard cap", () => {
    const state: LeaseState = { lastActivity: null, upSince: UP_SINCE };
    const now = afterUp(8 * HOUR + MIN); // past the cap

    const res = decideLeaseAction(state, idleAndCap, now);

    expect(res).toEqual({ action: "down", reason: "hard-cap" });
  });

  it("surfaces the 'activity unknown' reason on keep", () => {
    const state: LeaseState = { lastActivity: null, upSince: UP_SINCE };
    const now = afterUp(HOUR);

    const res = decideLeaseAction(state, idleAndCap, now);

    expect(res.action).toBe("keep");
    if (res.action === "keep") {
      expect(res.reason).toContain("unknown");
    }
  });
});

describe("decideLeaseAction — no hard cap (hardCapMs null)", () => {
  const idleOnly: LeasePolicy = { idleMs: 30 * MIN, hardCapMs: null };

  it("downs an idle box even with no hard cap", () => {
    const state: LeaseState = {
      lastActivity: "2026-05-22T12:20:00.000Z",
      upSince: UP_SINCE,
    };
    const now = afterUp(55 * MIN); // 35m quiet > 30m

    const res = decideLeaseAction(state, idleOnly, now);

    expect(res).toEqual({ action: "down", reason: "idle" });
  });

  it("keeps an active box with downInMs to the idle deadline (the only deadline)", () => {
    const state: LeaseState = {
      lastActivity: "2026-05-22T12:20:00.000Z",
      upSince: UP_SINCE,
    };
    const now = afterUp(25 * MIN); // 12:25, idle deadline 12:50

    const res = decideLeaseAction(state, idleOnly, now);

    expect(res).toMatchObject({ action: "keep", downInMs: 25 * MIN });
  });

  it("keeps forever (downInMs null) when there is no cap AND activity is unknown", () => {
    // The both-null-ish edge: nothing can ever down this box.
    const state: LeaseState = { lastActivity: null, upSince: UP_SINCE };
    const now = afterUp(99 * HOUR);

    const res = decideLeaseAction(state, idleOnly, now);

    expect(res).toEqual({
      action: "keep",
      reason: expect.stringContaining("unknown"),
      downInMs: null,
    });
  });
});

describe("decideLeaseAction — purity", () => {
  it("is deterministic and does not mutate its inputs", () => {
    const state: LeaseState = {
      lastActivity: "2026-05-22T12:20:00.000Z",
      upSince: UP_SINCE,
    };
    const policy: LeasePolicy = { idleMs: 30 * MIN, hardCapMs: 8 * HOUR };
    const now = afterUp(25 * MIN);

    const snapshotState = { ...state };
    const snapshotPolicy = { ...policy };

    const a = decideLeaseAction(state, policy, now);
    const b = decideLeaseAction(state, policy, now);

    expect(a).toEqual(b); // same inputs → same output
    expect(state).toEqual(snapshotState); // inputs untouched
    expect(policy).toEqual(snapshotPolicy);
  });
});
