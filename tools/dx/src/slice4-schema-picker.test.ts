/**
 * Slice 4 — JSON Schema validation, interactive picker read-only, tip CLI cleanup.
 *
 * Tests for:
 * - JSON Schema: validate config files against schemas (AC 15, 16, 18)
 * - Interactive picker: non-boolean features shown read-only (AC 10)
 * - Tip CLI: getValue integration check
 *
 * Part of: ENG-4689
 */

import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { makeConfig, makeContext } from "./test-fixtures";
import {
  buildInteractiveOptions,
  buildMultiselectConfig,
  formatReadOnlyFeatures,
} from "./commands/interactive";

// ===========================================================================
// JSON Schema structural validation (AC 15, 16, 18)
// ===========================================================================

/**
 * Minimal structural schema validator.
 *
 * We don't pull in ajv for a handful of structural checks.
 * Instead, we validate the schema files are well-formed JSON Schema 2020-12
 * and then test them against known-good and known-bad configs structurally.
 */

// import.meta.dir is tools/dx/src/ — go up three levels to reach the repo root
const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
const SCHEMA_DIR = resolve(REPO_ROOT, ".dx");

// Parse schemas once — reused across describe blocks that validate the same files.
const configSchema = JSON.parse(
  readFileSync(resolve(SCHEMA_DIR, "config.schema.json"), "utf-8"),
);
const localSchema = JSON.parse(
  readFileSync(resolve(SCHEMA_DIR, "config.local.schema.json"), "utf-8"),
);

