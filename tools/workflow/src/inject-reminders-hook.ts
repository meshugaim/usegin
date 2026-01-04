/**
 * Hook to inject workflow reminders into Claude context
 *
 * Called from Claude hooks (SessionStart, Stop) via stdin JSON:
 * { "session_id": "..." }
 *
 * Outputs XML-formatted reminders to stdout based on frequency.
 */

import { join } from "path";
import {
  getDefaultStorageDir,
  getUnblockStopCount,
  decrementUnblockStopCount,
  type Reminder,
  type WorkflowDeps,
} from "./workflow";

export interface HookInput {
  session_id: string;
  hook_event_name?: "SessionStart" | "Stop" | string;
}

export interface StopHookDecision {
  decision?: "block";  // undefined = allow, "block" = prevent stopping
  reason?: string;     // required when decision is "block"
}

export interface HookDeps {
  storageDir: string;
  sessionId: string;
  random: () => number;
}

/**
 * Format a reminder as XML tag
 */
export function formatReminder(text: string): string {
  return `<workflow-reminder>${text}</workflow-reminder>`;
}

/**
 * Determine if a reminder should be shown based on its frequency
 * Uses probability: frequency of 0.8 means 80% chance of showing
 */
export function shouldShowReminder(frequency: number, random: () => number): boolean {
  if (frequency <= 0) return false;
  if (frequency >= 1) return true;
  return random() <= frequency;
}

/**
 * Read and filter reminders, returning formatted output
 */
export async function injectReminders(deps: HookDeps): Promise<string> {
  const workflowPath = join(deps.storageDir, `${deps.sessionId}.json`);

  try {
    const file = Bun.file(workflowPath);
    if (!(await file.exists())) {
      return "";
    }

    const content = await file.json();

    if (!content.reminders || !Array.isArray(content.reminders)) {
      return "";
    }

    const reminders = content.reminders as Reminder[];
    const output = reminders
      .filter((r) => shouldShowReminder(r.frequency, deps.random))
      .map((r) => formatReminder(r.text));

    return output.join("\n");
  } catch {
    return "";
  }
}

/**
 * Process Stop hook decision
 *
 * If unblockStopCount > 0: allows stop and decrements counter
 * If unblockStopCount = 0 and reminders exist: blocks with reminders
 * If no reminders: allows stop
 */
export async function processStopHook(deps: HookDeps): Promise<StopHookDecision> {
  const workflowDeps: WorkflowDeps = {
    storageDir: deps.storageDir,
    sessionId: deps.sessionId,
  };

  // Check unblock counter
  const unblockCount = await getUnblockStopCount(workflowDeps);

  if (unblockCount > 0) {
    // Decrement counter and allow
    await decrementUnblockStopCount(workflowDeps);
    return {};  // decision undefined = allow
  }

  // No unblock count - check for reminders
  const remindersOutput = await injectReminders(deps);

  if (!remindersOutput) {
    // No reminders - allow stop
    return {};  // decision undefined = allow
  }

  // Has reminders - block and show them
  return {
    decision: "block",
    reason: remindersOutput,
  };
}

/**
 * Create default dependencies for production use
 * Respects WORKFLOW_STORAGE_DIR env var for testing
 */
export function createDefaultDeps(sessionId: string): HookDeps {
  return {
    storageDir: process.env.WORKFLOW_STORAGE_DIR || getDefaultStorageDir(),
    sessionId,
    random: Math.random,
  };
}

/**
 * Parse hook input from stdin
 */
export async function parseHookInput(): Promise<HookInput | null> {
  try {
    const text = await Bun.stdin.text();
    const parsed = JSON.parse(text.trim());
    return parsed as HookInput;
  } catch {
    return null;
  }
}

/**
 * Get session ID from stdin input or CLAUDE_SESSION_ID env var fallback
 */
export function getSessionId(input: HookInput | null): string | undefined {
  // Prefer stdin session_id, fall back to CLAUDE_SESSION_ID env var
  return input?.session_id || process.env.CLAUDE_SESSION_ID;
}

/**
 * Main entry point when run as hook
 */
export async function main(): Promise<void> {
  const input = await parseHookInput();
  const sessionId = getSessionId(input);

  if (!sessionId) {
    // No session ID from either stdin or env var, nothing to do
    return;
  }

  const deps = createDefaultDeps(sessionId);

  // Check if this is a Stop hook call
  if (input?.hook_event_name === "Stop") {
    const decision = await processStopHook(deps);
    // Output JSON decision for Stop hook
    console.log(JSON.stringify(decision));
    return;
  }

  // For SessionStart and other hooks, output reminders as plain text
  const output = await injectReminders(deps);

  if (output) {
    console.log(output);
  }
}

// Run when executed directly
if (import.meta.main) {
  main();
}
