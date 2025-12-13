import { Command } from "commander";
import { $ } from "bun";

const WORKTREES_DIR = ".worktrees";
const BRANCH_PREFIX = "wt/";

export function createCreateCommand(): Command {
  return new Command("create")
    .description("Create a new worktree")
    .argument("<name>", "Worktree name (e.g., ENG-123)")
    .action(async (name: string) => {
      await runCreate(name);
    });
}

async function runCreate(name: string): Promise<void> {
  const worktreePath = `${WORKTREES_DIR}/${name}`;
  const branchName = `${BRANCH_PREFIX}${name}`;

  // Check if worktree already exists
  const existingWorktrees = await $`git worktree list --porcelain`.text();
  if (existingWorktrees.includes(worktreePath)) {
    console.error(`Error: Worktree '${name}' already exists`);
    process.exit(1);
  }

  // Create the worktree with a new branch
  try {
    await $`git worktree add ${worktreePath} -b ${branchName}`.quiet();

    // Symlink .husky so git hooks work in the worktree
    // (core.hooksPath is relative, so worktree needs its own .husky)
    await $`ln -s ../../.husky ${worktreePath}/.husky`.quiet();

    console.log(`Created: ${worktreePath} (branch: ${branchName})`);
  } catch (error) {
    console.error(`Error creating worktree: ${error}`);
    process.exit(1);
  }
}
