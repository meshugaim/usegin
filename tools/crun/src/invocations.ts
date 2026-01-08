/**
 * Invocation tracking for crun
 *
 * Stores invocations in append-only JSONL format.
 * Latest entry for each ID wins (enables partial updates).
 */

import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";
import { nanoid } from "nanoid";

/** Status of an invocation */
export type InvocationStatus = "running" | "completed" | "failed";

/** A tracked invocation entry */
export interface InvocationEntry {
  /** Short ID (6-8 chars) */
  id: string;
  /** Claude session ID (UUID) */
  sessionId: string;
  /** Process ID */
  pid: number;
  /** ISO timestamp when started */
  startedAt: string;
  /** ISO timestamp when completed (optional) */
  completedAt?: string;
  /** Exit code (optional, set on completion) */
  exitCode?: number;
  /** Note from spawner about what to do after (optional) */
  noteToSelf?: string;
  /** The prompt (truncated to ~100 chars) */
  prompt: string;
  /** Working directory */
  cwd: string;
  /** Current status */
  status: InvocationStatus;
  /** Number of times this session has been resumed (0 for original) */
  resumeCount?: number;
}

/** Filter options for listing invocations */
export interface ListInvocationsOptions {
  /** Only show running invocations */
  running?: boolean;
  /** Only show invocations from today */
  today?: boolean;
  /** Limit number of results */
  limit?: number;
}

/**
 * Generate a short invocation ID (6-8 chars)
 */
export function generateInvocationId(): string {
  return nanoid(8);
}

/**
 * Get default invocations file path
 */
export function getInvocationsPath(): string {
  return join(homedir(), ".crun", "invocations.jsonl");
}

/**
 * Truncate prompt to ~100 chars with ellipsis
 */
function truncatePrompt(prompt: string, maxLength = 100): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }
  return prompt.slice(0, maxLength) + "...";
}

/**
 * Record a new invocation (append to JSONL)
 */
export async function recordInvocation(
  entry: InvocationEntry,
  filePath: string = getInvocationsPath()
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  const entryToWrite = {
    ...entry,
    prompt: truncatePrompt(entry.prompt),
  };

  const line = JSON.stringify(entryToWrite) + "\n";

  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (exists) {
    const existing = await file.text();
    await Bun.write(filePath, existing + line);
  } else {
    await Bun.write(filePath, line);
  }
}

/**
 * Update an existing invocation (append update entry with same ID)
 */
export async function updateInvocation(
  id: string,
  updates: Partial<Omit<InvocationEntry, "id">>,
  filePath: string = getInvocationsPath()
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  const updateEntry = { id, ...updates };
  const line = JSON.stringify(updateEntry) + "\n";

  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (exists) {
    const existing = await file.text();
    await Bun.write(filePath, existing + line);
  } else {
    await Bun.write(filePath, line);
  }
}

/**
 * Check if a date is today (same day in local timezone)
 */
function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * List invocations with optional filtering
 *
 * Reads JSONL file, deduplicates by ID (latest wins),
 * applies filters, and returns sorted by most recent first.
 */
