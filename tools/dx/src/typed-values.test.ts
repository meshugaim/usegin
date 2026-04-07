/**
 * Typed values — tests for ENG-4686 (Slice 1).
 *
 * Tests the widening of dx feature values from boolean-only to
 * `boolean | string | number`. Covers type coercion, getFeature with
 * typed values, isEnabled backward compatibility, and the new getValue.
 */

import { describe, test, expect } from "bun:test";
import {
  isEnabled,
  getFeature,
  toEnabled,
  getValue,
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
    },
    ...overrides,
  });
}

// ===========================================================================
// 1. Type coercion — toEnabled function
// ===========================================================================

describe("toEnabled — type coercion", () => {
  test("true -> true", () => {
    expect(toEnabled(true)).toBe(true);
  });

  test("false -> false", () => {
    expect(toEnabled(false)).toBe(false);
  });

  test("non-empty string '10m' -> true", () => {
    expect(toEnabled("10m")).toBe(true);
  });

  test("empty string '' -> false", () => {
    expect(toEnabled("")).toBe(false);
  });

  test("non-zero number 42 -> true", () => {
    expect(toEnabled(42)).toBe(true);
  });

  test("zero 0 -> false", () => {
    expect(toEnabled(0)).toBe(false);
  });

  test("negative number -1 -> true (non-zero)", () => {
    expect(toEnabled(-1)).toBe(true);
  });

  test("negative zero -0 -> false (JS: -0 === 0)", () => {
    expect(toEnabled(-0)).toBe(false);
  });
});

// ===========================================================================
// 2. getFeature with typed values
// ===========================================================================

describe("getFeature — typed values", () => {
  test("boolean default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("ci-watcher", ctx, null);
    expect(result).toEqual({ value: true, enabled: true, source: "default" });
  });

  test("string default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("tips.show-duration", ctx, null);
    expect(result).toEqual({ value: "10m", enabled: true, source: "default" });
  });

  test("number default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("tips.max-count", ctx, null);
    expect(result).toEqual({ value: 42, enabled: true, source: "default" });
  });

  test("string local override", () => {
    const ctx = makeCtx({
      config: makeTypedConfig(),
      local: {
        overrides: {
          "tips.show-duration": "5m",
        },
      },
    });
    const result = getFeature("tips.show-duration", ctx, null);
    expect(result).toEqual({ value: "5m", enabled: true, source: "local-override" });
  });

  test("string user override", () => {
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.show-duration": "7m",
          },
        },
      },
    });
    const ctx = makeCtx({ config });
    const result = getFeature("tips.show-duration", ctx, "nitsan");
    expect(result).toEqual({ value: "7m", enabled: true, source: "user-override" });
  });

  test("three-layer merge: local wins", () => {
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.show-duration": "5m",
          },
        },
      },
    });
    const ctx = makeCtx({
      config,
      local: {
        overrides: {
          "tips.show-duration": "1m",
        },
      },
    });
    const result = getFeature("tips.show-duration", ctx, "nitsan");
    expect(result).toEqual({ value: "1m", enabled: true, source: "local-override" });
  });

  test("boolean false default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("autosync", ctx, null);
    expect(result).toEqual({ value: false, enabled: false, source: "default" });
  });

  test("number zero default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("tips.disabled-count", ctx, null);
    expect(result).toEqual({ value: 0, enabled: false, source: "default" });
  });

  test("empty string default", () => {
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

  test("truthy string -> true", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.show-duration", ctx, null)).toBe(true);
  });

  test("zero number -> false", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.disabled-count", ctx, null)).toBe(false);
  });

  test("empty string -> false", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.empty-string", ctx, null)).toBe(false);
  });

  test("non-zero number -> true", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.max-count", ctx, null)).toBe(true);
  });

  test("boolean overrides still resolve identically", () => {
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
  test("boolean default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(getValue("ci-watcher", ctx, null)).toBe(true);
  });

  test("string default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(getValue("tips.show-duration", ctx, null)).toBe("10m");
  });

  test("number default", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(getValue("tips.max-count", ctx, null)).toBe(42);
  });

  test("local override", () => {
    const ctx = makeCtx({
      config: makeTypedConfig(),
      local: {
        overrides: {
          "tips.show-duration": "3m",
        },
      },
    });
    expect(getValue("tips.show-duration", ctx, null)).toBe("3m");
  });

  test("user override", () => {
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.max-count": 99,
          },
        },
      },
    });
    const ctx = makeCtx({ config });
    expect(getValue("tips.max-count", ctx, "nitsan")).toBe(99);
  });

  test("unknown feature returns undefined", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    // Unknown features in isEnabled return true (enabled).
    // For getValue, the value should be undefined since there's no
    // typed default to return for an unregistered feature.
    expect(getValue("nonexistent-feature", ctx, null)).toBeUndefined();
  });

  test("three-layer resolution returns local override", () => {
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.show-duration": "5m",
          },
        },
      },
    });
    const ctx = makeCtx({
      config,
      local: {
        overrides: {
          "tips.show-duration": "1m",
        },
      },
    });
    expect(getValue("tips.show-duration", ctx, "nitsan")).toBe("1m");
  });

  test("local override of string to empty string", () => {
    const ctx = makeCtx({
      config: makeTypedConfig(),
      local: {
        overrides: {
          "tips.show-duration": "",
        },
      },
    });
    expect(getValue("tips.show-duration", ctx, null)).toBe("");
  });

  test("local override of number to zero", () => {
    const ctx = makeCtx({
      config: makeTypedConfig(),
      local: {
        overrides: {
          "tips.max-count": 0,
        },
      },
    });
    expect(getValue("tips.max-count", ctx, null)).toBe(0);
  });
});
