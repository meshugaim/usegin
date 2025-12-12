/**
 * Print API call statistics to stderr
 */
export function printApiStats(callCount: number): void {
  if (process.env.PLAN_STATS !== "0") {
    console.error(`[${callCount} API call${callCount !== 1 ? "s" : ""}]`);
  }
}