export async function listInvocations(
  options: ListInvocationsOptions = {},
  filePath: string = getInvocationsPath()
): Promise<InvocationEntry[]> {
  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (!exists) {
    return [];
  }

  const content = await file.text();
  if (!content.trim()) {
    return [];
  }

  const lines = content.trim().split("\n");

  // Parse and dedupe by ID (latest wins, merge with previous)
  const entriesById = new Map<string, InvocationEntry>();

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as Partial<InvocationEntry> & { id: string };
      const existing = entriesById.get(entry.id);
      if (existing) {
        // Merge: existing fields + new fields (new fields override)
        entriesById.set(entry.id, { ...existing, ...entry } as InvocationEntry);
      } else {
        entriesById.set(entry.id, entry as InvocationEntry);
      }
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  let results = Array.from(entriesById.values());

  // Apply filters
  if (options.running) {
    results = results.filter((e) => e.status === "running");
  }

  if (options.today) {
    results = results.filter((e) => e.startedAt && isToday(e.startedAt));
  }

  // Sort by startedAt descending (most recent first)
  results.sort((a, b) => {
    const timeA = new Date(a.startedAt || 0).getTime();
    const timeB = new Date(b.startedAt || 0).getTime();
    return timeB - timeA;
  });

  // Apply limit
  if (options.limit !== undefined && options.limit > 0) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Get a single invocation by ID
 *
 * Returns the merged invocation entry or null if not found.
 */
export async function getInvocation(
  id: string,
  filePath: string = getInvocationsPath()
): Promise<InvocationEntry | null> {
  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (!exists) {
    return null;
  }

  const content = await file.text();
  if (!content.trim()) {
    return null;
  }

  const lines = content.trim().split("\n");

  // Parse and merge entries for this ID
  let result: InvocationEntry | null = null;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as Partial<InvocationEntry> & { id: string };
      if (entry.id === id) {
        if (result) {
          result = { ...result, ...entry } as InvocationEntry;
        } else {
          result = entry as InvocationEntry;
        }
      }
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return result;
}

/** Result of attempting to kill an invocation */
export type KillResult = {
  status: "killed" | "not_found" | "already_stopped" | "process_not_found" | "kill_failed";
  message: string;
};

/**
 * Check if a process exists
 */
export function processExists(pid: number): boolean {
  try {
    // Sending signal 0 checks if process exists without actually sending a signal
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill a running invocation by ID
 *
 * Sends SIGTERM to the worker process and updates tracking.
 * Handles various edge cases like already stopped or stale entries.
 */
export async function killInvocation(
  id: string,
  filePath: string = getInvocationsPath()
): Promise<KillResult> {
  const invocation = await getInvocation(id, filePath);

  if (!invocation) {
    return {
      status: "not_found",
      message: `Invocation '${id}' not found`,
    };
  }

  // Check if already stopped
  if (invocation.status === "completed" || invocation.status === "failed") {
    return {
      status: "already_stopped",
      message: `Invocation '${id}' already stopped (${invocation.status})`,
    };
  }

  // Check if process still exists
  if (!processExists(invocation.pid)) {
    // Mark as failed since process is gone but wasn't properly tracked
    await updateInvocation(id, {
      status: "failed",
      completedAt: new Date().toISOString(),
    }, filePath);

    return {
      status: "process_not_found",
      message: `Process ${invocation.pid} no longer exists. Marked invocation as failed.`,
    };
  }

  // Try to kill the process
  try {
    process.kill(invocation.pid, "SIGTERM");

    // Update invocation status
    await updateInvocation(id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      exitCode: -15, // SIGTERM signal number (negated by convention)
    }, filePath);

    return {
      status: "killed",
      message: `Sent SIGTERM to process ${invocation.pid}`,
    };
  } catch (error) {
    return {
      status: "kill_failed",
      message: `Failed to kill process ${invocation.pid}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get the resume count for a session
 *
 * Returns the number of invocations for this session.
 * If this is a new session, returns 0.
 * If there's been one invocation, returns 1 (the next would be the 1st resume).
 */
export async function getResumeCountForSession(
  sessionId: string,
  filePath: string = getInvocationsPath()
): Promise<number> {
  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (!exists) {
    return 0;
  }

  const content = await file.text();
  if (!content.trim()) {
    return 0;
  }

  const lines = content.trim().split("\n");

  // Track unique invocation IDs for this session
  const invocationIds = new Set<string>();

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as Partial<InvocationEntry> & { id: string };
      // Only count entries that have sessionId matching and appear to be original records
      // (have startedAt field, not just updates)
      if (entry.sessionId === sessionId && entry.startedAt) {
        invocationIds.add(entry.id);
      }
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return invocationIds.size;
}

/**
 * Clean up stale invocations where PID no longer exists
 *
 * Finds all "running" invocations and checks if the process still exists.
 * If not, marks them as "failed".
 *
 * Returns the number of stale entries cleaned up.
 */
export async function cleanupStaleInvocations(
  filePath: string = getInvocationsPath()
): Promise<number> {
  const invocations = await listInvocations({ running: true }, filePath);
  let cleaned = 0;

  for (const inv of invocations) {
    if (!processExists(inv.pid)) {
      await updateInvocation(inv.id, {
        status: "failed",
        completedAt: new Date().toISOString(),
      }, filePath);
      cleaned++;
    }
  }

  return cleaned;
}
