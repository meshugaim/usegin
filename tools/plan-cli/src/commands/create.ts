import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";
import { colors, dim } from "../lib/colors";
import { normalizeIssueId } from "../lib/identifier";

export function createCreateCommand(): Command {
  const cmd = new Command("create")
    .alias("as")
    .alias("capture")
    .description("Create a new issue in the list")
    .argument("<title>", "Issue title")
    .option("--team <key>", "Team key (e.g., ENG)")
    .option("--parent <id>", "Parent issue identifier (e.g., ENG-20)")
    .option("--description <text>", "Issue description")
    .option("--label <name>", "Add label (can be used multiple times)", collect, [])
    .option("--project <name>", "Add to project")
    .option("--status <name>", "Set initial status (e.g., 'In Progress', 'Todo')")
    .option("--blocked-by <id>", "Set blocked-by relationship after creation")
    .option("--blocking <id>", "Set blocking relationship after creation")
    .option("--related-to <id>", "Set related-to relationship after creation")
    .option("--json", "Output as JSON")
    .option("--quiet", "Only output the issue identifier")
    .option("--stats", "Show API call statistics")
    .option("--create-missing-labels", "Create labels that don't exist")
    .action(async (title: string, opts) => {
      // Normalize any issue ID options
      const normalizedOpts = {
        ...opts,
        parent: opts.parent ? normalizeIssueId(opts.parent) : opts.parent,
        blockedBy: opts.blockedBy ? normalizeIssueId(opts.blockedBy) : opts.blockedBy,
        blocking: opts.blocking ? normalizeIssueId(opts.blocking) : opts.blocking,
        relatedTo: opts.relatedTo ? normalizeIssueId(opts.relatedTo) : opts.relatedTo,
      };
      await runCreate(title, normalizedOpts);
    });

  return cmd;
}

// Helper to collect multiple --label flags
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

async function runCreate(
  title: string,
  opts: {
    team?: string;
    parent?: string;
    description?: string;
    label?: string[];
    project?: string;
    status?: string;
    blockedBy?: string;
    blocking?: string;
    relatedTo?: string;
    json?: boolean;
    quiet?: boolean;
    stats?: boolean;
    createMissingLabels?: boolean;
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

    const { issue, missingLabels } = await client.createIssue({
      title,
      description: opts.description,
      team,
      parentId: opts.parent,
      labels: opts.label,
      project: opts.project,
      status: opts.status,
      createMissingLabels: opts.createMissingLabels,
    });

    // Warn about missing labels
    if (missingLabels.length > 0) {
      console.error(`${colors.warning("Warning")}: Labels not found (skipped): ${missingLabels.join(", ")}`);
      console.error(dim(`  Use --create-missing-labels to create them`));
    }

    // Add relationships after creation
    if (opts.blockedBy) {
      await client.addBlockedBy(issue.identifier, opts.blockedBy);
    }
    if (opts.blocking) {
      await client.addBlocking(issue.identifier, opts.blocking);
    }
    if (opts.relatedTo) {
      await client.addRelatedTo(issue.identifier, opts.relatedTo);
    }

    // Check if any connections were made
    const hasConnections = opts.parent || opts.blockedBy || opts.blocking || opts.relatedTo;

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
      console.log(`${colors.success("Created")}: ${colors.identifier(issue.identifier)} - ${issue.title}`);
      if (!hasConnections) {
        console.log(dim(`  Tip: Consider connecting with --parent, --blocked-by, or --related-to`));
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
