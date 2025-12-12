import { Command } from "commander";
import { $ } from "bun";
import { LinearClient } from "../lib/linear-client";
import { formatListHuman, formatListJson, formatGroupedList } from "../lib/output";
import { formatIssuesForFzf, extractIdentifier } from "./browse";
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
    .option("--fzf", "Interactive selection with fzf (returns identifier)")
    .option("--multi", "Allow multiple selection (with --fzf)")
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
  fzf?: boolean;
  multi?: boolean;
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

    if (issues.length === 0) {
      console.log("No issues found");
      return;
    }

    // FZF mode
    if (opts.fzf) {
      const fzfInput = formatIssuesForFzf(issues);
      const binPath = new URL("../../../bin/plan", import.meta.url).pathname;
      const previewCmd = `echo {} | grep -oE '[A-Z]+-[0-9]+' | head -1 | xargs ${binPath} show`;

      const fzfArgs = [
        "--ansi",
        "--preview",
        previewCmd,
        "--preview-window",
        "right:50%:wrap",
      ];

      if (opts.multi) {
        fzfArgs.push("--multi");
      }

      const result = await $`echo ${fzfInput} | fzf ${fzfArgs}`
        .text()
        .catch(() => {
          process.exit(0);
        });

      if (result && result.trim()) {
        const selectedLines = result.trim().split("\n");
        for (const line of selectedLines) {
          const id = extractIdentifier(line);
          if (id) console.log(id);
        }
      }
      return;
    }

    // Standard output modes
    if (opts.json) {
      console.log(formatListJson(issues));
    } else if (opts.groupBy) {
      console.log(formatGroupedList(issues, opts.groupBy as "label" | "project" | "status"));
    } else {
      console.log(formatListHuman(issues, { depth: options.depth }));
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
