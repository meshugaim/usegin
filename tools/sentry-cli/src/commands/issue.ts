import { Command } from "commander";
import { SentryClient } from "../../../lib/sentry-api";
import {
  formatIssueSummary,
  formatIssueStats,
  formatIssueJson,
  computeEventStats,
  type SentryIssue,
  type SentryEventLite,
} from "../lib/issue-format";

const DEFAULT_ORG = "askeffi";

export function createIssueCommand(): Command {
  const issue = new Command("issue")
    .description("Show issue summary with event statistics")
    .argument("<issue-id>", "Issue ID (e.g., NEXTJS-APP-1)")
    .option("-o, --org <org>", "Organization slug", DEFAULT_ORG)
    .option("--stats", "Show detailed event statistics breakdown")
    .option("--json", "Output as JSON")
    .action(async (issueId: string, opts: IssueOptions) => {
      await runIssueCommand(issueId, opts);
    });

  return issue;
}

interface IssueOptions {
  org: string;
  stats?: boolean;
  json?: boolean;
}

async function runIssueCommand(
  issueId: string,
  opts: IssueOptions
): Promise<void> {
  try {
    const client = new SentryClient({ org: opts.org });

    // Fetch issue details
    const issue = (await client.getIssue(issueId)) as SentryIssue;

    // Fetch events for stats (up to 100 for stats computation)
    const events = (await client.listEvents(issueId, {
      limit: 100,
    })) as SentryEventLite[];

    // Compute stats from events
    const stats = computeEventStats(events);

    if (opts.json) {
      console.log(formatIssueJson(issue, stats));
      return;
    }

    // Show issue summary
    console.log(formatIssueSummary(issue, opts.org));
    console.log("");

    // Show stats if requested or by default in rich view
    if (opts.stats || !opts.json) {
      console.log(formatIssueStats(stats));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
