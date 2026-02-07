import { test, expect, describe } from "bun:test";
import {
  getModelPricing,
  estimateCost,
  formatCost,
  MODEL_PRICING,
  type ModelPricing,
} from "./pricing";
import type { TurnTokenUsage } from "./types";

describe("pricing", () => {
  // ==========================================================================
  // MODEL PRICING LOOKUP
  // ==========================================================================

  describe("getModelPricing", () => {
    test("returns pricing for claude-sonnet-4-5-20250929", () => {
      const pricing = getModelPricing("claude-sonnet-4-5-20250929");
      expect(pricing).toBeDefined();
      expect(pricing!.inputPerMillion).toBe(3.0);
      expect(pricing!.outputPerMillion).toBe(15.0);
      expect(pricing!.cacheWritePerMillion).toBe(3.75);
      expect(pricing!.cacheReadPerMillion).toBe(0.3);
    });

    test("returns pricing for claude-opus-4-6", () => {
      const pricing = getModelPricing("claude-opus-4-6");
      expect(pricing).toBeDefined();
      expect(pricing!.inputPerMillion).toBe(15.0);
      expect(pricing!.outputPerMillion).toBe(75.0);
      expect(pricing!.cacheWritePerMillion).toBe(18.75);
      expect(pricing!.cacheReadPerMillion).toBe(1.5);
    });

    test("returns pricing for claude-haiku-4-5-20251001", () => {
      const pricing = getModelPricing("claude-haiku-4-5-20251001");
      expect(pricing).toBeDefined();
      expect(pricing!.inputPerMillion).toBe(0.8);
      expect(pricing!.outputPerMillion).toBe(4.0);
      expect(pricing!.cacheWritePerMillion).toBe(1.0);
      expect(pricing!.cacheReadPerMillion).toBe(0.08);
    });

    test("returns undefined for unknown model", () => {
      const pricing = getModelPricing("gpt-4o-2024-08-06");
      expect(pricing).toBeUndefined();
    });

    test("returns undefined for empty string", () => {
      const pricing = getModelPricing("");
      expect(pricing).toBeUndefined();
    });
  });

  // ==========================================================================
  // FUZZY MODEL MATCHING
  // ==========================================================================

  describe("fuzzy model matching", () => {
    test("matches sonnet by prefix 'claude-sonnet-4-5'", () => {
      const pricing = getModelPricing("claude-sonnet-4-5");
      expect(pricing).toBeDefined();
      expect(pricing!.inputPerMillion).toBe(3.0);
    });

    test("matches opus by prefix 'claude-opus-4'", () => {
      const pricing = getModelPricing("claude-opus-4");
      expect(pricing).toBeDefined();
      expect(pricing!.inputPerMillion).toBe(15.0);
    });

    test("matches haiku by prefix 'claude-haiku-4-5'", () => {
      const pricing = getModelPricing("claude-haiku-4-5");
      expect(pricing).toBeDefined();
      expect(pricing!.inputPerMillion).toBe(0.8);
    });

    test("matches model with date suffix variation", () => {
      // Session files might have slightly different date suffixes
      const pricing = getModelPricing("claude-sonnet-4-5-20250301");
      expect(pricing).toBeDefined();
      expect(pricing!.inputPerMillion).toBe(3.0);
    });

    test("matches model with extra suffix", () => {
      const pricing = getModelPricing("claude-opus-4-6-latest");
      expect(pricing).toBeDefined();
      expect(pricing!.inputPerMillion).toBe(15.0);
    });

    test("does not match partial non-model strings", () => {
      expect(getModelPricing("claude")).toBeUndefined();
      expect(getModelPricing("sonnet")).toBeUndefined();
    });
  });

  // ==========================================================================
  // COST ESTIMATION
  // ==========================================================================

  describe("estimateCost", () => {
    const sonnetPricing: ModelPricing = {
      inputPerMillion: 3.0,
      outputPerMillion: 15.0,
      cacheWritePerMillion: 3.75,
      cacheReadPerMillion: 0.3,
    };

    test("computes cost for 1M input tokens at $3/M", () => {
      const usage: TurnTokenUsage = {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };
      expect(estimateCost(usage, sonnetPricing)).toBeCloseTo(3.0, 6);
    });

    test("computes cost for 1M output tokens at $15/M", () => {
      const usage: TurnTokenUsage = {
        inputTokens: 0,
        outputTokens: 1_000_000,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };
      expect(estimateCost(usage, sonnetPricing)).toBeCloseTo(15.0, 6);
    });

    test("computes cost for 1M cache write tokens at $3.75/M", () => {
      const usage: TurnTokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 1_000_000,
        cacheReadInputTokens: 0,
      };
      expect(estimateCost(usage, sonnetPricing)).toBeCloseTo(3.75, 6);
    });

    test("computes cost for 1M cache read tokens at $0.30/M", () => {
      const usage: TurnTokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 1_000_000,
      };
      expect(estimateCost(usage, sonnetPricing)).toBeCloseTo(0.3, 6);
    });

    test("sums all token categories correctly", () => {
      const usage: TurnTokenUsage = {
        inputTokens: 100_000,
        outputTokens: 50_000,
        cacheCreationInputTokens: 200_000,
        cacheReadInputTokens: 500_000,
      };
      // 100k * 3/1M + 50k * 15/1M + 200k * 3.75/1M + 500k * 0.3/1M
      // = 0.30 + 0.75 + 0.75 + 0.15
      // = 1.95
      expect(estimateCost(usage, sonnetPricing)).toBeCloseTo(1.95, 6);
    });

    test("returns 0 for zero token usage", () => {
      const usage: TurnTokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };
      expect(estimateCost(usage, sonnetPricing)).toBe(0);
    });

    test("works with opus pricing", () => {
      const opusPricing = getModelPricing("claude-opus-4-6")!;
      const usage: TurnTokenUsage = {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };
      // 1M * 15/1M + 100k * 75/1M = 15.0 + 7.5 = 22.5
      expect(estimateCost(usage, opusPricing)).toBeCloseTo(22.5, 6);
    });
  });

  // ==========================================================================
  // COST FORMATTING
  // ==========================================================================

  describe("formatCost", () => {
    test("formats dollars with two decimal places", () => {
      expect(formatCost(12.34)).toBe("$12.34");
    });

    test("formats zero", () => {
      expect(formatCost(0)).toBe("$0.00");
    });

    test("formats small cents", () => {
      expect(formatCost(0.01)).toBe("$0.01");
    });

    test("formats sub-cent amounts with extra precision", () => {
      // For very small costs, show enough precision to be meaningful
      expect(formatCost(0.003)).toBe("$0.003");
      expect(formatCost(0.0042)).toBe("$0.004");
    });

    test("rounds to two decimal places for amounts >= $0.01", () => {
      expect(formatCost(0.456)).toBe("$0.46");
      expect(formatCost(1.999)).toBe("$2.00");
    });

    test("formats large amounts", () => {
      expect(formatCost(100.5)).toBe("$100.50");
    });
  });

  // ==========================================================================
  // MODEL_PRICING MAP
  // ==========================================================================

  describe("MODEL_PRICING map", () => {
    test("cache write is 1.25x input rate for all models", () => {
      for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
        expect(pricing.cacheWritePerMillion).toBeCloseTo(
          pricing.inputPerMillion * 1.25,
          6,
        );
      }
    });

    test("cache read is 0.1x input rate for all models", () => {
      for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
        expect(pricing.cacheReadPerMillion).toBeCloseTo(
          pricing.inputPerMillion * 0.1,
          6,
        );
      }
    });
  });
});
