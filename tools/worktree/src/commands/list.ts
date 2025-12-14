import { Command } from "commander";
import { $ } from "bun";

export const WORKTREES_DIR = ".worktrees";

export interface WorktreeInfo {
  name: string;
  path: string;
  branch: string;
  commit: string;
}

export interface ListOptions {
  json?: boolean;
}

export interface ListDeps {
  getWorktreeList: () => Promise<string>;
  output: (message: string) => void;
}

export function getDefaultDeps(): ListDeps {
  return {
    getWorktreeList: async () => $`git worktree list --porcelain`.text(),
    output: console.log,
  };
}

export function createListCommand(): Command {
  return new Command("list")
    .alias("ls")
    .description("List all worktrees")
    .option("--json", "Output as JSON")
    .action(async (opts: ListOptions) => {
      await runList(opts);
    });
}

export function filterManagedWorktrees(worktrees: WorktreeInfo[]): WorktreeInfo[] {
  return worktrees.filter((wt) => wt.path.includes(WORKTREES_DIR));
}

export function formatTableRow(wt: WorktreeInfo): string {
  return wt.name.padEnd(15) + wt.branch.padEnd(20) + wt.commit.substring(0, 7);
}

export function formatTable(worktrees: WorktreeInfo[]): string {
  const header = "Name".padEnd(15) + "Branch".padEnd(20) + "Commit";
  const separator = "-".repeat(50);
  const rows = worktrees.map(formatTableRow);
  return [header, separator, ...rows].join("\n");
}

export async function runList(
  opts: ListOptions,
  deps: ListDeps = getDefaultDeps()
): Promise<void> {
  const output = await deps.getWorktreeList();
  const worktrees = parseWorktrees(output);
  const managed = filterManagedWorktrees(worktrees);

  if (managed.length === 0) {
    deps.output("No worktrees found");
    return;
  }

  if (opts.json) {
    deps.output(JSON.stringify(managed, null, 2));
  } else {
    deps.output(formatTable(managed));
  }
}

export function parseWorktrees(porcelainOutput: string): WorktreeInfo[] {
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
