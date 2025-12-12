import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { formatListHuman, formatListJson, formatGroupedList } from "../lib/output";
import type { ListOptions, PlanIssue } from "../types";

export function createListCommand(): Command {
  const cmd = new Command("list")
    .alias("ls")
    .description("List issues from Linear")
    .option("--team <key>", "Team key (e.g., ENG)")
    .option("--project <name>", "Filter by project name")
    .option("--label <name>", "Filter by label (can repeat)", collect, [])
    .option("--search <text>", "Search in title and description")
    .option("--group-by <field>", "Group by: label, project, or status")
    .option("--json", "Output as JSON")
    .option("--depth <n>", "Include sub-issues (0=none, 1=one level)", "0")
    .option("--inbox", "Show inbox items only")
    .option("--all", "Show both inbox and list items")
    .option("--status <status>", "Filter by status")
    .option("--assignee <user>", "Filter by assignee (@me for self)")
    .action(async (opts) => {
      await runList(opts);
    });

  return cmd;
}

// Helper to collect multiple flags
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

async function runList(opts: {
  team?: string;
  project?: string;
  label?: string[];
  search?: string;
  groupBy?: string;
  json?: boolean;
  depth?: string;
  inbox?: boolean;
  all?: boolean;
  status?: string;
  assignee?: string;
}): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    console.error("Get your API key from: https://linear.app/settings/api");
    process.exit(2);
  }

  try {
    const client = new LinearClient({ apiKey });

    // Use team from env if not specified
    const team = opts.team ?? process.env.PLAN_TEAM;

    const options: ListOptions = {
      team,
      project: opts.project ?? process.env.PLAN_PROJECT,
      label: opts.label,
      search: opts.search,
      groupBy: opts.groupBy as ListOptions["groupBy"],
      depth: parseInt(opts.depth ?? "0", 10),
      inbox: opts.inbox,
      all: opts.all,
      status: opts.status,
      assignee: opts.assignee,
      json: opts.json,
    };

    const issues = await client.listIssues(options);

    if (opts.json) {
      console.log(formatListJson(issues));
    } else if (opts.groupBy) {
      if (issues.length === 0) {
        console.log("No issues found");
      } else {
        console.log(formatGroupedList(issues, opts.groupBy as "label" | "project" | "status"));
      }
    } else {
      if (issues.length === 0) {
        console.log("No issues found");
      } else {
        console.log(formatListHuman(issues, { depth: options.depth }));
      }
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
