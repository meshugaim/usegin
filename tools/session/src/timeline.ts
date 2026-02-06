/**
 * Timeline event model for chronological session reconstruction.
 *
 * Transforms a ParsedSession into a flat, sorted list of TimelineEvents
 * that interleave user messages, tool calls, subagent lifecycles, commits,
 * and session boundaries into a single chronological stream.
 *
 * This module is pure data transformation — no I/O, no side effects,
 * no formatting. Feed the result into a renderer for display.
 */

import type {
  ParsedSession,
  ParsedSubagent,
  Turn,
  ToolCall,
  AgentId,
  CommitInfo,
} from "./types";
import { getToolCallInput } from "./types";

// ============================================================================
// TYPES
// ============================================================================

export type TimelineEvent =
  | { kind: "session_start"; timestamp: Date }
  | { kind: "user_message"; timestamp: Date; text: string }
  | { kind: "tool_call"; timestamp: Date; toolName: string; summary: string }
  | { kind: "subagent_spawn"; timestamp: Date; agentId: AgentId; description: string }
  | { kind: "subagent_return"; timestamp: Date; agentId: AgentId; turns: number; durationMs?: number }
  | { kind: "commit"; timestamp: Date; hash: string; subject: string }
  | { kind: "session_end"; timestamp: Date; totalDurationMs?: number };

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Truncate a string to maxLen characters, appending "..." if truncated.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

/**
 * Parse an ISO timestamp string to a Date, returning undefined if invalid.
 */
