/**
 * Token usage aggregation across turns.
 *
 * Extracted from parser.ts — provides a reusable helper for summing
 * per-turn token usage (used by subagent parsing).
 */

import type { Turn, TokenUsage } from "./types";

/**
 * Aggregate token usage from turns that carry per-turn data.
 *
 * Sums inputTokens, outputTokens, cacheCreationInputTokens, and
 * cacheReadInputTokens across all turns that have a tokenUsage field.
 * Returns undefined if no turns have token data.
 */
export function aggregateTokenUsage(turns: Turn[]): TokenUsage | undefined {
  const turnsWithTokens = turns.filter((t) => t.tokenUsage);
  if (turnsWithTokens.length === 0) return undefined;

  return turnsWithTokens.reduce(
    (acc, t) => ({
      inputTokens: acc.inputTokens + t.tokenUsage!.inputTokens,
      outputTokens: acc.outputTokens + t.tokenUsage!.outputTokens,
      cacheCreationInputTokens:
        acc.cacheCreationInputTokens + t.tokenUsage!.cacheCreationInputTokens,
      cacheReadInputTokens:
        acc.cacheReadInputTokens + t.tokenUsage!.cacheReadInputTokens,
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    }
  );
}
