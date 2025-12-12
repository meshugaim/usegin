import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";

export function createCloseCommand(): Command {
  const cmd = new Command("close")
    .description("Close an issue (set status to Done)")
    .argument("<id>", "Issue identifier (e.g., ENG-20)")
    .option("--reason <text>", "Add a comment explaining why (e.g., 'duplicate of ENG-15')")
    .option("--json", "Output as JSON")
    .option("--quiet", "No output on success")
    .option("--stats", "Show API call statistics")
    .action(async (id: string, opts) => {
      await runClose(id, opts);
    });

  return cmd;
}

async function runClose(
  identifier: string,
  opts: {
    reason?: string;
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

    // Add reason as comment if provided
    if (opts.reason) {
      await client.addComment(identifier, `Closed: ${opts.reason}`);
    }

    // Update status to "Done"
    const { issue } = await client.updateIssue(identifier, {
      status: "Done",
    });

    if (opts.quiet) {
      // No output
    } else if (opts.json) {
      console.log(
        JSON.stringify(
          {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            status: issue.status,
            reason: opts.reason,
          },
          null,
          2
        )
      );
    } else {
      if (opts.reason) {
        console.log(`Closed: ${issue.identifier} - ${issue.title} (${opts.reason})`);
      } else {
        console.log(`Closed: ${issue.identifier} - ${issue.title}`);
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
