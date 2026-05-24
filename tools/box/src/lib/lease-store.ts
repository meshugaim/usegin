/**
 * Lease store — the push-lease state (slice 7, push model).
 *
 * In the push-lease model each worker box renews its own lease by curling the
 * mgmt box ("I'm alive") whenever it's actually working; mgmt records the
 * renewal here, and the reaper (`planWatch`, fed `lastActivity = last renewal`)
 * downs boxes whose lease has gone stale past the idle window or hit the hard
 * cap. This module is that store: a JSON-file-backed map of box name →
 * last-renewal time, plus the pure helpers to read / update / query it.
 *
 * Why it's persisted to disk: if mgmt restarts and loses every lease, the next
 * reaper pass would see "no renewals ever" for the whole fleet. Because unknown
 * activity is never idle-downed (the false-down bias in `lease.ts`), that alone
 * won't reap a working box — but persisting leases keeps the countdown honest
 * across an mgmt bounce instead of silently resetting every box's idle clock.
 *
 * Why writes are atomic (tmp + rename): a crash mid-write must not leave a
 * half-written file that fails to parse. Parsing is also tolerant — a corrupt or
 * missing store reads back as empty rather than throwing, so a damaged file can
 * never crash the reaper loop. Both directions fail open (toward keep), never
 * toward a spurious down.
 *
 * The pure core (parse / serialize / renew / forget / activity) is split from
 * the thin sync file IO so the model is exhaustively unit-testable with no disk.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";

/** One box's lease state. */
export interface LeaseRecord {
  /** ISO time of this box's most recent lease renewal. */
  lastRenewal: string;
}

/** box name → its lease record. */
export type LeaseStore = Record<string, LeaseRecord>;

// --- Pure core (no IO) ---

/**
 * Parse a store from JSON. Tolerant by design: invalid JSON, a non-object, or
 * malformed entries yield an empty / pruned store rather than throwing, so a
 * corrupt file can never crash the reaper. Only entries with a string
 * `lastRenewal` survive; everything else is dropped.
 */
export function parseLeaseStore(json: string): LeaseStore {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {};
  }
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const store: LeaseStore = {};
  for (const [name, rec] of Object.entries(raw as Record<string, unknown>)) {
    if (
      rec != null &&
      typeof rec === "object" &&
      typeof (rec as Record<string, unknown>).lastRenewal === "string"
    ) {
      store[name] = { lastRenewal: (rec as LeaseRecord).lastRenewal };
    }
  }
  return store;
}

/**
 * Serialize a store to JSON with keys sorted, so the on-disk file is
 * deterministic (stable across renewals of unrelated boxes — easy to eyeball
 * and diff). Trailing newline for tidy files.
 */
export function serializeLeaseStore(store: LeaseStore): string {
  const sorted: LeaseStore = {};
  for (const name of Object.keys(store).sort()) {
    sorted[name] = store[name];
  }
  return JSON.stringify(sorted, null, 2) + "\n";
}

/**
 * Stamp `name`'s renewal at `now`. Pure: returns a NEW store, leaving the input
 * untouched. An existing box's timestamp is overwritten; a new box is added.
 */
export function renewLease(store: LeaseStore, name: string, now: Date): LeaseStore {
  return { ...store, [name]: { lastRenewal: now.toISOString() } };
}

/**
 * Drop `name` from the store. Pure (new store). Used after a box is reaped so
 * its record doesn't linger forever once the box no longer exists.
 */
export function forgetLease(store: LeaseStore, name: string): LeaseStore {
  if (!(name in store)) return store;
  const next = { ...store };
  delete next[name];
  return next;
}

/**
 * The box's last-renewal time, or `null` if it has never renewed — exactly the
 * shape `planWatch` / `decideLeaseAction` want for `lastActivity` (null → never
 * idle-downed, only the hard cap applies).
 */
export function leaseActivity(store: LeaseStore, name: string): string | null {
  return store[name]?.lastRenewal ?? null;
}

// --- Thin file IO (sync) ---

/** Read the store from `path`. A missing file reads as an empty store. */
export function readLeaseStore(path: string): LeaseStore {
  if (!existsSync(path)) return {};
  return parseLeaseStore(readFileSync(path, "utf8"));
}

/**
 * Write the store to `path` atomically (write a sibling tmp file, then rename
 * over the target) so a crash mid-write can't leave a half-written, unparseable
 * store. A reader either sees the old file or the new one, never a partial:
 * `renameSync` within the same directory is atomic on POSIX, and writing the tmp
 * as a sibling (not `/tmp`) keeps it on the same filesystem so the rename can't
 * degrade to a copy.
 *
 * The tmp name carries a per-write unique suffix (pid + random) rather than a
 * fixed `${path}.tmp`. A fixed name is NOT collision-safe: two overlapping
 * writers would clobber each other's tmp and the loser's `renameSync` would
 * throw ENOENT. The unique suffix gives each writer its own tmp, so the
 * write→rename step is collision-free. (Note: this protects the file from
 * corruption/partials, not the store from lost updates — two concurrent
 * read-modify-writes can still drop one renewal; serializing renewals is the
 * mgmt endpoint's job, see `renewLeaseFile`.)
 *
 * Creates the parent directory if needed.
 */
export function writeLeaseStore(path: string, store: LeaseStore): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(tmp, serializeLeaseStore(store));
  renameSync(tmp, path);
}

/**
 * Read-modify-write a single renewal: load the store, stamp `name` at `now`,
 * persist atomically, and return the updated store. This is what the mgmt
 * lease endpoint calls per renewal request.
 */
export function renewLeaseFile(path: string, name: string, now: Date): LeaseStore {
  const next = renewLease(readLeaseStore(path), name, now);
  writeLeaseStore(path, next);
  return next;
}
