#!/usr/bin/env bun

/**
 * daybook — Daily cross-reference digest
 *
 * Ties together Claude sessions, git commits, Linear issues, and GitHub PRs
 * for a given date. Uses session CLI, plan CLI, git, and gh as data sources.
 *
 * Usage:
 *   daybook                    # Yesterday
 *   daybook today              # Today
 *   daybook 2026-04-06         # Specific date
 *   daybook --json             # Machine-readable output
 *   daybook --author nitsan    # Filter by git author (substring match)
 */

import { collectSessions } from "./sessions";
import { collectCommits } from "./commits";
import { collectPRs } from "./prs";
import { resolveIssuesForSessions } from "./issues";
import { formatMarkdown, formatJson } from "./format";
import { renderTerminal } from "./render";
import { parseDate } from "./date";

function printHelp() {
  console.log(`
daybook — Daily cross-reference digest

USAGE:
  daybook [date] [options]

ARGUMENTS:
  date             Date to report on (default: yesterday)
                   Accepts: yesterday, today, YYYY-MM-DD

OPTIONS:
  --json           Output as JSON instead of markdown
  --author <name>  Filter git commits by author (substring match)
  --remote         Include remote sessions from ~/agent-records/
  --help, -h       Show this help

EXAMPLES:
  daybook                      # Yesterday's digest
  daybook today                # Today so far
  daybook 2026-04-06           # Specific date
  daybook --json               # JSON output
  daybook --author nitsan      # Filter by author
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const jsonMode = args.includes("--json");
  const includeRemote = args.includes("--remote");

  let author: string | undefined;
  const authorIdx = args.indexOf("--author");
  if (authorIdx !== -1 && args[authorIdx + 1]) {
    author = args[authorIdx + 1];
  }

  // First positional arg that isn't a flag
  const positional = args.find(
    (a) => !a.startsWith("--") && a !== author
  );
  const { dateStr, dayBefore, dayAfter } = parseDate(positional);

  console.error(`Collecting data for ${dateStr}...`);

  // Gather data in parallel
  const [sessions, commits, prs] = await Promise.all([
    collectSessions(dateStr, includeRemote),
    collectCommits(dayBefore, dayAfter, author),
    collectPRs(dateStr),
  ]);

  // For each session, resolve linked Linear issues
  const sessionIssues = await resolveIssuesForSessions(
    sessions.map((s) => s.id)
  );

  // Cross-reference: which commits belong to which session?
  const knownSessionIds = new Set(sessions.map((s) => s.id.slice(0, 8)));
  const commitsBySession = new Map<string, typeof commits>();
  for (const commit of commits) {
    if (commit.sessionId) {
      const short = commit.sessionId.slice(0, 8);
      const list = commitsBySession.get(short) ?? [];
      list.push(commit);
      commitsBySession.set(short, list);
    }
  }

  // Ghost sessions: referenced by commits but not in our session list
  const ghostSessions = new Map<string, { commits: typeof commits; authors: Set<string> }>();
  for (const [shortId, sessionCommits] of commitsBySession) {
    if (!knownSessionIds.has(shortId)) {
      const authors = new Set(sessionCommits.map((c) => c.author));
      ghostSessions.set(shortId, { commits: sessionCommits, authors });
    }
  }

  // Build the unified data structure
  const digest = {
    date: dateStr,
    sessions: sessions.map((s) => ({
      ...s,
      issues: sessionIssues.get(s.id.slice(0, 8)) ?? [],
      commits: commitsBySession.get(s.id.slice(0, 8)) ?? [],
    })),
    orphanCommits: commits.filter((c) => !c.sessionId),
    ghostSessions: [...ghostSessions.entries()].map(([id, { commits: gc, authors }]) => ({
      id,
      authors: [...authors],
      commits: gc,
      issueIds: [...new Set(gc.flatMap((c) => c.issueIds))],
    })),
    prs,
  };

  if (jsonMode) {
    console.log(formatJson(digest));
  } else {
    const md = formatMarkdown(digest);
    // Render for terminal if stdout is a TTY, raw markdown otherwise
    const isTTY = process.stdout.isTTY ?? false;
    console.log(isTTY ? renderTerminal(md) : md);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
