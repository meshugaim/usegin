import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { WORKTREES_DIR } from "./list";

export interface PathDeps {
  getCwd: () => string;
  exists: (path: string) => Promise<boolean>;
  output: (message: string) => void;
  exitWithError: (message: string) => void;
}

export function getDefaultDeps(): PathDeps {
  return {
    getCwd: () => process.cwd(),
    exists: async (path: string) => existsSync(path),
    output: console.log,
    exitWithError: (message: string) => {
      console.error(message);
      process.exit(1);
    },
  };
}

export function resolveWorktreePath(name: string, cwd: string): string {
  return resolve(cwd, WORKTREES_DIR, name);
}

export function createPathCommand(): Command {
  return new Command("path")
    .description("Get the absolute path to a worktree directory")
    .argument("<name>", "Worktree name")
    .action(async (name: string) => {
      await runPath(name);
    });
}

export async function runPath(
  name: string,
  deps: PathDeps = getDefaultDeps()
): Promise<void> {
  const worktreePath = resolveWorktreePath(name, deps.getCwd());

  if (!(await deps.exists(worktreePath))) {
    deps.exitWithError(`Worktree '${name}' does not exist at ${worktreePath}`);
    return;
  }

  deps.output(worktreePath);
}
