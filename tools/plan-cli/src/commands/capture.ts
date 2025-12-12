import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";

const DEFAULT_INBOX_LABEL = "inbox";

export function createCaptureCommand(): Command {
  const cmd = new Command("capture")
    .description("Capture an idea to the inbox (for later processing)")
    .argument("<title>", "What to capture")
    .option("--team <key>", "Team key (e.g., ENG)")
    .option("--description <text>", "Additional details")
    .option("--json", "Output as JSON")
    .option("--quiet", "Only output the issue identifier")
    .action(async (title: string, opts) => {
      await runCapture(title, opts);
    });

  return cmd;
}

async function runCapture(
  title: string,
  opts: {
    team?: string;
    description?: string;
    json?: boolean;
    quiet?: boolean;
  }
): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    console.error("Get your API key from: https://linear.app/settings/api");
    process.exit(2);
  }

  try {
    const client = new LinearClient({ apiKey });

    const team = opts.team ?? process.env.PLAN_TEAM;

    // Create issue with inbox label
    const issue = await client.createIssue({
      title,
      description: opts.description,
      team,
      labels: [DEFAULT_INBOX_LABEL],
    });

    if (opts.quiet) {
      console.log(issue.identifier);
    } else if (opts.json) {
      console.log(
        JSON.stringify(
          {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            status: issue.status,
            inbox: true,
          },
          null,
          2
        )
      );
    } else {
      console.log(`Captured: ${issue.identifier} - ${issue.title}`);
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
