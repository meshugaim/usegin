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
  function getParseCliValue(): (raw: string) => boolean | string | number {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./commands/set");
    return mod.parseCliValue;
  }

  test.failing('"true" -> true (boolean)', () => {
    const parseCliValue = getParseCliValue();
    expect(parseCliValue("true")).toBe(true);
  });

  test.failing('"false" -> false (boolean)', () => {
    const parseCliValue = getParseCliValue();
    expect(parseCliValue("false")).toBe(false);
  });

  test.failing('"TRUE" -> true (case-insensitive)', () => {
    const parseCliValue = getParseCliValue();
    expect(parseCliValue("TRUE")).toBe(true);
  });

  test.failing('"42" -> 42 (number)', () => {
    const parseCliValue = getParseCliValue();
    expect(parseCliValue("42")).toBe(42);
  });

  test.failing('"0" -> 0 (number)', () => {
    const parseCliValue = getParseCliValue();
    expect(parseCliValue("0")).toBe(0);
  });

  test.failing('"3.14" -> 3.14 (number)', () => {
    const parseCliValue = getParseCliValue();
    expect(parseCliValue("3.14")).toBe(3.14);
  });

  test.failing('"-1" -> -1 (number)', () => {
    const parseCliValue = getParseCliValue();
    expect(parseCliValue("-1")).toBe(-1);
  });

  test.failing('"10m" -> "10m" (string — not a number)', () => {
    const parseCliValue = getParseCliValue();
    expect(parseCliValue("10m")).toBe("10m");
  });

  test.failing('"" -> "" (empty string)', () => {
    const parseCliValue = getParseCliValue();
    expect(parseCliValue("")).toBe("");
  });

  test.failing('"hello" -> "hello" (string)', () => {
    const parseCliValue = getParseCliValue();
    expect(parseCliValue("hello")).toBe("hello");
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

  test.failing("buildSetCommand returns a Command instance", () => {
    const buildSetCommand = getBuildSetCommand();
    const cmd = buildSetCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test.failing("buildSetCommand has name 'set'", () => {
    const buildSetCommand = getBuildSetCommand();
    const cmd = buildSetCommand();
    expect(cmd.name()).toBe("set");
  });

  test.failing("buildSetCommand accepts <feature> and <value> arguments", () => {
    const buildSetCommand = getBuildSetCommand();
    const cmd = buildSetCommand();
    const args = (cmd as any)._args;
    expect(args).toHaveLength(2);
    expect(args[0].required).toBe(true);
    expect(args[1].required).toBe(true);
  });

  test.failing("buildSetCommand has --save option", () => {
    const buildSetCommand = getBuildSetCommand();
    const cmd = buildSetCommand();
    const saveOpt = cmd.options.find((o: any) => o.long === "--save");
    expect(saveOpt).toBeDefined();
  });

  test.failing("buildSetCommand has --json option", () => {
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

  test.failing("reports string value in human output (local)", () => {
    const formatSetResult = getFormatSetResult();
    const output = formatSetResult("tips.show-duration", "5m", false, null);
    // Per spec: dx: tips.show-duration = "5m" (local)
    expect(output).toContain("tips.show-duration");
    expect(output).toContain("5m");
    expect(output).toContain("local");
  });

  test.failing("reports number value in human output (local)", () => {
    const formatSetResult = getFormatSetResult();
    const output = formatSetResult("tips.max-count", 42, false, null);
    expect(output).toContain("tips.max-count");
    expect(output).toContain("42");
    expect(output).toContain("local");
  });

  test.failing("reports boolean value in human output (local)", () => {
    const formatSetResult = getFormatSetResult();
    const output = formatSetResult("ci-watcher", true, false, null);
    expect(output).toContain("ci-watcher");
    expect(output).toContain("true");
    expect(output).toContain("local");
  });

  test.failing("reports saved value with user in human output", () => {
    const formatSetResult = getFormatSetResult();
    const output = formatSetResult("tips.show-duration", "5m", true, "nitsan");
    expect(output).toContain("tips.show-duration");
    expect(output).toContain("5m");
    expect(output).toContain("nitsan");
    expect(output).toContain("config.json");
  });

  test.failing("JSON output includes feature, value, target", () => {
    const formatSetResultJson = getFormatSetResultJson();
    const output = formatSetResultJson("tips.show-duration", "10m", false, null);
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("tips.show-duration");
    expect(parsed.value).toBe("10m");
    expect(parsed.target).toBe("local");
  });

  test.failing("JSON output for saved includes user", () => {
    const formatSetResultJson = getFormatSetResultJson();
    const output = formatSetResultJson("tips.show-duration", "5m", true, "nitsan");
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("tips.show-duration");
    expect(parsed.value).toBe("5m");
    expect(parsed.target).toBe("config");
    expect(parsed.user).toBe("nitsan");
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

  test.failing("set module writes string value to local config", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeTypedLocalOverride } = require("./commands/set");
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, JSON.stringify({ overrides: {} }));

    writeTypedLocalOverride(localPath, "tips.show-duration", "10m");

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["tips.show-duration"]).toBe("10m");
  });

  test.failing("set module writes number value to local config", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeTypedLocalOverride } = require("./commands/set");
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, JSON.stringify({ overrides: {} }));

    writeTypedLocalOverride(localPath, "tips.max-count", 42);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["tips.max-count"]).toBe(42);
  });

  test.failing("set module writes boolean value to local config", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeTypedLocalOverride } = require("./commands/set");
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, JSON.stringify({ overrides: {} }));

    writeTypedLocalOverride(localPath, "ci-watcher", true);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["ci-watcher"]).toBe(true);
  });

  test.failing("set module writes typed value to user config via --save", () => {
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
});

