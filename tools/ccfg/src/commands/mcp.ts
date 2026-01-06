import { Command } from "commander";
import { enableServer, disableServer, enableAll, disableAll, getServerStatuses } from "../lib/toggle";
import { getMcpServerNames } from "../lib/mcp";

function getProjectPath(): string {
  return process.cwd();
}

export function createMcpCommand(): Command {
  const mcp = new Command("mcp")
    .description("Manage MCP server enabled/disabled state");

  // mcp list - show current state
  mcp
    .command("list")
    .alias("ls")
    .description("Show MCP servers and their enabled/disabled state")
    .action(async () => {
      const projectPath = getProjectPath();
      const statuses = await getServerStatuses(projectPath);

      if (statuses.length === 0) {
        console.log("No MCP servers found in .mcp.json");
        return;
      }

      console.log("MCP Servers:\n");
      for (const { name, enabled } of statuses) {
        const status = enabled ? "[enabled]" : "[disabled]";
        console.log(`  ${name}: ${status}`);
      }
    });

  // mcp enable <name> or --all
  mcp
    .command("enable [name]")
    .description("Enable an MCP server")
    .option("--all", "Enable all MCP servers")
    .action(async (name: string | undefined, options: { all?: boolean }) => {
      const projectPath = getProjectPath();

      if (options.all) {
        await enableAll(projectPath);
        console.log("Enabled all MCP servers");
        return;
      }

      if (!name) {
        console.error("Error: Please provide a server name or use --all");
        process.exit(1);
      }

      try {
        await enableServer(projectPath, name);
        console.log(`Enabled: ${name}`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // mcp disable <name> or --all
  mcp
    .command("disable [name]")
    .description("Disable an MCP server")
    .option("--all", "Disable all MCP servers")
    .action(async (name: string | undefined, options: { all?: boolean }) => {
      const projectPath = getProjectPath();

      if (options.all) {
        await disableAll(projectPath);
        console.log("Disabled all MCP servers");
        return;
      }

      if (!name) {
        console.error("Error: Please provide a server name or use --all");
        process.exit(1);
      }

      try {
        await disableServer(projectPath, name);
        console.log(`Disabled: ${name}`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // Default action (interactive picker) when no subcommand is given
  mcp.action(async () => {
    const projectPath = getProjectPath();
    const statuses = await getServerStatuses(projectPath);

    if (statuses.length === 0) {
      console.log("No MCP servers found in .mcp.json");
      return;
    }

    // Check if fzf is available
    const fzfCheck = Bun.spawnSync(["which", "fzf"]);
    if (fzfCheck.exitCode !== 0) {
      // Fallback to list if fzf is not available
      console.log("fzf not found. Use 'ccfg mcp list' to view servers or 'ccfg mcp enable/disable <name>' to toggle.");
      console.log("\nMCP Servers:\n");
      for (const { name, enabled } of statuses) {
        const status = enabled ? "[enabled]" : "[disabled]";
        console.log(`  ${name}: ${status}`);
      }
      return;
    }

    // Build fzf input with toggle indicators
    const lines = statuses.map(({ name, enabled }) => {
      const indicator = enabled ? "[x]" : "[ ]";
      return `${indicator} ${name}`;
    });

    // Run fzf with multi-select
    const proc = Bun.spawn(["fzf", "--multi", "--ansi", "--header", "Space to toggle, Enter to apply"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    });

    proc.stdin.write(lines.join("\n"));
    proc.stdin.end();

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (!output.trim()) {
      console.log("No changes made");
      return;
    }

    // Parse selections - toggle the selected servers
    const selectedLines = output.trim().split("\n");
    for (const line of selectedLines) {
      const match = line.match(/^\[(.)\] (.+)$/);
      if (!match) continue;

      const wasEnabled = match[1] === "x";
      const serverName = match[2];

      // Toggle: if was enabled, disable it; if was disabled, enable it
      if (wasEnabled) {
        await disableServer(projectPath, serverName);
        console.log(`Disabled: ${serverName}`);
      } else {
        await enableServer(projectPath, serverName);
        console.log(`Enabled: ${serverName}`);
      }
    }
  });

  return mcp;
}
