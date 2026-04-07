/**
 * dx namespace filtering — prefix-based feature filtering.
 *
 * Provides `matchesNamespace` (predicate) and `filterByNamespace` (record filter)
 * for commands that accept an optional [namespace] argument to scope their
 * output to a subset of features.
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
 * Check whether a feature name belongs to a namespace.
 *
 * Matching is strict (dot-separated boundary):
 * - Exact match: `matchesNamespace("ci-watcher", "ci-watcher")` → true
 * - Prefix match: `matchesNamespace("tips.enabled", "tips")` → true
 * - Partial word: `matchesNamespace("tips.enabled", "tip")` → false
 *
 * This is the single source of truth for namespace prefix matching.
 * Used by `filterByNamespace` and the namespace-scoped clear functions in reset.ts.
 */
export function matchesNamespace(featureName: string, namespace: string): boolean {
  return featureName === namespace || featureName.startsWith(namespace + ".");
}

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

  const result: Record<string, T> = {};

  for (const key of Object.keys(features)) {
    if (matchesNamespace(key, namespace)) {
      result[key] = features[key];
    }
  }

  return result;
}
