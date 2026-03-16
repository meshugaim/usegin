/**
 * Default team key to use when auto-prefixing numeric issue IDs
 */
const DEFAULT_TEAM_KEY = "ENG";

/**
 * Check if a string is a purely numeric issue ID (e.g., "331")
 */
function isNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

/**
 * Get the team key from environment or use default
 */
export function getTeamKey(): string {
  return process.env.PLAN_TEAM ?? DEFAULT_TEAM_KEY;
}

/**
 * Normalize an issue identifier by auto-prefixing the team key for numeric-only IDs.
 *
 * Examples:
 *   "331" -> "ENG-331"
 *   "ENG-331" -> "ENG-331"
 *   "ABC-123" -> "ABC-123"
 *
 * The team key is determined by:
 * 1. PLAN_TEAM environment variable (if set)
 * 2. Default "ENG"
 */
export function normalizeIssueId(id: string): string {
  if (isNumericId(id)) {
    return `${getTeamKey()}-${id}`;
  }
  return id;
}
