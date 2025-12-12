import { Command } from "commander";
import { $ } from "bun";
import { LinearClient } from "../lib/linear-client";
import type { PlanIssue } from "../types";

export function createBrowseCommand(): Command {
  const cmd = new Command("browse")
    .description("Interactive issue browser using fzf")
    .option("--team <key>", "Team key (e.g., ENG)")
    .option("--inbox", "Browse inbox items only")
    .option("--action <action>", "Action after selection: start, close")
    .option("--multi", "Allow multiple selection")
    .action(async (opts) => {
      await runBrowse(opts);
    });

  return cmd;
}

/**
 * Format issues for fzf input
 * Format: "identifier\ttitle\tstatus"
 */
export function formatIssuesForFzf(issues: PlanIssue[]): string {
  return issues
    .map((issue, index) => {
      const pos = String(index + 1).padStart(2);
      return `${pos}  ${issue.identifier}\t${issue.title}\t[${issue.status}]`;
    })
    .join("\n");
}

/**
 * Extract identifier from fzf selection line
 */
export function extractIdentifier(line: string): string | null {
  // Format: "pos  ID\ttitle\t[status]"
  const match = line.match(/^\s*\d+\s+([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

async function runBrowse(opts: {
  team?: string;
  inbox?: boolean;
  action?: string;
  multi?: boolean;
}): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    process.exit(2);
  }

  try {
    const client = new LinearClient({ apiKey });

    // Use team from env if not specified
    const team = opts.team ?? process.env.PLAN_TEAM;

    const issues = await client.listIssues({
      team,
      inbox: opts.inbox,
    });

    if (issues.length === 0) {
      console.log("No issues found");
      process.exit(0);
    }

    const fzfInput = formatIssuesForFzf(issues);

    // Build preview command - calls plan show with the identifier
    const binPath = new URL("../../../bin/plan", import.meta.url).pathname;
    const previewCmd = `echo {} | grep -oE '[A-Z]+-[0-9]+' | head -1 | xargs ${binPath} show`;

    // Build fzf args
    const fzfArgs = [
      "--ansi",
      "--preview",
      previewCmd,
      "--preview-window",
      "right:50%:wrap",
      "--header",
      "Select issue (enter to select, esc to cancel)",
    ];

    if (opts.multi) {
      fzfArgs.push("--multi");
    }

    // Run fzf
    const result = await $`echo ${fzfInput} | fzf ${fzfArgs}`
      .text()
      .catch(() => {
        // User cancelled with Ctrl+C or Esc
        process.exit(0);
      });

    if (!result || !result.trim()) {
      process.exit(0);
    }

    // Handle multi-select: split by newlines
    const selectedLines = result.trim().split("\n");
    const identifiers = selectedLines
      .map(extractIdentifier)
      .filter((id): id is string => id !== null);

    if (identifiers.length === 0) {
      console.error("Could not extract issue identifier from selection");
      process.exit(1);
    }

    // Perform action if specified
    if (opts.action) {
      for (const id of identifiers) {
        await performAction(client, id, opts.action);
      }
    } else {
      // Just output the identifiers
      for (const id of identifiers) {
        console.log(id);
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

async function performAction(
  client: LinearClient,
  identifier: string,
  action: string
): Promise<void> {
  switch (action) {
    case "start":
      await client.updateIssue(identifier, {
        status: "In Progress",
        assignee: "@me",
      });
      console.log(`Started: ${identifier}`);
      break;

    case "close":
      await client.updateIssue(identifier, {
        status: "Done",
      });
      console.log(`Closed: ${identifier}`);
      break;

    default:
      console.error(`Unknown action: ${action}`);
      process.exit(1);
  }
}
