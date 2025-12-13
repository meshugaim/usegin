import { Command } from "commander";
import { $ } from "bun";

const WORKTREES_DIR = ".worktrees";

interface WorktreeInfo {
  name: string;
  path: string;
  branch: string;
  commit: string;
}

export function createListCommand(): Command {
  return new Command("list")
    .alias("ls")
    .description("List all worktrees")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      await runList(opts);
    });
}

async function runList(opts: { json?: boolean }): Promise<void> {
  const output = await $`git worktree list --porcelain`.text();
  const worktrees = parseWorktrees(output);

  // Filter to only .worktrees directory
  const managed = worktrees.filter((wt) => wt.path.includes(WORKTREES_DIR));

  if (managed.length === 0) {
    console.log("No worktrees found");
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify(managed, null, 2));
  } else {
    console.log("Name".padEnd(15) + "Branch".padEnd(20) + "Commit");
    console.log("-".repeat(50));
    for (const wt of managed) {
      console.log(
        wt.name.padEnd(15) +
        wt.branch.padEnd(20) +
        wt.commit.substring(0, 7)
      );
    }
  }
}

function parseWorktrees(porcelainOutput: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const entries = porcelainOutput.trim().split("\n\n");

  for (const entry of entries) {
    const lines = entry.split("\n");
    const pathLine = lines.find((l) => l.startsWith("worktree "));
    const headLine = lines.find((l) => l.startsWith("HEAD "));
    const branchLine = lines.find((l) => l.startsWith("branch "));

    if (pathLine && headLine) {
      const path = pathLine.replace("worktree ", "");
      const name = path.split("/").pop() || path;
      const commit = headLine.replace("HEAD ", "");
      const branch = branchLine?.replace("branch refs/heads/", "") || "(detached)";

      worktrees.push({ name, path, branch, commit });
    }
  }

  return worktrees;
}
