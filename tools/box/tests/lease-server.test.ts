import { afterEach, beforeEach, describe, it, expect } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  handleLeaseRequest,
  parseLeaseRequest,
  serveLease,
  type LeaseRequest,
} from "../src/lib/lease-server";
import { parseLeaseStore, type LeaseStore } from "../src/lib/lease-store";

// Fixed clock (no real time): every renew stamps exactly NOW, so we can assert
// the body's `lastRenewal` byte-for-byte instead of fuzzily matching "recent".
const NOW = new Date("2026-05-24T12:00:00.000Z");
const NOW_ISO = "2026-05-24T12:00:00.000Z";
// A pre-existing renewal, distinct from NOW, used to prove renew touches only
// the named box and leaves siblings byte-identical.
const T_OLD = "2026-05-24T11:00:00.000Z";

/** Build the parsed-request shape the pure handler consumes. */
const req = (pathname: string, box: string | null = null): LeaseRequest => ({
  pathname,
  box,
});

describe("handleLeaseRequest — /lease/renew", () => {
  it("renews: 200, body {ok, box, lastRenewal=now}, store stamped at now", () => {
    const store: LeaseStore = {};
    const res = handleLeaseRequest(store, req("/lease/renew", "worker"), NOW);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, box: "worker", lastRenewal: NOW_ISO });
    // The returned store carries the stamp the body advertised.
    expect(res.store).toEqual({ worker: { lastRenewal: NOW_ISO } });
  });

  it("renew returns a NEW store ref (a write happened → caller must persist)", () => {
    // The thin wrapper persists IFF res.store !== input. A renew must therefore
    // hand back a fresh ref so the disk write fires.
    const store: LeaseStore = {};
    const res = handleLeaseRequest(store, req("/lease/renew", "worker"), NOW);
    expect(res.store).not.toBe(store);
  });

  it("does not mutate the input store on renew (purity)", () => {
    const store: LeaseStore = {};
    handleLeaseRequest(store, req("/lease/renew", "worker"), NOW);
    expect(store).toEqual({});
  });

  it("overwrites an existing box's timestamp, leaving siblings byte-identical", () => {
    const sibling = { lastRenewal: T_OLD };
    const store: LeaseStore = { worker: { lastRenewal: T_OLD }, other: sibling };
    const res = handleLeaseRequest(store, req("/lease/renew", "worker"), NOW);

    expect(res.store).toEqual({
      worker: { lastRenewal: NOW_ISO },
      other: { lastRenewal: T_OLD },
    });
    // The untouched box keeps its exact record object — renew only rewrites the
    // named key (spread copy preserves the others by reference).
    expect((res.store as LeaseStore).other).toBe(sibling);
  });

  it("adds a new box without disturbing the existing ones", () => {
    const store: LeaseStore = { existing: { lastRenewal: T_OLD } };
    const res = handleLeaseRequest(store, req("/lease/renew", "fresh"), NOW);
    expect(res.store).toEqual({
      existing: { lastRenewal: T_OLD },
      fresh: { lastRenewal: NOW_ISO },
    });
  });

  it("missing box → 400, store referentially UNCHANGED (no write fires)", () => {
    // box is null (the parser already collapsed empty/whitespace to null). The
    // handler must reject without producing a new ref, so the wrapper skips the
    // disk write — a bad request never rewrites the store.
    const store: LeaseStore = { worker: { lastRenewal: T_OLD } };
    const res = handleLeaseRequest(store, req("/lease/renew", null), NOW);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false });
    expect((res.body as { error: string }).error).toContain("box");
    expect(res.store).toBe(store); // same ref → wrapper persists nothing
  });
});

describe("handleLeaseRequest — read-only routes return the SAME store ref", () => {
  it("/lease/status → 200 {leases: store}, store ref unchanged", () => {
    const store: LeaseStore = { a: { lastRenewal: T_OLD }, b: { lastRenewal: NOW_ISO } };
    const res = handleLeaseRequest(store, req("/lease/status"), NOW);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ leases: store });
    // Read routes must hand back the identical ref so the wrapper never writes.
    expect(res.store).toBe(store);
  });

  it("/lease/status reflects the live store contents (the whole store, verbatim)", () => {
    const store: LeaseStore = { only: { lastRenewal: T_OLD } };
    const res = handleLeaseRequest(store, req("/lease/status"), NOW);
    expect((res.body as { leases: LeaseStore }).leases).toBe(store);
  });

  it("/healthz → 200 {ok: true}, store ref unchanged", () => {
    const store: LeaseStore = { a: { lastRenewal: T_OLD } };
    const res = handleLeaseRequest(store, req("/healthz"), NOW);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.store).toBe(store);
  });

  it("unknown path → 404 {ok:false, error}, store ref unchanged", () => {
    const store: LeaseStore = { a: { lastRenewal: T_OLD } };
    const res = handleLeaseRequest(store, req("/nope"), NOW);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ ok: false });
    expect((res.body as { error: string }).error).toContain("/nope");
    expect(res.store).toBe(store);
  });

  it("the renew path with a missing box is a 400, NOT a 404 (path matched, arg didn't)", () => {
    // Guards the route precedence: /lease/renew is a known route, so a missing
    // box is a bad request (400), not an unknown path (404).
    const store: LeaseStore = {};
    const res = handleLeaseRequest(store, req("/lease/renew", null), NOW);
    expect(res.status).toBe(400);
  });
});

