/**
 * Box config resolution — pure. No IO.
 *
 * Precedence per field: BOX_* env  >  legacy HETZNER_* env  >  built-in default.
 * We honour the HETZNER_* names so an existing `scripts/hetzner/hetzner.conf`
 * (exported into the env) keeps working during the transition off `hetzner.sh`.
 */

export interface BoxConfig {
  /** Default box name when none is passed on the CLI. */
  name: string;
  /** Hetzner server type. Defaults to cpx42: the current snapshot is locked to
   *  >=320GB-disk types, and cpx42 is the cheapest that fits. Slice 5 generalises
   *  sizing; until then this is the working default. */
  type: string;
  location: string;
  baseImage: string;
  /** Registered hcloud ssh-key name. Required for `up`/`provision`; empty = unset. */
  sshKeyName: string;
  repoUrl: string;
}

export const DEFAULTS: Omit<BoxConfig, "sshKeyName"> = {
  name: "effi-devbox",
  type: "cpx42",
  location: "nbg1",
  baseImage: "ubuntu-24.04",
  repoUrl: "https://github.com/AskEffi/test-mvp.git",
};

type Env = Record<string, string | undefined>;

export function resolveConfig(env: Env = process.env): BoxConfig {
  const pick = (boxKey: string, hetznerKey: string, def: string): string =>
    env[boxKey] ?? env[hetznerKey] ?? def;

  return {
    name: pick("BOX_NAME", "HETZNER_SERVER_NAME", DEFAULTS.name),
    type: pick("BOX_TYPE", "HETZNER_SERVER_TYPE", DEFAULTS.type),
    location: pick("BOX_LOCATION", "HETZNER_LOCATION", DEFAULTS.location),
    baseImage: pick("BOX_BASE_IMAGE", "HETZNER_BASE_IMAGE", DEFAULTS.baseImage),
    sshKeyName: pick("BOX_SSH_KEY", "HETZNER_SSH_KEY_NAME", ""),
    repoUrl: pick("BOX_REPO_URL", "HETZNER_REPO_URL", DEFAULTS.repoUrl),
  };
}

/**
 * The label/selector that ties a box to its snapshots. Matches the scheme
 * `hetzner.sh` used (`role=<name>-devbox`) so existing snapshots are found.
 */
export function snapshotSelector(name: string): string {
  return `role=${name}-devbox`;
}
