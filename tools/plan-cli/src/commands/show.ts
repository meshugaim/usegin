import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { formatShowHuman, formatShowJson } from "../lib/output";

export function createShowCommand(): Command {
  const cmd = new Command("show")
    .description("Show details of a single issue")
    .argument("<identifier>", "Issue identifier (e.g., ENG-123)")
    .option("--json", "Output as JSON")
    .action(async (identifier: string, opts) => {
      await runShow(identifier, opts);
    });

  return cmd;
}

async function runShow(
  identifier: string,
  opts: { json?: boolean }
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

    if (opts.json) {
      console.log(formatShowJson(issue));
    } else {
      console.log(formatShowHuman(issue));
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
