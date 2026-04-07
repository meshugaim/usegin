import type { CommitInfo } from "./commits";
import type { IssueInfo } from "./issues";
import type { PRInfo } from "./prs";
import type { SessionInfo } from "./sessions";

interface SessionDigest extends SessionInfo {
  issues: IssueInfo[];
  commits: CommitInfo[];
}

interface GhostSession {
  id: string;
  authors: string[];
  commits: CommitInfo[];
  issueIds: string[];
}

interface Digest {
  date: string;
  sessions: SessionDigest[];
  orphanCommits: CommitInfo[];
  ghostSessions: GhostSession[];
  prs: PRInfo[];
}

export function formatJson(digest: Digest): string {
  return JSON.stringify(digest, null, 2);
}

export function formatMarkdown(digest: Digest): string {
  const lines: string[] = [];

  lines.push(`# Daybook — ${digest.date}`);
  lines.push("");

  // Group sessions by user
  const byUser = new Map<string, SessionDigest[]>();
  for (const s of digest.sessions) {
    const user = s.username ?? "local";
    const list = byUser.get(user) ?? [];
    list.push(s);
    byUser.set(user, list);
  }

  // Totals
  const totalSessions = digest.sessions.length + digest.ghostSessions.length;
  const totalCommits =
    digest.sessions.reduce((n, s) => n + s.commits.length, 0) +
    digest.ghostSessions.reduce((n, g) => n + g.commits.length, 0) +
    digest.orphanCommits.length;
  const allIssueIds = new Set([
    ...digest.sessions.flatMap((s) => s.issues.map((i) => i.identifier)),
    ...digest.ghostSessions.flatMap((g) => g.issueIds),
  ]);
  const totalIssues = allIssueIds.size;

  lines.push(
    `**${totalSessions} sessions** | **${totalCommits} commits** | **${totalIssues} issues** | **${digest.prs.length} PRs**`
  );
  lines.push("");

  // Per-user sections
  for (const [user, sessions] of byUser) {
    const userCommits = sessions.reduce((n, s) => n + s.commits.length, 0);
    const userIssues = new Set(
      sessions.flatMap((s) => s.issues.map((i) => i.identifier))
    );

    lines.push(`## ${user} — ${sessions.length} sessions, ${userCommits} commits, ${userIssues.size} issues`);
    lines.push("");
    lines.push(
      "| Session | Issues | Commits | Source |"
    );
    lines.push(
      "|---------|--------|--------:|--------|"
    );

    for (const s of sessions) {
      const sid = s.id.slice(0, 8);
      const issueStr =
        s.issues.length > 0
          ? s.issues.map((i) => `${i.identifier}`).join(", ")
          : "—";
      const commitCount = s.commits.length;
      lines.push(
        `| \`${sid}\` | ${issueStr} | ${commitCount} | ${s.source} |`
      );
    }
    lines.push("");

    // Issue detail table for this user
    if (userIssues.size > 0) {
      lines.push(`### Issues`);
      lines.push("");
      lines.push("| Issue | Title | Status | Session(s) |");
      lines.push("|-------|-------|--------|------------|");

      const issueSessions = new Map<string, string[]>();
      for (const s of sessions) {
        for (const issue of s.issues) {
          const list = issueSessions.get(issue.identifier) ?? [];
          list.push(s.id.slice(0, 8));
          issueSessions.set(issue.identifier, list);
        }
      }

      // Deduplicate issues
      const seen = new Set<string>();
      for (const s of sessions) {
        for (const issue of s.issues) {
          if (seen.has(issue.identifier)) continue;
          seen.add(issue.identifier);
          const sids = issueSessions.get(issue.identifier) ?? [];
          const title = truncate(issue.title, 60);
          lines.push(
            `| ${issue.identifier} | ${title} | ${issue.status} | ${sids.map((s) => `\`${s}\``).join(", ")} |`
          );
        }
      }
      lines.push("");
    }
  }

  // Ghost sessions (known only from commit trailers, session files not available)
  if (digest.ghostSessions.length > 0) {
    lines.push("## Sessions from commits (session files not available)");
    lines.push("");
    lines.push("| Session | Author(s) | Commits | Issues |");
    lines.push("|---------|-----------|--------:|--------|");
    for (const g of digest.ghostSessions) {
      const issueStr = g.issueIds.length > 0 ? g.issueIds.join(", ") : "—";
      lines.push(
        `| \`${g.id}\` | ${g.authors.join(", ")} | ${g.commits.length} | ${issueStr} |`
      );
    }
    lines.push("");
  }

  // Orphan commits (no session trailer)
  if (digest.orphanCommits.length > 0) {
    lines.push("## Commits without session");
    lines.push("");
    lines.push("| SHA | Author | Subject |");
    lines.push("|-----|--------|---------|");
    for (const c of digest.orphanCommits) {
      lines.push(
        `| \`${c.sha}\` | ${c.author} | ${truncate(c.subject, 70)} |`
      );
    }
    lines.push("");
  }

  // PRs
  if (digest.prs.length > 0) {
    lines.push("## Pull Requests");
    lines.push("");
    lines.push("| PR | Title | State |");
    lines.push("|----|-------|-------|");
    for (const pr of digest.prs) {
      lines.push(`| #${pr.number} | ${truncate(pr.title, 65)} | ${pr.state} |`);
    }
    lines.push("");
  }

  // Reverse lookup: issue → sessions
  lines.push("## Issue → Session Map");
  lines.push("");
  lines.push("| Issue | Session(s) | Commit count |");
  lines.push("|-------|------------|-------------:|");

  const issueToSessions = new Map<
    string,
    { sessions: Set<string>; commits: number }
  >();
  for (const s of digest.sessions) {
    const sid = s.id.slice(0, 8);
    for (const issue of s.issues) {
      const entry = issueToSessions.get(issue.identifier) ?? {
        sessions: new Set(),
        commits: 0,
      };
      entry.sessions.add(sid);
      issueToSessions.set(issue.identifier, entry);
    }
    for (const c of s.commits) {
      for (const issueId of c.issueIds) {
        const entry = issueToSessions.get(issueId) ?? {
          sessions: new Set(),
          commits: 0,
        };
        entry.sessions.add(sid);
        entry.commits++;
        issueToSessions.set(issueId, entry);
      }
    }
  }
  // Include ghost sessions in issue map
  for (const g of digest.ghostSessions) {
    for (const c of g.commits) {
      for (const issueId of c.issueIds) {
        const entry = issueToSessions.get(issueId) ?? {
          sessions: new Set(),
          commits: 0,
        };
        entry.sessions.add(g.id);
        entry.commits++;
        issueToSessions.set(issueId, entry);
      }
    }
  }

  const sortedIssues = [...issueToSessions.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  for (const [issueId, { sessions, commits }] of sortedIssues) {
    const sids = [...sessions].map((s) => `\`${s}\``).join(", ");
    lines.push(`| ${issueId} | ${sids} | ${commits} |`);
  }
  lines.push("");

  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}