describe("parseLeaseRequest — URL → handler input", () => {
  // A fixed origin; only pathname + the `box` param matter to the handler.
  const url = (path: string): string => `http://effi-mgmt:9100${path}`;

  it("extracts pathname and the box query param", () => {
    const r = parseLeaseRequest(url("/lease/renew?box=worker"));
    expect(r).toEqual({ pathname: "/lease/renew", box: "worker" });
  });

  it("trims surrounding whitespace from box (a curl with %20 padding still resolves)", () => {
    const r = parseLeaseRequest(url("/lease/renew?box=%20worker%20"));
    expect(r.box).toBe("worker");
  });

  it("absent box → null", () => {
    const r = parseLeaseRequest(url("/lease/status"));
    expect(r.box).toBeNull();
  });

  it("empty box (?box=) → null", () => {
    const r = parseLeaseRequest(url("/lease/renew?box="));
    expect(r.box).toBeNull();
  });

  it("whitespace-only box (?box=%20%20) → null (not a stampable name)", () => {
    const r = parseLeaseRequest(url("/lease/renew?box=%20%20"));
    expect(r.box).toBeNull();
  });

  it("a real box value passes through verbatim (after trim)", () => {
    const r = parseLeaseRequest(url("/lease/renew?box=effi-devbox-3"));
    expect(r.box).toBe("effi-devbox-3");
  });

  it("ignores query params other than box", () => {
    const r = parseLeaseRequest(url("/lease/renew?other=1&box=worker&extra=2"));
    expect(r).toEqual({ pathname: "/lease/renew", box: "worker" });
  });

  it("keeps the pathname even when there is no query string at all", () => {
    const r = parseLeaseRequest(url("/healthz"));
    expect(r).toEqual({ pathname: "/healthz", box: null });
  });
});

// The reason parse + handle are split: parse normalizes the URL, handle reasons
// over the normalized shape. Prove the seam — feed a real URL straight through
// the parser into the handler, the way the Bun.serve wrapper does.
describe("parseLeaseRequest → handleLeaseRequest (the wiring)", () => {
  it("a padded ?box= renews the trimmed name end-to-end", () => {
    const r = parseLeaseRequest("http://effi-mgmt:9100/lease/renew?box=%20w%20");
    const res = handleLeaseRequest({}, r, NOW);
    expect(res.status).toBe(200);
    expect(res.store).toEqual({ w: { lastRenewal: NOW_ISO } });
  });

  it("an empty ?box= flows to a 400 with the store untouched", () => {
    const store: LeaseStore = { w: { lastRenewal: T_OLD } };
    const r = parseLeaseRequest("http://effi-mgmt:9100/lease/renew?box=");
    const res = handleLeaseRequest(store, r, NOW);
    expect(res.status).toBe(400);
    expect(res.store).toBe(store);
  });
});

// The pure handler is exhaustively covered above; this block proves the thin
// Bun.serve wrapper actually wires it to a socket and to disk — that a renew
// persists (write-through) and a read route does not. Needs a real port + file,
// so it's a small handful of socket tests, not the bulk of the coverage.
describe("serveLease — the Bun.serve wrapper (persist-on-change, over a socket)", () => {
  let dir: string;
  let storePath: string;
  let server: ReturnType<typeof serveLease>;

  const get = async (path: string): Promise<{ status: number; body: any }> => {
    const r = await fetch(`http://localhost:${server.port}${path}`);
    return { status: r.status, body: await r.json() };
  };
  const onDisk = (): LeaseStore => parseLeaseStore(readFileSync(storePath, "utf8"));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lease-server-test-"));
    storePath = join(dir, "leases.json");
  });
  afterEach(() => {
    server?.stop(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads an existing store from disk at startup (in-memory is seeded, not empty)", async () => {
    writeFileSync(storePath, JSON.stringify({ pre: { lastRenewal: T_OLD } }));
    server = serveLease({ port: 0, storePath });
    const { body } = await get("/lease/status");
    expect(body.leases).toEqual({ pre: { lastRenewal: T_OLD } });
  });

  it("a renew writes the stamp through to disk", async () => {
    server = serveLease({ port: 0, storePath });
    const { status, body } = await get("/lease/renew?box=worker");
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.box).toBe("worker");
    // The renewal landed on disk, not just in memory.
    expect(onDisk().worker?.lastRenewal).toBe(body.lastRenewal);
  });

  it("a read route (/lease/status) does NOT create or write the store file", async () => {
    server = serveLease({ port: 0, storePath });
    expect(existsSync(storePath)).toBe(false); // empty start, nothing loaded
    const { status, body } = await get("/lease/status");
    expect(status).toBe(200);
    expect(body.leases).toEqual({});
    // No mutation → wrapper must not have written anything.
    expect(existsSync(storePath)).toBe(false);
  });

  it("a 400 (missing box) does NOT write the store file", async () => {
    server = serveLease({ port: 0, storePath });
    const { status } = await get("/lease/renew?box=");
    expect(status).toBe(400);
    expect(existsSync(storePath)).toBe(false);
  });

  it("serves in-memory state across requests without re-reading disk per request", async () => {
    server = serveLease({ port: 0, storePath });
    await get("/lease/renew?box=a");
    await get("/lease/renew?box=b");
    // Both renewals are visible from the in-memory source of truth.
    const { body } = await get("/lease/status");
    expect(Object.keys(body.leases).sort()).toEqual(["a", "b"]);
    // And both are durable on disk.
    expect(Object.keys(onDisk()).sort()).toEqual(["a", "b"]);
  });

  it("an unknown path is a 404 and leaves no file behind", async () => {
    server = serveLease({ port: 0, storePath });
    const { status, body } = await get("/nope");
    expect(status).toBe(404);
    expect(body.ok).toBe(false);
    expect(existsSync(storePath)).toBe(false);
  });
});
