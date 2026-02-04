#!/usr/bin/env bun
import { Command } from "commander";
import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join, dirname, basename } from "path";

// Types for tool metadata
interface ToolMeta {
  name: string;
  description: string;
  location: string;
  type: "cli" | "script" | "justfile" | "npm-script";
  usage?: string;
  binPath?: string;
}

// Get the tools directory
function getToolsDir(): string {
  // Walk up from src directory to find tools/
  let dir = dirname(import.meta.dir);
  while (dir !== "/" && basename(dir) !== "tools") {
    const toolsDir = join(dir, "tools");
    if (existsSync(toolsDir)) {
      return toolsDir;
    }
    dir = dirname(dir);
  }
  // If we're already in tools
  if (basename(dir) === "tools") {
    return dir;
  }
  // Default fallback
  return join(process.cwd(), "tools");
}

// Get the repo root directory
function getRepoRoot(): string {
  const toolsDir = getToolsDir();
  return dirname(toolsDir);
}

// Discover CLI tools from tools/ subdirectories
function discoverCLITools(toolsDir: string): ToolMeta[] {
  const tools: ToolMeta[] = [];

  try {
    const entries = readdirSync(toolsDir);
    for (const entry of entries) {
      // Skip bin directory and hidden files
      if (entry === "bin" || entry.startsWith(".")) continue;

      const entryPath = join(toolsDir, entry);
      if (!statSync(entryPath).isDirectory()) continue;

      // Check for package.json
      const pkgPath = join(entryPath, "package.json");
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
          const binPath = pkg.bin
            ? Object.values(pkg.bin)[0] as string
            : pkg.main;

          tools.push({
            name: pkg.name || entry,
            description: pkg.description || "",
            location: `tools/${entry}`,
            type: "cli",
            binPath: binPath ? join(entryPath, binPath) : undefined,
            usage: getBinCommand(entry, toolsDir),
          });
        } catch {
          // Skip invalid package.json
        }
      }
    }
  } catch {
    // toolsDir might not exist
  }

  return tools;
}

// Check if there's a bin wrapper for a tool
function getBinCommand(toolName: string, toolsDir: string): string | undefined {
  const binDir = join(toolsDir, "bin");
  if (!existsSync(binDir)) return undefined;

  // Map tool directory names to bin script names
  const nameMap: Record<string, string> = {
    "plan-cli": "plan",
    "docs-registry": "docs",
    "tool-cli": "tool",
  };

  const binName = nameMap[toolName] || toolName;
  const binPath = join(binDir, binName);

  if (existsSync(binPath)) {
    return binName;
  }
  return undefined;
}

// Discover bin scripts from tools/bin/
function discoverBinScripts(toolsDir: string): ToolMeta[] {
  const tools: ToolMeta[] = [];
  const binDir = join(toolsDir, "bin");

  if (!existsSync(binDir)) return tools;

  // CLI tools we've already discovered - don't duplicate
  const cliTools = new Set<string>();
  const cliToolsList = discoverCLITools(toolsDir);
  for (const tool of cliToolsList) {
    if (tool.usage) {
      cliTools.add(tool.usage);
    }
  }

  try {
    const entries = readdirSync(binDir);
    for (const entry of entries) {
      // Skip non-files
      const entryPath = join(binDir, entry);
      if (!existsSync(entryPath)) continue;
      const stat = statSync(entryPath);
      if (!stat.isFile() && !stat.isSymbolicLink()) continue;

      // Skip test files and README
      if (entry.endsWith(".test.ts") || entry === "README.md") continue;

      // Skip if this is a wrapper for a CLI tool we already found
      if (cliTools.has(entry)) continue;

      // Get description from first line comment or shebang
      const description = getScriptDescription(entryPath, entry);

      tools.push({
        name: entry,
        description,
        location: `tools/bin/${entry}`,
        type: "script",
        usage: entry,
        binPath: entryPath,
      });
    }
  } catch {
    // binDir might not exist
  }

  return tools;
}

// Extract description from script file
function getScriptDescription(filePath: string, name: string): string {
  // Known descriptions for bin scripts
  const knownDescriptions: Record<string, string> = {
    "api-dev": "Run FastAPI dev server",
    "autopull": "Auto-pull daemon for syncing from main",
    "claude-sync": "Sync Claude sessions between environments",
    "fathom": "CLI for Fathom API - list, view, export meetings",
    "gmail": "Sync and search Gmail via CLI",
    "google-file-search": "Test Google Gemini File Search Tool API",
    "hebrew-to-english": "Convert Hebrew keyboard input to English",
    "mailgun-send": "Send real emails via Mailgun API (supports threading headers)",
    "mailgun-test-webhook": "Send a signed fake Mailgun webhook to localhost",
    "mailgun-tunnel": "Start/stop Cloudflare Tunnel for local Mailgun webhooks",
    "nextjs-dev": "Run Next.js dev server",
    "pick-and-push-session.ts": "Pick a session and push for retro",
    "pick-issue": "Interactive issue picker with fzf",
    "push-session": "Push Claude sessions to git for retro analysis",
    "qr-port": "Generate QR code for port forwarding",
  };

  if (knownDescriptions[name]) {
    return knownDescriptions[name];
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // Look for a description comment after shebang
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.startsWith("//") && !line.includes("import")) {
        return line.replace(/^\/\/\s*/, "");
      }
      if (line.startsWith("#") && !line.startsWith("#!")) {
        return line.replace(/^#\s*/, "");
      }
    }
  } catch {
    // Ignore read errors
  }

  return "";
}

