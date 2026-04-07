/**
 * dx namespace filtering — prefix-based feature filtering.
 *
 * Provides `filterByNamespace` for commands that accept an optional
 * [namespace] argument to scope their output to a subset of features.
 *
 * Matching rules:
 * - No namespace → return all features (pass-through)
 * - Exact match on a key → include it
 * - Prefix match (`namespace.`) → include all matching keys
 * - No matches → empty record
 *
 * Part of: ENG-4688
 */

/**
 * Filter a features record by namespace prefix.
 *
 * Returns a new record containing only the entries whose keys match
 * the given namespace. Matching is strict:
 * - Exact key match (e.g. namespace "ci-watcher" matches key "ci-watcher")
 * - Dot-separated prefix (e.g. namespace "tips" matches key "tips.enabled")
 *
 * This prevents partial-word matches: namespace "tip" does NOT match
 * "tips.enabled" because "tip." is not a prefix of "tips.enabled".
 *
 * When namespace is undefined, all entries are returned unchanged.
 */
export function filterByNamespace<T>(
  features: Record<string, T>,
  namespace: string | undefined,
): Record<string, T> {
  if (namespace === undefined) {
    return features;
  }

  const prefix = namespace + ".";
  const result: Record<string, T> = {};

  for (const key of Object.keys(features)) {
    if (key === namespace || key.startsWith(prefix)) {
      result[key] = features[key];
    }
  }

  return result;
}
