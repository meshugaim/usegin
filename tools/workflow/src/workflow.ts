/**
 * Workflow reminders - session-scoped reminders for Claude workflows
 */

import { mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

export interface WorkflowDeps {
  storageDir: string;
  sessionId: string;
}

/**
 * Get default storage directory
 */
export function getDefaultStorageDir(): string {
  return join(homedir(), ".crun", "workflows");
}

/**
 * Get the file path for a session's reminders
 */
function getRemindersPath(deps: WorkflowDeps): string {
  return join(deps.storageDir, `${deps.sessionId}.txt`);
}

/**
 * Read reminders from file
 */
async function readReminders(deps: WorkflowDeps): Promise<string[]> {
  const path = getRemindersPath(deps);
  try {
    const content = await Bun.file(path).text();
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

/**
 * Write reminders to file
 */
async function writeReminders(
  reminders: string[],
  deps: WorkflowDeps
): Promise<void> {
  await mkdir(deps.storageDir, { recursive: true });
  const path = getRemindersPath(deps);
  await Bun.write(path, reminders.join("\n"));
}

/**
 * Add a reminder
 */
export async function addReminder(
  reminder: string,
  deps: WorkflowDeps
): Promise<void> {
  const reminders = await readReminders(deps);
  reminders.push(reminder.trim());
  await writeReminders(reminders, deps);
}

/**
 * List all reminders
 */
export async function listReminders(deps: WorkflowDeps): Promise<string[]> {
  return readReminders(deps);
}

/**
 * Remove a reminder by index (0-based)
 */
export async function removeReminder(
  index: number,
  deps: WorkflowDeps
): Promise<void> {
  const reminders = await readReminders(deps);
  if (index < 0 || index >= reminders.length) {
    throw new Error(`Invalid index: ${index}`);
  }
  reminders.splice(index, 1);
  await writeReminders(reminders, deps);
}

/**
 * Clear all reminders
 */
export async function clearReminders(deps: WorkflowDeps): Promise<void> {
  await writeReminders([], deps);
}
