#!/usr/bin/env bun
/**
 * crun - Minimal synchronous wrapper for claude -p
 */

import { Command } from "commander";
import { run, createDefaultDeps } from "./run";
import { runList } from "./list";
import { runKill } from "./kill";
import {
  isSessionIdOrPrefix,
  resolveSessionPath,
  extractSessionIdFromPath,
  AmbiguousSessionError,
} from "../../session/src/finder";

const program = new Command()
  .name("crun")
  .description("Minimal synchronous wrapper for claude -p");

// List subcommand
program
  .command("list")
  .description("List recent invocations")
  .option("--running", "Filter to running invocations only")
  .option("--today", "Filter to today's invocations only")
  .option("-l, --limit <n>", "Limit number of results", "10")
  .action(async (options) => {
    const listOptions = {
      running: options.running || false,
      today: options.today || false,
      limit: parseInt(options.limit, 10) || 10,
    };

    const output = await runList(listOptions);
    console.log(output);
  });

// Kill subcommand
program
  .command("kill")
  .description("Terminate a running worker invocation")
  .argument("<id>", "The invocation ID to kill")
  .action(async (id: string) => {
    const output = await runKill(id);
    console.log(output);
  });

// Default run command (when no subcommand is given)
program
  .argument("[prompt]", "The prompt to send to Claude")
  .option("-r, --resume <id>", "Continue existing session")
  .option("-m, --model <model>", "Override model")
  .option("-C, --cwd <path>", "Run in directory")
  .option("-f, --prompt-file <file>", "Read prompt from file")
  .option(
    "--remind <presets>",
    "Comma-separated preset names (e.g., tdd,commit-often)"
  )
  .option(
    "-n, --note-to-self <note>",
    "Reminder for when work completes (required for run)"
  )
  .allowUnknownOption() // Allow claude flags after --
  .action(async (prompt: string | undefined, options) => {
    // Don't run the main action if a subcommand was invoked
    // Commander handles this automatically via the subcommand action
    const subcommands = ["list", "kill"];
    if (subcommands.includes(process.argv[2])) {
      return;
    }
    await main(prompt, options);
  });

program.parse();

/**
 * Resolve a short session ID prefix to the full session UUID.
 * If already a full UUID or path, returns it unchanged.
 * Throws AmbiguousSessionError if multiple sessions match the prefix.
 */
async function resolveSessionId(input: string): Promise<string> {
  // If it doesn't look like an ID or prefix, return unchanged
  if (!isSessionIdOrPrefix(input)) {
    return input;
  }

  // Resolve to full path, then extract session ID
  const resolvedPath = await resolveSessionPath(input);
  return extractSessionIdFromPath(resolvedPath);
}

async function main(
  prompt: string | undefined,
  options: {
    resume?: string;
    model?: string;
    cwd?: string;
    promptFile?: string;
    remind?: string;
    noteToSelf?: string;
  }
) {
  // Extract claude flags (everything after --)
  const rawArgs = process.argv.slice(2);
  const separatorIndex = rawArgs.indexOf("--");
  const claudeFlags =
    separatorIndex === -1 ? [] : rawArgs.slice(separatorIndex + 1);

  // Check for stdin if no prompt or file
  if (!prompt && !options.promptFile && !process.stdin.isTTY) {
    prompt = await Bun.stdin.text();
    prompt = prompt.trim();
  }

  if (!prompt && !options.promptFile) {
    console.error("Error: No prompt provided");
    console.error("Usage: crun [options] <prompt> -n <note>");
    console.error("       echo 'prompt' | crun -n <note>");
    console.error("       crun --prompt-file task.md -n <note>");
    console.error("       crun list [--running] [--today] [--limit N]");
    process.exit(1);
  }

  if (!options.noteToSelf) {
    console.error("Error: --note-to-self is required");
    console.error("Usage: crun [options] <prompt> -n <note>");
    process.exit(1);
  }

  // Resolve short session ID prefixes to full UUIDs
  let resolvedResume = options.resume;
  if (options.resume) {
    try {
      resolvedResume = await resolveSessionId(options.resume);
    } catch (error) {
      if (error instanceof AmbiguousSessionError) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      if (error instanceof Error && error.message.includes("not found")) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  }

  // Generate IDs early for header
  const deps = createDefaultDeps();
  const sessionId = resolvedResume || (await deps.generateSessionId());
  const invocationId = deps.generateInvocationId();

  console.error(`Invocation: ${invocationId}`);
  console.error(`Session: ${sessionId}`);
  console.error(`Log: ~/.crun/logs/${sessionId}.log`);
  console.error("─".repeat(40));

  // Parse remind flag (comma-separated preset names)
  const remind = options.remind
    ? options.remind.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  try {
    const result = await run(
      {
        prompt,
        promptFile: options.promptFile,
        resume: resolvedResume,
        model: options.model,
        cwd: options.cwd,
        claudeFlags: claudeFlags.length > 0 ? claudeFlags : undefined,
        noteToSelf: options.noteToSelf,
        remind,
      },
      {
        ...deps,
        generateSessionId: async () => sessionId,
        generateInvocationId: () => invocationId,
      }
    );

    console.log("─".repeat(40));
    if (result.noteToSelf) {
      console.log(`\n📝 NOTE TO SELF: ${result.noteToSelf}\n`);
    }
    console.log(`Exit: ${result.exitCode}`);
    process.exit(result.exitCode);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    process.exit(1);
  }
}
