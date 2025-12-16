import { Command } from "commander";
import { $ } from "bun";
import { LinearClient } from "../lib/linear-client";
import { formatShowHuman, formatShowJson, formatHistoryHuman } from "../lib/output";
import { printApiStats } from "../lib/stats";
import { normalizeIssueId } from "../lib/identifier";
import { colors } from "../lib/colors";

export function createShowCommand(): Command {
  const cmd = new Command("show")
    .description("Show details of a single issue")
    .argument("<identifier>", "Issue identifier (e.g., ENG-123 or just 123)")
    .option("--json", "Output as JSON")
    .option("--web", "Open issue in web browser")
    .option("--comments", "Include comments in the output")
    .option("--with-history", "Include change history")
    .option("--stats", "Show API call statistics")
    .action(async (identifier: string, opts) => {
      await runShow(normalizeIssueId(identifier), opts);
    });

  return cmd;
}

async function runShow(
  identifier: string,
  opts: { json?: boolean; web?: boolean; comments?: boolean; withHistory?: boolean; stats?: boolean }
): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    console.error("Get your API key from: https://linear.app/settings/api");
    process.exit(2);
  }

  try {
    const client = new LinearClient({ apiKey });
    const issue = await client.getIssueDetail(identifier);

    if (!issue) {
      console.error(`Error: Issue "${identifier}" not found`);
      process.exit(3);
    }

    // Fetch comments if requested
    if (opts.comments) {
      issue.comments = await client.getIssueComments(identifier);
    }

    if (opts.web) {
      // Open in browser - use xdg-open on Linux, open on macOS
      const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
      await $`${openCmd} ${issue.url}`.quiet();
    }

    // Fetch history if requested
    const history = opts.withHistory
      ? await client.getIssueHistory(identifier)
      : undefined;

    if (opts.json) {
      console.log(formatShowJson(issue, history));
    } else {
      console.log(formatShowHuman(issue));

      // Print history section if requested
      if (opts.withHistory && history) {
        console.log("");
        console.log(colors.fieldName("History:"));
        console.log(formatHistoryHuman(history));
      }
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
