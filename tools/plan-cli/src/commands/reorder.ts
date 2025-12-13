import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { printApiStats } from "../lib/stats";
import {
  calculateBefore,
  calculateAfter,
  calculateTop,
  calculateBottom,
  calculatePull,
  calculatePush,
} from "../lib/ordering";
import { colors } from "../lib/colors";

export function createReorderCommand(): Command {
  const cmd = new Command("reorder")
    .description("Change the position of an issue in the list")
    .argument("<id>", "Issue identifier (e.g., ENG-20)")
    .argument("<action>", "Action: before, after, top, bottom, pull, push")
    .argument("[target]", "Target identifier or count (depends on action)")
    .option("--team <key>", "Team key (e.g., ENG)")
    .option("--quiet", "No output on success")
    .option("--stats", "Show API call statistics")
    .action(async (id: string, action: string, target: string | undefined, opts) => {
      await runReorder(id, action, target, opts);
    });

  return cmd;
}

async function runReorder(
  identifier: string,
  action: string,
  target: string | undefined,
  opts: { team?: string; quiet?: boolean; stats?: boolean }
): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    process.exit(2);
  }

  try {
    const client = new LinearClient({ apiKey });
    const team = opts.team ?? process.env.PLAN_TEAM;

    // Get all issues for reordering context
    const issues = await client.getIssuesForReordering(team);

    // Verify the issue exists in the list
    const issueExists = issues.some((i) => i.identifier === identifier);
    if (!issueExists) {
      console.error(`Error: Issue "${identifier}" not found in list`);
      process.exit(3);
    }

    let newSortOrder: number | null = null;
    let description = "";

    switch (action) {
      case "before":
        if (!target) {
          console.error("Error: 'before' requires a target identifier");
          process.exit(1);
        }
        newSortOrder = calculateBefore(issues, target);
        if (newSortOrder === null) {
          console.error(`Error: Target "${target}" not found`);
          process.exit(3);
        }
        description = `before ${target}`;
        break;

      case "after":
        if (!target) {
          console.error("Error: 'after' requires a target identifier");
          process.exit(1);
        }
        newSortOrder = calculateAfter(issues, target);
        if (newSortOrder === null) {
          console.error(`Error: Target "${target}" not found`);
          process.exit(3);
        }
        description = `after ${target}`;
        break;

      case "top":
        newSortOrder = calculateTop(issues);
        description = "to top";
        break;

      case "bottom":
        newSortOrder = calculateBottom(issues);
        description = "to bottom";
        break;

      case "pull":
        {
          const count = target ? parseInt(target, 10) : 1;
          if (isNaN(count) || count < 1) {
            console.error("Error: 'pull' count must be a positive number");
            process.exit(1);
          }
          newSortOrder = calculatePull(issues, identifier, count);
          if (newSortOrder === null) {
            console.error("Error: Cannot move up (already at top?)");
            process.exit(4);
          }
          description = `up ${count}`;
        }
        break;

      case "push":
        {
          const count = target ? parseInt(target, 10) : 1;
          if (isNaN(count) || count < 1) {
            console.error("Error: 'push' count must be a positive number");
            process.exit(1);
          }
          newSortOrder = calculatePush(issues, identifier, count);
          if (newSortOrder === null) {
            console.error("Error: Cannot move down (already at bottom?)");
            process.exit(4);
          }
          description = `down ${count}`;
        }
        break;

      default:
        console.error(`Error: Unknown action "${action}"`);
        console.error("Valid actions: before, after, top, bottom, pull, push");
        process.exit(1);
    }

    // Update the sortOrder
    await client.updateSortOrder(identifier, newSortOrder);

    if (!opts.quiet) {
      console.log(`${colors.success("Moved")} ${colors.identifier(identifier)} ${description}`);
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
