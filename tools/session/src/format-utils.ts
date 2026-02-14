/**
 * Shared formatting utilities for session CLI formatters.
 *
 * These small helpers are used across multiple formatter modules.
 * Centralizing them here eliminates duplication and ensures
 * consistent behavior across the stats card, timeline, and
 * narrative formatters.
 */

/**
 * Truncate a string to maxLen characters, appending "..." if truncated.
 *
 * The returned string is always <= maxLen characters (the suffix is
 * included within the limit, not added on top of it).
 *
 * Handles edge cases:
 * - maxLen <= 3: returns the string as-is if it fits, otherwise a
 *   truncated "..." prefix (e.g., maxLen=2 -> "..")
 * - Empty strings are returned as-is.
 *
 * @param text - The string to truncate
 * @param maxLen - Maximum length of the returned string (including "..." suffix)
 *
 * @example
 * ```ts
 * truncate("Hello world", 8)  // "Hello..."
 * truncate("Hi", 8)           // "Hi"
 * truncate("ABCDEF", 3)       // "..."
 * ```
 */
export function truncate(text: string, maxLen: number): string {
  if (maxLen <= 3) return text.length <= maxLen ? text : "...".slice(0, maxLen);
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

/**
 * Format a token count with human-friendly suffixes.
 *
 * - Under 1,000:     "999"
 * - 1,000-999,999:   "1.2k", "45.2k", "123k"
 * - 1,000,000+:      "1.2M", "12.3M"
 *
 * Uses one decimal place when the leading digits are < 100,
 * drops the decimal when >= 100 (e.g., "123k" not "123.4k").
 *
 * @example
 * ```ts
 * formatTokenCount(500)       // "500"
 * formatTokenCount(1_234)     // "1.2k"
 * formatTokenCount(45_200)    // "45.2k"
 * formatTokenCount(123_000)   // "123k"
 * formatTokenCount(1_500_000) // "1.5M"
 * ```
 */
export function formatTokenCount(count: number): string {
  if (count < 1_000) {
    return String(count);
  }

  if (count < 1_000_000) {
    const k = count / 1_000;
    return k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }

  const m = count / 1_000_000;
  return m >= 100 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`;
}
