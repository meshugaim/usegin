/**
 * Cost math — pure. No IO, no `Date.now()`.
 *
 * Every input is passed in (hours, hourly/monthly prices, snapshot sizes) so the
 * spend calc is deterministic and unit-tested. The impure parts — fetching live
 * Hetzner prices and computing "now" — live in `hcloud.ts` and the `status`
 * command; this module only does arithmetic + formatting.
 *
 * Cost model (see `scripts/hetzner/README.md`):
 *   - Hetzner bills hourly (ex-VAT), but you actually pay incl-VAT (~+21%); we use
 *     the **gross** (incl-VAT) figures everywhere a human reads "what it costs".
 *   - Hourly billing is **capped at the monthly price** — a heavy month never
 *     exceeds the monthly cap, so spend-so-far is `min(hourly×hours, monthlyCap)`.
 *   - Snapshot storage ≈ €0.0143 / GB / month.
 */

/** Snapshot storage rate: euros per GB per month (incl-VAT). */
export const SNAPSHOT_EUR_PER_GB_MONTH = 0.0143;

/**
 * Estimated compute spend so far for a running box.
 *
 * `hourlyGross × hoursUp`, **capped at the monthly price** — hourly billing never
 * exceeds the monthly cap, so a box left up all month costs `monthlyCapGross`, not
 * `hourly × 730`.
 */
export function runningCostSoFar(p: {
  hourlyGross: number;
  hoursUp: number;
  monthlyCapGross: number;
}): number {
  const uncapped = p.hourlyGross * Math.max(0, p.hoursUp);
  return Math.min(uncapped, p.monthlyCapGross);
}

/** Monthly snapshot-storage cost for a set of snapshot sizes (GB) → €/month. */
export function snapshotStorageCost(sizesGB: number[]): number {
  const total = sizesGB.reduce((sum, gb) => sum + (gb || 0), 0);
  return total * SNAPSHOT_EUR_PER_GB_MONTH;
}

/**
 * Whole hours between two ISO timestamps (fractional). Pure: both ends are args,
 * so the caller passes `now` rather than this reading the clock.
 *
 * Returns 0 if either timestamp is unparseable or `b` precedes `a` — a defensive
 * floor so a clock skew or a missing `created` never yields negative spend.
 */
export function hoursBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, (b - a) / 3_600_000);
}

/** Format euros as `€X.XX` (two decimals — cents granularity for human lines). */
export function formatEur(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

/** Format a per-hour rate as `€X.XXX/hr` (three decimals — hourly rates are tiny). */
export function formatEurHourly(amount: number): string {
  return `€${amount.toFixed(3)}/hr`;
}

/** Format hours as a short `~Nh` / `~N.Mh` approximation for status lines. */
export function formatHours(hours: number): string {
  return hours >= 10 ? `~${Math.round(hours)}h` : `~${hours.toFixed(1)}h`;
}
