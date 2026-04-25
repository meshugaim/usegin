import { parseMeta } from "./plan-meta";

const MIN_PREFIX_LENGTH = 8;

export function filterBySession<T extends { description?: string }>(
  issues: T[],
  sessionQuery: string,
): T[] {
  if (sessionQuery.length < MIN_PREFIX_LENGTH) {
    return [];
  }

  const isFullUuid = sessionQuery.length >= 36; // UUID length

  return issues.filter((issue) => {
    if (!issue.description) return false;

    const { meta } = parseMeta(issue.description);
    if (!meta?.sessions?.length) return false;

    if (isFullUuid) {
      return meta.sessions.includes(sessionQuery);
    }
    // Prefix match: any session that starts with the query
    return meta.sessions.some((s) => s.startsWith(sessionQuery));
  });
}
