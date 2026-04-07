import { run } from "./shell";

export interface IssueInfo {
  identifier: string;
  title: string;
  status: string;
  labels: string[];
  parent: string | null;
}

/**
 * For each session, resolve linked Linear issues via `plan list --session`.
 * Returns a map from short session ID (8 chars) to issue list.
 */
export async function resolveIssuesForSessions(
  sessionIds: string[]
): Promise<Map<string, IssueInfo[]>> {
  const result = new Map<string, IssueInfo[]>();

  // Run in batches of 5 to avoid overwhelming plan CLI / Linear API
  const batchSize = 5;
  for (let i = 0; i < sessionIds.length; i += batchSize) {
    const batch = sessionIds.slice(i, i + batchSize);
    const promises = batch.map(async (id) => {
      const short = id.slice(0, 8);
      try {
        const out = await run(
          ["plan", "list", "--session", short, "--json"],
          { timeout: 15_000, allowFailure: true }
        );
        if (!out) return { short, issues: [] as IssueInfo[] };

        const parsed = JSON.parse(out) as Array<{
          identifier: string;
          title: string;
          status: string;
          labels: string[];
          parent: string | null;
        }>;

        const issues: IssueInfo[] = parsed.map((i) => ({
          identifier: i.identifier,
          title: i.title,
          status: i.status,
          labels: i.labels ?? [],
          parent: i.parent,
        }));

        return { short, issues };
      } catch {
        return { short, issues: [] as IssueInfo[] };
      }
    });

    const results = await Promise.all(promises);
    for (const { short, issues } of results) {
      result.set(short, issues);
    }
  }

  return result;
}
