import { Command } from "commander";
import { $ } from "bun";

export const WORKTREES_DIR = ".worktrees";
export const BRANCH_PREFIX = "wt/";

export interface DestroyConfig {
  worktreesDir: string;
  branchPrefix: string;
}

export interface DestroyOptions {
  force?: boolean;
}

export interface DestroyDeps {
  getWorktreeList: () => Promise<string>;
  removeWorktree: (path: string, force: boolean) => Promise<void>;
  deleteBranch: (branch: string, force: boolean) => Promise<void>;
  output: (message: string) => void;
  errorOutput: (message: string) => void;
  warnOutput: (message: string) => void;
  exit: (code: number) => never;
}

export function getDefaultConfig(): DestroyConfig {
  return {
    worktreesDir: WORKTREES_DIR,
    branchPrefix: BRANCH_PREFIX,
  };
}

export function getDefaultDeps(): DestroyDeps {
  return {
    getWorktreeList: async () => $`git worktree list --porcelain`.text(),
    removeWorktree: async (path, force) => {
      if (force) {
        await $`git worktree remove ${path} --force`.quiet();
      } else {
        await $`git worktree remove ${path}`.quiet();
      }
    },
    deleteBranch: async (branch, force) => {
      if (force) {
        await $`git branch -D ${branch}`.quiet();
      } else {
        await $`git branch -d ${branch}`.quiet();
      }
    },
    output: console.log,
    errorOutput: console.error,
    warnOutput: console.warn,
    exit: process.exit as (code: number) => never,
  };
}

export function buildWorktreePath(name: string, config = getDefaultConfig()): string {
  return `${config.worktreesDir}/${name}`;
}

export function buildBranchName(name: string, config = getDefaultConfig()): string {
  return `${config.branchPrefix}${name}`;
}

export function worktreeExists(porcelainOutput: string, worktreePath: string): boolean {
  return porcelainOutput.includes(worktreePath);
}

export function createDestroyCommand(): Command {
  return new Command("destroy")
    .description("Remove a worktree and its branch")
    .argument("<name>", "Worktree name (e.g., ENG-123)")
    .option("--force", "Force removal even if worktree has changes")
    .action(async (name: string, opts: DestroyOptions) => {
      await runDestroy(name, opts);
    });
}

export async function runDestroy(
  name: string,
  opts: DestroyOptions,
  config: DestroyConfig = getDefaultConfig(),
  deps: DestroyDeps = getDefaultDeps()
): Promise<void> {
  const worktreePath = buildWorktreePath(name, config);
  const branchName = buildBranchName(name, config);

  // Check if worktree exists
  const existingWorktrees = await deps.getWorktreeList();
  if (!worktreeExists(existingWorktrees, worktreePath)) {
    deps.errorOutput(`Error: Worktree '${name}' does not exist`);
    deps.exit(1);
  }

  try {
    // Remove the worktree
    await deps.removeWorktree(worktreePath, opts.force ?? false);

    // Delete the branch
    try {
      await deps.deleteBranch(branchName, false);
    } catch {
      // Branch might have unmerged changes, try force delete
      if (opts.force) {
        await deps.deleteBranch(branchName, true);
      } else {
        deps.warnOutput(`Warning: Branch '${branchName}' has unmerged changes. Use --force to delete.`);
      }
    }

    deps.output(`Destroyed: ${worktreePath}`);
  } catch (error) {
    deps.errorOutput(`Error destroying worktree: ${error}`);
    deps.exit(1);
  }
}
