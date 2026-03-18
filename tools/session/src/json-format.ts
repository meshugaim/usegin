/**
 * JSON output builder for session CLI.
 *
 * Constructs the structured JSON representation of a parsed session,
 * including full turn data with tool calls/results. Used by the
 * `--format json` output mode.
 *
 * Tool result content respects the truncate setting:
 * - truncateLength > 0: content is truncated to that many characters
 * - truncateLength === 0: no truncation (full content preserved)
 */

import type { ParsedSession } from "./types";
import { computeStats, type SessionStats } from "./stats";
import { truncate } from "./format-utils";

/**
 * Shape of a single turn in JSON output.
 *
 * Designed for programmatic consumption — every field is always present
 * (no conditional omission) so consumers can rely on the shape.
 */
export interface JsonTurn {
  index: number;
  role: "user" | "assistant";
  text: string;
  timestamp: string | null;
  isOnCurrentBranch: boolean;
  toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  toolResults: Array<{
    toolUseId: string;
    content: string;
    isError: boolean;
  }>;
}

/**
 * Shape of the full JSON output object.
 *
 * Includes session metadata, stats from computeStats(), and the
 * full turns array. The `totalTurnCount` field preserves the total
 * count even when windowed output (e.g., --since-turn) is used.
 */
export interface JsonOutput extends SessionStats {
  sessionId: string;
  slug: string | null;
  model: string;
  cwd: string;
  summary: string | null;
  startTimestamp: string | null;
  endTimestamp: string | null;
  totalTurnCount: number;
  turns: JsonTurn[];
}

/**
 * Build the structured JSON output for a session.
 *
 * @param session - The parsed session to serialize
 * @param truncateLength - Max characters for tool result content (0 = unlimited)
 * @returns A plain object ready for JSON.stringify()
 */
export function buildJsonOutput(
  session: ParsedSession,
  truncateLength: number
): JsonOutput {
  const stats = computeStats(session);

  const turns: JsonTurn[] = session.turns.map((turn, i) => ({
    index: i,
    role: turn.role,
    text: turn.text,
    timestamp: turn.timestamp ?? null,
    isOnCurrentBranch: turn.isOnCurrentBranch,
    toolCalls: turn.toolCalls.map((tc) => ({
      id: String(tc.id),
      name: tc.name,
      input: tc.input,
    })),
    toolResults: turn.toolResults.map((tr) => ({
      toolUseId: String(tr.toolUseId),
      content:
        truncateLength === 0
          ? tr.content
          : truncate(tr.content, truncateLength),
      isError: tr.isError,
    })),
  }));

  return {
    sessionId: String(session.sessionId),
    slug: session.slug ?? null,
    model: session.model,
    cwd: session.cwd,
    summary: session.summary ?? null,
    startTimestamp: session.startTimestamp ?? null,
    endTimestamp: session.endTimestamp ?? null,
    ...stats,
    totalTurnCount: stats.turnCount.total,
    turns,
  };
}
