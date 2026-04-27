/**
 * Anthropic model pricing and cost estimation.
 *
 * The pricing table is sourced from the model registry (LiteLLM cache or
 * built-in fallback — see `model-registry.ts`). Refresh the cache with
 * `session refresh-models` when new models ship.
 */

import { getModelRegistry } from "./model-registry";
import type { ModelPricing } from "./pricing-types";
import type { TokenUsage } from "./types";

export type { ModelPricing };

// ============================================================================
// PRICING TABLE
// ============================================================================

/**
 * Known model pricing, keyed by canonical model ID.
 *
 * Implemented as a Proxy over the live registry so existing callers that
 * hold a reference to `MODEL_PRICING` always see the current registry state.
 * Mutating this object is not supported.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = new Proxy(
  {} as Record<string, ModelPricing>,
  {
    get: (_target, prop: string) => getModelRegistry()[prop],
    has: (_target, prop: string) => prop in getModelRegistry(),
    ownKeys: () => Reflect.ownKeys(getModelRegistry()),
    getOwnPropertyDescriptor: (_target, prop: string) => {
      const value = getModelRegistry()[prop];
      if (value === undefined) return undefined;
      return { configurable: true, enumerable: true, value };
    },
  },
);

// ============================================================================
// FUZZY MATCHING
// ============================================================================

/**
 * Prefixes used for fuzzy model matching, ordered longest-first so that
 * more-specific prefixes win (e.g. "claude-sonnet-4-5" before "claude-sonnet-4").
 *
 * Each prefix maps to a canonical model ID we expect to find in the registry.
 * The registry already contains many dated/aliased variants from LiteLLM, so
 * fuzzy matching is mostly a safety net for new aliases the cache hasn't
 * picked up yet.
 */
const MODEL_PREFIX_MAP: [prefix: string, canonicalId: string][] = [
  ["claude-sonnet-4-5", "claude-sonnet-4-5-20250929"],
  ["claude-sonnet-4-6", "claude-sonnet-4-6"],
  // Opus 4.7 / 4.6 must precede the shorter "claude-opus-4" prefix.
  ["claude-opus-4-7", "claude-opus-4-7"],
  ["claude-opus-4-6", "claude-opus-4-6"],
  ["claude-opus-4-1", "claude-opus-4-1"],
  ["claude-opus-4-0", "claude-opus-4-0"],
  // Catch-all for "claude-opus-4" with no further version — assume legacy pricing.
  ["claude-opus-4", "claude-opus-4-0"],
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
 * Looks up the model in the registry (exact or fuzzy match) and returns its
 * context window size. Falls back to `DEFAULT_CONTEXT_WINDOW` for unknown
 * models.
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
 * Returns undefined for unknown models — callers decide how to handle that.
 */
export function getModelPricing(model: string): ModelPricing | undefined {
  if (!model) return undefined;
  const registry = getModelRegistry();

  if (registry[model]) return registry[model];

  for (const [prefix, canonicalId] of MODEL_PREFIX_MAP) {
    if (model.startsWith(prefix)) {
      return registry[canonicalId];
    }
  }
  return undefined;
}

/**
 * Estimate the cost in USD for a set of token usage at the given pricing.
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
 */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd > 0 && usd < 0.01) {
    return `$${usd.toFixed(3)}`;
  }
  return `$${usd.toFixed(2)}`;
}
