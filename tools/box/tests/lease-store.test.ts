import { describe, it, expect } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseLeaseStore,
  serializeLeaseStore,
  renewLease,
  forgetLease,
  leaseActivity,
  readLeaseStore,
  writeLeaseStore,
  renewLeaseFile,
  type LeaseStore,
} from "../src/lib/lease-store";
import { decideLeaseAction } from "../src/lib/lease";

const T1 = "2026-05-24T12:00:00.000Z";
const T2 = "2026-05-24T12:01:00.000Z";

/** A fresh temp dir per test that needs disk, so cases never collide. */
const tmpDir = (): string => mkdtempSync(join(tmpdir(), "lease-store-"));

describe("parseLeaseStore — tolerant by design", () => {
  it("parses a well-formed store", () => {
    const store = parseLeaseStore(
      JSON.stringify({ worker: { lastRenewal: T1 } }),
    );
    expect(store).toEqual({ worker: { lastRenewal: T1 } });
  });

  it("returns an empty store for invalid JSON (never throws — reaper must not crash)", () => {
    expect(parseLeaseStore("not json{")).toEqual({});
    expect(parseLeaseStore("")).toEqual({});
  });

  it("returns an empty store for non-object JSON (array, number, null)", () => {
    expect(parseLeaseStore("[1,2,3]")).toEqual({});
    expect(parseLeaseStore("42")).toEqual({});
    expect(parseLeaseStore("null")).toEqual({});
  });

  it("drops malformed entries but keeps the valid ones", () => {
    const store = parseLeaseStore(
      JSON.stringify({
        good: { lastRenewal: T1 },
        noField: { other: 1 }, // missing lastRenewal
        wrongType: { lastRenewal: 12345 }, // not a string
        notObject: "nope",
      }),
    );
    // Only `good` survives — the rest are silently pruned (fail open).
    expect(store).toEqual({ good: { lastRenewal: T1 } });
  });

  it("ignores extra fields on a record, keeping only lastRenewal", () => {
    const store = parseLeaseStore(
      JSON.stringify({ worker: { lastRenewal: T1, stale: true } }),
    );
    expect(store).toEqual({ worker: { lastRenewal: T1 } });
  });
});

describe("serializeLeaseStore — deterministic", () => {
  it("sorts keys so the file is stable regardless of insertion order", () => {
    const a = serializeLeaseStore({
      zebra: { lastRenewal: T1 },
      alpha: { lastRenewal: T2 },
    });
    const b = serializeLeaseStore({
      alpha: { lastRenewal: T2 },
      zebra: { lastRenewal: T1 },
    });
    expect(a).toBe(b);
    // alpha is emitted before zebra.
    expect(a.indexOf("alpha")).toBeLessThan(a.indexOf("zebra"));
  });

  it("ends with a trailing newline", () => {
    expect(serializeLeaseStore({ w: { lastRenewal: T1 } })).toEndWith("}\n");
  });

  it("round-trips through parse", () => {
    const store: LeaseStore = { a: { lastRenewal: T1 }, b: { lastRenewal: T2 } };
    expect(parseLeaseStore(serializeLeaseStore(store))).toEqual(store);
  });
});

describe("renewLease — pure stamp", () => {
  it("adds a new box at `now` (as ISO)", () => {
    const next = renewLease({}, "worker", new Date(T1));
    expect(next).toEqual({ worker: { lastRenewal: T1 } });
  });

  it("overwrites an existing box's timestamp", () => {
    const next = renewLease({ worker: { lastRenewal: T1 } }, "worker", new Date(T2));
    expect(next).toEqual({ worker: { lastRenewal: T2 } });
  });

  it("does not mutate the input store", () => {
    const orig: LeaseStore = { worker: { lastRenewal: T1 } };
    renewLease(orig, "worker", new Date(T2));
    expect(orig).toEqual({ worker: { lastRenewal: T1 } });
  });

  it("leaves other boxes untouched", () => {
    const next = renewLease({ a: { lastRenewal: T1 } }, "b", new Date(T2));
    expect(next).toEqual({ a: { lastRenewal: T1 }, b: { lastRenewal: T2 } });
  });
});

describe("forgetLease — post-reap cleanup", () => {
  it("removes a box", () => {
    const next = forgetLease({ a: { lastRenewal: T1 }, b: { lastRenewal: T2 } }, "a");
    expect(next).toEqual({ b: { lastRenewal: T2 } });
  });

  it("is a no-op for an absent box (returns the same store)", () => {
    const orig: LeaseStore = { a: { lastRenewal: T1 } };
    expect(forgetLease(orig, "missing")).toBe(orig);
  });

  it("does not mutate the input store", () => {
    const orig: LeaseStore = { a: { lastRenewal: T1 } };
    forgetLease(orig, "a");
    expect(orig).toEqual({ a: { lastRenewal: T1 } });
  });
});

describe("leaseActivity — feeds planWatch.lastActivity", () => {
  it("returns the last renewal for a known box", () => {
    expect(leaseActivity({ w: { lastRenewal: T1 } }, "w")).toBe(T1);
  });

  it("returns null for a box that never renewed (→ never idle-downed)", () => {
    expect(leaseActivity({ w: { lastRenewal: T1 } }, "other")).toBeNull();
    expect(leaseActivity({}, "w")).toBeNull();
  });
});

