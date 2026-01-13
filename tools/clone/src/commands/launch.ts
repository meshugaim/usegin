import { Command } from "commander";
import { existsSync } from "node:fs";
import { buildClonePath as sharedBuildClonePath } from "../shared";

export interface LaunchOptions {
  noMcp?: boolean;
  mcpConfig?: string;
}

export interface LaunchDeps {
  cloneExists: (path: string) => Promise<boolean>;
  spawn: (command: string, args: string[], cwd: string) => Promise<void>;
  errorOutput: (message: string) => void;
  exit: (code: number) => never;
}

export function getDefaultDeps(): LaunchDeps {
  return {
    cloneExists: async (path: string) => existsSync(path),
    spawn: async (command, args, cwd) => {
      // Use 'bun run --bun' to resolve the claude executable via node_modules/.bin
      // This matches how delegate worktree launches claude and ensures PATH resolution works
      const proc = Bun.spawn(["bun", "run", "--bun", command, ...args], {
        cwd,
        stdio: ["inherit", "inherit", "inherit"],
      });
      await proc.exited;
    },
    errorOutput: console.error,
    exit: process.exit as (code: number) => never,
  };
}

export function createLaunchCommand(): Command {
  return new Command("launch")
    .description("Launch Claude in a clone with MCP control")
    .argument("<name>", "Clone name (e.g., ENG-123 or just 123)")
    .option("--no-mcp", "Disable all MCP servers")
    .option("--mcp-config <path>", "Path to custom MCP config file")
    .action(async (name: string, opts: LaunchOptions) => {
      await runLaunch(name, opts);
    });
}

export function buildClonePath(name: string): string {
  return sharedBuildClonePath(name);
}

export async function cloneExists(
  checkExists: (path: string) => Promise<boolean>,
  clonePath: string
): Promise<boolean> {
  return checkExists(clonePath);
}

export async function runLaunch(
  name: string,
  opts: LaunchOptions,
  deps: LaunchDeps = getDefaultDeps()
): Promise<void> {
  const clonePath = buildClonePath(name);

  // Check if clone exists
  if (!(await deps.cloneExists(clonePath))) {
    deps.errorOutput(`Error: Clone '${name}' does not exist`);
    deps.exit(1);
  }

  // Build Claude CLI args
  const args: string[] = [];

  if (opts.noMcp) {
    // Use --strict-mcp-config alone to disable all MCPs
    args.push("--strict-mcp-config");
  } else if (opts.mcpConfig) {
    // Use custom MCP config
    args.push("--strict-mcp-config");
    args.push("--mcp-config", opts.mcpConfig);
  }

  // Launch Claude in the clone directory
  try {
    await deps.spawn("claude", args, clonePath);
  } catch (error) {
    deps.errorOutput(`Error launching Claude: ${error}`);
    deps.exit(1);
  }
}
