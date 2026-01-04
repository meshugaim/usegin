#!/usr/bin/env bun
/**
 * workflow - Session-scoped workflow reminders for Claude
 */

import { Command } from "commander";
import {
  addReminder,
  listReminders,
  clearReminders,
  removeReminder,
  getDefaultStorageDir,
  type WorkflowDeps,
} from "./workflow";

function getDeps(): WorkflowDeps {
  // Get session ID from environment or generate one
  const sessionId = process.env.CLAUDE_SESSION_ID || "default";
  return {
    storageDir: getDefaultStorageDir(),
    sessionId,
  };
}

const program = new Command()
  .name("workflow")
  .description("Session-scoped workflow reminders for Claude")
  .version("0.1.0");

program
  .command("add")
  .description("Add a workflow reminder")
  .argument("<reminder>", "The reminder text")
  .action(async (reminder: string) => {
    const deps = getDeps();
    await addReminder(reminder, deps);
    console.log(`Added: ${reminder}`);
  });

program
  .command("list")
  .description("List all workflow reminders")
  .action(async () => {
    const deps = getDeps();
    const reminders = await listReminders(deps);
    if (reminders.length === 0) {
      console.log("No workflow reminders set.");
      return;
    }
    console.log("Workflow reminders:");
    reminders.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r}`);
    });
  });

program
  .command("remove")
  .description("Remove a reminder by number")
  .argument("<number>", "The reminder number (1-based)")
  .action(async (num: string) => {
    const deps = getDeps();
    const index = parseInt(num, 10) - 1;
    if (isNaN(index)) {
      console.error("Error: Invalid number");
      process.exit(1);
    }
    try {
      const reminders = await listReminders(deps);
      const removed = reminders[index];
      await removeReminder(index, deps);
      console.log(`Removed: ${removed}`);
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

program
  .command("clear")
  .description("Clear all workflow reminders")
  .action(async () => {
    const deps = getDeps();
    await clearReminders(deps);
    console.log("Cleared all workflow reminders.");
  });

program.parse();
