#!/usr/bin/env bun
/**
 * workflow - Session-scoped workflow reminders for Claude
 */

import { Command } from "commander";
import {
  addReminder,
  listReminders,
  getRawReminders,
  clearReminders,
  removeReminder,
  exportTemplate,
  importTemplate,
  listTemplates,
  listSessions,
  importFromSession,
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
  .option("-f, --frequency <number>", "Probability (0-1) of showing this reminder", "1.0")
  .action(async (reminder: string, options: { frequency: string }) => {
    const deps = getDeps();
    const frequency = parseFloat(options.frequency);
    if (isNaN(frequency)) {
      console.error("Error: Frequency must be a number");
      process.exit(1);
    }
    await addReminder(reminder, deps, { frequency });
    const freqDisplay = frequency < 1.0 ? ` (${Math.round(frequency * 100)}% chance)` : "";
    console.log(`Added: ${reminder}${freqDisplay}`);
  });

program
  .command("list")
  .description("List all workflow reminders")
  .option("-v, --verbose", "Show frequency and metadata")
  .action(async (options: { verbose?: boolean }) => {
    const deps = getDeps();
    const reminders = await getRawReminders(deps);
    if (reminders.length === 0) {
      console.log("No workflow reminders set.");
      return;
    }
    console.log("Workflow reminders:");
    reminders.forEach((r, i) => {
      if (options.verbose) {
        const freqPercent = Math.round(r.frequency * 100);
        console.log(`  ${i + 1}. ${r.text} [${freqPercent}%]`);
      } else {
        const freqNote = r.frequency < 1.0 ? ` (${Math.round(r.frequency * 100)}%)` : "";
        console.log(`  ${i + 1}. ${r.text}${freqNote}`);
      }
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

// ===== Templates =====

program
  .command("export")
  .description("Save current reminders as a template")
  .argument("<name>", "Template name")
  .action(async (name: string) => {
    const deps = getDeps();
    const reminders = await listReminders(deps);
    if (reminders.length === 0) {
      console.error("Error: No reminders to export");
      process.exit(1);
    }
    await exportTemplate(name, deps);
    console.log(`Exported ${reminders.length} reminders to template: ${name}`);
  });

program
  .command("use")
  .description("Apply a saved template")
  .argument("<name>", "Template name")
  .action(async (name: string) => {
    const deps = getDeps();
    try {
      await importTemplate(name, deps);
      const reminders = await listReminders(deps);
      console.log(`Applied template: ${name}`);
      console.log(`Loaded ${reminders.length} reminders.`);
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

program
  .command("templates")
  .description("List available templates")
  .action(async () => {
    const deps = getDeps();
    const templates = await listTemplates(deps);
    if (templates.length === 0) {
      console.log("No templates saved.");
      return;
    }
    console.log("Available templates:");
    templates.forEach((t) => {
      console.log(`  - ${t}`);
    });
  });

// ===== Session Import =====

program
  .command("sessions")
  .description("List sessions with reminders")
  .action(async () => {
    const deps = getDeps();
    const sessions = await listSessions(deps);
    if (sessions.length === 0) {
      console.log("No sessions with reminders found.");
      return;
    }
    console.log("Sessions with reminders:");
    sessions.forEach((s) => {
      const marker = s === deps.sessionId ? " (current)" : "";
      console.log(`  - ${s}${marker}`);
    });
  });

program
  .command("import")
  .description("Import reminders from another session")
  .argument("<session-id>", "Session ID to import from")
  .action(async (sessionId: string) => {
    const deps = getDeps();
    try {
      await importFromSession(sessionId, deps);
      const reminders = await listReminders(deps);
      console.log(`Imported ${reminders.length} reminders from: ${sessionId}`);
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

program.parse();
