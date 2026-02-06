/**
 * Compute aggregate statistics from a parsed session.
 *
 * Pure data aggregation — no formatting, no side effects.
 * Feed the result into a formatter for display.
 */

import type { ParsedSession, ParsedSubagent, Turn, ToolCall, AgentId, TokenUsage } from "./types";
import { getToolCallInput } from "./types";
import type { GitCommit } from "./git-commits";

// ============================================================================
// TYPES
// ============================================================================

export interface SessionStats {
  turnCount: { total: number; user: number; assistant: number };
  toolCounts: Record<string, number>; // tool name -> call count, sorted by count desc
  subagentSummaries: SubagentSummary[];
  commitCount: number;
  /** Rich commit data from git history, when available */
  gitCommits?: GitCommit[];
  rewindCount: number;
  /** Total session duration from result entry, if available */
  durationMs?: number;
  /** Total session cost from result entry, if available */
  costUsd?: number;
  /** Aggregated token usage across all assistant turns, if available */
  tokenUsage?: TokenUsage;
}

export interface SubagentSummary {
  agentId: AgentId;
  /** Description from the Task tool call that spawned this subagent, or first assistant text (truncated to 80 chars) */
  description: string;
  turns: number;
  toolCalls: number;
  /** Duration from first to last turn timestamp, if available */
  durationMs?: number;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Count tool calls across a list of turns.
 * Only assistant turns have meaningful tool calls, but we count all
 * to stay honest about the data.
 */
function countToolCalls(turns: Turn[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const turn of turns) {
    for (const tc of turn.toolCalls) {
      counts[tc.name] = (counts[tc.name] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Sort a record by value descending, returning a new object with
 * entries in sorted order. (Object key order is preserved in modern JS.)
 */
function sortByCountDesc(counts: Record<string, number>): Record<string, number> {
  const entries = Object.entries(counts);
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries);
}

/**
 * Total the tool calls from a counts record.
 */
function totalToolCalls(turns: Turn[]): number {
  let total = 0;
  for (const turn of turns) {
    total += turn.toolCalls.length;
  }
  return total;
}

/**
 * Try to find the Task tool call in the main session that spawned a subagent.
 *
 * The Task tool call result typically contains the agentId. We look through
 * assistant turns for Task tool calls and match by examining the tool call's
 * prompt/description fields.
 *
 * Returns the description (truncated to 80 chars) or undefined if not found.
 */
function findSubagentDescription(
  mainTurns: Turn[],
  agentId: AgentId
): string | undefined {
  for (const turn of mainTurns) {
    for (const tc of turn.toolCalls) {
      const taskInput = getToolCallInput("Task", tc);
      if (!taskInput) continue;

      // We can't reliably match by agentId from the tool call alone
      // (the agentId appears in the result, not the input), so we return
      // undefined here and let the caller fall back to first assistant text.
      // This is a best-effort heuristic — a future enhancement could match
      // Task tool results to agentIds via the toolResults on the user turn.
    }
  }
  return undefined;
}

/**
 * Build a description for a subagent.
 *
 * Priority:
 * 1. The Task tool call prompt that spawned this subagent (if we can match it)
 * 2. The first assistant turn's text, truncated to 80 characters
 * 3. Empty string as last resort
 */
function buildSubagentDescription(
  subagent: ParsedSubagent,
  mainTurns: Turn[]
): string {
  // Try matching via Task tool call results in the main session
  // Look through user turns for tool results that mention this agentId
  for (const turn of mainTurns) {
    for (const tr of turn.toolResults) {
      if (tr.content.includes(String(subagent.agentId))) {
        // Found the result — now find the corresponding Task tool call
        const matchingTurn = mainTurns.find((t) =>
          t.toolCalls.some((tc) => tc.id === tr.toolUseId)
        );
        if (matchingTurn) {
          const taskCall = matchingTurn.toolCalls.find(
            (tc) => tc.id === tr.toolUseId
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
  const firstAssistant = subagent.turns.find((t) => t.role === "assistant");
  if (firstAssistant && firstAssistant.text) {
    return truncate(firstAssistant.text, 80);
  }

  return "";
}

/**
 * Truncate a string to maxLen characters, appending "..." if truncated.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

/**
 * Compute duration in ms between two ISO timestamp strings.
 * Returns undefined if either timestamp is missing or unparseable.
 */
function computeDurationMs(
  first: string | undefined,
  last: string | undefined
): number | undefined {
  if (!first || !last) return undefined;
  const startMs = new Date(first).getTime();
  const endMs = new Date(last).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return undefined;
  const delta = endMs - startMs;
  return delta >= 0 ? delta : undefined;
}

/**
 * Build a SubagentSummary from a ParsedSubagent.
 */
function summarizeSubagent(
  subagent: ParsedSubagent,
  mainTurns: Turn[]
): SubagentSummary {
  const description = buildSubagentDescription(subagent, mainTurns);
  const toolCallCount = totalToolCalls(subagent.turns);

  const firstTs = subagent.startTimestamp ?? subagent.turns[0]?.timestamp;
  const lastTs = subagent.turns[subagent.turns.length - 1]?.timestamp;
  const durationMs = computeDurationMs(firstTs, lastTs);

  return {
    agentId: subagent.agentId,
    description,
    turns: subagent.turns.length,
    toolCalls: toolCallCount,
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Compute aggregate statistics from a parsed session.
 *
 * This is a pure function — no I/O, no side effects.
 * Pass the result to a stats formatter for display.
 *
 * @example
 * ```ts
 * const session = parseSession(filePath);
 * const stats = computeStats(session);
 * console.log(`${stats.turnCount.total} turns, ${stats.commitCount} commits`);
 * ```
 */
export function computeStats(session: ParsedSession): SessionStats {
  const userCount = session.turns.filter((t) => t.role === "user").length;
  const assistantCount = session.turns.filter(
    (t) => t.role === "assistant"
  ).length;

  const rawCounts = countToolCalls(session.turns);
  const toolCounts = sortByCountDesc(rawCounts);

  const subagentSummaries = session.subagents.map((sub) =>
    summarizeSubagent(sub, session.turns)
  );

  // Prefer git-history commits over regex-extracted commits when available
  const hasGitCommits = session.gitCommits && session.gitCommits.length > 0;
  const commitCount = hasGitCommits
    ? session.gitCommits!.length
    : session.commits.length;

  return {
    turnCount: {
      total: session.turns.length,
      user: userCount,
      assistant: assistantCount,
    },
    toolCounts,
    subagentSummaries,
    commitCount,
    ...(hasGitCommits ? { gitCommits: session.gitCommits } : {}),
    rewindCount: session.rewinds.length,
    ...(session.result
      ? {
          durationMs: session.result.durationMs,
          ...(session.result.costUsd !== undefined
            ? { costUsd: session.result.costUsd }
            : {}),
        }
      : {}),
    ...(session.tokenUsage ? { tokenUsage: session.tokenUsage } : {}),
  };
}
