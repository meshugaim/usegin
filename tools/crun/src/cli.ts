#!/usr/bin/env bun
/**
 * crun - Minimal synchronous wrapper for claude -p
 */

import { Command } from "commander";
import { run, createDefaultDeps } from "./run";

const program = new Command()
  .name("crun")
  .description("Minimal synchronous wrapper for claude -p")
  .argument("[prompt]", "The prompt to send to Claude")
  .option("-r, --resume <id>", "Continue existing session")
  .option("-m, --model <model>", "Override model")
  .option("-C, --cwd <path>", "Run in directory")
  .option("-f, --prompt-file <file>", "Read prompt from file")
  .option(
    "--remind <presets>",
    "Comma-separated preset names (e.g., tdd,commit-often)"
  )
  .requiredOption(
    "-n, --note-to-self <note>",
    "Reminder for when work completes (required)"
  )
  .allowUnknownOption() // Allow claude flags after --
  .action(async (prompt: string | undefined, options) => {
    await main(prompt, options);
  });

program.parse();

async function main(
  prompt: string | undefined,
  options: {
    resume?: string;
    model?: string;
    cwd?: string;
    promptFile?: string;
    remind?: string;
    noteToSelf: string;
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
    process.exit(1);
  }

  // Generate session ID early for header
  const deps = createDefaultDeps();
  const sessionId = options.resume || (await deps.generateSessionId());

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
        resume: options.resume,
        model: options.model,
        cwd: options.cwd,
        claudeFlags: claudeFlags.length > 0 ? claudeFlags : undefined,
        noteToSelf: options.noteToSelf,
        remind,
      },
      {
        ...deps,
        generateSessionId: async () => sessionId,
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
