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
}

/** Partial update for an invocation */
export type InvocationUpdate = Partial<Omit<InvocationEntry, "id">> & {
  id: string;
};

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
