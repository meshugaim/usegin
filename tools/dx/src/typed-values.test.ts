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
import { makeConfig } from "./test-fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a DxContext with sensible defaults (mirrors core.test.ts pattern). */
function makeCtx(overrides?: Partial<DxContext>): DxContext {
  return {
    config: makeConfig(),
    local: null,
    env: {},
    gitUserName: null,
    gitUserEmail: null,
    whoami: null,
    ...overrides,
  };
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
        default: "10m" as any, // typed value — not yet supported by types
      },
      "tips.rest-duration": {
        description: "Quiet period between tips",
        mechanism: "tip statusline timing parameter",
        default: "2h" as any,
      },
      "tips.max-count": {
        description: "Maximum tips per session",
        mechanism: "tip counter limit",
        default: 42 as any,
      },
      "tips.disabled-count": {
        description: "A zero-valued number feature",
        mechanism: "test",
        default: 0 as any,
      },
      "tips.empty-string": {
        description: "An empty string feature",
        mechanism: "test",
        default: "" as any,
      },
    },
    ...overrides,
  });
}

// ===========================================================================
// 1. Type coercion — toEnabled function
// ===========================================================================

describe("toEnabled — type coercion", () => {
  test.failing("true -> true", () => {
    // Lazy import: toEnabled does not exist yet
    const { toEnabled } = require("./core") as { toEnabled: (v: any) => boolean };
    expect(toEnabled(true)).toBe(true);
  });

  test.failing("false -> false", () => {
    const { toEnabled } = require("./core") as { toEnabled: (v: any) => boolean };
    expect(toEnabled(false)).toBe(false);
  });

  test.failing("non-empty string '10m' -> true", () => {
    const { toEnabled } = require("./core") as { toEnabled: (v: any) => boolean };
    expect(toEnabled("10m")).toBe(true);
  });

  test.failing("empty string '' -> false", () => {
    const { toEnabled } = require("./core") as { toEnabled: (v: any) => boolean };
    expect(toEnabled("")).toBe(false);
  });

  test.failing("non-zero number 42 -> true", () => {
    const { toEnabled } = require("./core") as { toEnabled: (v: any) => boolean };
    expect(toEnabled(42)).toBe(true);
  });

  test.failing("zero 0 -> false", () => {
    const { toEnabled } = require("./core") as { toEnabled: (v: any) => boolean };
    expect(toEnabled(0)).toBe(false);
  });
});

// ===========================================================================
// 2. getFeature with typed values
// ===========================================================================

