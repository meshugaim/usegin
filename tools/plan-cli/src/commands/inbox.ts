import { Command } from "commander";
import { LinearClient } from "../lib/linear-client";
import { formatListHuman, formatListJson } from "../lib/output";
import { formatIssuesForFzf, extractIdentifier } from "./browse";
import { $ } from "bun";

export function createInboxCommand(): Command {
  const cmd = new Command("inbox")
    .description("List inbox items (shorthand for: list --inbox)")
    .option("--team <key>", "Team key (e.g., ENG)")
    .option("--json", "Output as JSON")
    .option("--fzf", "Interactive selection with fzf")
    .option("--multi", "Allow multiple selection (with --fzf)")
    .action(async (opts) => {
      await runInbox(opts);
    });

  return cmd;
}

async function runInbox(opts: {
  team?: string;
  json?: boolean;
  fzf?: boolean;
  multi?: boolean;
}): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("Error: LINEAR_API_KEY environment variable is required");
    process.exit(2);
  }

  try {
    const client = new LinearClient({ apiKey });
    const team = opts.team ?? process.env.PLAN_TEAM;

    const issues = await client.listIssues({
      team,
      inbox: true,
    });

    if (issues.length === 0) {
      console.log("Inbox is empty");
      return;
    }

    if (opts.fzf) {
      const fzfInput = formatIssuesForFzf(issues);
      const binPath = new URL("../../../bin/plan", import.meta.url).pathname;
      const previewCmd = `echo {} | grep -oE '[A-Z]+-[0-9]+' | head -1 | xargs ${binPath} show`;

      const fzfArgs = ["--ansi", "--preview", previewCmd, "--preview-window", "right:50%:wrap"];
      if (opts.multi) fzfArgs.push("--multi");

      const result = await $`echo ${fzfInput} | fzf ${fzfArgs}`.text().catch(() => {
        process.exit(0);
      });

      if (result?.trim()) {
        for (const line of result.trim().split("\n")) {
          const id = extractIdentifier(line);
          if (id) console.log(id);
        }
      }
    } else if (opts.json) {
      console.log(formatListJson(issues));
    } else {
      console.log(formatListHuman(issues));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}
