import { runLines } from "./shell";

export interface CommitInfo {
  sha: string;
  author: string;
  subject: string;
  sessionId: string | null;
  issueIds: string[];
}

/**
 * Collect git commits for a date range, extracting session trailers and issue refs.
 */
export async function collectCommits(
  dayBefore: string,
  dayAfter: string,
  authorFilter?: string
): Promise<CommitInfo[]> {
  const args = [
    "git",
    "log",
    "--all",
    `--after=${dayBefore}`,
    `--before=${dayAfter}`,
    "--format=%h\x1f%an\x1f%s\x1f%(trailers:key=Claude-Session,valueonly,separator=,)",
  ];

  if (authorFilter) {
    args.push(`--author=${authorFilter}`);
  }

  const lines = await runLines(args);
  const commits: CommitInfo[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const [sha, author, subject, sessionTrailer] = line.split("\x1f");
    if (!sha) continue;

    const issueIds = extractIssueIds(subject);
    const sessionId = sessionTrailer?.trim() || null;

    commits.push({ sha, author, subject, sessionId, issueIds });
  }

  return commits;
}

function extractIssueIds(text: string): string[] {
  const matches = text.match(/ENG-\d+/g);
  return matches ? [...new Set(matches)] : [];
}
