import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { CLONES_DIR } from "./list";

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

export function resolveClonePath(name: string, cwd: string): string {
  return resolve(cwd, CLONES_DIR, name);
}

export function createPathCommand(): Command {
  return new Command("path")
    .description("Get the absolute path to a clone directory")
    .argument("<name>", "Clone name")
    .action(async (name: string) => {
      await runPath(name);
    });
}

export async function runPath(
  name: string,
  deps: PathDeps = getDefaultDeps()
): Promise<void> {
  const clonePath = resolveClonePath(name, deps.getCwd());

  if (!(await deps.exists(clonePath))) {
    deps.exitWithError(`Clone '${name}' does not exist at ${clonePath}`);
    return;
  }

  deps.output(clonePath);
}
