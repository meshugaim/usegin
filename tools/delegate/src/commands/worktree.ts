import { Command } from "commander";
import { $ } from "bun";

interface WorktreeOptions {
  dryRun?: boolean;
  keepWorktree?: boolean;
}

interface LinearIssue {
  identifier: string;
  title: string;
  children: unknown[];
}

async function validateIssue(issueId: string): Promise<LinearIssue> {
  try {
    const result = await $`plan show ${issueId} --json`.quiet().text();
    const issue = JSON.parse(result) as LinearIssue;
    return issue;
  } catch {
    throw new Error(`Issue ${issueId} not found`);
  }
}

async function worktreeExists(issueId: string): Promise<boolean> {
  try {
    const result = await $`worktree list --json`.quiet().text();
    const worktrees = JSON.parse(result) as Array<{ name: string }>;
    return worktrees.some((wt) => wt.name === issueId);
  } catch {
    return false;
  }
}

async function createWorktree(issueId: string): Promise<void> {
  await $`worktree create ${issueId}`.quiet();
}

async function destroyWorktree(issueId: string): Promise<void> {
  await $`worktree destroy ${issueId} --force`.quiet();
}

async function launchAgent(issueId: string): Promise<void> {
  const worktreePath = `.worktrees/${issueId}`;
  const prompt = await $`delegate prompt ${issueId}`.text();

  // Launch claude in the worktree directory, blocking until it exits
  await $`bun --cwd=${worktreePath} run --bun claude --dangerously-skip-permissions -p ${prompt}`;
}

async function runWorktree(issueId: string, options: WorktreeOptions): Promise<void> {
  console.log(`Delegating ${issueId}...`);

  // 1. Validate issue exists
  console.log(`  Validating issue...`);
  const issue = await validateIssue(issueId);

  // 2. Check if leaf (no children)
  if (issue.children && issue.children.length > 0) {
    console.error(`Error: ${issueId} has ${issue.children.length} sub-issues. Only leaf issues can be delegated.`);
    process.exit(1);
  }

  // 3. Check if worktree already exists
  if (await worktreeExists(issueId)) {
    console.error(`Error: Worktree for ${issueId} already exists.`);
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(`\n[dry-run] Would:`);
    console.log(`  1. Create worktree: .worktrees/${issueId}`);
    console.log(`  2. Launch: cd .worktrees/${issueId} && bun run --bun claude --dangerously-skip-permissions -p "$(delegate prompt ${issueId})"`);
    console.log(`  3. Block until agent completes`);
    if (!options.keepWorktree) {
      console.log(`  4. Cleanup: worktree destroy ${issueId}`);
    }
    return;
  }

  // 4. Create worktree
  console.log(`  Creating worktree...`);
  await createWorktree(issueId);
  console.log(`  Created: .worktrees/${issueId}`);

  // 5. Launch agent (blocks)
  console.log(`  Launching agent...`);
  console.log(`  ─────────────────────────────────────`);

  try {
    await launchAgent(issueId);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Agent completed.`);
  } catch (error) {
    console.log(`  ─────────────────────────────────────`);
    console.error(`  Agent exited with error:`, error);
  }

  // 6. Cleanup (unless --keep-worktree)
  if (!options.keepWorktree) {
    console.log(`  Cleaning up worktree...`);
    try {
      await destroyWorktree(issueId);
      console.log(`  Destroyed: .worktrees/${issueId}`);
    } catch (error) {
      console.error(`  Warning: Failed to cleanup worktree:`, error);
    }
  } else {
    console.log(`  Keeping worktree: .worktrees/${issueId}`);
  }

  console.log(`Done.`);
}

export function createWorktreeCommand(): Command {
  return new Command("worktree")
    .description("Delegate issue to agent in worktree (blocks until done)")
    .argument("<issue-id>", "Issue identifier (e.g., ENG-123)")
    .option("--dry-run", "Show what would happen, don't execute")
    .option("--keep-worktree", "Don't cleanup worktree on completion")
    .action(async (issueId: string, options: WorktreeOptions) => {
      try {
        await runWorktree(issueId, options);
      } catch (error) {
        console.error(`Error:`, error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
