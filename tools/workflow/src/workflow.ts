/**
 * Workflow reminders - session-scoped reminders for Claude workflows
 */

import { mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

export interface Reminder {
  text: string;
  frequency: number;
  created: string;
}

export interface WorkflowStorage {
  reminders: Reminder[];
  unblockStopCount?: number;
}

export interface WorkflowDeps {
  storageDir: string;
  sessionId: string;
}

export interface AddReminderOptions {
  frequency?: number;
}

/**
 * Get default storage directory
 */
export function getDefaultStorageDir(): string {
  return join(homedir(), ".claude", "workflows");
}

/**
 * Get the file path for a session's reminders
 */
function getRemindersPath(deps: WorkflowDeps): string {
  return join(deps.storageDir, `${deps.sessionId}.json`);
}

/**
 * Read reminders from JSON file
 */
async function readStorage(deps: WorkflowDeps): Promise<WorkflowStorage> {
  const path = getRemindersPath(deps);
  try {
    const content = await Bun.file(path).json();
    return content as WorkflowStorage;
  } catch {
    return { reminders: [] };
  }
}

/**
 * Write reminders to JSON file
 */
async function writeStorage(
  storage: WorkflowStorage,
  deps: WorkflowDeps
): Promise<void> {
  await mkdir(deps.storageDir, { recursive: true });
  const path = getRemindersPath(deps);
  await Bun.write(path, JSON.stringify(storage, null, 2));
}

/**
 * Clamp a number to a range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Add a reminder
 */
export async function addReminder(
  reminder: string,
  deps: WorkflowDeps,
  options: AddReminderOptions = {}
): Promise<void> {
  const storage = await readStorage(deps);
  const frequency = clamp(options.frequency ?? 0.2, 0, 1);
  storage.reminders.push({
    text: reminder.trim(),
    frequency,
    created: new Date().toISOString(),
  });
  await writeStorage(storage, deps);
}

/**
 * Add multiple reminders at once
 */
export async function addReminders(
  reminders: string[],
  deps: WorkflowDeps,
  options: AddReminderOptions = {}
): Promise<void> {
  if (reminders.length === 0) {
    return;
  }
  const storage = await readStorage(deps);
  const frequency = clamp(options.frequency ?? 0.2, 0, 1);
  const created = new Date().toISOString();
  for (const reminder of reminders) {
    storage.reminders.push({
      text: reminder.trim(),
      frequency,
      created,
    });
  }
  await writeStorage(storage, deps);
}

/**
 * List all reminders (text only, for backward compatibility)
 */
export async function listReminders(deps: WorkflowDeps): Promise<string[]> {
  const storage = await readStorage(deps);
  return storage.reminders.map((r) => r.text);
}

/**
 * Get raw reminder objects with metadata
 */
export async function getRawReminders(deps: WorkflowDeps): Promise<Reminder[]> {
  const storage = await readStorage(deps);
  return storage.reminders;
}

/**
 * Remove a reminder by index (0-based)
 */
export async function removeReminder(
  index: number,
  deps: WorkflowDeps
): Promise<void> {
  const storage = await readStorage(deps);
  if (index < 0 || index >= storage.reminders.length) {
    throw new Error(`Invalid index: ${index}`);
  }
  storage.reminders.splice(index, 1);
  await writeStorage(storage, deps);
}

/**
 * Clear all reminders (preserves unblockStopCount)
 */
export async function clearReminders(deps: WorkflowDeps): Promise<void> {
  const storage = await readStorage(deps);
  storage.reminders = [];
  await writeStorage(storage, deps);
}

// ===== Templates =====

/**
 * Get templates directory
 */
function getTemplatesDir(deps: WorkflowDeps): string {
  return join(deps.storageDir, "templates");
}

/**
 * Get template file path
 */
function getTemplatePath(name: string, deps: WorkflowDeps): string {
  return join(getTemplatesDir(deps), `${name}.json`);
}

/**
 * Export current reminders as a template
 */
export async function exportTemplate(
  name: string,
  deps: WorkflowDeps
): Promise<void> {
  const storage = await readStorage(deps);
  const templatesDir = getTemplatesDir(deps);
  await mkdir(templatesDir, { recursive: true });
  const path = getTemplatePath(name, deps);
  await Bun.write(path, JSON.stringify(storage, null, 2));
}

/**
 * Import reminders from a template
 */
export async function importTemplate(
  name: string,
  deps: WorkflowDeps
): Promise<void> {
  const path = getTemplatePath(name, deps);
  try {
    const storage = (await Bun.file(path).json()) as WorkflowStorage;
    await writeStorage(storage, deps);
  } catch {
    throw new Error(`Template not found: ${name}`);
  }
}

/**
 * List all available templates
 */
export async function listTemplates(deps: WorkflowDeps): Promise<string[]> {
  const templatesDir = getTemplatesDir(deps);
  try {
    const { readdir } = await import("fs/promises");
    const files = await readdir(templatesDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

// ===== Session Import =====

/**
 * List all sessions with reminders
 */
export async function listSessions(deps: WorkflowDeps): Promise<string[]> {
  try {
    const { readdir } = await import("fs/promises");
    const files = await readdir(deps.storageDir);
    return files
      .filter((f) => f.endsWith(".json") && !f.includes("/") && f !== "templates")
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

/**
 * Import reminders from another session
 */
export async function importFromSession(
  sessionId: string,
  deps: WorkflowDeps
): Promise<void> {
  const sourcePath = join(deps.storageDir, `${sessionId}.json`);
  try {
    const storage = (await Bun.file(sourcePath).json()) as WorkflowStorage;
    await writeStorage(storage, deps);
  } catch {
    throw new Error(`Session not found: ${sessionId}`);
  }
}

// ===== Unblock Stop =====

/**
 * Set the number of allowed stop operations before blocking again
 */
export async function setUnblockStopCount(
  count: number,
  deps: WorkflowDeps
): Promise<void> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Count must be a positive integer");
  }
  const storage = await readStorage(deps);
  storage.unblockStopCount = count;
  await writeStorage(storage, deps);
}

/**
 * Get the current unblock stop count (0 if not set)
 */
export async function getUnblockStopCount(deps: WorkflowDeps): Promise<number> {
  const storage = await readStorage(deps);
  return storage.unblockStopCount ?? 0;
}

/**
 * Decrement the unblock stop count by 1 (minimum 0)
 */
export async function decrementUnblockStopCount(
  deps: WorkflowDeps
): Promise<void> {
  const storage = await readStorage(deps);
  const current = storage.unblockStopCount ?? 0;
  storage.unblockStopCount = Math.max(0, current - 1);
  await writeStorage(storage, deps);
}
