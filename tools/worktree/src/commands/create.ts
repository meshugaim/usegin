import { Command } from "commander";
import { $ } from "bun";

export const WORKTREES_DIR = ".worktrees";
export const BRANCH_PREFIX = "wt/";

export interface CreateConfig {
  worktreesDir: string;
  branchPrefix: string;
}

export interface CreateDeps {
  getWorktreeList: () => Promise<string>;
  createWorktree: (path: string, branch: string) => Promise<void>;
  output: (message: string) => void;
  errorOutput: (message: string) => void;
  exit: (code: number) => never;
}

export function getDefaultConfig(): CreateConfig {
  return {
    worktreesDir: WORKTREES_DIR,
    branchPrefix: BRANCH_PREFIX,
  };
}

export function getDefaultDeps(): CreateDeps {
  return {
    getWorktreeList: async () => $`git worktree list --porcelain`.text(),
    createWorktree: async (path, branch) => {
      await $`git worktree add ${path} -b ${branch}`.quiet();
    },
    output: console.log,
    errorOutput: console.error,
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

export function createCreateCommand(): Command {
  return new Command("create")
    .description("Create a new worktree")
    .argument("<name>", "Worktree name (e.g., ENG-123)")
    .action(async (name: string) => {
      await runCreate(name);
    });
}

export async function runCreate(
  name: string,
  config: CreateConfig = getDefaultConfig(),
  deps: CreateDeps = getDefaultDeps()
): Promise<void> {
  const worktreePath = buildWorktreePath(name, config);
  const branchName = buildBranchName(name, config);

  // Check if worktree already exists
  const existingWorktrees = await deps.getWorktreeList();
  if (worktreeExists(existingWorktrees, worktreePath)) {
    deps.errorOutput(`Error: Worktree '${name}' already exists`);
    deps.exit(1);
  }

  // Create the worktree with a new branch
  try {
    await deps.createWorktree(worktreePath, branchName);
    // .husky is tracked in git, so it's already checked out in the worktree
    deps.output(`Created: ${worktreePath} (branch: ${branchName})`);
  } catch (error) {
    deps.errorOutput(`Error creating worktree: ${error}`);
    deps.exit(1);
  }
}
