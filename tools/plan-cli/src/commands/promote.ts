import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";
import { calculateTop } from "../lib/ordering";
import { colors } from "../lib/colors";

const INBOX_LABEL = "inbox";

export function createPromoteCommand(): Command {
  const cmd = new Command("promote")
    .description("Move an issue from inbox to list (removes inbox label)")
    .argument("<id>", "Issue identifier (e.g., ENG-30)")
    .argument("[position]", "Position: 'top' to move to top of list")
    .option("--json", "Output as JSON")
    .option("--quiet", "No output on success")
    .option("--stats", "Show API call statistics")
    .action(async (id: string, position: string | undefined, opts) => {
      await runPromote(id, position, opts);
    });

  return cmd;
}

async function runPromote(
  identifier: string,
  position: string | undefined,
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

    // Remove the inbox label
    await client.removeLabel(identifier, INBOX_LABEL);

    // If position is "top", reorder to top
    if (position === "top") {
      const issues = await client.getIssuesForReordering();
      const newSortOrder = calculateTop(issues);
      await client.updateSortOrder(identifier, newSortOrder);
    }

    // Get the updated issue for output
    const issue = await client.getIssueByIdentifier(identifier);
    if (!issue) {
      console.error(`Error: Issue "${identifier}" not found`);
      process.exit(3);
    }

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
            promoted: true,
            position: position === "top" ? "top" : "bottom",
          },
          null,
          2
        )
      );
    } else {
      if (position === "top") {
        console.log(`${colors.success("Promoted to top")}: ${colors.identifier(issue.identifier)} - ${issue.title}`);
      } else {
        console.log(`${colors.success("Promoted")}: ${colors.identifier(issue.identifier)} - ${issue.title}`);
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