describe("config.schema.json — structure (AC 15, 18)", () => {
  const schema = configSchema;

  test("uses JSON Schema 2020-12 dialect", () => {
    expect(schema.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
  });

  test("root type is object", () => {
    expect(schema.type).toBe("object");
  });

  test("requires 'features' at root", () => {
    expect(schema.required).toContain("features");
  });

  test("allows $schema string property", () => {
    expect(schema.properties.$schema).toEqual({ type: "string" });
  });

  test("features additionalProperties define feature shape", () => {
    const featureDef = schema.properties.features.additionalProperties;

    expect(featureDef.required).toEqual(["description", "mechanism", "default"]);
    expect(featureDef.properties.description).toEqual({ type: "string" });
    expect(featureDef.properties.mechanism).toEqual({ type: "string" });

    // default accepts boolean | string | number
    const defaultTypes = featureDef.properties.default.oneOf.map(
      (s: any) => s.type,
    );
    expect(defaultTypes.sort()).toEqual(["boolean", "number", "string"]);
  });

  test("users additionalProperties define user shape", () => {
    const userDef = schema.properties.users.additionalProperties;

    expect(userDef.required).toEqual(["aliases", "overrides"]);
    expect(userDef.properties.aliases.type).toBe("array");
    expect(userDef.properties.aliases.items).toEqual({ type: "string" });

    // overrides accept boolean | string | number
    const overrideTypes =
      userDef.properties.overrides.additionalProperties.oneOf.map(
        (s: any) => s.type,
      );
    expect(overrideTypes.sort()).toEqual(["boolean", "number", "string"]);
  });

  test("disallows additional properties at root level", () => {
    expect(schema.additionalProperties).toBe(false);
  });

  test("disallows additional properties in feature definitions", () => {
    expect(
      schema.properties.features.additionalProperties.additionalProperties,
    ).toBe(false);
  });

  test("disallows additional properties in user definitions", () => {
    expect(
      schema.properties.users.additionalProperties.additionalProperties,
    ).toBe(false);
  });
});

describe("config.local.schema.json — structure (AC 16, 18)", () => {
  const schema = localSchema;

  test("uses JSON Schema 2020-12 dialect", () => {
    expect(schema.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
  });

  test("root type is object", () => {
    expect(schema.type).toBe("object");
  });

  test("requires 'overrides' at root", () => {
    expect(schema.required).toContain("overrides");
  });

  test("allows $schema string property", () => {
    expect(schema.properties.$schema).toEqual({ type: "string" });
  });

  test("overrides accept boolean | string | number values", () => {
    const overrideTypes =
      schema.properties.overrides.additionalProperties.oneOf.map(
        (s: any) => s.type,
      );
    expect(overrideTypes.sort()).toEqual(["boolean", "number", "string"]);
  });

  test("disallows additional properties at root level", () => {
    expect(schema.additionalProperties).toBe(false);
  });
});

describe("config files reference their schemas (AC 17)", () => {
  test("config.json has $schema pointing to config.schema.json", () => {
    const config = JSON.parse(
      readFileSync(resolve(SCHEMA_DIR, "config.json"), "utf-8"),
    );
    expect(config.$schema).toBe("./config.schema.json");
  });

  test("config.local.json has $schema pointing to config.local.schema.json", () => {
    // config.local.json is gitignored and only created when local overrides are set.
    // Skip rather than fail when the file doesn't exist (e.g. in CI).
    const localPath = resolve(SCHEMA_DIR, "config.local.json");
    if (!existsSync(localPath)) {
      return;
    }
    const local = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(local.$schema).toBe("./config.local.schema.json");
  });
});

describe("schema enforces typed defaults (AC 18)", () => {
  /**
   * Structural validation: verify that the schema allows all three value
   * types in the correct places and rejects invalid structures.
   *
   * We reuse the configSchema parsed above to avoid redundant file reads.
   */

  test("actual config.json validates structurally against schema expectations", () => {
    // Load the real config and verify it matches the shapes the schema expects
    const config = JSON.parse(
      readFileSync(resolve(SCHEMA_DIR, "config.json"), "utf-8"),
    );

    // Must have features object
    expect(typeof config.features).toBe("object");

    // Each feature must have description (string), mechanism (string), default (bool|str|num)
    for (const [_name, def] of Object.entries(config.features) as [string, any][]) {
      expect(typeof def.description).toBe("string");
      expect(typeof def.mechanism).toBe("string");
      expect(["boolean", "string", "number"]).toContain(typeof def.default);
    }

    // Each user must have aliases (array) and overrides (object)
    if (config.users) {
      for (const [, user] of Object.entries(config.users) as [string, any][]) {
        expect(Array.isArray(user.aliases)).toBe(true);
        expect(typeof user.overrides).toBe("object");

        // Override values must be boolean | string | number
        for (const val of Object.values(user.overrides)) {
          expect(["boolean", "string", "number"]).toContain(typeof val);
        }
      }
    }
  });

  test("schema rejects feature definitions with invalid default types", () => {
    // Verify the schema's oneOf constraint only permits scalar types.
    // An array, object, or null value should NOT be representable in the
    // allowed types list — confirming the schema would reject them.
    const allowedTypes = new Set(
      configSchema.properties.features.additionalProperties.properties.default.oneOf.map(
        (s: any) => s.type,
      ),
    );

    // These types must NOT be in the allowed set
    expect(allowedTypes.has("array")).toBe(false);
    expect(allowedTypes.has("object")).toBe(false);
    expect(allowedTypes.has("null")).toBe(false);

    // Only the three scalar types are permitted
    expect(allowedTypes.size).toBe(3);
    expect(allowedTypes.has("boolean")).toBe(true);
    expect(allowedTypes.has("string")).toBe(true);
    expect(allowedTypes.has("number")).toBe(true);
  });

  test("schema rejects user overrides with invalid value types", () => {
    const allowedTypes = new Set(
      configSchema.properties.users.additionalProperties.properties.overrides
        .additionalProperties.oneOf.map((s: any) => s.type),
    );

    expect(allowedTypes.has("array")).toBe(false);
    expect(allowedTypes.has("object")).toBe(false);
    expect(allowedTypes.has("null")).toBe(false);
    expect(allowedTypes.size).toBe(3);
  });
});

// ===========================================================================
// Interactive picker — non-boolean features shown read-only (AC 10)
// ===========================================================================

describe("buildInteractiveOptions — read-only for non-booleans (AC 10)", () => {
  function makeMixedContext() {
    return makeContext({
      config: makeConfig({
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
          "tips.enabled": {
            description: "Show tips in status line",
            mechanism: "tip statusline checks this",
            default: true,
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
          "max-retries": {
            description: "Maximum retry count",
            mechanism: "retry logic",
            default: 3,
          },
        },
      }),
      env: {},
    });
  }

  test("boolean features have readOnly: false", () => {
    const ctx = makeMixedContext();
    const options = buildInteractiveOptions(ctx);

    const booleans = options.filter(
      (o) => typeof ctx.config.features[o.value].default === "boolean",
    );

    for (const opt of booleans) {
      expect(opt.readOnly).toBe(false);
    }
  });

  test("string features have readOnly: true", () => {
    const ctx = makeMixedContext();
    const options = buildInteractiveOptions(ctx);

    const showDuration = options.find(
      (o) => o.value === "tips.show-duration",
    )!;
    expect(showDuration.readOnly).toBe(true);
    expect(showDuration.currentValue).toBe("10m");
  });

  test("number features have readOnly: true", () => {
    const ctx = makeMixedContext();
    const options = buildInteractiveOptions(ctx);

    const maxRetries = options.find((o) => o.value === "max-retries")!;
    expect(maxRetries.readOnly).toBe(true);
    expect(maxRetries.currentValue).toBe(3);
  });

  test("readOnly reflects resolved value (respects overrides)", () => {
    const ctx = makeContext({
      config: makeConfig({
        features: {
          "tips.show-duration": {
            description: "How long a tip stays visible",
            mechanism: "tip statusline timing parameter",
            default: "10m",
          },
        },
      }),
      local: { overrides: { "tips.show-duration": "5m" } },
      env: {},
    });

    const options = buildInteractiveOptions(ctx);
    const showDuration = options.find(
      (o) => o.value === "tips.show-duration",
    )!;

    expect(showDuration.readOnly).toBe(true);
    expect(showDuration.currentValue).toBe("5m");
  });
});

describe("buildMultiselectConfig — excludes read-only options (AC 10)", () => {
  test("non-boolean features are excluded from multiselect options", () => {
    const ctx = makeContext({
      config: makeConfig({
        features: {
          "ci-watcher": {
            description: "Monitor CI after push",
            mechanism: "Claude PostToolUse hook",
            default: true,
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
        },
      }),
      env: {},
    });

    const options = buildInteractiveOptions(ctx);
    const config = buildMultiselectConfig(options);

    // Only ci-watcher should appear in the multiselect
    expect(config.options).toHaveLength(1);
    expect(config.options[0].value).toBe("ci-watcher");
  });

  test("initialValues only includes toggleable (boolean) features", () => {
    const ctx = makeContext({
      config: makeConfig({
        features: {
          "ci-watcher": {
            description: "Monitor CI",
            mechanism: "hook",
            default: true,
          },
          autosync: {
            description: "Auto sync",
            mechanism: "hook",
            default: false,
          },
          "tips.show-duration": {
            description: "Duration",
            mechanism: "timing",
            default: "10m",
          },
        },
      }),
      env: {},
    });

    const options = buildInteractiveOptions(ctx);
    const config = buildMultiselectConfig(options);

    // ci-watcher is enabled (true default), autosync is disabled (false default)
    // tips.show-duration is excluded entirely
    expect(config.initialValues).toEqual(["ci-watcher"]);
  });
});

describe("formatReadOnlyFeatures — display hint for non-booleans (AC 10)", () => {
  test("formats non-boolean features with value and dx set hint", () => {
    const ctx = makeContext({
      config: makeConfig({
        features: {
          "ci-watcher": {
            description: "Monitor CI",
            mechanism: "hook",
            default: true,
          },
          "tips.show-duration": {
            description: "How long a tip stays visible",
            mechanism: "timing",
            default: "10m",
          },
          "tips.rest-duration": {
            description: "Quiet period between tips",
            mechanism: "timing",
            default: "2h",
          },
        },
      }),
      env: {},
    });

    const options = buildInteractiveOptions(ctx);
    const lines = formatReadOnlyFeatures(options);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("tips.show-duration = 10m");
    expect(lines[0]).toContain("use `dx set` to change");
    expect(lines[1]).toContain("tips.rest-duration = 2h");
    expect(lines[1]).toContain("use `dx set` to change");
  });

  test("returns empty array when all features are boolean", () => {
    const ctx = makeContext({
      config: makeConfig({
        features: {
          "ci-watcher": {
            description: "Monitor CI",
            mechanism: "hook",
            default: true,
          },
          autosync: {
            description: "Auto sync",
            mechanism: "hook",
            default: false,
          },
        },
      }),
      env: {},
    });

    const options = buildInteractiveOptions(ctx);
    const lines = formatReadOnlyFeatures(options);

    expect(lines).toHaveLength(0);
  });

  test("shows number values correctly", () => {
    const ctx = makeContext({
      config: makeConfig({
        features: {
          "max-retries": {
            description: "Maximum retry count",
            mechanism: "retry logic",
            default: 3,
          },
        },
      }),
      env: {},
    });

    const options = buildInteractiveOptions(ctx);
    const lines = formatReadOnlyFeatures(options);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("max-retries = 3");
  });
});

// ===========================================================================
// Tip CLI — getValue integration (AC 5 consumer)
// ===========================================================================

describe("tip CLI — getValue integration", () => {
  test("dx SDK exports getValue method", async () => {
    // Verify the SDK method exists and is callable.
    // The actual tip CLI uses dx.getValue("tips.show-duration") which
    // returns the resolved typed value through the three-layer merge chain.
    const { default: dx } = await import("../sdk");

    expect(typeof dx.getValue).toBe("function");
  });

  test("getValue returns typed values (not booleans) for duration features", async () => {
    // Use the core getValue directly with a test context to verify
    // the tip CLI's usage pattern works correctly.
    const { getValue } = await import("./core");

    const ctx = makeContext({
      config: makeConfig({
        features: {
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
        },
      }),
      env: {},
    });

    expect(getValue("tips.show-duration", ctx)).toBe("10m");
    expect(getValue("tips.rest-duration", ctx)).toBe("2h");
  });

  test("getValue respects local overrides (tip CLI pattern)", async () => {
    const { getValue } = await import("./core");

    const ctx = makeContext({
      config: makeConfig({
        features: {
          "tips.show-duration": {
            description: "How long a tip stays visible",
            mechanism: "tip statusline timing parameter",
            default: "10m",
          },
        },
      }),
      local: { overrides: { "tips.show-duration": "5m" } },
      env: {},
    });

    // Local override should win over default
    expect(getValue("tips.show-duration", ctx)).toBe("5m");
  });
});