// Discover npm scripts from root package.json
function discoverNpmScripts(repoRoot: string): ToolMeta[] {
  const tools: ToolMeta[] = [];
  const pkgPath = join(repoRoot, "package.json");

  if (!existsSync(pkgPath)) return tools;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const scripts = pkg.scripts || {};

    // Known descriptions for npm scripts
    const scriptDescriptions: Record<string, string> = {
      c: "Run Claude Code CLI",
      "set-env": "Set environment variables",
      "gitpod-claude-sync": "Sync Claude sessions in Gitpod",
      autosync: "Auto-sync git after commits",
      autopull: "Auto-pull from main branch",
      prepare: "Setup git hooks",
    };

    for (const [name, command] of Object.entries(scripts)) {
      if (typeof command !== "string") continue;

      tools.push({
        name,
        description: scriptDescriptions[name] || command.slice(0, 50),
        location: "package.json",
        type: "npm-script",
        usage: `bun run ${name}`,
      });
    }
  } catch {
    // Ignore errors
  }

  return tools;
}

// Discover justfile recipes
function discoverJustRecipes(repoRoot: string): ToolMeta[] {
  const tools: ToolMeta[] = [];
  const justfilePath = join(repoRoot, "justfile");

  if (!existsSync(justfilePath)) return tools;

  try {
    const content = readFileSync(justfilePath, "utf-8");
    const lines = content.split("\n");

    // Known descriptions for just recipes
    const recipeDescriptions: Record<string, string> = {
      default: "List all recipes",
      gh_login: "Login to GitHub CLI",
      repo: "Open GitHub repo in browser",
      issues: "Open GitHub issues in browser",
      c: "Run Claude Code with args",
      web: "Run Next.js app",
      py: "Run Python services",
      "dev-web": "Run Next.js dev server",
      "dev-api": "Run FastAPI dev server",
      dev: "Run both web and API servers",
      update: "Update root dependencies",
      "update-all": "Update all dependencies",
      install: "Install deps in all submodules",
      sessions: "Browse Claude sessions interactively",
      session: "Parse a specific session file",
      vsc: "VSC Bridge CLI",
      "vsc-release": "Release VSC Bridge",
      "vsc-install": "Install VSC Bridge extension",
    };

    let currentComment = "";
    for (const line of lines) {
      // Track comments for recipe descriptions
      if (line.trim().startsWith("#") && !line.trim().startsWith("#!")) {
        currentComment = line.trim().replace(/^#\s*/, "");
        continue;
      }

      // Match recipe definitions (name followed by : or name with args)
      const recipeMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*(\*?\w*\s*=?[^:]*)?:/);
      if (recipeMatch) {
        const recipeName = recipeMatch[1];

        // Skip module declarations and other non-recipes
        if (["mod", "set", "alias"].includes(recipeName)) {
          currentComment = "";
          continue;
        }

        const description =
          currentComment ||
          recipeDescriptions[recipeName] ||
          "";

        tools.push({
          name: recipeName,
          description,
          location: "justfile",
          type: "justfile",
          usage: `just ${recipeName}`,
        });

        currentComment = "";
      }
    }
  } catch {
    // Ignore errors
  }

  return tools;
}

// Merge and deduplicate tools
function getAllTools(): ToolMeta[] {
  const toolsDir = getToolsDir();
  const repoRoot = getRepoRoot();

  const cliTools = discoverCLITools(toolsDir);
  const binScripts = discoverBinScripts(toolsDir);
  const npmScripts = discoverNpmScripts(repoRoot);
  const justRecipes = discoverJustRecipes(repoRoot);

  // Combine all tools, CLI tools first, then bin scripts
  // Skip npm scripts and justfile recipes by default (they're secondary)
  const allTools = [...cliTools, ...binScripts];

  // Sort by name
  return allTools.sort((a, b) => a.name.localeCompare(b.name));
}

