/**
 * Typed values — Red phase tests for ENG-4686 (Slice 1).
 *
 * Tests the widening of dx feature values from boolean-only to
 * `boolean | string | number`. Covers type coercion, getFeature with
 * typed values, isEnabled backward compatibility, and the new getValue.
 *
 * All new tests are marked `test.failing` because the implementation
 * does not yet exist. Functions that don't exist yet (toEnabled, getValue)
 * are imported lazily to avoid import-time errors.
 */

import { describe, test, expect } from "bun:test";
import {
  isEnabled,
  getFeature,
  type DxContext,
  type DxConfig,
} from "./core";
import { makeConfig, makeContext } from "./test-fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand for makeContext with env: {} (no auto-resolved user). */
function makeCtx(overrides?: Partial<DxContext>): DxContext {
  return makeContext({ env: {}, ...overrides });
}

/**
 * Build a config with typed (non-boolean) feature defaults.
 * Extends the base config with string and number features.
 */
function makeTypedConfig(overrides?: Partial<DxConfig>): DxConfig {
  return makeConfig({
    features: {
      "ci-watcher": {
        description: "Monitor CI after push",
        mechanism: "Claude PostToolUse hook",
        default: true,
      },
      autosync: {
        description: "Push to origin after every commit",
        mechanism: "husky post-commit hook",
        default: false,
      },
      "tips.show-duration": {
        description: "How long a tip stays visible",
        mechanism: "tip statusline timing parameter",
        default: "10m",
      },
      "tips.rest-duration": {
        description: "Quiet period between tips",
        mechanism: "tip statusline timing parameter",
        default: "2h",
      },
      "tips.max-count": {
        description: "Maximum tips per session",
        mechanism: "tip counter limit",
        default: 42,
      },
      "tips.disabled-count": {
        description: "A zero-valued number feature",
        mechanism: "test",
        default: 0,
      },
      "tips.empty-string": {
        description: "An empty string feature",
        mechanism: "test",
        default: "",
      },
    } as any, // typed values — not yet supported by FeatureDefinition types
    ...overrides,
  });
}

// ===========================================================================
// 1. Type coercion — toEnabled function
// ===========================================================================

describe("toEnabled — type coercion", () => {
  // Lazy import: toEnabled does not exist yet
  const lazyToEnabled = () =>
    (require("./core") as { toEnabled: (v: any) => boolean }).toEnabled;

  test.failing("true -> true", () => {
    expect(lazyToEnabled()(true)).toBe(true);
  });

  test.failing("false -> false", () => {
    expect(lazyToEnabled()(false)).toBe(false);
  });

  test.failing("non-empty string '10m' -> true", () => {
    expect(lazyToEnabled()("10m")).toBe(true);
  });

  test.failing("empty string '' -> false", () => {
    expect(lazyToEnabled()("")).toBe(false);
  });

  test.failing("non-zero number 42 -> true", () => {
    expect(lazyToEnabled()(42)).toBe(true);
  });

  test.failing("zero 0 -> false", () => {
    expect(lazyToEnabled()(0)).toBe(false);
  });

  test.failing("negative number -1 -> true (non-zero)", () => {
    expect(lazyToEnabled()(-1)).toBe(true);
  });

  test.failing("negative zero -0 -> false (JS: -0 === 0)", () => {
    expect(lazyToEnabled()(-0)).toBe(false);
  });
});

// ===========================================================================
// 2. getFeature with typed values
// ===========================================================================

// NOTE for Green phase: existing tests in core.test.ts use `toEqual` on
// getFeature results without a `value` field. The implementer must update
// those tests to include `value` when widening FeatureInfo.
describe("getFeature — typed values", () => {
  test.failing("boolean default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("ci-watcher", ctx, null);
    expect(result).toEqual({ value: true, enabled: true, source: "default" });
  });

  test.failing("string default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("tips.show-duration", ctx, null);
    expect(result).toEqual({ value: "10m", enabled: true, source: "default" });
  });

  test.failing("number default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("tips.max-count", ctx, null);
    expect(result).toEqual({ value: 42, enabled: true, source: "default" });
  });

  test.failing("string local override", () => {
    const ctx = makeCtx({
      config: makeTypedConfig(),
      local: {
        overrides: {
          "tips.show-duration": "5m",
        } as any,
      },
    });
    const result = getFeature("tips.show-duration", ctx, null);
    expect(result).toEqual({ value: "5m", enabled: true, source: "local-override" });
  });

  test.failing("string user override", () => {
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.show-duration": "7m",
          } as any,
        },
      },
    });
    const ctx = makeCtx({ config });
    const result = getFeature("tips.show-duration", ctx, "nitsan");
    expect(result).toEqual({ value: "7m", enabled: true, source: "user-override" });
  });

  test.failing("three-layer merge: local wins", () => {
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.show-duration": "5m",
          } as any,
        },
      },
    });
    const ctx = makeCtx({
      config,
      local: {
        overrides: {
          "tips.show-duration": "1m",
        } as any,
      },
    });
    const result = getFeature("tips.show-duration", ctx, "nitsan");
    expect(result).toEqual({ value: "1m", enabled: true, source: "local-override" });
  });

  test.failing("boolean false default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("autosync", ctx, null);
    expect(result).toEqual({ value: false, enabled: false, source: "default" });
  });

  test.failing("number zero default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("tips.disabled-count", ctx, null);
    expect(result).toEqual({ value: 0, enabled: false, source: "default" });
  });

  test.failing("empty string default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("tips.empty-string", ctx, null);
    expect(result).toEqual({ value: "", enabled: false, source: "default" });
  });
});

