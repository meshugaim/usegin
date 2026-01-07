/**
 * Sentry issue formatting utilities
 */

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  status: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  project: {
    slug: string;
    name: string;
  };
  metadata?: {
    type?: string;
    value?: string;
  };
}

export interface SentryEventLite {
  eventID: string;
  dateCreated: string;
  tags?: Array<{ key: string; value: string }>;
}

export interface EventStats {
  total: number;
  byUrl: Record<string, number>;
  byEnvironment: Record<string, number>;
  byBrowser: Record<string, number>;
}

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

function getTagValue(
  tags: Array<{ key: string; value: string }> | undefined,
  key: string
): string | undefined {
  return tags?.find((t) => t.key === key)?.value;
}

/**
 * Compute event statistics by grouping events by various tag values
 */
export function computeEventStats(events: SentryEventLite[]): EventStats {
  const stats: EventStats = {
    total: events.length,
    byUrl: {},
    byEnvironment: {},
    byBrowser: {},
  };

  for (const event of events) {
    const url = getTagValue(event.tags, "url");
    const environment = getTagValue(event.tags, "environment");
    const browser = getTagValue(event.tags, "browser");

    if (url) {
      stats.byUrl[url] = (stats.byUrl[url] || 0) + 1;
    }
    if (environment) {
      stats.byEnvironment[environment] =
        (stats.byEnvironment[environment] || 0) + 1;
    }
    if (browser) {
      stats.byBrowser[browser] = (stats.byBrowser[browser] || 0) + 1;
    }
  }

  return stats;
}

/**
 * Sort a record by value descending and return as array of [key, value] pairs
 */
function sortByValueDesc(record: Record<string, number>): [string, number][] {
  return Object.entries(record).sort((a, b) => b[1] - a[1]);
}

/**
 * Format a breakdown section (e.g., "Events by URL:")
 */
function formatBreakdown(
  title: string,
  data: Record<string, number>
): string[] {
  const lines: string[] = [];
  const sorted = sortByValueDesc(data);

  if (sorted.length === 0) return lines;

  lines.push(`${colors.bold}${title}${colors.reset}`);

  // Calculate max key length for alignment
  const maxKeyLen = Math.max(...sorted.map(([k]) => k.length));

  for (const [key, count] of sorted) {
    const paddedKey = key.padEnd(maxKeyLen);
    lines.push(
      `  ${colors.cyan}${paddedKey}${colors.reset}  ${colors.yellow}${count}${colors.reset}`
    );
  }

  return lines;
}

/**
 * Format event statistics for display
 */
export function formatIssueStats(stats: EventStats): string {
  const lines: string[] = [];

  lines.push(
    `${colors.bold}Total events: ${colors.yellow}${stats.total}${colors.reset}`
  );
  lines.push("");

  const urlBreakdown = formatBreakdown("Events by URL:", stats.byUrl);
  if (urlBreakdown.length > 0) {
    lines.push(...urlBreakdown);
    lines.push("");
  }

  const envBreakdown = formatBreakdown(
    "Events by environment:",
    stats.byEnvironment
  );
  if (envBreakdown.length > 0) {
    lines.push(...envBreakdown);
    lines.push("");
  }

  const browserBreakdown = formatBreakdown(
    "Events by browser:",
    stats.byBrowser
  );
  if (browserBreakdown.length > 0) {
    lines.push(...browserBreakdown);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format issue summary for display
 */
export function formatIssueSummary(issue: SentryIssue, org: string): string {
  const lines: string[] = [];

  // Header
  lines.push(
    `${colors.bold}${colors.yellow}${issue.shortId}${colors.reset}: ${issue.title}`
  );
  lines.push("");

  // Status and counts
  const statusColor =
    issue.status === "resolved"
      ? colors.green
      : issue.status === "ignored"
        ? colors.gray
        : colors.red;
  lines.push(
    `${colors.bold}Status:${colors.reset} ${statusColor}${issue.status}${colors.reset}`
  );
  lines.push(
    `${colors.bold}Events:${colors.reset} ${issue.count}  ${colors.bold}Users:${colors.reset} ${issue.userCount}`
  );
  lines.push(
    `${colors.bold}Project:${colors.reset} ${issue.project.slug} (${issue.project.name})`
  );
  lines.push("");

  // Dates
  lines.push(
    `${colors.bold}First seen:${colors.reset} ${formatDate(issue.firstSeen)}`
  );
  lines.push(
    `${colors.bold}Last seen:${colors.reset} ${formatDate(issue.lastSeen)}`
  );
  lines.push("");

  // Error info
  if (issue.metadata?.type || issue.metadata?.value) {
    lines.push(`${colors.bold}${colors.red}Error${colors.reset}`);
    if (issue.metadata.type) {
      lines.push(`  ${colors.red}${issue.metadata.type}${colors.reset}`);
    }
    if (issue.metadata.value) {
      lines.push(`  ${issue.metadata.value}`);
    }
    lines.push("");
  }

  // Sentry link
  const sentryUrl = `https://sentry.io/organizations/${org}/issues/${issue.id}/`;
  lines.push(`${colors.bold}Sentry:${colors.reset} ${colors.blue}${sentryUrl}${colors.reset}`);

  return lines.join("\n");
}

/**
 * Format issue and stats as JSON
 */
export function formatIssueJson(issue: SentryIssue, stats: EventStats): string {
  return JSON.stringify(
    {
      issue: {
        id: issue.id,
        shortId: issue.shortId,
        title: issue.title,
        status: issue.status,
        count: issue.count,
        userCount: issue.userCount,
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        project: issue.project,
        metadata: issue.metadata,
      },
      stats,
    },
    null,
    2
  );
}
