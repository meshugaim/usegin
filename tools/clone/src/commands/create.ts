import { Command } from "commander";
import { $ } from "bun";
import { existsSync } from "node:fs";

export const CLONES_DIR = ".clones";

export interface CreateConfig {
  clonesDir: string;
}

export interface CreateDeps {
  getOriginUrl: () => Promise<string>;
  cloneExists: (path: string) => Promise<boolean>;
  createClone: (origin: string, path: string) => Promise<void>;
  output: (message: string) => void;
  errorOutput: (message: string) => void;
  exit: (code: number) => never;
}

export function getDefaultConfig(): CreateConfig {
  return {
    clonesDir: CLONES_DIR,
  };
}

export function getDefaultDeps(): CreateDeps {
  return {
    getOriginUrl: async () => {
      const result = await $`git remote get-url origin`.text();
      return result.trim();
    },
    cloneExists: async (path: string) => existsSync(path),
    createClone: async (origin: string, path: string) => {
      // Use --reference . to share objects with the current repo
      await $`git clone --reference . ${origin} ${path}`.quiet();
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

export async function cloneExists(
  checkExists: (path: string) => Promise<boolean>,
  clonePath: string
): Promise<boolean> {
  return checkExists(clonePath);
}

export function createCreateCommand(): Command {
  return new Command("create")
    .description("Create a new reference clone")
    .argument("<name>", "Clone name (e.g., ENG-123)")
    .action(async (name: string) => {
      await runCreate(name);
    });
}

export async function runCreate(
  name: string,
  config: CreateConfig = getDefaultConfig(),
  deps: CreateDeps = getDefaultDeps()
): Promise<void> {
  const clonePath = buildClonePath(name, config);

  // Check if clone already exists
  if (await deps.cloneExists(clonePath)) {
    deps.errorOutput(`Error: Clone '${name}' already exists at ${clonePath}`);
    deps.exit(1);
  }

  // Get the origin URL
  let originUrl: string;
  try {
    originUrl = await deps.getOriginUrl();
  } catch (error) {
    deps.errorOutput(`Error getting origin URL: ${error}`);
    deps.exit(1);
  }

  // Create the reference clone
  try {
    await deps.createClone(originUrl, clonePath);
    deps.output(`Created: ${clonePath}`);
  } catch (error) {
    deps.errorOutput(`Error creating clone: ${error}`);
    deps.exit(1);
  }
}
