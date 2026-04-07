/**
 * Slice 2 — dx set, typed resolve output, typed status display.
 *
 * Tests for:
 * - parseCliValue: auto-detect CLI string -> typed value (AC 7)
 * - dx set: command structure and persistence (AC 6)
 * - dx resolve: output typed values, not just true/false (AC 8)
 * - dx status: display typed values for non-booleans (AC 9)
 *
 * All tests use `test.failing` — they define the Red phase for
 * ENG-4687 Slice 2 and will pass once the implementation lands.
 *
 * Part of: ENG-4687
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Command } from "commander";

// --- Existing imports (static — these modules exist today) ---
import { makeConfig, makeContext } from "./test-fixtures";
import type { FeatureInfo } from "./core";
import {
  formatResolve,
  formatResolveJson,
} from "./commands/resolve";
import {
  buildStatusData,
  formatStatus,
  formatStatusJson,
  type StatusData,
} from "./commands/status";

// ===========================================================================
// parseCliValue — auto-detect CLI string -> typed value (AC 7)
// ===========================================================================

describe("parseCliValue", () => {
  // Lazy import: the set module does not exist yet.
  // Every test in this block will fail at require() time.
  // Cached at describe level so the require() isn't repeated in every test.
  let parseCliValue: (raw: string) => boolean | string | number;

  function ensureImported() {
    if (!parseCliValue) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("./commands/set");
      parseCliValue = mod.parseCliValue;
    }
  }

  test('"true" -> true (boolean)', () => {
    ensureImported();
    expect(parseCliValue("true")).toBe(true);
  });

  test('"false" -> false (boolean)', () => {
    ensureImported();
    expect(parseCliValue("false")).toBe(false);
  });

  test('"TRUE" -> true (case-insensitive)', () => {
    ensureImported();
    expect(parseCliValue("TRUE")).toBe(true);
  });

  test('"42" -> 42 (number)', () => {
    ensureImported();
    expect(parseCliValue("42")).toBe(42);
  });

  test('"0" -> 0 (number)', () => {
    ensureImported();
    expect(parseCliValue("0")).toBe(0);
  });

  test('"3.14" -> 3.14 (number)', () => {
    ensureImported();
    expect(parseCliValue("3.14")).toBe(3.14);
  });

  test('"-1" -> -1 (number)', () => {
    ensureImported();
    expect(parseCliValue("-1")).toBe(-1);
  });

  test('"10m" -> "10m" (string — not a number)', () => {
    ensureImported();
    expect(parseCliValue("10m")).toBe("10m");
  });

  test('"" -> "" (empty string)', () => {
    ensureImported();
    expect(parseCliValue("")).toBe("");
  });

  test('"hello" -> "hello" (string)', () => {
    ensureImported();
    expect(parseCliValue("hello")).toBe("hello");
  });

  test('"Infinity" -> "Infinity" (string, not a number — Number.isFinite check)', () => {
    ensureImported();
    expect(parseCliValue("Infinity")).toBe("Infinity");
  });

  test('"NaN" -> "NaN" (string, not a number)', () => {
    ensureImported();
    expect(parseCliValue("NaN")).toBe("NaN");
  });
});

// ===========================================================================
// dx set — command structure and format output (AC 6)
// ===========================================================================

describe("dx set — command structure", () => {
  // Lazy import: buildSetCommand does not exist yet
  function getBuildSetCommand(): () => Command {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./commands/set");
    return mod.buildSetCommand;
  }

  test("buildSetCommand returns a Command instance", () => {
    const buildSetCommand = getBuildSetCommand();
    const cmd = buildSetCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("buildSetCommand has name 'set'", () => {
    const buildSetCommand = getBuildSetCommand();
    const cmd = buildSetCommand();
    expect(cmd.name()).toBe("set");
  });

  test("buildSetCommand accepts <feature> and <value> arguments", () => {
    const buildSetCommand = getBuildSetCommand();
    const cmd = buildSetCommand();
    const args = (cmd as any)._args;
    expect(args).toHaveLength(2);
    expect(args[0].required).toBe(true);
    expect(args[1].required).toBe(true);
  });

  test("buildSetCommand has --save option", () => {
    const buildSetCommand = getBuildSetCommand();
    const cmd = buildSetCommand();
    const saveOpt = cmd.options.find((o: any) => o.long === "--save");
    expect(saveOpt).toBeDefined();
  });

  test("buildSetCommand has --json option", () => {
    const buildSetCommand = getBuildSetCommand();
    const cmd = buildSetCommand();
    const jsonOpt = cmd.options.find((o: any) => o.long === "--json");
    expect(jsonOpt).toBeDefined();
  });
});

describe("dx set — format output", () => {
  // Lazy import: formatSetResult and formatSetResultJson do not exist yet
  function getFormatSetResult(): (
    feature: string,
    value: boolean | string | number,
    saved: boolean,
    user: string | null,
  ) => string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./commands/set");
    return mod.formatSetResult;
  }

  function getFormatSetResultJson(): (
    feature: string,
    value: boolean | string | number,
    saved: boolean,
    user: string | null,
  ) => string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./commands/set");
    return mod.formatSetResultJson;
  }

  test("reports string value in human output (local)", () => {
    const formatSetResult = getFormatSetResult();
    const output = formatSetResult("tips.show-duration", "5m", false, null);
    // Per spec: dx: tips.show-duration = "5m" (local)
    expect(output).toContain("tips.show-duration");
    expect(output).toContain("5m");
    expect(output).toContain("local");
  });

  test("reports number value in human output (local)", () => {
    const formatSetResult = getFormatSetResult();
    const output = formatSetResult("tips.max-count", 42, false, null);
    expect(output).toContain("tips.max-count");
    expect(output).toContain("42");
    expect(output).toContain("local");
  });

  test("reports boolean value in human output (local)", () => {
    const formatSetResult = getFormatSetResult();
    const output = formatSetResult("ci-watcher", true, false, null);
    expect(output).toContain("ci-watcher");
    expect(output).toContain("true");
    expect(output).toContain("local");
  });

  test("reports saved value with user in human output", () => {
    const formatSetResult = getFormatSetResult();
    const output = formatSetResult("tips.show-duration", "5m", true, "nitsan");
    expect(output).toContain("tips.show-duration");
    expect(output).toContain("5m");
    expect(output).toContain("nitsan");
    expect(output).toContain("config.json");
  });

  test("JSON output includes feature, value, target", () => {
    const formatSetResultJson = getFormatSetResultJson();
    const output = formatSetResultJson("tips.show-duration", "10m", false, null);
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("tips.show-duration");
    expect(parsed.value).toBe("10m");
    expect(parsed.target).toBe("local");
  });

  test("JSON output for saved includes user", () => {
    const formatSetResultJson = getFormatSetResultJson();
    const output = formatSetResultJson("tips.show-duration", "5m", true, "nitsan");
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("tips.show-duration");
    expect(parsed.value).toBe("5m");
    expect(parsed.target).toBe("config");
    expect(parsed.user).toBe("nitsan");
  });

  test("formatSetResultJson returns valid JSON", () => {
    const formatSetResultJson = getFormatSetResultJson();
    const output = formatSetResultJson("ci-watcher", true, false, null);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test("local (non-saved) output includes persistence hint", () => {
    const formatSetResult = getFormatSetResult();
    const output = formatSetResult("tips.show-duration", "5m", false, null);
    // Hint tells the user how to persist across environments
    expect(output).toContain("dx set");
  });
});

describe("dx set — typed persistence", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dx-set-persist-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // These tests verify that writeLocalOverride/writeUserOverride accept
  // typed values (FeatureValue, not just boolean). Currently the TypeScript
  // signatures restrict to boolean — calling with a string/number should
  // be a type error that we bypass via the set module's own write path.

  test("set module writes string value to local config", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeTypedLocalOverride } = require("./commands/set");
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, JSON.stringify({ overrides: {} }));

    writeTypedLocalOverride(localPath, "tips.show-duration", "10m");

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["tips.show-duration"]).toBe("10m");
  });

  test("set module writes number value to local config", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeTypedLocalOverride } = require("./commands/set");
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, JSON.stringify({ overrides: {} }));

    writeTypedLocalOverride(localPath, "tips.max-count", 42);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["tips.max-count"]).toBe(42);
  });

  test("set module writes boolean value to local config", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeTypedLocalOverride } = require("./commands/set");
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, JSON.stringify({ overrides: {} }));

    writeTypedLocalOverride(localPath, "ci-watcher", true);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["ci-watcher"]).toBe(true);
  });

  test("set module writes typed value to user config via --save", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeTypedUserOverride } = require("./commands/set");
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {
          nitsan: { aliases: [], overrides: {} },
        },
      }),
    );

    writeTypedUserOverride(configPath, "nitsan", "tips.show-duration", "5m");

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.nitsan.overrides["tips.show-duration"]).toBe("5m");
  });

  test("creates local config file when it doesn't exist yet", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeTypedLocalOverride } = require("./commands/set");
    const localPath = join(tempDir, "config.local.json");
    // Intentionally NOT seeding the file — it shouldn't exist yet.

    writeTypedLocalOverride(localPath, "tips.show-duration", "10m");

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["tips.show-duration"]).toBe("10m");
  });
});

// ===========================================================================
// dx resolve — typed output (AC 8)
//
// FeatureInfo already has a `value` field (added in Slice 1). After Slice 2,
// formatResolve uses String(info.value) instead of the enabled boolean.
// These tests verify that non-boolean values produce correct resolve output.
// ===========================================================================

describe("dx resolve — typed output", () => {
  // Current formatResolve returns info.enabled ? "true" : "false".
  // After Slice 2 it should return String(info.value).
  // For boolean features the output is identical — but for string/number
  // features the output changes.

  test('string feature "10m": outputs "10m" (not "true")', () => {
    // FeatureInfo already has `value` (added in Slice 1), but formatResolve
    // ignores it — it still returns `info.enabled ? "true" : "false"`.
    // This test fails because formatResolve doesn't USE `value` yet.
    const info = {
      value: "10m",
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolve("tips.show-duration", info as FeatureInfo);
    // Current implementation returns "true" — this expects "10m"
    expect(output).toBe("10m");
  });

  test("number feature 42: outputs '42'", () => {
    const info = {
      value: 42,
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolve("tips.max-count", info as FeatureInfo);
    // Current implementation returns "true" — this expects "42"
    expect(output).toBe("42");
  });

  test("number feature 0: outputs '0' (not 'false')", () => {
    const info = {
      value: 0,
      enabled: false,
      source: "default" as const,
    };
    const output = formatResolve("tips.max-count", info as FeatureInfo);
    // Current implementation returns "false" — this expects "0"
    expect(output).toBe("0");
  });

  test("empty string feature: outputs empty string (not 'false')", () => {
    const info = {
      value: "",
      enabled: false,
      source: "default" as const,
    };
    const output = formatResolve("tips.label", info as FeatureInfo);
    // Current implementation returns "false" — this expects ""
    expect(output).toBe("");
  });

  test("JSON mode: includes typed value field for string", () => {
    const info = {
      value: "10m",
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolveJson("tips.show-duration", info as FeatureInfo);
    const parsed = JSON.parse(output);
    // Current JSON output has {feature, enabled, source} — no value field
    expect(parsed.value).toBe("10m");
  });

  test("JSON mode: includes typed value field for number", () => {
    const info = {
      value: 42,
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolveJson("tips.max-count", info as FeatureInfo);
    const parsed = JSON.parse(output);
    expect(parsed.value).toBe(42);
  });

  test("JSON mode: includes typed value field for boolean", () => {
    const info = {
      value: true,
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolveJson("ci-watcher", info as FeatureInfo);
    const parsed = JSON.parse(output);
    // Verify the full shape: feature, value, enabled, source
    expect(parsed.feature).toBe("ci-watcher");
    expect(parsed.value).toBe(true);
    expect(parsed.enabled).toBe(true);
    expect(parsed.source).toBe("default");
  });
});

// ===========================================================================
// dx status — typed display (AC 9)
//
// After Slice 2, formatStatus renders non-boolean features differently:
// - Booleans: "on"/"off" as before
// - Strings: show the actual value (e.g., "10m")
// - Numbers: show the actual number (e.g., "42")
// Overridden non-booleans uppercase the value (e.g., "10M~" for local).
// ===========================================================================

describe("dx status — typed display", () => {
  /**
   * Build a StatusData with mixed-type features.
   * After Slice 2, each feature carries a `value` field alongside `enabled`.
   */
  function makeTypedStatusData(): StatusData {
    return {
      user: "nitsan",
      features: {
        "ci-watcher": {
          enabled: true,
          source: "user-override" as const,
          description: "Monitor CI after push",
          value: true,
        } as FeatureInfo & { description: string },
        autosync: {
          enabled: false,
          source: "default" as const,
          description: "Push to origin after every commit",
          value: false,
        } as FeatureInfo & { description: string },
        "tips.show-duration": {
          enabled: true,
          source: "default" as const,
          description: "How long a tip stays visible",
          value: "10m",
        } as FeatureInfo & { description: string },
        "tips.max-count": {
          enabled: true,
          source: "local-override" as const,
          description: "Maximum tips to show",
          value: 42,
        } as FeatureInfo & { description: string },
      },
    };
  }

  // These tests fail because formatStatus's rendering logic currently renders
  // "on"/"off" based on `enabled`, ignoring the `value` field entirely.
  // The type system is fine — FeatureInfo already carries `value` from Slice 1.

  test("string features show the actual value, not on/off", () => {
    const data = makeTypedStatusData();
    const output = formatStatus(data);
    const lines = output.split("\n");

    // tips.show-duration has value "10m" — should display "10m", not "on"
    const durationLine = lines.find((l) => l.includes("tips.show-duration"));
    expect(durationLine).toBeDefined();
    expect(durationLine).toContain("10m");
    // Should NOT show "on" for string features
    // Use word boundary to avoid matching inside "duration" etc.
    expect(durationLine!.replace("tips.show-duration", "")).not.toMatch(
      /\bon\b/i,
    );
  });

  test("number features show the actual number, not on/off", () => {
    const data = makeTypedStatusData();
    const output = formatStatus(data);
    const lines = output.split("\n");

    // tips.max-count has value 42 — should display "42", not "on"
    const countLine = lines.find((l) => l.includes("tips.max-count"));
    expect(countLine).toBeDefined();
    expect(countLine).toContain("42");
    expect(countLine!.replace("tips.max-count", "")).not.toMatch(/\bon\b/i);
  });

  test("overridden string features uppercase the value", () => {
    const data: StatusData = {
      user: "nitsan",
      features: {
        "tips.show-duration": {
          enabled: true,
          source: "local-override" as const,
          description: "How long a tip stays visible",
          value: "10m",
        } as FeatureInfo & { description: string },
      },
    };
    const output = formatStatus(data);
    const line = output.split("\n").find((l) => l.includes("tips.show-duration"));
    expect(line).toBeDefined();
    // Per spec: overridden non-booleans uppercase the value: "10m" -> "10M"
    expect(line).toContain("10M");
    // The ~ marker is the universal override indicator
    expect(line).toContain("~");
  });

  test("overridden number features show ~ marker (uppercasing is a no-op)", () => {
    // For numbers, uppercasing is a no-op — the ~ marker is the only
    // visual indicator that the value is overridden.
    const data: StatusData = {
      user: "nitsan",
      features: {
        "tips.max-count": {
          enabled: true,
          source: "local-override" as const,
          description: "Maximum tips to show",
          value: 42,
        } as FeatureInfo & { description: string },
      },
    };
    const output = formatStatus(data);
    const line = output.split("\n").find((l) => l.includes("tips.max-count"));
    expect(line).toBeDefined();
    expect(line).toContain("42");
    expect(line).toContain("~");
  });

  test("formatStatus uses typed value in display for string feature", () => {
    // Build a real context with typed features, run through buildStatusData,
    // then format. After Slice 2, formatStatus should show "10m" not "on".
    const ctx = makeContext({
      config: makeConfig({
        features: {
          "ci-watcher": {
            description: "Monitor CI after push",
            mechanism: "hook",
            default: true,
          },
          "tips.show-duration": {
            description: "How long a tip stays visible",
            mechanism: "timing",
            default: "10m",
          },
        },
      }),
    });

    const data = buildStatusData(ctx);
    const output = formatStatus(data);
    const lines = output.split("\n");

    // tips.show-duration should show "10m", not "on"
    const durationLine = lines.find((l: string) => l.includes("tips.show-duration"));
    expect(durationLine).toBeDefined();
    expect(durationLine).toContain("10m");
    // Remove the feature name to avoid false matches, then verify no "on"
    expect(durationLine!.replace("tips.show-duration", "")).not.toMatch(
      /\bon\b/i,
    );
  });

  test("formatStatus uses typed value in display for number feature", () => {
    const ctx = makeContext({
      config: makeConfig({
        features: {
          "tips.max-count": {
            description: "Maximum tips to show",
            mechanism: "counter",
            default: 42,
          },
        },
      }),
    });

    const data = buildStatusData(ctx);
    const output = formatStatus(data);
    const lines = output.split("\n");

    // tips.max-count should show "42", not "on"
    const countLine = lines.find((l: string) => l.includes("tips.max-count"));
    expect(countLine).toBeDefined();
    expect(countLine).toContain("42");
    expect(countLine!.replace("tips.max-count", "")).not.toMatch(/\bon\b/i);
  });
});