// Get full list including npm and just
function getAllToolsExtended(): {
  cli: ToolMeta[];
  scripts: ToolMeta[];
  npm: ToolMeta[];
  just: ToolMeta[];
} {
  const toolsDir = getToolsDir();
  const repoRoot = getRepoRoot();

  return {
    cli: discoverCLITools(toolsDir).sort((a, b) => a.name.localeCompare(b.name)),
    scripts: discoverBinScripts(toolsDir).sort((a, b) => a.name.localeCompare(b.name)),
    npm: discoverNpmScripts(repoRoot).sort((a, b) => a.name.localeCompare(b.name)),
    just: discoverJustRecipes(repoRoot).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ANSI color helpers
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

// Format tool list
function formatToolList(tools: ToolMeta[], showLocation = false): void {
  for (const tool of tools) {
    const nameCol = cyan(tool.name.padEnd(24));
    const descCol = tool.description || dim("(no description)");

    if (showLocation) {
      console.log(`  ${nameCol} ${descCol}`);
      console.log(dim(`                          ${tool.location}`));
    } else {
      console.log(`  ${nameCol} ${descCol}`);
    }
  }
}

// CLI commands
function runList(options: { all?: boolean; verbose?: boolean }): void {
  if (options.all) {
    const { cli, scripts, npm, just } = getAllToolsExtended();

    if (cli.length > 0) {
      console.log(yellow("CLI Tools:"));
      formatToolList(cli, options.verbose);
      console.log();
    }

    if (scripts.length > 0) {
      console.log(yellow("Bin Scripts:"));
      formatToolList(scripts, options.verbose);
      console.log();
    }

    if (npm.length > 0) {
      console.log(yellow("NPM Scripts:"));
      formatToolList(npm, options.verbose);
      console.log();
    }

    if (just.length > 0) {
      console.log(yellow("Justfile Recipes:"));
      formatToolList(just, options.verbose);
      console.log();
    }
  } else {
    const tools = getAllTools();

    if (tools.length === 0) {
      console.log(dim("No tools found."));
      return;
    }

    formatToolList(tools, options.verbose);
    console.log();
    console.log(dim("Use: tool show <name>     # details about a tool"));
    console.log(dim("     tool list --all      # include npm scripts & just recipes"));
  }
}

function runShow(name: string): void {
  const { cli, scripts, npm, just } = getAllToolsExtended();
  const allTools = [...cli, ...scripts, ...npm, ...just];

  const tool = allTools.find((t) => t.name === name);

  if (!tool) {
    console.error(`Tool not found: ${name}\n`);
    console.error("Available tools:");
    for (const t of getAllTools().slice(0, 10)) {
      console.error(dim(`  ${t.name}`));
    }
    if (getAllTools().length > 10) {
      console.error(dim(`  ... and ${getAllTools().length - 10} more`));
    }
    process.exit(1);
  }

  // Header
  console.log(green(tool.name));
  console.log();

  // Description
  if (tool.description) {
    console.log(tool.description);
    console.log();
  }

  // Details
  console.log(dim("Type:     ") + tool.type);
  console.log(dim("Location: ") + tool.location);

  if (tool.usage) {
    console.log(dim("Usage:    ") + tool.usage);
  }

  // Try to get help output for CLI tools
  if (tool.type === "cli" && tool.usage) {
    console.log();
    console.log(dim("─── help ───"));
    console.log(dim(`Run: ${tool.usage} --help`));
  }
}

function runSearch(term: string): void {
  const { cli, scripts, npm, just } = getAllToolsExtended();
  const allTools = [...cli, ...scripts, ...npm, ...just];

  const lowerTerm = term.toLowerCase();
  const matches = allTools.filter((tool) => {
    const searchable = [tool.name, tool.description, tool.location, tool.type].join(" ").toLowerCase();
    return searchable.includes(lowerTerm);
  });

  if (matches.length === 0) {
    console.log(dim(`No tools matching: ${term}`));
    return;
  }

  console.log(yellow(`Found ${matches.length} tool(s) matching: ${term}`));
  console.log();

  formatToolList(matches, true);

  console.log();
  console.log(dim("Use: tool show <name>"));
}

// Main program
const program = new Command()
  .name("tool")
  .description("Central registry for discovering tools in this repo")
  .version("0.1.0");

// Default action (no subcommand) = list
program.action(() => {
  runList({});
});

program
  .command("list")
  .alias("ls")
  .description("List all tools")
  .option("-a, --all", "Include npm scripts and justfile recipes")
  .option("-v, --verbose", "Show location for each tool")
  .action((options) => {
    runList(options);
  });

program
  .command("show")
  .alias("get")
  .description("Show details about a tool")
  .argument("<name>", "Tool name")
  .action((name: string) => {
    runShow(name);
  });

program
  .command("search")
  .alias("find")
  .description("Search tools by name or description")
  .argument("<term>", "Search term")
  .action((term: string) => {
    runSearch(term);
  });

program.parse();