// ===========================================================================
// 3. isEnabled backward compatibility
// ===========================================================================

describe("isEnabled — backward compat with typed values", () => {
  // This test passes today — boolean features already work.
  // It's here to guard against regressions when typed values land.
  test("boolean features unchanged", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("ci-watcher", ctx, null)).toBe(true);
    expect(isEnabled("autosync", ctx, null)).toBe(false);
  });

  test.failing("truthy string -> true", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.show-duration", ctx, null)).toBe(true);
  });

  test.failing("zero number -> false", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.disabled-count", ctx, null)).toBe(false);
  });

  test.failing("empty string -> false", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.empty-string", ctx, null)).toBe(false);
  });

  test.failing("non-zero number -> true", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.max-count", ctx, null)).toBe(true);
  });

  test.failing("boolean overrides still resolve identically", () => {
    // The existing boolean features should work exactly the same
    // as they did before typed values were introduced.
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "ci-watcher": false,
          },
        },
      },
    });
    const ctx = makeCtx({
      config,
      local: {
        overrides: {
          autosync: true,
        },
      },
    });

    // default true, user override false -> false
    expect(isEnabled("ci-watcher", ctx, "nitsan")).toBe(false);
    // default false, local override true -> true
    expect(isEnabled("autosync", ctx, "nitsan")).toBe(true);
    // string feature default -> true (truthy)
    expect(isEnabled("tips.show-duration", ctx, "nitsan")).toBe(true);
  });
});

// ===========================================================================
// 4. getValue — new function
// ===========================================================================

// We test the core `getValue` function here as pure-function unit tests.
// The SDK's `dx.getValue()` wraps this with context injection — see SDK tests.
describe("getValue — typed value retrieval", () => {
  // Lazy import: getValue does not exist yet
  const lazyGetValue = () =>
    (require("./core") as {
      getValue: (name: string, ctx: DxContext, user?: string | null) => any;
    }).getValue;

  test.failing("boolean default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(lazyGetValue()("ci-watcher", ctx, null)).toBe(true);
  });

  test.failing("string default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(lazyGetValue()("tips.show-duration", ctx, null)).toBe("10m");
  });

  test.failing("number default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(lazyGetValue()("tips.max-count", ctx, null)).toBe(42);
  });

  test.failing("local override", () => {
    const ctx = makeCtx({
      config: makeTypedConfig(),
      local: {
        overrides: {
          "tips.show-duration": "3m",
        } as any,
      },
    });
    expect(lazyGetValue()("tips.show-duration", ctx, null)).toBe("3m");
  });

  test.failing("user override", () => {
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.max-count": 99,
          } as any,
        },
      },
    });
    const ctx = makeCtx({ config });
    expect(lazyGetValue()("tips.max-count", ctx, "nitsan")).toBe(99);
  });

  test.failing("unknown feature returns undefined", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    // Unknown features in isEnabled return true (enabled).
    // For getValue, the value should be undefined since there's no
    // typed default to return for an unregistered feature.
    expect(lazyGetValue()("nonexistent-feature", ctx, null)).toBeUndefined();
  });

  test.failing("three-layer resolution returns local override", () => {
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.show-duration": "5m",
          } as any,
        },
      },
    });
    const ctx = makeCtx({
      config,
      local: {
        overrides: {
          "tips.show-duration": "1m",
        } as any,
      },
    });
    expect(lazyGetValue()("tips.show-duration", ctx, "nitsan")).toBe("1m");
  });

  test.failing("local override of string to empty string", () => {
    const ctx = makeCtx({
      config: makeTypedConfig(),
      local: {
        overrides: {
          "tips.show-duration": "",
        } as any,
      },
    });
    expect(lazyGetValue()("tips.show-duration", ctx, null)).toBe("");
  });

  test.failing("local override of number to zero", () => {
    const ctx = makeCtx({
      config: makeTypedConfig(),
      local: {
        overrides: {
          "tips.max-count": 0,
        } as any,
      },
    });
    expect(lazyGetValue()("tips.max-count", ctx, null)).toBe(0);
  });
});
