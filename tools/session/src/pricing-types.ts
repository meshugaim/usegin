/**
 * Shared pricing types — split out so `model-registry.ts` and `pricing.ts`
 * can both import without forming a cycle.
 */

/** Per-million-token pricing and capabilities for a single model. */
export interface ModelPricing {
  /** USD per 1M input tokens (non-cached) */
  inputPerMillion: number;
  /** USD per 1M output tokens */
  outputPerMillion: number;
  /** USD per 1M cache write tokens (typically 1.25x input) */
  cacheWritePerMillion: number;
  /** USD per 1M cache read tokens (typically 0.1x input) */
  cacheReadPerMillion: number;
  /** Context window size in tokens */
  contextWindow: number;
}
