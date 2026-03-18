import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";
import { shouldDefaultToJson } from "../lib/output-mode";
import { colors, colorizeStatus, padEnd, dim } from "../lib/colors";
import type { PlanIssue } from "../types";

export function createSearchCommand(): Command {
  const cmd = new Command("search")
    .description("Search issues by text in title, description, or identifier")
    .argument("<query>", "Search query text")
    .option("--team <key>", "Team key (e.g., ENG)")
    .option("--all", "Include completed and canceled issues")
    .option("--limit <n>", "Maximum results to return", "50")
    .option("--json", "Output as JSON")
    .option("--stats", "Show API call statistics")
    .action(async (query, opts) => {
      await runSearch(query, opts);
    });

  return cmd;
}

async function runSearch(
  query: string,
  opts: {
    team?: string;
    all?: boolean;
    limit?: string;
    json?: boolean;
    stats?: boolean;
  }
): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    console.error("Get your API key from: https://linear.app/settings/api");
    process.exit(2);
  }

  if (!query || query.trim().length === 0) {
    console.error("Error: Search query cannot be empty");
    process.exit(1);
  }

  try {
    const client = new LinearClient({ apiKey });

    // Use team from env if not specified
    const team = opts.team ?? process.env.PLAN_TEAM;
    const limit = parseInt(opts.limit ?? "50", 10);

    const useJson = shouldDefaultToJson({
      json: opts.json,
      env: process.env,
      isTTY: process.stdout.isTTY,
    });

    const issues = await client.searchIssues({
      query: query.trim(),
      team,
      includeCompleted: opts.all ?? false,
      limit,
    });

    if (issues.length === 0) {
      if (useJson) {
        console.log("[]");
      } else {
        console.log(`No issues found matching "${query}"`);
      }
      printApiStats(client.apiCallCount, opts.stats ?? false);
      return;
    }

    if (useJson) {
      console.log(formatSearchResultsJson(issues));
    } else {
      console.log(formatSearchResultsHuman(issues, query));
    }

    printApiStats(client.apiCallCount, opts.stats ?? false);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

/**
 * Format search results for human-readable output
 */
function formatSearchResultsHuman(issues: PlanIssue[], query: string): string {
  const lines: string[] = [];

  // Header with result count
  const countText = issues.length === 1 ? "1 result" : `${issues.length} results`;
  lines.push(`${dim(`Search results for "${query}" (${countText}):`)}`);
  lines.push("");

  // Calculate column widths
  const maxIdLen = Math.max(4, ...issues.map((i) => i.identifier.length));
  const maxStatusLen = Math.max(6, ...issues.map((i) => i.status.length));
  const maxTitleLen = 50;

  for (const issue of issues) {
    const id = padEnd(colors.identifier(issue.identifier), maxIdLen);
    const title = truncate(issue.title, maxTitleLen);
    const status = padEnd(colorizeStatus(issue.status), maxStatusLen);

    // Show parent indicator if issue is a sub-issue
    const parentIndicator = issue.parent
      ? dim(` (sub of ${issue.parent.identifier})`)
      : "";

    lines.push(`  ${id}   ${title}   [${status}]${parentIndicator}`);
  }

  return lines.join("\n");
}

/**
 * Format search results as JSON
 */
function formatSearchResultsJson(issues: PlanIssue[]): string {
  const output = issues.map((issue) => ({
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    status: issue.status,
    assignee: issue.assignee?.displayName ?? issue.assignee?.name,
    labels: issue.labels,
    project: issue.project,
    parent: issue.parent?.identifier,
  }));

  return JSON.stringify(output, null, 2);
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}
