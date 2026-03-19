import { parseSession } from "../parser";
import {
  checkFzfAvailable,
  discoverSessions,
  getCurrentProjectHash,
  resolveSessionPath,
} from "../finder";
import { FzfNotFoundError } from "../errors";
import { extractBashCommands, formatBashEntry, formatBashGrep } from "../bash-history";
import { detectClipboardTool, copyToClipboard } from "../clipboard";

function printBashHelp() {
  console.log(`
session bash - Browse Bash commands from sessions

USAGE:
  session bash [<id|prefix>] [--grep <pattern>]

Browse Bash tool calls across recent sessions with fzf. Each entry shows
the timestamp, Claude's description, and the actual command. The preview
pane shows command output.

If <id> is provided, scopes to a single session. Otherwise collects
commands from the 20 most recent sessions in the current project.

KEYBINDINGS:
  enter    Copy command to clipboard (falls back to stdout)
  ctrl-r   Run command (with confirmation)

OPTIONS:
  --grep <pattern>  Non-interactive: filter and print matching commands
  --help, -h        Show this help

EXAMPLES:
  session bash                        # Browse all recent commands
  session bash 502de9c7               # Browse commands from one session
  session bash --grep "bun test"      # Search for test commands
  session bash 502de9c7 --grep pg     # Search in a specific session
`);
}

// =============================================================================
// FZF CONFIGURATION
// =============================================================================

/** Marker prefix used by ctrl-r binding to signal "run this command". */
export const RUN_MARKER = "RUN:";

/**
 * Build fzf arguments for bash browsing.
 * Separated for testability.
 */
export function buildBashFzfArgs(): string[] {
  return [
    "fzf",
    "--read0",
    "--ansi",
    "--no-sort",
    "--header", "enter: copy │ ctrl-r: run │ ctrl-u/d: scroll preview",
    "--preview", "echo {+2..}",
    "--preview-window", "right:50%:wrap",
    "--bind", "ctrl-u:preview-half-page-up",
    "--bind", "ctrl-d:preview-half-page-down",
    "--bind", `ctrl-r:become(printf '${RUN_MARKER}'; echo {+2..})`,
  ];
}

// =============================================================================
// OUTPUT PARSING
// =============================================================================

/**
 * Extract the bare command text from an fzf selection.
 *
 * The selection contains multi-line text like:
 *   [2025-03-18 10:30]  Run the test suite
 *   $ bun test src/parser.test.ts
 *
 * Returns the command without the "$ " prefix, or the raw selection
 * if no command line is found.
 */
export function extractCommandFromSelection(selected: string): string {
  const lines = selected.split("\n");
  const commandLine = lines.find((l) => l.startsWith("$ "));
  if (commandLine) {
    return commandLine.slice(2);
  }
  return selected;
}

/**
 * Parse fzf output to determine the action and command.
 *
 * Returns `{ action: "run", command }` if the output starts with the RUN: marker,
 * or `{ action: "copy", command }` for a normal Enter selection.
 * Returns `null` if the output is empty (user cancelled).
 */
export function parseBashFzfOutput(
  output: string
): { action: "copy" | "run"; command: string } | null {
  const trimmed = output.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(RUN_MARKER)) {
    // ctrl-r: the become() binding outputs "RUN:" + the command line from {+2..}
    // {+2..} extracts the second line onward, so it's already "$ command"
    const rawCommand = trimmed.slice(RUN_MARKER.length).trim();
    // Strip the "$ " prefix if present
    const command = rawCommand.startsWith("$ ")
      ? rawCommand.slice(2)
      : rawCommand;
    return { action: "run", command };
  }

  // Normal Enter: extract command from the multi-line selection
  const command = extractCommandFromSelection(trimmed);
  return { action: "copy", command };
}

// =============================================================================
// RUN WITH CONFIRMATION
// =============================================================================

/**
 * Prompt the user for confirmation, then run a command.
 *
 * Prints the command, asks y/n, and spawns it with inherited stdio if confirmed.
 */
async function runWithConfirmation(command: string): Promise<void> {
  console.log(`\n  ${command}\n`);

  // Prompt for confirmation
  process.stdout.write("Run this command? [y/N] ");

  // Read a single line from stdin
  const reader = process.stdin;
  reader.resume();

  const answer = await new Promise<string>((resolve) => {
    const onData = (data: Buffer) => {
      reader.removeListener("data", onData);
      reader.pause();
      resolve(data.toString().trim().toLowerCase());
    };
    reader.on("data", onData);
  });

  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled.");
    return;
  }

  const proc = Bun.spawn(["bash", "-c", command], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  process.exit(exitCode ?? 0);
}

// =============================================================================
// MAIN COMMAND
// =============================================================================

export async function runBash(args: string[]) {
  const helpFlag = args.includes("--help") || args.includes("-h");
  if (helpFlag) {
    printBashHelp();
    return;
  }

  // Parse args: optional <id>, optional --grep <pattern>
  let grepPattern: string | undefined;
  let sessionIdOrPrefix: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--grep") {
      grepPattern = args[i + 1];
      i++; // skip the pattern value
    } else if (!args[i]?.startsWith("-")) {
      sessionIdOrPrefix = args[i];
    }
  }

  try {
    let allCommands: ReturnType<typeof extractBashCommands> = [];

    if (sessionIdOrPrefix) {
      // Single session mode
      const filePath = await resolveSessionPath(sessionIdOrPrefix);
      const session = await parseSession(filePath, { includeSubagents: false });
      allCommands = extractBashCommands(session.turns);
    } else {
      // Multi-session mode: discover recent sessions
      const currentProject = getCurrentProjectHash();
      const sessions = await discoverSessions({
        project: currentProject || undefined,
      });
      const limited = sessions.slice(0, 20);

      if (limited.length === 0) {
        console.error("No sessions found.");
        process.exit(1);
      }

      for (const sessionInfo of limited) {
        try {
          const session = await parseSession(sessionInfo.path, { includeSubagents: false });
          const commands = extractBashCommands(session.turns);
          allCommands.push(...commands);
        } catch {
          // Skip sessions that fail to parse
        }
      }
    }

    if (allCommands.length === 0) {
      console.log("No Bash commands found.");
      return;
    }

    // --grep: non-interactive output
    if (grepPattern) {
      console.log(formatBashGrep(allCommands, grepPattern));
      return;
    }

    // Interactive: launch fzf
    if (!(await checkFzfAvailable())) {
      const error = new FzfNotFoundError();
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }

    // Build NUL-separated entries for fzf --read0
    const entries = allCommands.map(formatBashEntry);
    const input = entries.join("\0");

    const fzfArgs = buildBashFzfArgs();

    const childProcess = Bun.spawn(fzfArgs, {
      stdin: new Response(input),
      stdout: "pipe",
      stderr: "inherit",
    });

    const output = await new Response(childProcess.stdout).text();
    await childProcess.exited;

    const result = parseBashFzfOutput(output);
    if (!result) {
      process.exit(1);
    }

    if (result.action === "run") {
      await runWithConfirmation(result.command);
      return;
    }

    // Default action: copy to clipboard, fall back to stdout
    const clipboardTool = await detectClipboardTool();
    if (clipboardTool) {
      const copied = await copyToClipboard(result.command, clipboardTool);
      if (copied) {
        console.log(`Copied to clipboard: ${result.command}`);
      } else {
        // Clipboard tool failed — fall back to stdout
        console.log(result.command);
      }
    } else {
      // No clipboard tool available — print to stdout
      console.log(result.command);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}
