/**
 * Filter turns by timestamp for time-based incremental reads.
 *
 * Supports two input formats:
 * - **Relative**: "5m", "1h", "2d", "30s" — offset from now
 * - **ISO 8601**: "2026-03-19T10:30:00Z" — absolute cutoff
 *
 * Turns without a timestamp are always kept (don't penalize missing data).
 * Applied BEFORE windowing (--since-turn / --last) so that `--last 20`
 * returns 20 real turns from the filtered set.
 */

import type { Turn } from "./types";

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parse a relative time string like "5m", "1h", "2d", "30s" into a Date
 * representing that many units in the past from now.
 */
export function parseRelativeTime(value: string): Date {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    throw new Error(`Invalid relative time: "${value}"`);
  }
  const amount = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const ms = UNIT_MS[unit]!;
  return new Date(Date.now() - amount * ms);
}

/**
 * Parse a timestamp argument into a Date.
 *
 * Tries relative format first ("5m", "1h", "2d"), then ISO 8601.
 * Throws with an actionable message if neither works.
 */
export function parseTimestampArg(value: string): Date {
  // Try relative first: "5m", "1h", "2d", "30s"
  if (/^\d+[smhd]$/.test(value)) {
    return parseRelativeTime(value);
  }

  // Try ISO 8601
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(
      `Invalid timestamp: "${value}". Use ISO 8601 or relative (5m, 1h, 2d).`
    );
  }
  return date;
}

/**
 * Resolve a git commit SHA to the commit's author date.
 *
 * This is sugar over `--since-timestamp` — it looks up the commit in the
 * repo at `cwd` (defaulting to `process.cwd()`) and returns the author
 * date as a `Date`, which can then be passed to `filterByTimestamp`.
 *
 * Throws if the SHA is empty, not found, or if `cwd` is not a git repo.
 */
export async function resolveCommitTimestamp(
  sha: string,
  cwd?: string
): Promise<Date> {
  if (!sha) throw new Error("Commit SHA is required");

  const proc = Bun.spawn(["git", "show", "-s", "--format=%aI", sha], {
    cwd: cwd || process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(
      `Could not resolve commit "${sha}". Is it a valid commit in this repo?`
    );
  }

  const timestamp = stdout.trim();
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error(
      `Commit "${sha}" returned invalid timestamp: "${timestamp}"`
    );
  }

  return date;
}

/**
 * Filter turns to only those at or after the given cutoff date.
 *
 * - Turns with a timestamp >= cutoff are kept.
 * - Turns with a timestamp < cutoff are removed.
 * - Turns without a timestamp are always kept (don't filter what we can't compare).
 */
export function filterByTimestamp(turns: Turn[], since: Date): Turn[] {
  return turns.filter((t) => {
    if (!t.timestamp) return true;
    return new Date(t.timestamp).getTime() >= since.getTime();
  });
}
