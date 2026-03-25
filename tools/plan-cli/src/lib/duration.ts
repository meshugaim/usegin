/**
 * Parse a human-friendly duration string into milliseconds.
 *
 * Supported formats:
 *   "10m"  → 600_000 ms
 *   "1h"   → 3_600_000 ms
 *   "30s"  → 30_000 ms
 *   "none" → null (no timeout)
 *
 * Throws on unrecognised input.
 */
export function parseDuration(input: string): number | null {
  if (input === "none") return null;

  const match = input.match(/^(\d+)(s|m|h)$/);
  if (!match) throw new Error(`Invalid duration: ${input}`);

  const value = parseInt(match[1], 10);
  const unit = match[2] as "s" | "m" | "h";
  const multipliers: Record<"s" | "m" | "h", number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
  };

  return value * multipliers[unit];
}
