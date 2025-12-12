import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";

export function createCreateCommand(): Command {
  const cmd = new Command("create")
    .description("Create a new issue in the list")
    .argument("<title>", "Issue title")
    .option("--team <key>", "Team key (e.g., ENG)")
    .option("--parent <id>", "Parent issue identifier (e.g., ENG-20)")
    .option("--description <text>", "Issue description")
    .option("--json", "Output as JSON")
    .option("--quiet", "Only output the issue identifier")
    .action(async (title: string, opts) => {
      await runCreate(title, opts);
    });

  return cmd;
}

async function runCreate(
  title: string,
  opts: {
    team?: string;
    parent?: string;
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

    const issue = await client.createIssue({
      title,
      description: opts.description,
      team,
      parentId: opts.parent,
    });

    if (opts.quiet) {
      // Just output the identifier
      console.log(issue.identifier);
    } else if (opts.json) {
      // JSON output
      console.log(
        JSON.stringify(
          {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            status: issue.status,
          },
          null,
          2
        )
      );
    } else {
      // Human-readable output
      console.log(`Created: ${issue.identifier} - ${issue.title}`);
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
