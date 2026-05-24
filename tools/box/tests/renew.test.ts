import { afterEach, beforeEach, describe, it, expect } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasRecentActivity, buildRenewUrl } from "../src/lib/renew";
import { renewCommand } from "../src/commands/renew";
import { serveLease } from "../src/lib/lease-server";
import { parseLeaseStore, type LeaseStore } from "../src/lib/lease-store";

// Fixed clock (no real time): activity ages are computed against this exact NOW,
// so boundary cases (age === buffer) are exact, not fuzzy.
const NOW = new Date("2026-05-24T12:00:00.000Z");
const NOW_MS = NOW.getTime();
const BUFFER_MS = 10 * 60_000; // 10m, the daemon's default activity window.

/** A Date `ms` milliseconds before NOW (i.e. a JSONL mtime that age). */
const agoMs = (ms: number): Date => new Date(NOW_MS - ms);

describe("hasRecentActivity", () => {
  it("empty list → false (no sessions → nothing to keep alive)", () => {
    expect(hasRecentActivity([], NOW, BUFFER_MS)).toBe(false);
  });

  it("a write well within the window → active", () => {
    expect(hasRecentActivity([agoMs(60_000)], NOW, BUFFER_MS)).toBe(true);
  });

  it("a write older than the window → idle", () => {
    // 11m ago with a 10m buffer — outside the window, no renewal.
    expect(hasRecentActivity([agoMs(11 * 60_000)], NOW, BUFFER_MS)).toBe(false);
  });

  it("at the exact edge (age === buffer) → active (inclusive boundary)", () => {
    // Mirrors decideLeaseAction's inclusive deadlines: the edge still counts, so
    // a borderline-active box is kept alive rather than dying one tick early.
    expect(hasRecentActivity([agoMs(BUFFER_MS)], NOW, BUFFER_MS)).toBe(true);
  });

  it("one tick past the edge (age === buffer + 1ms) → idle", () => {
    // The complement of the boundary test: just over the edge is genuinely idle.
    expect(hasRecentActivity([agoMs(BUFFER_MS + 1)], NOW, BUFFER_MS)).toBe(false);
  });

  it("any one recent write among stale ones → active", () => {
    // Real fs: many old project JSONLs + one live session. The OR over all mtimes
    // means the single live write wins.
    const mtimes = [agoMs(3 * 86_400_000), agoMs(60 * 60_000), agoMs(30_000)];
    expect(hasRecentActivity(mtimes, NOW, BUFFER_MS)).toBe(true);
  });

  it("all writes stale → idle", () => {
    const mtimes = [agoMs(3 * 86_400_000), agoMs(60 * 60_000), agoMs(20 * 60_000)];
    expect(hasRecentActivity(mtimes, NOW, BUFFER_MS)).toBe(false);
  });

  it("a future mtime (clock skew, age < 0) → active (safe direction)", () => {
    // A negative age is trivially <= any non-negative buffer. We treat a write
    // 'in the future' as active rather than risk idling a live box on skew.
    expect(hasRecentActivity([new Date(NOW_MS + 5_000)], NOW, BUFFER_MS)).toBe(true);
  });

  it("buffer 0 → only an exactly-now write counts (degenerate but consistent)", () => {
    // age === 0 is <= 0 → active; any positive age is > 0 → idle.
    expect(hasRecentActivity([NOW], NOW, 0)).toBe(true);
    expect(hasRecentActivity([agoMs(1)], NOW, 0)).toBe(false);
  });
});

describe("buildRenewUrl", () => {
  it("builds the canonical renew URL from mgmt + port + box", () => {
    expect(buildRenewUrl({ mgmtName: "effi-mgmt", port: 9100, box: "effi-devbox" }))
      .toBe("http://effi-mgmt:9100/lease/renew?box=effi-devbox");
  });

  it("substitutes a different mgmt name and port", () => {
    expect(buildRenewUrl({ mgmtName: "other-mgmt", port: 8080, box: "w1" }))
      .toBe("http://other-mgmt:8080/lease/renew?box=w1");
  });

  it("encodes a box name with a space", () => {
    // encodeURIComponent → %20, which the server's parseLeaseRequest reads + trims
    // back to the real name end-to-end.
    expect(buildRenewUrl({ mgmtName: "m", port: 1, box: "my box" }))
      .toBe("http://m:1/lease/renew?box=my%20box");
  });

  it("encodes reserved query characters so they don't corrupt the query string", () => {
    // &, =, ?, # in a name would otherwise be read as query structure. Encoding
    // keeps the name a single opaque value.
    expect(buildRenewUrl({ mgmtName: "m", port: 1, box: "a&b=c?d#e" }))
      .toBe("http://m:1/lease/renew?box=a%26b%3Dc%3Fd%23e");
  });

  it("a plain box name with hyphens/digits passes through verbatim", () => {
    // The common case — no reserved chars, so encodeURIComponent is a no-op.
    expect(buildRenewUrl({ mgmtName: "effi-mgmt", port: 9100, box: "effi-devbox-3" }))
      .toBe("http://effi-mgmt:9100/lease/renew?box=effi-devbox-3");
  });
});

