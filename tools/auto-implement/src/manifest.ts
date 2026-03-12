/**
 * Run manifest — JSONL log of everything that happens during an auto-implement run.
 * Each line is a self-contained JSON event. Designed for retro analysis.
 */

import { appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

export type EventType =
  | "run_started"
  | "session_started"
  | "session_completed"
  | "session_failed"
  | "handoff_detected"
  | "rotation_detected"
  | "handoff_writer_started"
  | "handoff_writer_completed"
  | "handoff_writer_failed"
  | "completion_detected"
  | "pause_waiting"
  | "pause_resumed"
  | "run_completed"
  | "run_stopped";

export interface ManifestEvent {
  timestamp: string;
  event: EventType;
  runId: string;
  specId: string;
  sessionNumber?: number;
  sessionId?: string;
  /** Duration in seconds */
  durationSeconds?: number;
  /** Path to handoff file written this session */
  handoffFile?: string;
  /** Exit code from claude -p */
  exitCode?: number;
  /** Total sessions completed so far */
  totalSessions?: number;
  /** Max sessions allowed */
  maxSessions?: number;
  /** Free-form details */
  details?: string;
}

/**
 * Default directory for auto-implement runs
 */
export function getRunsDir(): string {
  return join(homedir(), ".auto-implement", "runs");
}

/**
 * Get the directory for a specific run
 */
export function getRunDir(runId: string): string {
  return join(getRunsDir(), runId);
}

/**
 * Get the manifest file path for a run
 */
export function getManifestPath(runDir: string): string {
  return join(runDir, "manifest.jsonl");
}

/**
 * Generate a run ID: YYYYMMDD_HHMMSS_specid
 */
export function generateRunId(specId: string): string {
  const now = new Date();
  const ts = now
    .toISOString()
    .replace(/[-:T]/g, "")
    .replace(/\.\d+Z/, "")
    .replace(/(\d{8})(\d{6})/, "$1_$2");
  // Sanitize spec ID for filesystem
  const safe = specId.replace(/[^a-zA-Z0-9-]/g, "_").toLowerCase();
  return `${ts}_${safe}`;
}

/**
 * Append an event to the manifest JSONL file
 */
export async function appendEvent(
  runDir: string,
  event: ManifestEvent
): Promise<void> {
  await mkdir(runDir, { recursive: true });
  const line = JSON.stringify(event) + "\n";
  await appendFile(getManifestPath(runDir), line);
}

/**
 * Read all events from a manifest
 */
export async function readManifest(
  runDir: string
): Promise<ManifestEvent[]> {
  const path = getManifestPath(runDir);
  const file = Bun.file(path);
  if (!(await file.exists())) return [];
  const text = await file.text();
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
