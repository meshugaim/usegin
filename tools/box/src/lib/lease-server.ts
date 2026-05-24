/**
 * Mgmt lease HTTP server (slice 7, push model).
 *
 * Runs on the always-on mgmt box. Work boxes that are actively working renew
 * their lease by curling this server; it records the renewal in the persisted
 * lease store (`lease-store.ts`), and `box watch`'s reaper later reads that store
 * to decide keep/down. Mgmt never SSHes into a work box — the inside reports out.
 *
 * Routes (all GET; the renew daemon just curls a URL):
 *   /lease/renew?box=<name>  → stamp <name>'s lease at now → 200 {ok, box, lastRenewal}
 *   /lease/status            → 200 {leases: <whole store>}
 *   /healthz                 → 200 {ok: true}
 *   (anything else)          → 404 {ok: false, error}
 *
 * No auth: the security boundary is the network, not the request. A hardened box
 * only accepts traffic over the tailnet (`harden-firewall.sh`), so only tailnet
 * peers can reach this port at all — same trust model as serve-static. Don't
 * expose this server on a public interface.
 *
 * Split for testability: `handleLeaseRequest` is pure (store + parsed request +
 * now → new store + status + body), so every route is unit-testable with no
 * socket. `serveLease` is the thin Bun.serve wrapper that parses the URL, holds
 * the in-memory store, and persists on change.
 */

import type { Server } from "bun";
import {
  leaseActivity,
  readLeaseStore,
  renewLease,
  writeLeaseStore,
  type LeaseStore,
} from "./lease-store";

/** A parsed lease request — the thin wrapper extracts these from the URL. */
export interface LeaseRequest {
  pathname: string;
  /** The `box` query param, or null when absent/empty. */
  box: string | null;
}

export interface LeaseResponse {
  /** The store after handling — same ref when unchanged, new ref on a renew. */
  store: LeaseStore;
  status: number;
  body: unknown;
}

/**
 * Handle one lease request. Pure: no IO, no clock — `now` is passed in, and the
 * (possibly updated) store is returned for the caller to persist. The returned
 * `store` is referentially identical to the input unless a renew changed it, so
 * the caller can persist only on change.
 */
export function handleLeaseRequest(
  store: LeaseStore,
  req: LeaseRequest,
  now: Date,
): LeaseResponse {
  switch (req.pathname) {
    case "/lease/renew": {
      if (!req.box) {
        return {
          store,
          status: 400,
          body: { ok: false, error: "missing required query param: box" },
        };
      }
      const next = renewLease(store, req.box, now);
      return {
        store: next,
        status: 200,
        body: { ok: true, box: req.box, lastRenewal: leaseActivity(next, req.box) },
      };
    }
    case "/lease/status":
      return { store, status: 200, body: { leases: store } };
    case "/healthz":
      return { store, status: 200, body: { ok: true } };
    default:
      return {
        store,
        status: 404,
        body: { ok: false, error: `not found: ${req.pathname}` },
      };
  }
}

/** Parse a request URL into the pure handler's input. */
export function parseLeaseRequest(url: string): LeaseRequest {
  const u = new URL(url);
  const box = u.searchParams.get("box");
  return { pathname: u.pathname, box: box && box.trim() ? box.trim() : null };
}

/**
 * Start the lease server on `port`, persisting to `storePath`. Returns the Bun
 * Server (caller can `.stop()` it).
 *
 * The store is loaded once into memory and kept as the source of truth; each
 * renew updates memory and writes through to disk. Because the request handler
 * is synchronous (no `await` between read and write of the in-memory store),
 * concurrent renewals can't interleave a read-modify-write — Bun runs the JS
 * handler to completion per request — so this process is the single serializer
 * the file store needs (see the lost-update note in lease-store.ts).
 *
 * `log` is injectable so tests can pass a no-op and not pollute the suite output
 * with per-renew lines; it defaults to `console.error` so the real mgmt-box
 * server logs as before. (Injecting is race-free across Bun's concurrent test
 * files, unlike stubbing the global console.error.)
 */
export function serveLease(opts: {
  port: number;
  storePath: string;
  log?: (msg: string) => void;
}): Server<undefined> {
  let store = readLeaseStore(opts.storePath);
  const log = opts.log ?? ((msg: string): void => console.error(msg));

  return Bun.serve({
    port: opts.port,
    fetch(request): Response {
      const req = parseLeaseRequest(request.url);
      const res = handleLeaseRequest(store, req, new Date());
      if (res.store !== store) {
        store = res.store;
        writeLeaseStore(opts.storePath, store);
        if (req.box) {
          log(`[${new Date().toISOString()}] renew ${req.box}`);
        }
      }
      return Response.json(res.body, { status: res.status });
    },
  });
}
