import { Command } from "commander";
import { $ } from "bun";
import { LinearClient } from "../lib/linear-client";
import { formatListHuman, formatGroupedList } from "../lib/output";
import { formatIssuesForFzf, extractIdentifier } from "./browse";
import { printApiStats } from "../lib/stats";
import { dim } from "../lib/colors";
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
    .option("--depth <n>", "Include sub-issues (0=none, 1, 2, ...)", "2")
    .option("--inbox", "Show inbox items only")
    .option("--all", "Show both inbox and list items")
    .option("--status <status>", "Filter by status")
    .option("--assignee <user>", "Filter by assignee (@me for self)")
    .option("--fzf", "Interactive selection with fzf (returns identifier)")
    .option("--multi", "Allow multiple selection (with --fzf)")
    .option("--show-done", "Show Done sub-issues (hidden by default)")
    .option("--stats", "Show API call statistics")
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
  depth?: string;
  inbox?: boolean;
  all?: boolean;
  status?: string;
  assignee?: string;
  fzf?: boolean;
  multi?: boolean;
  showDone?: boolean;
  stats?: boolean;
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

    // Validate --status if provided
    if (opts.status) {
      const teamData = team
        ? await client.getTeamByKey(team)
        : await client.getDefaultTeam();

      if (teamData) {
        const states = await client.getStatesForTeam(teamData.id);
        const validStatus = states.find(
          (s) => s.name.toLowerCase() === opts.status!.toLowerCase()
        );
        if (!validStatus) {
          const available = states.map((s) => `"${s.name}"`).join(", ");
          console.error(`Error: Status "${opts.status}" not found.`);
          console.error(`Available statuses: ${available}`);
          process.exit(1);
        }
      }
    }

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
      printApiStats(client.apiCallCount, opts.stats ?? false);
      return;
    }

    // Standard output modes
    const showDone = opts.showDone ?? false;
    const depthExplicit = process.argv.some(arg => arg.startsWith("--depth"));

    if (opts.groupBy) {
      console.log(formatGroupedList(issues, opts.groupBy as "label" | "project" | "status", { showDone }));
    } else {
      const result = formatListHuman(issues, { depth: options.depth, showDone });
      console.log(result.output);

      // Show hint about depth if using default and there are hidden children
      if (result.hasHiddenChildren && !depthExplicit) {
        console.log(dim(`\n(showing up to depth ${options.depth}, use --depth N to see more)`));
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
