import { Command } from "commander";
import { $ } from "bun";
import { WORKTREES_DIR } from "./create";

export interface LaunchOptions {
  noMcp?: boolean;
  mcpConfig?: string;
}

export interface LaunchDeps {
  getWorktreeList: () => Promise<string>;
  spawn: (command: string, args: string[], cwd: string) => Promise<void>;
  errorOutput: (message: string) => void;
  exit: (code: number) => never;
}

export function getDefaultDeps(): LaunchDeps {
  return {
    getWorktreeList: async () => $`git worktree list --porcelain`.text(),
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
    .description("Launch Claude in a worktree with MCP control")
    .argument("<name>", "Worktree name (e.g., ENG-123 or just 123)")
    .option("--no-mcp", "Disable all MCP servers")
    .option("--mcp-config <path>", "Path to custom MCP config file")
    .action(async (name: string, opts: LaunchOptions) => {
      await runLaunch(name, opts);
    });
}

export function buildWorktreePath(name: string): string {
  return `${WORKTREES_DIR}/${name}`;
}

export function worktreeExists(porcelainOutput: string, worktreePath: string): boolean {
  return porcelainOutput.includes(worktreePath);
}

export async function runLaunch(
  name: string,
  opts: LaunchOptions,
  deps: LaunchDeps = getDefaultDeps()
): Promise<void> {
  const worktreePath = buildWorktreePath(name);

  // Check if worktree exists
  const existingWorktrees = await deps.getWorktreeList();
  if (!worktreeExists(existingWorktrees, worktreePath)) {
    deps.errorOutput(`Error: Worktree '${name}' does not exist`);
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

  // Launch Claude in the worktree directory
  try {
    await deps.spawn("claude", args, worktreePath);
  } catch (error) {
    deps.errorOutput(`Error launching Claude: ${error}`);
    deps.exit(1);
  }
}
