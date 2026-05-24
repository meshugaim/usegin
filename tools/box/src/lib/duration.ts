/**
 * Human duration parsing/formatting — pure. No IO.
 *
 * `box watch` takes durations on the CLI (`--idle 30m`, `--ttl 8h`,
 * `--interval 60s`) and reports time-to-down ("down in 25m"). Both directions
 * live here so the string⇄ms conversion is in one tested place instead of
 * scattered `Number(x) * 60_000` arithmetic in the command layer.
 */

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parse a duration like `30m`, `8h`, `90s`, `500ms`, `2d`, or a compound
 * `1h30m` into milliseconds. Units: `ms`, `s`, `m`, `h`, `d`. Case-insensitive,
 * whitespace-tolerant. Throws `Error` on anything unparseable so the command can
 * surface a clear `--idle` error rather than silently treating garbage as 0.
 *
 * Pure: string in → number out. A bare number with no unit is rejected on
 * purpose — `--idle 30` is ambiguous (30 what?), and guessing ms would make a
 * "30-minute" idle window fire in 30ms, the exact false-down we bias against.
 */
export function parseDuration(input: string): number {
  const raw = input.trim().toLowerCase();
  if (raw === "") throw new Error("empty duration");

  // One-or-more <number><unit> chunks, nothing else. `ms` before `m` matters so
  // "500ms" doesn't parse as "500m" + leftover "s".
  const chunk = /(\d+(?:\.\d+)?)(ms|s|m|h|d)/g;
  let total = 0;
  let matched = 0;
  let consumed = 0;
  for (const m of raw.matchAll(chunk)) {
    total += Number(m[1]) * UNIT_MS[m[2]!]!;
    matched += 1;
    consumed += m[0].length;
  }
  // Reject leftovers (e.g. "30x", "30", "h"): every char must belong to a chunk.
  if (matched === 0 || consumed !== raw.length) {
    throw new Error(
      `invalid duration "${input}" — use a number + unit like 30m, 8h, 90s, 500ms, 2d (or 1h30m)`,
    );
  }
  return total;
}

/**
 * Format ms as a compact human duration — the inverse of {@link parseDuration},
 * to the two most-significant non-zero units (`8h`, `1h30m`, `25m`, `45s`).
 * Watch granularity is minutes, so sub-second values render as `0s`. Negative
 * input is treated as `0s` (a deadline already passed).
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const units: Array<[number, string]> = [
    [86_400, "d"],
    [3_600, "h"],
    [60, "m"],
    [1, "s"],
  ];
  const parts: string[] = [];
  let remaining = totalSeconds;
  for (const [secs, label] of units) {
    const n = Math.floor(remaining / secs);
    if (n > 0) {
      parts.push(`${n}${label}`);
      remaining -= n * secs;
    }
    if (parts.length === 2) break; // two most-significant units is enough.
  }
  return parts.length > 0 ? parts.join("") : "0s";
}
