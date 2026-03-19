import { parseSession } from "../parser";
import {
  checkFzfAvailable,
  discoverSessions,
  getCurrentProjectHash,
  resolveSessionPath,
} from "../finder";
import { FzfNotFoundError } from "../errors";
import { extractBashCommands, formatBashEntry, formatBashGrep } from "../bash-history";

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

    const fzfArgs = [
      "fzf",
      "--read0",
      "--ansi",
      "--no-sort",
      "--header", "enter: print command │ ctrl-u/d: scroll preview",
      "--preview", "echo {+2..}",
      "--preview-window", "right:50%:wrap",
      "--bind", "ctrl-u:preview-half-page-up",
      "--bind", "ctrl-d:preview-half-page-down",
    ];

    const childProcess = Bun.spawn(fzfArgs, {
      stdin: new Response(input),
      stdout: "pipe",
      stderr: "inherit",
    });

    const output = await new Response(childProcess.stdout).text();
    await childProcess.exited;

    const selected = output.trim();
    if (!selected) {
      process.exit(1);
    }

    // Extract the command line (starts with "$ ")
    const lines = selected.split("\n");
    const commandLine = lines.find((l) => l.startsWith("$ "));
    if (commandLine) {
      // Print the bare command (without "$ " prefix) for easy piping/copying
      console.log(commandLine.slice(2));
    } else {
      console.log(selected);
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