function parseTimestamp(ts: string | undefined): Date | undefined {
  if (!ts) return undefined;
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

/**
 * Summarize a tool call for timeline display.
 *
 * Returns a short, human-readable string describing what the tool call does.
 * Similar to getToolSummary in formatter.ts but tuned for timeline brevity.
 */
export function summarizeToolCall(tc: ToolCall): string {
  const input = tc.input;

  switch (tc.name) {
    case "Read":
      return String(input.file_path || "");
    case "Write":
      return String(input.file_path || "");
    case "Edit":
      return String(input.file_path || "");
    case "Glob":
      return `pattern="${input.pattern || ""}"`;
    case "Grep":
      return `pattern="${input.pattern || ""}"`;
    case "Bash": {
      const cmd = String(input.command || "");
      return truncate(cmd, 60);
    }
    case "Task":
      return truncate(String(input.description || input.prompt || ""), 60);
    case "Skill":
      return String(input.skill || "");
    case "TodoWrite": {
      const todoInput = getToolCallInput("TodoWrite", tc);
      return `${todoInput?.todos.length ?? 0} todos`;
    }
    default: {
      // Return first string value found, truncated
      for (const v of Object.values(input)) {
        if (typeof v === "string" && v.length > 0) {
          return truncate(v, 60);
        }
      }
      return "";
    }
  }
}

/**
 * Compute duration in ms between two Dates.
 * Returns undefined if the delta is negative.
 */
function durationMs(start: Date, end: Date): number | undefined {
  const delta = end.getTime() - start.getTime();
  return delta >= 0 ? delta : undefined;
}

// ============================================================================
// SUBAGENT MATCHING
// ============================================================================

/**
 * Find the last turn timestamp of a subagent, used as its "return" time.
 */
function subagentEndTimestamp(sub: ParsedSubagent): Date | undefined {
  // Walk backwards to find the last turn with a timestamp
  for (let i = sub.turns.length - 1; i >= 0; i--) {
    const ts = parseTimestamp(sub.turns[i]!.timestamp);
    if (ts) return ts;
  }
  return undefined;
}

/**
 * Find the start timestamp of a subagent.
 * Prefers the explicit startTimestamp, falls back to first turn.
 */
function subagentStartTimestamp(sub: ParsedSubagent): Date | undefined {
  return parseTimestamp(sub.startTimestamp) ?? parseTimestamp(sub.turns[0]?.timestamp);
}

/**
 * Build a description for a subagent spawn event.
 *
 * Priority:
 * 1. Task tool call prompt that spawned this subagent (matched via tool result agentId)
 * 2. First assistant turn text, truncated to 80 chars
 * 3. Empty string
 */
function buildSpawnDescription(
  sub: ParsedSubagent,
  mainTurns: Turn[],
): string {
  // Try matching via Task tool call results in the main session
  for (const turn of mainTurns) {
    for (const tr of turn.toolResults) {
      if (tr.content.includes(String(sub.agentId))) {
        const matchingTurn = mainTurns.find((t) =>
          t.toolCalls.some((tc) => tc.id === tr.toolUseId),
        );
        if (matchingTurn) {
          const taskCall = matchingTurn.toolCalls.find(
            (tc) => tc.id === tr.toolUseId,
          );
          if (taskCall) {
            const taskInput = getToolCallInput("Task", taskCall);
            if (taskInput) {
              return truncate(taskInput.prompt || taskInput.description, 80);
            }
          }
        }
      }
    }
  }

  // Fallback: first assistant turn text
  const firstAssistant = sub.turns.find((t) => t.role === "assistant");
  if (firstAssistant?.text) {
    return truncate(firstAssistant.text, 80);
  }

  return "";
}

// ============================================================================
// BUILD TIMELINE
// ============================================================================

/**
 * Build a chronologically sorted timeline from a parsed session.
 *
 * Walks the session's turns, subagents, and commits to produce a flat
 * list of events ordered by timestamp. Events without valid timestamps
 * are silently skipped.
 *
 * @param session - A fully parsed session (with subagents if available)
 * @returns Sorted array of timeline events
 */
export function buildTimeline(session: ParsedSession): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // --- Session start ---
  const startDate = parseTimestamp(session.startTimestamp);
  if (startDate) {
    events.push({ kind: "session_start", timestamp: startDate });
  }

  // --- Main session turns ---
  for (const turn of session.turns) {
    const ts = parseTimestamp(turn.timestamp);
    if (!ts) continue;

    if (turn.role === "user") {
      // Only emit user_message for turns with actual text (not bare tool results)
      if (turn.text) {
        events.push({
          kind: "user_message",
          timestamp: ts,
          text: truncate(turn.text, 80),
        });
      }
    }

    // Tool calls (from assistant turns)
    for (const tc of turn.toolCalls) {
      // Task tool calls get a subagent_spawn event instead of a plain tool_call
      if (tc.name === "Task") {
        // We'll handle subagent spawns separately below to get the agentId
        continue;
      }

      events.push({
        kind: "tool_call",
        timestamp: ts,
        toolName: tc.name,
        summary: summarizeToolCall(tc),
      });
    }
  }

  // --- Subagent spawn and return events ---
  for (const sub of session.subagents) {
    const spawnTs = subagentStartTimestamp(sub);
    if (spawnTs) {
      events.push({
        kind: "subagent_spawn",
        timestamp: spawnTs,
        agentId: sub.agentId,
        description: buildSpawnDescription(sub, session.turns),
      });
    }

    const endTs = subagentEndTimestamp(sub);
    if (endTs) {
      const startTs = subagentStartTimestamp(sub);
      events.push({
        kind: "subagent_return",
        timestamp: endTs,
        agentId: sub.agentId,
        turns: sub.turns.length,
        ...(startTs ? { durationMs: durationMs(startTs, endTs) } : {}),
      });
    }
  }

  // --- Commit events ---
  // Prefer gitCommits (from git log) if available, fall back to regex-extracted commits
  const commits: CommitInfo[] = session.commits;
  for (const commit of commits) {
    // CommitInfo doesn't have a timestamp, so we can't place these precisely.
    // If a GitCommit (from git-commits.ts) is in use and has a timestamp, it
    // would be on a different field. For now, skip commits without timestamps.
    // However, we check if the commit object has a timestamp property (duck typing
    // for GitCommit which extends CommitInfo with extra fields).
    const commitAny = commit as Record<string, unknown>;
    const commitTs = parseTimestamp(commitAny.timestamp as string | undefined);
    if (commitTs) {
      events.push({
        kind: "commit",
        timestamp: commitTs,
        hash: commit.hash,
        subject: commit.message ?? "",
      });
    }
  }

  // --- Session end ---
  const endDate = parseTimestamp(session.endTimestamp);
  if (endDate) {
    const totalMs = startDate ? durationMs(startDate, endDate) : undefined;
    events.push({
      kind: "session_end",
      timestamp: endDate,
      ...(totalMs !== undefined ? { totalDurationMs: totalMs } : {}),
    });
  }

  // --- Sort chronologically ---
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return events;
}