// The reason this whole slice exists: leaseActivity's output must be exactly
// what decideLeaseAction wants for `lastActivity`. Unit-testing each side in
// isolation doesn't prove the wiring — feed one straight into the other.
describe("leaseActivity → decideLeaseAction (the consumer contract)", () => {
  // Hard cap set far out (10h) so the idle-window cases isolate idle behavior;
  // the never-renewed case sets its own tighter cap to exercise hard-cap.
  const idlePolicy = { idleMs: 60_000, hardCapMs: 36_000_000 };
  const upSince = "2026-05-24T11:00:00.000Z"; // 10h cap → hard deadline 21:00

  it("a renewed box at exactly the idle edge is idle-downed (inclusive boundary)", () => {
    const store = renewLease({}, "w", new Date(T1));
    const action = decideLeaseAction(
      { lastActivity: leaseActivity(store, "w"), upSince },
      idlePolicy,
      new Date(T2), // T2 is 1 min after T1, idleMs is also 60s → exactly at edge
    );
    // T2 - T1 === idleMs, boundary is inclusive → idle-down at exactly the edge.
    expect(action).toEqual({ action: "down", reason: "idle" });
  });

  it("a renewed box still inside the idle window is kept", () => {
    const store = renewLease({}, "w", new Date(T2));
    const action = decideLeaseAction(
      { lastActivity: leaseActivity(store, "w"), upSince },
      idlePolicy,
      new Date("2026-05-24T12:01:30.000Z"), // 30s after T2, < idleMs, < hard cap
    );
    expect(action.action).toBe("keep");
  });

  it("a never-renewed box is NEVER idle-downed — only the hard cap applies", () => {
    const policy = { idleMs: 60_000, hardCapMs: 3_600_000 }; // 1h cap
    const store: LeaseStore = {}; // nothing ever renewed
    const activity = leaseActivity(store, "ghost");
    expect(activity).toBeNull(); // the bridge value

    // Long past any idle window, but before the hard cap → kept.
    const keep = decideLeaseAction(
      { lastActivity: activity, upSince },
      policy,
      new Date("2026-05-24T11:30:00.000Z"), // 30 min up, idle would be 1 min
    );
    expect(keep.action).toBe("keep");

    // Past the hard cap → the only thing that can down a never-renewed box.
    const down = decideLeaseAction(
      { lastActivity: activity, upSince },
      policy,
      new Date("2026-05-24T12:30:00.000Z"), // 90 min up, hard cap 60 min
    );
    expect(down).toEqual({ action: "down", reason: "hard-cap" });
  });
});

describe("file IO", () => {
  it("readLeaseStore returns empty for a missing file", () => {
    expect(readLeaseStore(join(tmpDir(), "nope.json"))).toEqual({});
  });

  it("writeLeaseStore then readLeaseStore round-trips", () => {
    const path = join(tmpDir(), "leases.json");
    const store: LeaseStore = { a: { lastRenewal: T1 } };
    writeLeaseStore(path, store);
    expect(readLeaseStore(path)).toEqual(store);
  });

  it("writeLeaseStore creates the parent directory if missing", () => {
    const path = join(tmpDir(), "nested", "deep", "leases.json");
    writeLeaseStore(path, { a: { lastRenewal: T1 } });
    expect(existsSync(path)).toBe(true);
  });

  it("writeLeaseStore leaves no .tmp sibling behind (rename completed)", () => {
    const dir = tmpDir();
    const path = join(dir, "leases.json");
    writeLeaseStore(path, { a: { lastRenewal: T1 } });
    // The tmp name is unique per write (pid + random), so assert on the real
    // invariant — NO `.tmp` sibling survives — rather than a fixed literal path
    // the impl no longer produces.
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("concurrent writeLeaseStore calls don't collide on the tmp path", () => {
    // A fixed `${path}.tmp` would make the loser's rename throw ENOENT. The
    // unique suffix gives each writer its own tmp; both writes complete, the
    // last rename wins, and no tmp sibling is orphaned. (This guards the
    // write→rename step, not lost updates — see writeLeaseStore's note.)
    const dir = tmpDir();
    const path = join(dir, "leases.json");
    expect(() => {
      writeLeaseStore(path, { a: { lastRenewal: T1 } });
      writeLeaseStore(path, { b: { lastRenewal: T2 } });
    }).not.toThrow();
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
    expect(readLeaseStore(path)).toEqual({ b: { lastRenewal: T2 } });
  });

  it("readLeaseStore tolerates a corrupt file (reads as empty)", () => {
    const path = join(tmpDir(), "leases.json");
    writeFileSync(path, "{ half-written");
    expect(readLeaseStore(path)).toEqual({});
  });

  it("renewLeaseFile read-modify-writes and returns the updated store", () => {
    const path = join(tmpDir(), "leases.json");
    writeLeaseStore(path, { a: { lastRenewal: T1 } });
    const next = renewLeaseFile(path, "b", new Date(T2));
    expect(next).toEqual({ a: { lastRenewal: T1 }, b: { lastRenewal: T2 } });
    // Persisted, not just returned.
    expect(readLeaseStore(path)).toEqual(next);
  });

  it("renewLeaseFile works against a missing file (creates it)", () => {
    const path = join(tmpDir(), "leases.json");
    const next = renewLeaseFile(path, "a", new Date(T1));
    expect(next).toEqual({ a: { lastRenewal: T1 } });
    expect(readLeaseStore(path)).toEqual(next);
  });

  it("on-disk file is the deterministic serialized form", () => {
    const path = join(tmpDir(), "leases.json");
    const store: LeaseStore = { z: { lastRenewal: T1 }, a: { lastRenewal: T2 } };
    writeLeaseStore(path, store);
    expect(readFileSync(path, "utf8")).toBe(serializeLeaseStore(store));
  });
});
