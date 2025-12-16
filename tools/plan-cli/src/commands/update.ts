import { Command } from "commander";
import { readFileSync } from "fs";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";
import { colors, dim } from "../lib/colors";
import { normalizeIssueId } from "../lib/identifier";

export function createUpdateCommand(): Command {
  const cmd = new Command("update")
    .description("Update an existing issue")
    .argument("<id>", "Issue identifier (e.g., ENG-20 or just 20)")
    .option("--title <text>", "Update title")
    .option("--description <text>", "Update description")
    .option("--description-file <path>", "Read description from file")
    .option("--append-description <text>", "Append to existing description")
    .option("--status <name>", "Update status (e.g., 'In Progress')")
    .option("--assignee <user>", "Assign to user (@me for self, 'none' to unassign)")
    .option("--parent <id>", "Set parent issue (makes this a sub-issue)")
    .option("--no-parent", "Remove parent (make top-level)")
    .option("--label <name>", "Set labels (can repeat, replaces existing)", collect, undefined)
    .option("--project <name>", "Move to project")
    .option("--blocked-by <id>", "Add blocked-by relationship")
    .option("--blocking <id>", "Add blocking relationship (this blocks another)")
    .option("--related-to <id>", "Add related-to relationship")
    .option("--duplicate-of <id>", "Mark as duplicate of another issue")
    .option("--comment <text>", "Add a comment to the issue")
    .option("--json", "Output as JSON")
    .option("--quiet", "No output on success")
    .option("--stats", "Show API call statistics")
    .option("--create-missing-labels", "Create labels that don't exist")
    .action(async (id: string, opts) => {
      // Normalize the main issue ID and any relationship IDs
      const normalizedOpts = {
        ...opts,
        parent: opts.parent ? normalizeIssueId(opts.parent) : opts.parent,
        blockedBy: opts.blockedBy ? normalizeIssueId(opts.blockedBy) : opts.blockedBy,
        blocking: opts.blocking ? normalizeIssueId(opts.blocking) : opts.blocking,
        relatedTo: opts.relatedTo ? normalizeIssueId(opts.relatedTo) : opts.relatedTo,
        duplicateOf: opts.duplicateOf ? normalizeIssueId(opts.duplicateOf) : opts.duplicateOf,
      };
      await runUpdate(normalizeIssueId(id), normalizedOpts);
    });

  return cmd;
}

// Helper to collect multiple flags
function collect(value: string, previous: string[] | undefined): string[] {
  return (previous ?? []).concat([value]);
}

async function runUpdate(
  identifier: string,
  opts: {
    title?: string;
    description?: string;
    descriptionFile?: string;
    appendDescription?: string;
    status?: string;
    assignee?: string;
    parent?: string | false;
    label?: string[];
    project?: string;
    blockedBy?: string;
    blocking?: string;
    relatedTo?: string;
    duplicateOf?: string;
    comment?: string;
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

    // Resolve description from various sources
    let finalDescription = opts.description;

    // --description-file takes precedence over --description
    if (opts.descriptionFile) {
      try {
        finalDescription = readFileSync(opts.descriptionFile, "utf-8");
      } catch (err) {
        console.error(`Error reading file: ${opts.descriptionFile}`);
        process.exit(1);
      }
    }

    // --append-description appends to existing description
    if (opts.appendDescription) {
      const issue = await client.getIssueByIdentifier(identifier);
      if (!issue) {
        console.error(`Error: Issue ${identifier} not found`);
        process.exit(3);
      }
      const existing = issue.description ?? "";
      finalDescription = existing + (existing ? "\n\n" : "") + opts.appendDescription;
    }

    // Update opts.description for downstream logic
    if (finalDescription !== undefined) {
      opts.description = finalDescription;
    }

    // Handle relationships first
    if (opts.blockedBy) {
      await client.addBlockedBy(identifier, opts.blockedBy);
      if (!opts.quiet && !opts.json) {
        console.log(`${colors.success("Added")}: ${colors.identifier(identifier)} blocked by ${colors.identifier(opts.blockedBy)}`);
      }
    }

    if (opts.blocking) {
      await client.addBlocking(identifier, opts.blocking);
      if (!opts.quiet && !opts.json) {
        console.log(`${colors.success("Added")}: ${colors.identifier(identifier)} blocks ${colors.identifier(opts.blocking)}`);
      }
    }

    if (opts.relatedTo) {
      await client.addRelatedTo(identifier, opts.relatedTo);
      if (!opts.quiet && !opts.json) {
        console.log(`${colors.success("Added")}: ${colors.identifier(identifier)} related to ${colors.identifier(opts.relatedTo)}`);
      }
    }

    if (opts.duplicateOf) {
      await client.markDuplicateOf(identifier, opts.duplicateOf);
      if (!opts.quiet && !opts.json) {
        console.log(`${colors.success("Marked")}: ${colors.identifier(identifier)} duplicate of ${colors.identifier(opts.duplicateOf)}`);
      }
    }

    // Handle comment
    if (opts.comment) {
      await client.addComment(identifier, opts.comment);
      if (!opts.quiet && !opts.json) {
        console.log(`${colors.success("Added comment")} to ${colors.identifier(identifier)}`);
      }
    }

    // Handle field updates
    const hasFieldUpdates =
      opts.title !== undefined ||
      opts.description !== undefined ||
      opts.status !== undefined ||
      opts.assignee !== undefined ||
      opts.parent !== undefined ||
      opts.label !== undefined ||
      opts.project !== undefined;

    if (hasFieldUpdates) {
      const { issue, missingLabels } = await client.updateIssue(identifier, {
        title: opts.title,
        description: opts.description,
        status: opts.status,
        assignee: opts.assignee,
        parentId: opts.parent === false ? null : opts.parent,
        labels: opts.label,
        project: opts.project,
        createMissingLabels: opts.createMissingLabels,
      });

      // Warn about missing labels
      if (missingLabels.length > 0) {
        console.error(`${colors.warning("Warning")}: Labels not found (skipped): ${missingLabels.join(", ")}`);
        console.error(dim(`  Use --create-missing-labels to create them`));
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
            },
            null,
            2
          )
        );
      } else {
        console.log(`${colors.success("Updated")}: ${colors.identifier(issue.identifier)} - ${issue.title}`);
      }
    } else if (!opts.blockedBy && !opts.blocking && !opts.relatedTo && !opts.duplicateOf && !opts.comment) {
      console.error("Error: No updates specified. Use --help to see options.");
      process.exit(1);
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
