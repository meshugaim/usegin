/**
 * Hook to inject workflow reminders into Claude context
 *
 * Called from Claude hooks (SessionStart, Stop) via stdin JSON:
 * { "session_id": "..." }
 *
 * Outputs XML-formatted reminders to stdout based on frequency.
 * Also checks context utilization and nudges for handoff when high.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getDefaultStorageDir,
  getUnblockStopCount,
  decrementUnblockStopCount,
  type Reminder,
  type WorkflowDeps,
} from "./workflow";

import { homedir } from "os";

// Resolve absolute path to cctx (relative to this file: ../../cctx/src/cli.ts)
const __dirname = dirname(fileURLToPath(import.meta.url));
const CCTX_PATH = join(__dirname, "..", "..", "cctx", "src", "cli.ts");

/**
 * Get the path to Claude's user config.
 * Uses CLAUDE_CONFIG_PATH env var for testing, otherwise ~/.claude.json
 */
export function getClaudeConfigPath(): string {
  return process.env.CLAUDE_CONFIG_PATH || join(homedir(), ".claude.json");
}

/**
 * Check if auto-handoff is enabled in user's Claude config (~/.claude.json)
 * Returns false if not set or on any error (fail-safe to default behavior)
 */
export async function isAutoHandoffEnabled(): Promise<boolean> {
  try {
    const configPath = getClaudeConfigPath();
    const file = Bun.file(configPath);
    if (!(await file.exists())) {
      return false;
    }
    const config = await file.json();
    return config.autoHandoffEnabled === true;
  } catch {
    return false;
  }
}

/**
 * Context thresholds for handoff (exported for testing)
 */
export const CONTEXT_THRESHOLD_WARNING = 75; // Warning - suggest handoff
export const CONTEXT_THRESHOLD_MANDATORY = 85; // Mandatory - must hand off immediately

/**
 * Context reminder result
 */
export interface ContextReminder {
  message: string;
  mandatory: boolean;
}

/**
 * Pure function to generate context reminder based on utilization percentage.
 * Exported for testing.
 */
export function getContextReminderFromUtilization(utilization: number): ContextReminder | null {
  if (utilization >= CONTEXT_THRESHOLD_MANDATORY) {
    return {
      message: `🛑 CONTEXT AT ${utilization.toFixed(0)}% - MANDATORY HANDOFF REQUIRED. You MUST run /handoff NOW. Do not continue with any other work. This is not optional. Execute the handoff skill immediately.`,
      mandatory: true,
    };
  }

  if (utilization >= CONTEXT_THRESHOLD_WARNING) {
    return {
      message: `Context at ${utilization.toFixed(0)}%. Consider wrapping up your current task and running /handoff to hand off to a fresh agent.`,
      mandatory: false,
    };
  }

  return null;
}

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
    // Use absolute path to cctx to avoid PATH issues in hooks
    const args = ["bun", CCTX_PATH, "--percent"];
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
 * Generate context-based handoff reminder if needed.
 * Only checks context if autoHandoffEnabled is true in ~/.claude.json
 */
async function getContextReminder(sessionId?: string): Promise<ContextReminder | null> {
  // Check if auto-handoff is enabled in user config
  const enabled = await isAutoHandoffEnabled();
  if (!enabled) {
    debug("Auto-handoff not enabled, skipping context check");
    return null;
  }

  const utilization = await getContextUtilization(sessionId);

  if (utilization === null) {
    return null;
  }

  return getContextReminderFromUtilization(utilization);
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
 * Result from injecting reminders
 */
export interface InjectRemindersResult {
  output: string;
  mandatoryHandoff: boolean;
}

/**
 * Read and filter reminders, returning formatted output
 * Includes context-based handoff reminders when utilization is high
 */
export async function injectReminders(deps: HookDeps): Promise<InjectRemindersResult> {
  const texts: string[] = [];
  let mandatoryHandoff = false;

  // Check context utilization first (pass session ID for accurate lookup)
  const contextReminder = await getContextReminder(deps.sessionId);
  if (contextReminder) {
    texts.push(contextReminder.message);
    mandatoryHandoff = contextReminder.mandatory;
  }

  // Then check workflow reminders (skip if mandatory handoff - don't clutter)
  if (!mandatoryHandoff) {
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
  }

  return {
    output: formatReminders(texts),
    mandatoryHandoff,
  };
}

/**
 * Process Stop hook decision
 *
 * If mandatory handoff: always blocks, no unblock allowed
 * If unblockStopCount > 0: allows stop and decrements counter
 * If unblockStopCount = 0 and reminders exist: blocks with reminders
 * If no reminders: allows stop
 */
export async function processStopHook(deps: HookDeps): Promise<StopHookDecision> {
  // Check for reminders first to detect mandatory handoff
  const remindersResult = await injectReminders(deps);

  // Mandatory handoff - always block, no exceptions
  if (remindersResult.mandatoryHandoff) {
    return {
      decision: "block",
      reason: remindersResult.output,
    };
  }

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

  if (!remindersResult.output) {
    // No reminders - allow stop
    return {};  // decision undefined = allow
  }

  // Has reminders - block and show them with tip
  const tip = "Run workflow unblock-stop to continue (prefer -n 1)";
  return {
    decision: "block",
    reason: `${remindersResult.output}\n\n${tip}`,
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
    debug(`Stdin text: "${text.substring(0, 100)}"`);
    if (!text.trim()) {
      debug("Empty stdin, returning null");
      return null;
    }
    const parsed = JSON.parse(text.trim());
    debug(`Parsed input: session_id=${parsed.session_id}, hook_event_name=${parsed.hook_event_name}`);
    return parsed as HookInput;
  } catch (err) {
    debug(`Parse error: ${err}`);
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
  const result = await injectReminders(deps);

  if (result.output) {
    console.log(result.output);
  }
}

// Run when executed directly
if (import.meta.main) {
  main();
}
