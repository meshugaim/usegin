/**
 * Anthropic model pricing and cost estimation.
 *
 * Provides a pricing table for known Claude models and functions to compute
 * estimated session cost from token usage data.
 *
 * Prices last verified: 2025-02 (https://docs.anthropic.com/en/docs/about-claude/pricing)
 * Standard cache ratios: write = 1.25x input, read = 0.1x input
 */

import type { TurnTokenUsage } from "./types";

// ============================================================================
// TYPES
// ============================================================================

/** Per-million-token pricing for a single model. */
export interface ModelPricing {
  /** USD per 1M input tokens (non-cached) */
  inputPerMillion: number;
  /** USD per 1M output tokens */
  outputPerMillion: number;
  /** USD per 1M cache write tokens (1.25x input) */
  cacheWritePerMillion: number;
  /** USD per 1M cache read tokens (0.1x input) */
  cacheReadPerMillion: number;
}

// ============================================================================
// PRICING TABLE
// ============================================================================

/**
 * Known model pricing, keyed by canonical model ID.
 *
 * When updating: check https://docs.anthropic.com/en/docs/about-claude/pricing
 * Cache write = 1.25x input. Cache read = 0.1x input.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-5-20250929": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  "claude-opus-4-6": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.5,
  },
  "claude-haiku-4-5-20251001": {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cacheWritePerMillion: 1.0,
    cacheReadPerMillion: 0.08,
  },
};

// ============================================================================
// FUZZY MATCHING
// ============================================================================

/**
 * Prefixes used for fuzzy model matching, ordered longest-first so that
 * more-specific prefixes win (e.g. "claude-sonnet-4-5" before "claude-sonnet-4").
 *
 * Each prefix maps to the canonical model ID in MODEL_PRICING.
 */
const MODEL_PREFIX_MAP: [prefix: string, canonicalId: string][] = [
  // Sonnet 4.5
  ["claude-sonnet-4-5", "claude-sonnet-4-5-20250929"],
  // Opus 4.6
  ["claude-opus-4-6", "claude-opus-4-6"],
  ["claude-opus-4", "claude-opus-4-6"],
  // Haiku 4.5
  ["claude-haiku-4-5", "claude-haiku-4-5-20251001"],
];

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Look up pricing for a model string.
 *
 * Tries an exact match first, then falls back to prefix-based fuzzy matching.
 * Model strings in session files typically look like "claude-opus-4-6" or
 * "claude-sonnet-4-5-20250929".
 *
 * Returns undefined for unknown models — callers decide how to handle that.
 *
 * @example
 * ```ts
 * const pricing = getModelPricing("claude-sonnet-4-5-20250929");
 * if (pricing) {
 *   const cost = estimateCost(tokenUsage, pricing);
 * }
 * ```
 */
export function getModelPricing(model: string): ModelPricing | undefined {
  if (!model) return undefined;

  // Exact match
  if (MODEL_PRICING[model]) {
    return MODEL_PRICING[model];
  }

  // Prefix match — first matching prefix wins (longest prefixes are listed first)
  for (const [prefix, canonicalId] of MODEL_PREFIX_MAP) {
    if (model.startsWith(prefix)) {
      return MODEL_PRICING[canonicalId];
    }
  }

  return undefined;
}

/**
 * Estimate the cost in USD for a set of token usage at the given pricing.
 *
 * @param tokenUsage - Token counts from a turn or session
 * @param pricing - Per-million-token rates for the model
 * @returns Estimated cost in USD
 *
 * @example
 * ```ts
 * const cost = estimateCost(
 *   { inputTokens: 100_000, outputTokens: 50_000, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
 *   { inputPerMillion: 3.0, outputPerMillion: 15.0, cacheWritePerMillion: 3.75, cacheReadPerMillion: 0.3 },
 * );
 * // cost = 0.30 + 0.75 = $1.05
 * ```
 */
export function estimateCost(
  tokenUsage: TurnTokenUsage,
  pricing: ModelPricing,
): number {
  const perMillion = 1_000_000;
  return (
    (tokenUsage.inputTokens / perMillion) * pricing.inputPerMillion +
    (tokenUsage.outputTokens / perMillion) * pricing.outputPerMillion +
    (tokenUsage.cacheCreationInputTokens / perMillion) *
      pricing.cacheWritePerMillion +
    (tokenUsage.cacheReadInputTokens / perMillion) * pricing.cacheReadPerMillion
  );
}

/**
 * Format a USD cost as a human-readable string.
 *
 * - Amounts >= $0.01: two decimal places ("$0.42", "$12.34")
 * - Amounts < $0.01 but > 0: three decimal places ("$0.003")
 * - Zero: "$0.00"
 *
 * @example
 * ```ts
 * formatCost(0.42);   // "$0.42"
 * formatCost(12.0);   // "$12.00"
 * formatCost(0.003);  // "$0.003"
 * ```
 */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";

  // For sub-cent amounts, show 3 decimal places so the value is meaningful
  if (usd > 0 && usd < 0.01) {
    return `$${usd.toFixed(3)}`;
  }

  return `$${usd.toFixed(2)}`;
}
