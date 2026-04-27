import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  BUILTIN_FALLBACK,
  getModelRegistry,
  parseLiteLLM,
  resetRegistryForTest,
} from "./model-registry";

describe("model-registry", () => {
  let tmpDir: string;
  const originalEnv = process.env.SESSION_MODEL_CACHE_PATH;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "session-registry-"));
    resetRegistryForTest();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalEnv === undefined) {
      delete process.env.SESSION_MODEL_CACHE_PATH;
    } else {
      process.env.SESSION_MODEL_CACHE_PATH = originalEnv;
    }
    resetRegistryForTest();
  });

  describe("BUILTIN_FALLBACK", () => {
    test("includes claude-opus-4-7 with 1M context window", () => {
      // Regression for the original report: Opus 4.7 sessions showed 101%
      // context because the table didn't know the model. Fallback must carry
      // it explicitly so first-run/offline use is correct.
      const opus47 = BUILTIN_FALLBACK["claude-opus-4-7"];
      expect(opus47).toBeDefined();
      expect(opus47!.contextWindow).toBe(1_000_000);
    });

    test("every fallback entry has standard cache ratios", () => {
      for (const [, entry] of Object.entries(BUILTIN_FALLBACK)) {
        expect(entry.cacheWritePerMillion).toBeCloseTo(
          entry.inputPerMillion * 1.25,
          6,
        );
        expect(entry.cacheReadPerMillion).toBeCloseTo(
          entry.inputPerMillion * 0.1,
          6,
        );
      }
    });
  });

  describe("parseLiteLLM", () => {
    test("filters to anthropic-direct provider", () => {
      const result = parseLiteLLM({
        "claude-opus-4-7": {
          litellm_provider: "anthropic",
          max_input_tokens: 1_000_000,
          input_cost_per_token: 5e-6,
          output_cost_per_token: 2.5e-5,
          cache_creation_input_token_cost: 6.25e-6,
          cache_read_input_token_cost: 5e-7,
        },
        "anthropic.claude-opus-4-7": {
          litellm_provider: "bedrock_converse",
          max_input_tokens: 1_000_000,
          input_cost_per_token: 5e-6,
          output_cost_per_token: 2.5e-5,
        },
        "vertex_ai/claude-opus-4-7": {
          litellm_provider: "vertex_ai-anthropic_models",
          max_input_tokens: 1_000_000,
          input_cost_per_token: 5e-6,
          output_cost_per_token: 2.5e-5,
        },
      });
      expect(Object.keys(result)).toEqual(["claude-opus-4-7"]);
    });

    test("converts per-token to per-million pricing", () => {
      const result = parseLiteLLM({
        "claude-opus-4-7": {
          litellm_provider: "anthropic",
          max_input_tokens: 1_000_000,
          input_cost_per_token: 5e-6,
          output_cost_per_token: 2.5e-5,
          cache_creation_input_token_cost: 6.25e-6,
          cache_read_input_token_cost: 5e-7,
        },
      });
      expect(result["claude-opus-4-7"]).toEqual({
        inputPerMillion: 5.0,
        outputPerMillion: 25.0,
        cacheWritePerMillion: 6.25,
        cacheReadPerMillion: 0.5,
        contextWindow: 1_000_000,
      });
    });

    test("falls back to standard ratios when cache costs are null", () => {
      const result = parseLiteLLM({
        "claude-x": {
          litellm_provider: "anthropic",
          max_input_tokens: 200_000,
          input_cost_per_token: 4e-6,
          output_cost_per_token: 2e-5,
          cache_creation_input_token_cost: null,
          cache_read_input_token_cost: null,
        },
      });
      expect(result["claude-x"]!.cacheWritePerMillion).toBeCloseTo(5.0, 6);
      expect(result["claude-x"]!.cacheReadPerMillion).toBeCloseTo(0.4, 6);
    });

    test("skips entries missing required fields", () => {
      const result = parseLiteLLM({
        "claude-broken": {
          litellm_provider: "anthropic",
          max_input_tokens: null,
          input_cost_per_token: 1e-6,
          output_cost_per_token: 5e-6,
        },
      });
      expect(result).toEqual({});
    });
  });

  describe("getModelRegistry", () => {
    test("returns BUILTIN_FALLBACK when cache file is missing", () => {
      process.env.SESSION_MODEL_CACHE_PATH = join(tmpDir, "missing.json");
      const registry = getModelRegistry();
      expect(registry["claude-opus-4-7"]).toEqual(
        BUILTIN_FALLBACK["claude-opus-4-7"]!,
      );
    });

    test("loads cache and merges over fallback", () => {
      const cachePath = join(tmpDir, "cache.json");
      writeFileSync(
        cachePath,
        JSON.stringify({
          "claude-future-model": {
            litellm_provider: "anthropic",
            max_input_tokens: 2_000_000,
            input_cost_per_token: 1e-5,
            output_cost_per_token: 5e-5,
            cache_creation_input_token_cost: 1.25e-5,
            cache_read_input_token_cost: 1e-6,
          },
          // Override Opus 4.7's price to verify cache wins over fallback.
          "claude-opus-4-7": {
            litellm_provider: "anthropic",
            max_input_tokens: 1_000_000,
            input_cost_per_token: 9e-6,
            output_cost_per_token: 2.5e-5,
            cache_creation_input_token_cost: 1.125e-5,
            cache_read_input_token_cost: 9e-7,
          },
        }),
      );
      process.env.SESSION_MODEL_CACHE_PATH = cachePath;

      const registry = getModelRegistry();
      expect(registry["claude-future-model"]!.contextWindow).toBe(2_000_000);
      expect(registry["claude-opus-4-7"]!.inputPerMillion).toBe(9.0);
      // Models not in cache still come from fallback.
      expect(registry["claude-haiku-4-5-20251001"]).toEqual(
        BUILTIN_FALLBACK["claude-haiku-4-5-20251001"]!,
      );
    });

    test("falls back gracefully on corrupted cache", () => {
      const cachePath = join(tmpDir, "broken.json");
      writeFileSync(cachePath, "{ not valid json");
      process.env.SESSION_MODEL_CACHE_PATH = cachePath;

      const registry = getModelRegistry();
      expect(registry["claude-opus-4-7"]).toEqual(
        BUILTIN_FALLBACK["claude-opus-4-7"]!,
      );
    });
  });
});
