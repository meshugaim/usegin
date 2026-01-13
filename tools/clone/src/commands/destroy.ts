import { Command } from "commander";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

export const CLONES_DIR = ".clones";

export interface DestroyConfig {
  clonesDir: string;
}

export interface DestroyOptions {
  force?: boolean;
}

export interface DestroyDeps {
  cloneExists: (path: string) => Promise<boolean>;
  removeClone: (path: string) => Promise<void>;
  output: (message: string) => void;
  errorOutput: (message: string) => void;
  exit: (code: number) => never;
}

export function getDefaultConfig(): DestroyConfig {
  return {
    clonesDir: CLONES_DIR,
  };
}

export function getDefaultDeps(): DestroyDeps {
  return {
    cloneExists: async (path: string) => existsSync(path),
    removeClone: async (path: string) => {
      await rm(path, { recursive: true, force: true });
    },
    output: console.log,
    errorOutput: console.error,
    exit: process.exit as (code: number) => never,
  };
}

export function buildClonePath(
  name: string,
  config = getDefaultConfig()
): string {
  return `${config.clonesDir}/${name}`;
}

export function createDestroyCommand(): Command {
  return new Command("destroy")
    .description("Remove a clone")
    .argument("<name>", "Clone name (e.g., ENG-123)")
    .option("--force", "Force removal even if clone has changes")
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
  const clonePath = buildClonePath(name, config);

  // Check if clone exists
  if (!(await deps.cloneExists(clonePath))) {
    deps.errorOutput(`Error: Clone '${name}' does not exist at ${clonePath}`);
    deps.exit(1);
  }

  try {
    await deps.removeClone(clonePath);
    deps.output(`Destroyed: ${clonePath}`);
  } catch (error) {
    deps.errorOutput(`Error destroying clone: ${error}`);
    deps.exit(1);
  }
}
