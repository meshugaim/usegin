/**
 * Model registry — single source of truth for Anthropic model metadata
 * (context window size + pricing).
 *
 * The registry is sourced from LiteLLM's community-maintained
 * `model_prices_and_context_window.json` (filtered to `litellm_provider:
 * "anthropic"`). The file is cached at `~/.cache/session/model_prices.json`
 * and refreshed manually via `session refresh-models`.
 *
 * If the cache is missing or unreadable, the registry falls back to a small
 * built-in snapshot kept in this file. The fallback exists so the tool keeps
 * working offline / on first run; it should be refreshed when new models ship.
 *
 * Why LiteLLM and not the Anthropic SDK? LiteLLM ships a static JSON we can
 * vendor or fetch with a single curl, includes pricing (the SDK's
 * `/v1/models` does not), and is updated promptly when new models launch.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

import type { ModelPricing } from "./pricing-types";

// ============================================================================
// CONSTANTS
// ============================================================================

export const LITELLM_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

/**
 * Where the registry cache lives. Override with `SESSION_MODEL_CACHE_PATH`
 * (used by tests to force fallback-only behavior by pointing at a path
 * that won't exist).
 */
export function cachePath(): string {
  return (
    process.env.SESSION_MODEL_CACHE_PATH ||
    join(homedir(), ".cache", "session", "model_prices.json")
  );
}

// ============================================================================
// BUILT-IN FALLBACK
// ============================================================================

/**
 * Embedded snapshot used when the LiteLLM cache is missing.
 *
 * Keep this current with the latest Claude family. It's the safety net for
 * first-run / offline use and for environments that haven't fetched the cache.
 */
export const BUILTIN_FALLBACK: Record<string, ModelPricing> = {
  "claude-sonnet-4-5-20250929": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
    contextWindow: 200_000,
  },
  "claude-sonnet-4-6": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
    contextWindow: 1_000_000,
  },
  "claude-opus-4-6": {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 6.25,
    cacheReadPerMillion: 0.5,
    contextWindow: 1_000_000,
  },
  "claude-opus-4-7": {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 6.25,
    cacheReadPerMillion: 0.5,
    contextWindow: 1_000_000,
  },
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
// LITELLM PARSER
// ============================================================================

interface LiteLLMEntry {
  litellm_provider?: string;
  max_input_tokens?: number | null;
  input_cost_per_token?: number | null;
  output_cost_per_token?: number | null;
  cache_creation_input_token_cost?: number | null;
  cache_read_input_token_cost?: number | null;
}

const PER_MILLION = 1_000_000;

/**
 * Convert the raw LiteLLM JSON into our `ModelPricing` shape.
 *
 * Only Anthropic-direct entries (`litellm_provider: "anthropic"`) are kept —
 * Claude Code session JSONLs always carry the Anthropic-direct model ID, not
 * the Bedrock/Vertex/Azure variants.
 *
 * Entries missing required fields are skipped silently — partial provider
 * coverage in LiteLLM shouldn't break the registry.
 */
export function parseLiteLLM(
  data: Record<string, LiteLLMEntry>,
): Record<string, ModelPricing> {
  const out: Record<string, ModelPricing> = {};
  for (const [id, entry] of Object.entries(data)) {
    if (entry.litellm_provider !== "anthropic") continue;

    const ctxWindow = entry.max_input_tokens;
    const inputCost = entry.input_cost_per_token;
    const outputCost = entry.output_cost_per_token;
    if (
      typeof ctxWindow !== "number" ||
      typeof inputCost !== "number" ||
      typeof outputCost !== "number"
    ) {
      continue;
    }

    const cacheWrite =
      typeof entry.cache_creation_input_token_cost === "number"
        ? entry.cache_creation_input_token_cost
        : inputCost * 1.25;
    const cacheRead =
      typeof entry.cache_read_input_token_cost === "number"
        ? entry.cache_read_input_token_cost
        : inputCost * 0.1;

    out[id] = {
      inputPerMillion: inputCost * PER_MILLION,
      outputPerMillion: outputCost * PER_MILLION,
      cacheWritePerMillion: cacheWrite * PER_MILLION,
      cacheReadPerMillion: cacheRead * PER_MILLION,
      contextWindow: ctxWindow,
    };
  }
  return out;
}

// ============================================================================
// REGISTRY (memoized)
// ============================================================================

let cachedRegistry: Record<string, ModelPricing> | undefined;

/**
 * Load the registry from cache (if present), else from BUILTIN_FALLBACK.
 *
 * Cache entries take precedence; fallback fills in models LiteLLM lacks.
 * Memoized for the process — call `resetRegistryForTest()` between tests.
 */
export function getModelRegistry(): Record<string, ModelPricing> {
  if (cachedRegistry) return cachedRegistry;

  const merged: Record<string, ModelPricing> = { ...BUILTIN_FALLBACK };
  const fromCache = readCacheSafe();
  if (fromCache) {
    for (const [id, entry] of Object.entries(fromCache)) {
      merged[id] = entry;
    }
  }
  cachedRegistry = merged;
  return merged;
}

/**
 * Read and parse the cache file. Returns undefined on any I/O or parse error
 * — caller falls back to BUILTIN_FALLBACK.
 */
function readCacheSafe(): Record<string, ModelPricing> | undefined {
  const path = cachePath();
  if (!path || !existsSync(path)) return undefined;
  try {
    const raw = readFileSync(path, "utf8");
    return parseLiteLLM(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/** Test helper: clear the memoized registry so the next call re-reads. */
export function resetRegistryForTest(): void {
  cachedRegistry = undefined;
}

// ============================================================================
// REFRESH
// ============================================================================

/**
 * Fetch the LiteLLM JSON and write it to the cache path. Throws on network
 * or write failure so callers can surface the error.
 */
export async function refreshCache(): Promise<{ path: string; bytes: number }> {
  const res = await fetch(LITELLM_URL);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  // Validate JSON before writing — don't poison the cache.
  JSON.parse(text);

  const path = cachePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  resetRegistryForTest();
  return { path, bytes: text.length };
}
