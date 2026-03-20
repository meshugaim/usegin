/**
 * Anthropic model pricing and cost estimation.
 *
 * Provides a pricing table for known Claude models and functions to compute
 * estimated session cost from token usage data.
 *
 * Prices last verified: 2026-02-07 (https://platform.claude.com/docs/en/docs/about-claude/pricing)
 * Standard cache ratios: write = 1.25x input, read = 0.1x input
 */

import type { TokenUsage } from "./types";

// ============================================================================
// TYPES
// ============================================================================

/** Per-million-token pricing and capabilities for a single model. */
export interface ModelPricing {
  /** USD per 1M input tokens (non-cached) */
  inputPerMillion: number;
  /** USD per 1M output tokens */
  outputPerMillion: number;
  /** USD per 1M cache write tokens (1.25x input) */
  cacheWritePerMillion: number;
  /** USD per 1M cache read tokens (0.1x input) */
  cacheReadPerMillion: number;
  /** Context window size in tokens */
  contextWindow: number;
}

// ============================================================================
// PRICING TABLE
// ============================================================================

/**
 * Known model pricing, keyed by canonical model ID.
 *
 * When updating: check https://docs.anthropic.com/en/docs/about-claude/pricing
 * Cache write = 1.25x input. Cache read = 0.1x input.
 *
 * Prices last verified: 2026-02-07 from https://platform.claude.com/docs/en/docs/about-claude/pricing
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-5-20250929": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
    contextWindow: 200_000,
  },
  "claude-opus-4-6": {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 6.25,
    cacheReadPerMillion: 0.5,
    contextWindow: 1_000_000,
  },
  "claude-sonnet-4-6": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
    contextWindow: 1_000_000,
  },
  // Legacy Opus models (4.0, 4.1) have different (higher) pricing
  "claude-opus-4-1": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.5,
    contextWindow: 200_000,
  },
  "claude-opus-4-0": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.5,
    contextWindow: 200_000,
  },
  "claude-haiku-4-5-20251001": {
    inputPerMillion: 1.0,
    outputPerMillion: 5.0,
    cacheWritePerMillion: 1.25,
    cacheReadPerMillion: 0.1,
    contextWindow: 200_000,
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
  // Sonnet 4.6
  ["claude-sonnet-4-6", "claude-sonnet-4-6"],
  // Opus 4.6 (must come before shorter "claude-opus-4" prefix)
  ["claude-opus-4-6", "claude-opus-4-6"],
  // Legacy Opus (4.1, 4.0) — "claude-opus-4-1" before the catch-all "claude-opus-4"
  ["claude-opus-4-1", "claude-opus-4-1"],
  ["claude-opus-4-0", "claude-opus-4-0"],
  // Catch-all for "claude-opus-4" without further version — assume legacy pricing
  ["claude-opus-4", "claude-opus-4-0"],
  // Haiku 4.5
  ["claude-haiku-4-5", "claude-haiku-4-5-20251001"],
];

// ============================================================================
// CONTEXT WINDOW
// ============================================================================

/** Default context window size for unknown models. */
export const DEFAULT_CONTEXT_WINDOW = 200_000;

/**
 * Get the context window size for a model.
 *
 * Looks up the model in the pricing table (exact or fuzzy match) and
 * returns its context window size. Falls back to DEFAULT_CONTEXT_WINDOW
 * for unknown models.
 *
 * @param model - Model string (e.g., "claude-opus-4-6", "claude-sonnet-4-5-20250929")
 * @returns Context window size in tokens
 *
 * @example
 * ```ts
 * getContextWindowSize("claude-opus-4-6");       // 1_000_000
 * getContextWindowSize("unknown-model");          // 200_000 (default)
 * ```
 */
export function getContextWindowSize(model?: string): number {
  if (!model) return DEFAULT_CONTEXT_WINDOW;
  const pricing = getModelPricing(model);
  return pricing?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
}

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
  tokenUsage: TokenUsage,
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
