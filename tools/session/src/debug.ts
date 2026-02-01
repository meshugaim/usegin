/**
 * Debug logging utilities for the session tool.
 *
 * Provides consistent debug output to stderr, preserving stdout for actual output.
 * Debug messages include a `[session]` prefix and optional timing information.
 */

/**
 * Log a debug message to stderr with optional timing information.
 *
 * Messages are prefixed with `[session]` for easy filtering.
 * When startTime is provided, appends elapsed milliseconds since that time.
 *
 * @param enabled - Whether debug logging is enabled
 * @param message - The message to log
 * @param startTime - Optional start time (from Date.now()) to calculate elapsed ms
 *
 * @example
 * ```ts
 * const start = Date.now();
 * debugLog(true, "Starting operation...");
 * // ... do work ...
 * debugLog(true, "Operation complete", start);
 * // Output:
 * // [session] Starting operation...
 * // [session] Operation complete (42ms)
 * ```
 */
export function debugLog(
  enabled: boolean,
  message: string,
  startTime?: number
): void {
  if (!enabled) return;
  const timing = startTime !== undefined ? ` (${Date.now() - startTime}ms)` : "";
  console.error(`[session] ${message}${timing}`);
}
