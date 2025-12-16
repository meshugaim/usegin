import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { formatHistoryHuman } from "../lib/output";
import { printApiStats } from "../lib/stats";
import { normalizeIssueId } from "../lib/identifier";
import { colors, dim, bold } from "../lib/colors";

export function createHistoryCommand(): Command {
  const cmd = new Command("history")
    .description("Show change history for an issue")
    .argument("<identifier>", "Issue identifier (e.g., ENG-123 or just 123)")
    .option("--json", "Output as JSON")
    .option("--limit <n>", "Maximum number of history entries to show", "50")
    .option("--stats", "Show API call statistics")
    .action(async (identifier: string, opts) => {
      await runHistory(normalizeIssueId(identifier), opts);
    });

  return cmd;
}

async function runHistory(
  identifier: string,
  opts: { json?: boolean; limit?: string; stats?: boolean }
): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    console.error("Get your API key from: https://linear.app/settings/api");
    process.exit(2);
  }

  try {
    const client = new LinearClient({ apiKey });
    const limit = parseInt(opts.limit ?? "50", 10);

    // Get basic issue info for the header
    const issue = await client.getIssueByIdentifier(identifier);
    if (!issue) {
      console.error(`Error: Issue "${identifier}" not found`);
      process.exit(3);
    }

    // Get history
    const history = await client.getIssueHistory(identifier, limit);

    if (opts.json) {
      console.log(JSON.stringify({
        issue: {
          identifier: issue.identifier,
          title: issue.title,
        },
        history,
      }, null, 2));
    } else {
      // Header
      console.log(`${colors.identifier(bold(issue.identifier))}: ${bold(issue.title)}`);
      console.log("");
      console.log(colors.fieldName("History:"));

      if (history.length === 0) {
        console.log(dim("  (no history)"));
      } else {
        console.log(formatHistoryHuman(history));

        if (history.length >= limit) {
          console.log("");
          console.log(dim(`  (showing first ${limit} entries, use --limit to see more)`));
        }
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
