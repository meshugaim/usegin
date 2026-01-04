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
  return join(getTemplatesDir(deps), `${name}.txt`);
}

/**
 * Export current reminders as a template
 */
export async function exportTemplate(
  name: string,
  deps: WorkflowDeps
): Promise<void> {
  const reminders = await readReminders(deps);
  const templatesDir = getTemplatesDir(deps);
  await mkdir(templatesDir, { recursive: true });
  const path = getTemplatePath(name, deps);
  await Bun.write(path, reminders.join("\n"));
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
    const content = await Bun.file(path).text();
    const reminders = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    await writeReminders(reminders, deps);
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
      .filter((f) => f.endsWith(".txt"))
      .map((f) => f.replace(/\.txt$/, ""));
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
      .filter((f) => f.endsWith(".txt") && !f.includes("/"))
      .map((f) => f.replace(/\.txt$/, ""));
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
  const sourcePath = join(deps.storageDir, `${sessionId}.txt`);
  try {
    const content = await Bun.file(sourcePath).text();
    const reminders = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    await writeReminders(reminders, deps);
  } catch {
    throw new Error(`Session not found: ${sessionId}`);
  }
}
