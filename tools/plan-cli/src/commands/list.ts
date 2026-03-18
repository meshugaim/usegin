import { Command } from "commander";
import { $ } from "bun";
import { LinearClient } from "../lib/linear-client";
import { formatListHuman, formatListJson, formatGroupedList, formatGroupedListJson, paginateIssues } from "../lib/output";
import { formatIssuesForFzf, extractIdentifier } from "./browse";
import { printApiStats } from "../lib/stats";
import { dim } from "../lib/colors";
import type { ListOptions, PlanIssue } from "../types";

/**
 * Get the maximum updatedAt timestamp across an issue and all its descendants.
 * Used for --active sorting so that parent issues bubble up when their
 * children are being actively worked on.
 */
export function getMaxUpdatedAt(issue: PlanIssue): number {
  let maxTime = new Date(issue.updatedAt).getTime();

  for (const child of issue.children) {
    const childMax = getMaxUpdatedAt(child);
    if (childMax > maxTime) {
      maxTime = childMax;
    }
  }

  return maxTime;
}

/**
 * Determine whether JSON output should be used by default.
 *
 * Priority order:
 * 1. Explicit --json flag → always JSON
 * 2. PLAN_OUTPUT=json → force JSON
 * 3. PLAN_OUTPUT=human → force human (overrides CLAUDECODE and TTY detection)
 * 4. CLAUDECODE=1 → default to JSON (Claude Code sets this)
 * 5. No TTY on stdout AND no --fzf → default to JSON (piped/scripted usage)
 * 6. Otherwise → human
 */
export function shouldDefaultToJson(opts: {
  fzf?: boolean;
  json?: boolean;
  env?: Record<string, string | undefined>;
  isTTY?: boolean;
}): boolean {
  // Explicit --json flag always wins
  if (opts.json) return true;

  const env = opts.env ?? {};
  const planOutput = env.PLAN_OUTPUT;

  // Explicit PLAN_OUTPUT env var overrides everything else
  const planOutputLower = planOutput?.toLowerCase();
  if (planOutputLower === "json") return true;
  if (planOutputLower === "human") return false;

  // Claude Code agent detection
  if (env.CLAUDECODE === "1") return true;

  // No TTY and not in fzf mode → likely piped/scripted
  if (!opts.isTTY && !opts.fzf) return true;

  return false;
}

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
    .option("--status <status>", "Filter by status")
    .option("--assignee <user>", "Filter by assignee (@me for self)")
    .option("--latest", "Sort by creation date (newest first)")
    .option("--active", "Sort by recent activity (most recently updated first)")
    .option("--json", "Output as JSON")
    .option("--fzf", "Interactive selection with fzf (returns identifier)")
    .option("--multi", "Allow multiple selection (with --fzf)")
    .option("--limit <n>", "Maximum number of top-level issues to show")
    .option("--page <n>", "Page number (1-indexed, JSON mode only)")
    .option("--page-size <n>", "Items per page (default 25, JSON mode only)")
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
  status?: string;
  assignee?: string;
  limit?: string;
  page?: string;
  pageSize?: string;
  json?: boolean;
  latest?: boolean;
  active?: boolean;
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

  // --page and --limit are mutually exclusive
  if (opts.page && opts.limit) {
    console.error("Error: --page and --limit cannot be used together");
    process.exit(1);
  }

  const useJson = shouldDefaultToJson({
    fzf: opts.fzf,
    json: opts.json,
    env: process.env,
    isTTY: process.stdout.isTTY,
  });

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
      status: opts.status,
      assignee: opts.assignee,
    };

    let issues = await client.listIssues(options);

    if (issues.length === 0) {
      if (useJson) {
        if (opts.groupBy) {
          console.log(JSON.stringify({ groups: [] }, null, 2));
        } else if (opts.page) {
          const page = parseInt(opts.page, 10);
          const pageSize = parseInt(opts.pageSize ?? "25", 10);
          console.log(JSON.stringify(paginateIssues([], page, pageSize), null, 2));
        } else {
          console.log("[]");
        }
      } else {
        console.log("No issues found");
      }
      return;
    }

    // Sort by creation date if --latest is specified
    if (opts.latest) {
      issues = issues.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Newest first
      });
    }

    // Sort by update date if --active is specified
    // Uses max(updatedAt) across entire subtree so parent issues bubble up
    // when their children are actively being worked on
    if (opts.active) {
      issues = issues.sort((a, b) => {
        const dateA = getMaxUpdatedAt(a);
        const dateB = getMaxUpdatedAt(b);
        return dateB - dateA; // Most recently updated first
      });
    }

    // Apply --limit (after sorting, before output)
    if (opts.limit) {
      const limit = parseInt(opts.limit, 10);
      if (isNaN(limit) || limit < 1) {
        console.error(`Error: --limit must be a positive integer, got "${opts.limit}"`);
        process.exit(1);
      }
      issues = issues.slice(0, limit);
    }

    // FZF mode takes precedence over --json (interactive selection can't be JSON)
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
    // Show Done children if explicitly requested OR if filtering by done status
    const showDone = opts.showDone ?? (opts.status?.toLowerCase() === "done");
    if (useJson) {
      const groupBy = opts.groupBy as "label" | "project" | "status";
      if (opts.groupBy) {
        console.log(formatGroupedListJson(issues, groupBy, { showDone }));
      } else if (opts.page) {
        const page = parseInt(opts.page, 10);
        const pageSize = parseInt(opts.pageSize ?? "25", 10);
        // Format each issue to compact JSON shape, then paginate
        const compactIssues = JSON.parse(formatListJson(issues, { showDone }));
        const result = paginateIssues(compactIssues, page, pageSize);
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatListJson(issues, { showDone }));
      }
    } else if (opts.groupBy) {
      const groupBy = opts.groupBy as "label" | "project" | "status";
      console.log(formatGroupedList(issues, groupBy, { showDone }));
    } else {
      const depthExplicit = process.argv.some(arg => arg.startsWith("--depth"));
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