describe("getFeature — typed values", () => {
  test.failing("boolean feature default returns { value: true, enabled: true, source: 'default' }", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("ci-watcher", ctx, null);
    expect(result).toEqual({ value: true, enabled: true, source: "default" });
  });

  test.failing("string feature default '10m' returns { value: '10m', enabled: true, source: 'default' }", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("tips.show-duration", ctx, null);
    expect(result).toEqual({ value: "10m", enabled: true, source: "default" });
  });

  test.failing("number feature default 42 returns { value: 42, enabled: true, source: 'default' }", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("tips.max-count", ctx, null);
    expect(result).toEqual({ value: 42, enabled: true, source: "default" });
  });

  test.failing("string feature with local override returns overridden value", () => {
    const ctx = makeCtx({
      config: makeTypedConfig(),
      local: {
        overrides: {
          "tips.show-duration": "5m" as any,
        },
      },
    });
    const result = getFeature("tips.show-duration", ctx, null);
    expect(result).toEqual({ value: "5m", enabled: true, source: "local-override" });
  });

  test.failing("string feature with user override returns correct value and source", () => {
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.show-duration": "7m" as any,
          },
        },
      },
    });
    const ctx = makeCtx({ config });
    const result = getFeature("tips.show-duration", ctx, "nitsan");
    expect(result).toEqual({ value: "7m", enabled: true, source: "user-override" });
  });

  test.failing("three-layer merge: default '10m' + user '5m' + local '1m' -> value is '1m'", () => {
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.show-duration": "5m" as any,
          },
        },
      },
    });
    const ctx = makeCtx({
      config,
      local: {
        overrides: {
          "tips.show-duration": "1m" as any,
        },
      },
    });
    const result = getFeature("tips.show-duration", ctx, "nitsan");
    expect(result).toEqual({ value: "1m", enabled: true, source: "local-override" });
  });

  test.failing("boolean false feature default returns { value: false, enabled: false, source: 'default' }", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("autosync", ctx, null);
    expect(result).toEqual({ value: false, enabled: false, source: "default" });
  });

  test.failing("number 0 feature default returns { value: 0, enabled: false, source: 'default' }", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    const result = getFeature("tips.disabled-count", ctx, null);
    expect(result).toEqual({ value: 0, enabled: false, source: "default" });
  });

  test.failing("empty string feature default returns { value: '', enabled: false, source: 'default' }", () => {
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
  test("boolean feature returns boolean as before", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("ci-watcher", ctx, null)).toBe(true);
    expect(isEnabled("autosync", ctx, null)).toBe(false);
  });

  test.failing("string feature '10m' returns true", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.show-duration", ctx, null)).toBe(true);
  });

  test.failing("number feature 0 returns false", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.disabled-count", ctx, null)).toBe(false);
  });

  test.failing("empty string feature returns false", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.empty-string", ctx, null)).toBe(false);
  });

  test.failing("non-zero number feature returns true", () => {
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(isEnabled("tips.max-count", ctx, null)).toBe(true);
  });

  test.failing("existing boolean features still resolve identically", () => {
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

describe("getValue — typed value retrieval", () => {
  test.failing("returns boolean value for boolean feature", () => {
    const { getValue } = require("./core") as {
      getValue: (name: string, ctx: DxContext, user?: string | null) => any;
    };
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(getValue("ci-watcher", ctx, null)).toBe(true);
  });

  test.failing("returns string value for string feature", () => {
    const { getValue } = require("./core") as {
      getValue: (name: string, ctx: DxContext, user?: string | null) => any;
    };
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(getValue("tips.show-duration", ctx, null)).toBe("10m");
  });

  test.failing("returns number value for number feature", () => {
    const { getValue } = require("./core") as {
      getValue: (name: string, ctx: DxContext, user?: string | null) => any;
    };
    const ctx = makeCtx({ config: makeTypedConfig() });
    expect(getValue("tips.max-count", ctx, null)).toBe(42);
  });

  test.failing("returns resolved value through local override", () => {
    const { getValue } = require("./core") as {
      getValue: (name: string, ctx: DxContext, user?: string | null) => any;
    };
    const ctx = makeCtx({
      config: makeTypedConfig(),
      local: {
        overrides: {
          "tips.show-duration": "3m" as any,
        },
      },
    });
    expect(getValue("tips.show-duration", ctx, null)).toBe("3m");
  });

  test.failing("returns resolved value through user override", () => {
    const { getValue } = require("./core") as {
      getValue: (name: string, ctx: DxContext, user?: string | null) => any;
    };
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.max-count": 99 as any,
          },
        },
      },
    });
    const ctx = makeCtx({ config });
    expect(getValue("tips.max-count", ctx, "nitsan")).toBe(99);
  });

  test.failing("unknown feature returns undefined (matches isEnabled's warn-and-default pattern)", () => {
    const { getValue } = require("./core") as {
      getValue: (name: string, ctx: DxContext, user?: string | null) => any;
    };
    const ctx = makeCtx({ config: makeTypedConfig() });
    // Unknown features in isEnabled return true (enabled).
    // For getValue, the value should be undefined since there's no
    // typed default to return for an unregistered feature.
    expect(getValue("nonexistent-feature", ctx, null)).toBeUndefined();
  });

  test.failing("three-layer resolution returns local override value", () => {
    const { getValue } = require("./core") as {
      getValue: (name: string, ctx: DxContext, user?: string | null) => any;
    };
    const config = makeTypedConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {
            "tips.show-duration": "5m" as any,
          },
        },
      },
    });
    const ctx = makeCtx({
      config,
      local: {
        overrides: {
          "tips.show-duration": "1m" as any,
        },
      },
    });
    expect(getValue("tips.show-duration", ctx, "nitsan")).toBe("1m");
  });
});