// The pure core above carries the activity gate and URL shape; this block proves
// the command's untested IO loop — glob mtimes → recency gate → fetch → real
// lease store — actually wires together. It mirrors slice 2's serveLease socket
// tests: a real ephemeral server on port 0 + a tmp projects dir, driving one
// `--once` pass and asserting the renewal (or its absence) lands on disk. The
// load-bearing claim is end-to-end: an active box's renewal reaches the store,
// an idle box's does not, and a dead target doesn't crash the daemon.
describe("box renew — the --once IO loop, against a real lease server", () => {
  let dir: string;
  let projectsDir: string;
  let storePath: string;
  let server: ReturnType<typeof serveLease>;

  // Run one `--once` pass with the given flags, targeting the live server.
  const runOnce = async (extra: string[] = []): Promise<void> => {
    await renewCommand().parseAsync(
      [
        "--once",
        "--box", "test-box",
        "--mgmt", "localhost",
        "--port", String(server.port),
        "--projects", projectsDir,
        ...extra,
      ],
      { from: "user" },
    );
  };

  // Write a *.jsonl under projectsDir (creating the dir) with an mtime `ageMs`
  // before now — the activity signal the daemon globs for.
  const writeJsonl = (name: string, ageMs: number): void => {
    mkdirSync(projectsDir, { recursive: true });
    const p = join(projectsDir, name);
    writeFileSync(p, "{}\n");
    const when = (Date.now() - ageMs) / 1000;
    utimesSync(p, when, when);
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "renew-test-"));
    projectsDir = join(dir, "projects");
    storePath = join(dir, "leases.json");
    // Real mgmt-side lease server, ephemeral port, store under our tmp dir. Inject
    // a no-op log so the server's per-renew line doesn't pollute the suite output.
    server = serveLease({ port: 0, storePath, log: () => {} });
  });
  afterEach(() => {
    server?.stop(true);
    rmSync(dir, { recursive: true, force: true });
  });

  const readStore = async (): Promise<LeaseStore> =>
    parseLeaseStore(await Bun.file(storePath).text().catch(() => ""));

  it("an active box (recent JSONL) renews — the stamp lands in the mgmt store", async () => {
    writeJsonl("live.jsonl", 30_000); // 30s ago, well within the 10m buffer
    await runOnce();
    const store = await readStore();
    expect(Object.keys(store)).toEqual(["test-box"]);
    expect(typeof store["test-box"]?.lastRenewal).toBe("string");
  });

  it("an active box in a nested project subdir renews (recursive glob)", async () => {
    // Claude JSONL live in per-project subdirs, not the projects root — prove the
    // **/*.jsonl recursion actually reaches them.
    const nested = join(projectsDir, "some-project");
    mkdirSync(nested, { recursive: true });
    const p = join(nested, "session.jsonl");
    writeFileSync(p, "{}\n");
    const when = (Date.now() - 30_000) / 1000;
    utimesSync(p, when, when);
    await runOnce();
    const store = await readStore();
    expect(Object.keys(store)).toEqual(["test-box"]);
  });

  it("an idle box (only stale JSONL) does NOT renew — the store stays empty", async () => {
    writeJsonl("stale.jsonl", 20 * 60_000); // 20m ago, outside the 10m buffer
    await runOnce();
    const store = await readStore();
    expect(store).toEqual({});
  });

  it("a missing projects dir reads as idle (no crash, no renewal)", async () => {
    // projectsDir is never created → collectJsonlMtimes returns [] → idle.
    await runOnce();
    const store = await readStore();
    expect(store).toEqual({});
  });

  it("a dead target does not crash the pass (false-down guard end-to-end)", async () => {
    writeJsonl("live.jsonl", 30_000);
    // Point at a closed port: fetch rejects, the catch swallows it, the pass
    // returns normally. The assertion is that parseAsync resolves rather than
    // throwing — a thrown error here would mean a transient blip kills the daemon.
    const deadPort = server.port;
    server.stop(true);
    await expect(
      renewCommand().parseAsync(
        [
          "--once", "--box", "test-box", "--mgmt", "localhost",
          "--port", String(deadPort), "--projects", projectsDir,
        ],
        { from: "user" },
      ),
    ).resolves.toBeDefined();
  });
});
