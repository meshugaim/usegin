/**
 * tdd-shared/events — append-only events.jsonl writer/reader.
 *
 * Per design memo §4c: events.jsonl records every spawn, every verdict,
 * every state transition, every diff inspection. One JSON object per line,
 * always carrying a UTC ISO timestamp at `ts`.
 *
 * Schema is intentionally loose — `kind` is a free-form string so each
 * skill can name its own event types — but `ts`, `kind`, optional `phase`,
 * optional `cycle_index`, and optional `data` are stable.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "fs";
import { join } from "path";
import type { Phase } from "./state";

export const EVENTS_FILENAME = "events.jsonl";

export interface Event {
  ts: string;
  kind: string;
  phase?: Phase;
  cycle_index?: number;
  data?: unknown;
  /** Free-form fields are permitted; we don't fight the worker-reviewer
   *  legacy events that carried `actor`, `event`, etc. */
  [k: string]: unknown;
}

function eventsPath(workspace: string): string {
  return join(workspace, EVENTS_FILENAME);
}

function ensureWorkspace(workspace: string): void {
  if (!existsSync(workspace)) {
    mkdirSync(workspace, { recursive: true });
  }
}

/**
 * Append one event to events.jsonl. Stamps `ts` automatically.
 *
 * Caller may supply `phase`, `cycle_index`, `data`, and any other fields.
 * The legacy worker-reviewer code stamps {actor, event, ...rest} — that
 * shape is fine; it goes in via `e` directly.
 */
export function appendEvent(
  workspace: string,
  e: Omit<Event, "ts"> & Record<string, unknown>,
): void {
  ensureWorkspace(workspace);
  const stamped: Event = { ts: new Date().toISOString(), ...e };
  appendFileSync(eventsPath(workspace), JSON.stringify(stamped) + "\n");
}

/**
 * Read all events from events.jsonl. Returns [] if file is missing.
 * Skips malformed lines silently — the file is append-only and partial
 * lines (from a crashed process) shouldn't block readers.
 */
export function readEvents(workspace: string): Event[] {
  const p = eventsPath(workspace);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf-8");
  const out: Event[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as Event);
    } catch {
      // skip malformed line
    }
  }
  return out;
}
