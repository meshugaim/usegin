import { run } from "./shell";

export interface PRInfo {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  mergedAt: string | null;
  branch: string;
}

/**
 * Collect GitHub PRs created on a given date using gh CLI.
 */
export async function collectPRs(dateStr: string): Promise<PRInfo[]> {
  try {
    const out = await run(
      [
        "gh",
        "pr",
        "list",
        "--state",
        "all",
        "--search",
        `created:${dateStr}`,
        "--json",
        "number,title,state,createdAt,mergedAt,headRefName",
        "--limit",
        "50",
      ],
      { allowFailure: true }
    );

    if (!out) return [];
    const prs = JSON.parse(out) as Array<{
      number: number;
      title: string;
      state: string;
      createdAt: string;
      mergedAt: string | null;
      headRefName: string;
    }>;

    return prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      branch: pr.headRefName,
    }));
  } catch {
    return [];
  }
}
