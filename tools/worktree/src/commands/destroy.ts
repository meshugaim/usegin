import { Command } from "commander";
import { $ } from "bun";

const WORKTREES_DIR = ".worktrees";
const BRANCH_PREFIX = "wt/";

export function createDestroyCommand(): Command {
  return new Command("destroy")
    .description("Remove a worktree and its branch")
    .argument("<name>", "Worktree name (e.g., ENG-123)")
    .option("--force", "Force removal even if worktree has changes")
    .action(async (name: string, opts: { force?: boolean }) => {
      await runDestroy(name, opts);
    });
}

async function runDestroy(name: string, opts: { force?: boolean }): Promise<void> {
  const worktreePath = `${WORKTREES_DIR}/${name}`;
  const branchName = `${BRANCH_PREFIX}${name}`;

  // Check if worktree exists
  const existingWorktrees = await $`git worktree list --porcelain`.text();
  if (!existingWorktrees.includes(worktreePath)) {
    console.error(`Error: Worktree '${name}' does not exist`);
    process.exit(1);
  }

  try {
    // Remove the worktree
    if (opts.force) {
      await $`git worktree remove ${worktreePath} --force`.quiet();
    } else {
      await $`git worktree remove ${worktreePath}`.quiet();
    }

    // Delete the branch
    try {
      await $`git branch -d ${branchName}`.quiet();
    } catch {
      // Branch might have unmerged changes, try force delete
      if (opts.force) {
        await $`git branch -D ${branchName}`.quiet();
      } else {
        console.warn(`Warning: Branch '${branchName}' has unmerged changes. Use --force to delete.`);
      }
    }

    console.log(`Destroyed: ${worktreePath}`);
  } catch (error) {
    console.error(`Error destroying worktree: ${error}`);
    process.exit(1);
  }
}
