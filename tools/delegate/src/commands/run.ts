import { Command } from "commander";
import { $ } from "bun";
import { readFile } from "fs/promises";
import { generateBrief } from "./prompt";

interface RunOptions {
  dryRun?: boolean;
  keepWorktree?: boolean;
  prompt?: string;
  promptFile?: string;
  issue?: string;
}

async function worktreeExists(name: string): Promise<boolean> {
  try {
    const result = await $`worktree list --json`.quiet().text();
    const worktrees = JSON.parse(result) as Array<{ name: string }>;
    return worktrees.some((wt) => wt.name === name);
  } catch {
    return false;
  }
}

async function createWorktree(name: string): Promise<void> {
  await $`worktree create ${name}`.quiet();
}

async function destroyWorktree(name: string): Promise<void> {
  await $`worktree destroy ${name} --force`.quiet();
}

async function resolvePrompt(options: RunOptions): Promise<string> {
  // Priority: --prompt > --prompt-file > --issue > default
  if (options.prompt) {
    return options.prompt;
  }

  if (options.promptFile) {
    try {
      return await readFile(options.promptFile, "utf-8");
    } catch (error) {
      throw new Error(`Failed to read prompt file: ${options.promptFile}`);
    }
  }

  if (options.issue) {
    return generateBrief(options.issue);
  }

  throw new Error("No prompt provided. Use --prompt, --prompt-file, or --issue");
}

async function launchAgent(worktreePath: string, prompt: string): Promise<void> {
  // Launch claude in the worktree directory, blocking until it exits
  await $`bun --cwd=${worktreePath} run --bun claude --dangerously-skip-permissions -p ${prompt}`;
}

async function run(worktreeName: string, options: RunOptions): Promise<void> {
  console.log(`Running agent in worktree: ${worktreeName}`);

  // 1. Resolve the prompt
  const prompt = await resolvePrompt(options);

  // 2. Check if worktree already exists
  const exists = await worktreeExists(worktreeName);

  if (options.dryRun) {
    console.log(`\n[dry-run] Would:`);
    if (!exists) {
      console.log(`  1. Create worktree: .worktrees/${worktreeName}`);
    } else {
      console.log(`  1. Using existing worktree: .worktrees/${worktreeName}`);
    }
    console.log(`  2. Launch: cd .worktrees/${worktreeName} && bun run --bun claude --dangerously-skip-permissions -p "..."`);
    console.log(`  3. Block until agent completes`);
    if (!options.keepWorktree && !exists) {
      console.log(`  4. Cleanup: worktree destroy ${worktreeName}`);
    }
    console.log(`\nPrompt preview (first 200 chars):`);
    console.log(`  ${prompt.substring(0, 200).replace(/\n/g, "\\n")}...`);
    return;
  }

  // 3. Create worktree if needed
  const createdWorktree = !exists;
  if (!exists) {
    console.log(`  Creating worktree...`);
    await createWorktree(worktreeName);
    console.log(`  Created: .worktrees/${worktreeName}`);
  } else {
    console.log(`  Using existing worktree: .worktrees/${worktreeName}`);
  }

  const worktreePath = `.worktrees/${worktreeName}`;

  // 4. Launch agent (blocks)
  console.log(`  Launching agent...`);
  console.log(`  ─────────────────────────────────────`);

  try {
    await launchAgent(worktreePath, prompt);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Agent completed.`);
  } catch (error) {
    console.log(`  ─────────────────────────────────────`);
    console.error(`  Agent exited with error:`, error);
  }

  // 5. Cleanup (unless --keep-worktree or worktree existed before)
  if (!options.keepWorktree && createdWorktree) {
    console.log(`  Cleaning up worktree...`);
    try {
      await destroyWorktree(worktreeName);
      console.log(`  Destroyed: .worktrees/${worktreeName}`);
    } catch (error) {
      console.error(`  Warning: Failed to cleanup worktree:`, error);
    }
  } else if (createdWorktree) {
    console.log(`  Keeping worktree: .worktrees/${worktreeName}`);
  }

  console.log(`Done.`);
}

export function createRunCommand(): Command {
  return new Command("run")
    .description("Run agent in a worktree with custom prompt")
    .argument("<worktree-name>", "Name for the worktree (e.g., 'my-feature', 'ENG-123')")
    .option("--dry-run", "Show what would happen, don't execute")
    .option("--keep-worktree", "Don't cleanup worktree on completion")
    .option("-p, --prompt <text>", "Custom prompt text to pass to the agent")
    .option("-f, --prompt-file <path>", "Read prompt from file")
    .option("-i, --issue <id>", "Use standard delegation brief for a Linear issue")
    .action(async (worktreeName: string, options: RunOptions) => {
      try {
        await run(worktreeName, options);
      } catch (error) {
        console.error(`Error:`, error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
