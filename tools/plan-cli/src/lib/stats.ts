/**
 * Print API call statistics to stderr (opt-in via --stats flag)
 */
export function printApiStats(callCount: number, enabled: boolean): void {
  if (enabled) {
    console.error(`[${callCount} API call${callCount !== 1 ? "s" : ""}]`);
  }
}