// ===========================================================================
// dx resolve — typed output (AC 8)
//
// After Slice 2, FeatureInfo gains a `value` field and formatResolve
// uses String(info.value) instead of the enabled boolean. These tests
// verify that non-boolean values produce correct resolve output.
// ===========================================================================

describe("dx resolve — typed output", () => {
  // Current formatResolve returns info.enabled ? "true" : "false".
  // After Slice 2 it should return String(info.value).
  // For boolean features the output is identical — but for string/number
  // features the output changes.

  test.failing('string feature "10m": outputs "10m" (not "true")', () => {
    // Build a FeatureInfo with `value: "10m"`.
    // Since FeatureInfo doesn't have `value` yet, this test will fail
    // until the type is widened and formatResolve is updated.
    const info = {
      value: "10m",
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolve("tips.show-duration", info as FeatureInfo);
    // Current implementation returns "true" — this expects "10m"
    expect(output).toBe("10m");
  });

  test.failing("number feature 42: outputs '42'", () => {
    const info = {
      value: 42,
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolve("tips.max-count", info as FeatureInfo);
    // Current implementation returns "true" — this expects "42"
    expect(output).toBe("42");
  });

  test.failing("number feature 0: outputs '0' (not 'false')", () => {
    const info = {
      value: 0,
      enabled: false,
      source: "default" as const,
    };
    const output = formatResolve("tips.max-count", info as FeatureInfo);
    // Current implementation returns "false" — this expects "0"
    expect(output).toBe("0");
  });

  test.failing("empty string feature: outputs empty string (not 'false')", () => {
    const info = {
      value: "",
      enabled: false,
      source: "default" as const,
    };
    const output = formatResolve("tips.label", info as FeatureInfo);
    // Current implementation returns "false" — this expects ""
    expect(output).toBe("");
  });

  test.failing("JSON mode: includes typed value field for string", () => {
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

  test.failing("JSON mode: includes typed value field for number", () => {
    const info = {
      value: 42,
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolveJson("tips.max-count", info as FeatureInfo);
    const parsed = JSON.parse(output);
    expect(parsed.value).toBe(42);
  });

  test.failing("JSON mode: includes typed value field for boolean", () => {
    const info = {
      value: true,
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolveJson("ci-watcher", info as FeatureInfo);
    const parsed = JSON.parse(output);
    // The JSON output should now include a `value` field
    expect(parsed).toHaveProperty("value");
    expect(parsed.value).toBe(true);
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

  test.failing("string features show the actual value, not on/off", () => {
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

  test.failing("number features show the actual number, not on/off", () => {
    const data = makeTypedStatusData();
    const output = formatStatus(data);
    const lines = output.split("\n");

    // tips.max-count has value 42 — should display "42", not "on"
    const countLine = lines.find((l) => l.includes("tips.max-count"));
    expect(countLine).toBeDefined();
    expect(countLine).toContain("42");
    expect(countLine!.replace("tips.max-count", "")).not.toMatch(/\bon\b/i);
  });

  test.failing("overridden string features uppercase the value", () => {
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
  });

  test.failing("formatStatus uses typed value in display for string feature", () => {
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

    const { buildStatusData } = require("./commands/status");
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

  test.failing("formatStatus uses typed value in display for number feature", () => {
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

    const { buildStatusData } = require("./commands/status");
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
