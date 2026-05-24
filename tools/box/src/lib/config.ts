/**
 * Box config resolution — pure. No IO.
 *
 * Precedence per field: BOX_* env  >  legacy HETZNER_* env  >  built-in default.
 * We honour the HETZNER_* names so an existing `scripts/hetzner/hetzner.conf`
 * (exported into the env) keeps working during the transition off `hetzner.sh`.
 */

import { join } from "node:path";

export interface BoxConfig {
  /** Default box name when none is passed on the CLI. */
  name: string;
  /**
   * Fixed name of the always-on management box (slice 6). The mgmt box holds the
   * hcloud token and runs the `box` CLI to manage the fleet; work boxes are
   * token-free. It has its OWN snapshot lineage (`role=<mgmtName>-devbox`) and is
   * a lean env, NOT the full dev devcontainer. From `BOX_MGMT_NAME` (no legacy
   * HETZNER_* name — the mgmt box is new in this tool).
   */
  mgmtName: string;
  /** Hetzner server type. Defaults to cpx42: the current snapshot is locked to
   *  >=320GB-disk types, and cpx42 is the cheapest that fits. Slice 5 generalises
   *  sizing; until then this is the working default. */
  type: string;
  location: string;
  baseImage: string;
  /** Registered hcloud ssh-key name. Required for `up`/`provision`; empty = unset. */
  sshKeyName: string;
  repoUrl: string;
  /**
   * TCP port the push-lease HTTP server listens on (slice 7, push model). The
   * mgmt box runs `box mgmt lease-server` on this port; work boxes renew against
   * `http://<mgmtName>:<leasePort>/lease/renew`. Both sides read it from config so
   * they agree. From `BOX_LEASE_PORT`.
   */
  leasePort: number;
  /**
   * Path where the mgmt box persists the lease store (JSON). On the mgmt box;
   * work boxes never touch it. From `BOX_LEASE_STORE`; defaults under `$HOME`.
   */
  leaseStorePath: string;
}

export const DEFAULTS: Omit<BoxConfig, "sshKeyName" | "leaseStorePath"> = {
  name: "effi-devbox",
  mgmtName: "effi-mgmt",
  type: "cpx42",
  location: "nbg1",
  baseImage: "ubuntu-24.04",
  repoUrl: "https://github.com/AskEffi/test-mvp.git",
  // Outside the work boxes' published serve-static range (9000-9009); the lease
  // server runs on the lean mgmt host, reachable on any port over the tailnet.
  leasePort: 9100,
};

type Env = Record<string, string | undefined>;

/**
 * Parse a TCP port (1–65535) from a string, returning `null` for anything that
 * isn't one. Stricter than a bare `parseInt(...) || default`: that idiom lets a
 * negative (`-1` is truthy), trailing junk (`"99999abc"` → 99999), and
 * out-of-range values slip through to a `Bun.serve` that would throw or, for
 * >65535, silently CLAMP. The single source of truth for "is this a port?": the
 * config (env) path falls back to a default on null; the `--port` flag path
 * (mgmt's `parsePort`) exits loud on null. Shared so the two can never drift.
 */
export function parsePort(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0 || n > 65535 || String(n) !== raw.trim()) {
    return null;
  }
  return n;
}

export function resolveConfig(env: Env = process.env): BoxConfig {
  const pick = (boxKey: string, hetznerKey: string, def: string): string =>
    env[boxKey] ?? env[hetznerKey] ?? def;

  return {
    name: pick("BOX_NAME", "HETZNER_SERVER_NAME", DEFAULTS.name),
    // No legacy HETZNER_* name for the mgmt box — it's new in this tool, so we
    // pass the BOX_* key as the (unused) legacy slot to keep `pick`'s shape.
    mgmtName: pick("BOX_MGMT_NAME", "BOX_MGMT_NAME", DEFAULTS.mgmtName),
    type: pick("BOX_TYPE", "HETZNER_SERVER_TYPE", DEFAULTS.type),
    location: pick("BOX_LOCATION", "HETZNER_LOCATION", DEFAULTS.location),
    baseImage: pick("BOX_BASE_IMAGE", "HETZNER_BASE_IMAGE", DEFAULTS.baseImage),
    sshKeyName: pick("BOX_SSH_KEY", "HETZNER_SSH_KEY_NAME", ""),
    repoUrl: pick("BOX_REPO_URL", "HETZNER_REPO_URL", DEFAULTS.repoUrl),
    // Any bad BOX_LEASE_PORT — empty, NaN, zero, negative, or outside the
    // 1–65535 TCP range — falls back to the default rather than passing a value
    // that `Bun.serve` would reject or silently clamp (it clamps >65535 to
    // 65535). The `--port` flag path (parsePort) exits loud instead; config is
    // ambient, so it fails soft toward the default.
    leasePort: parsePort(env.BOX_LEASE_PORT) ?? DEFAULTS.leasePort,
    leaseStorePath:
      env.BOX_LEASE_STORE ?? join(env.HOME ?? env.USERPROFILE ?? ".", ".box", "leases.json"),
  };
}

/**
 * The label/selector that ties a box to its snapshots. Matches the scheme
 * `hetzner.sh` used (`role=<name>-devbox`) so existing snapshots are found.
 */
export function snapshotSelector(name: string): string {
  return `role=${name}-devbox`;
}
