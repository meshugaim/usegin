import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";
import { colors } from "../lib/colors";
import { normalizeIssueId } from "../lib/identifier";
import { shouldDefaultToJson } from "../lib/output-mode";

export function createStartCommand(): Command {
  const cmd = new Command("start")
    .description("Start working on an issue (set In Progress + assign to me)")
    .argument("<id>", "Issue identifier (e.g., ENG-20 or just 20)")
    .option("--json", "Output as JSON")
    .option("--quiet", "No output on success")
    .option("--stats", "Show API call statistics")
    .action(async (id: string, opts) => {
      await runStart(normalizeIssueId(id), opts);
    });

  return cmd;
}

async function runStart(
  identifier: string,
  opts: {
    json?: boolean;
    quiet?: boolean;
    stats?: boolean;
  }
): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    process.exit(2);
  }

  try {
    const client = new LinearClient({ apiKey });

    // Update status to "In Progress" and assign to me
    const { issue } = await client.updateIssue(identifier, {
      status: "In Progress",
      assignee: "@me",
    });

    const useJson = shouldDefaultToJson({
      json: opts.json,
      env: process.env,
      isTTY: process.stdout.isTTY,
    });

    if (opts.quiet) {
      // No output
    } else if (useJson) {
      console.log(
        JSON.stringify(
          {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            status: issue.status,
            assignee: issue.assignee,
          },
          null,
          2
        )
      );
    } else {
      console.log(`${colors.success("Started")}: ${colors.identifier(issue.identifier)} - ${issue.title}`);
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
