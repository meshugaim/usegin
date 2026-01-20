/**
 * Hook to inject workflow reminders into Claude context
 *
 * Called from Claude hooks (SessionStart, Stop) via stdin JSON:
 * { "session_id": "..." }
 *
 * Outputs XML-formatted reminders to stdout based on frequency.
 * Also checks context utilization and nudges for handoff when high.
 */

import { join } from "path";
import {
  getDefaultStorageDir,
  getUnblockStopCount,
  decrementUnblockStopCount,
  type Reminder,
  type WorkflowDeps,
} from "./workflow";

/**
 * Context thresholds for handoff nudging
 */
const CONTEXT_THRESHOLD_GENTLE = 75; // Start gentle nudging
const CONTEXT_THRESHOLD_URGENT = 80; // Become persistent

/** Debug flag - set via WORKFLOW_DEBUG=1 env var */
const DEBUG = process.env.WORKFLOW_DEBUG === "1";

function debug(msg: string): void {
  if (DEBUG) {
    console.error(`[workflow-hook] ${msg}`);
  }
}

/**
 * Check context utilization using cctx CLI
 * Returns percentage (0-100) or null if unable to check
 */
async function getContextUtilization(sessionId?: string): Promise<number | null> {
  try {
    // Pass session ID if available, otherwise cctx will find most recent
    const args = ["cctx", "--percent"];
    if (sessionId) {
      args.push(sessionId);
    }

    debug(`Running: ${args.join(" ")}`);

    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    debug(`cctx output: "${output.trim()}", stderr: "${stderr.trim()}", exit: ${exitCode}`);

    if (exitCode !== 0 && exitCode !== 2) {
      // exitCode 2 means critical (>90%) but still valid
      debug(`cctx failed with exit code ${exitCode}`);
      return null;
    }

    // Parse "75.3%" -> 75.3
    const match = output.trim().match(/^([\d.]+)%$/);
    if (match) {
      const utilization = parseFloat(match[1]);
      debug(`Context utilization: ${utilization}%`);
      return utilization;
    }
    debug(`Failed to parse cctx output: "${output.trim()}"`);
    return null;
  } catch (err) {
    debug(`cctx exception: ${err}`);
    return null;
  }
}

/**
 * Generate context-based handoff reminder if needed
 */
async function getContextReminder(sessionId?: string): Promise<string | null> {
  const utilization = await getContextUtilization(sessionId);

  if (utilization === null) {
    return null;
  }

  if (utilization >= CONTEXT_THRESHOLD_URGENT) {
    return `⚠️ CONTEXT AT ${utilization.toFixed(0)}% - You should hand off soon. Run /auto-handoff to spawn a continuation agent before context fills up. Wrap up your current thought and hand off.`;
  }

  if (utilization >= CONTEXT_THRESHOLD_GENTLE) {
    return `Context at ${utilization.toFixed(0)}%. Consider wrapping up and running /auto-handoff to hand off to a fresh agent.`;
  }

  return null;
}

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
 * Format reminders as a single XML block with newline-separated items
 */
export function formatReminders(texts: string[]): string {
  if (texts.length === 0) return "";
  return `<workflow-reminders>\n${texts.join("\n")}\n</workflow-reminders>`;
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
 * Includes context-based handoff reminders when utilization is high
 */
export async function injectReminders(deps: HookDeps): Promise<string> {
  const texts: string[] = [];

  // Check context utilization first (pass session ID for accurate lookup)
  const contextReminder = await getContextReminder(deps.sessionId);
  if (contextReminder) {
    texts.push(contextReminder);
  }

  // Then check workflow reminders
  const workflowPath = join(deps.storageDir, `${deps.sessionId}.json`);

  try {
    const file = Bun.file(workflowPath);
    if (await file.exists()) {
      const content = await file.json();

      if (content.reminders && Array.isArray(content.reminders)) {
        const reminders = content.reminders as Reminder[];
        const workflowTexts = reminders
          .filter((r) => shouldShowReminder(r.frequency, deps.random))
          .map((r) => r.text);
        texts.push(...workflowTexts);
      }
    }
  } catch {
    // Ignore workflow file errors
  }

  return formatReminders(texts);
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

  // Has reminders - block and show them with tip
  const tip = "Run workflow unblock-stop to continue (prefer -n 1)";
  return {
    decision: "block",
    reason: `${remindersOutput}\n\n${tip}`,
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
