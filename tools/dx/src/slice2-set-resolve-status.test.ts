/**
 * Slice 2 — dx set, typed resolve output, typed status display.
 *
 * Tests for:
 * - parseCliValue: auto-detect CLI string -> typed value (AC 7)
 * - dx set: command structure and persistence (AC 6)
 * - dx resolve: output typed values, not just true/false (AC 8)
 * - dx status: display typed values for non-booleans (AC 9)
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
import {
  parseCliValue,
  buildSetCommand,
  formatSetResult,
  formatSetResultJson,
} from "./commands/set";
import {
  writeLocalOverride,
  writeUserOverride,
} from "./commands/enable-disable";

// ===========================================================================
// parseCliValue — auto-detect CLI string -> typed value (AC 7)
// ===========================================================================

describe("parseCliValue", () => {
  test('"true" -> true (boolean)', () => {
    expect(parseCliValue("true")).toBe(true);
  });

  test('"false" -> false (boolean)', () => {
    expect(parseCliValue("false")).toBe(false);
  });

  test('"TRUE" -> true (case-insensitive)', () => {
    expect(parseCliValue("TRUE")).toBe(true);
  });

  test('"42" -> 42 (number)', () => {
    expect(parseCliValue("42")).toBe(42);
  });

  test('"0" -> 0 (number)', () => {
    expect(parseCliValue("0")).toBe(0);
  });

  test('"3.14" -> 3.14 (number)', () => {
    expect(parseCliValue("3.14")).toBe(3.14);
  });

  test('"-1" -> -1 (number)', () => {
    expect(parseCliValue("-1")).toBe(-1);
  });

  test('"10m" -> "10m" (string — not a number)', () => {
    expect(parseCliValue("10m")).toBe("10m");
  });

  test('"" -> "" (empty string)', () => {
    expect(parseCliValue("")).toBe("");
  });

  test('"hello" -> "hello" (string)', () => {
    expect(parseCliValue("hello")).toBe("hello");
  });

  test('"Infinity" -> "Infinity" (string, not a number — Number.isFinite check)', () => {
    expect(parseCliValue("Infinity")).toBe("Infinity");
  });

  test('"NaN" -> "NaN" (string, not a number)', () => {
    expect(parseCliValue("NaN")).toBe("NaN");
  });
});

// ===========================================================================
// dx set — command structure and format output (AC 6)
// ===========================================================================

describe("dx set — command structure", () => {
  test("buildSetCommand returns a Command instance", () => {
    const cmd = buildSetCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("buildSetCommand has name 'set'", () => {
    const cmd = buildSetCommand();
    expect(cmd.name()).toBe("set");
  });

  test("buildSetCommand accepts <feature> and <value> arguments", () => {
    const cmd = buildSetCommand();
    const args = (cmd as any)._args;
    expect(args).toHaveLength(2);
    expect(args[0].required).toBe(true);
    expect(args[1].required).toBe(true);
  });

  test("buildSetCommand has --save option", () => {
    const cmd = buildSetCommand();
    const saveOpt = cmd.options.find((o: any) => o.long === "--save");
    expect(saveOpt).toBeDefined();
  });

  test("buildSetCommand has --json option", () => {
    const cmd = buildSetCommand();
    const jsonOpt = cmd.options.find((o: any) => o.long === "--json");
    expect(jsonOpt).toBeDefined();
  });
});

describe("dx set — format output", () => {
  test("reports string value in human output (local)", () => {
    const output = formatSetResult("tips.show-duration", "5m", false, null);
    // Per spec: dx: tips.show-duration = "5m" (local)
    expect(output).toContain("tips.show-duration");
    expect(output).toContain("5m");
    expect(output).toContain("local");
  });

  test("reports number value in human output (local)", () => {
    const output = formatSetResult("tips.max-count", 42, false, null);
    expect(output).toContain("tips.max-count");
    expect(output).toContain("42");
    expect(output).toContain("local");
  });

  test("reports boolean value in human output (local)", () => {
    const output = formatSetResult("ci-watcher", true, false, null);
    expect(output).toContain("ci-watcher");
    expect(output).toContain("true");
    expect(output).toContain("local");
  });

  test("reports saved value with user in human output", () => {
    const output = formatSetResult("tips.show-duration", "5m", true, "nitsan");
    expect(output).toContain("tips.show-duration");
    expect(output).toContain("5m");
    expect(output).toContain("nitsan");
    expect(output).toContain("config.json");
  });

  test("JSON output includes feature, value, target", () => {
    const output = formatSetResultJson("tips.show-duration", "10m", false, null);
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("tips.show-duration");
    expect(parsed.value).toBe("10m");
    expect(parsed.target).toBe("local");
  });

  test("JSON output for saved includes user", () => {
    const output = formatSetResultJson("tips.show-duration", "5m", true, "nitsan");
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("tips.show-duration");
    expect(parsed.value).toBe("5m");
    expect(parsed.target).toBe("config");
    expect(parsed.user).toBe("nitsan");
  });

  test("formatSetResultJson returns valid JSON", () => {
    const output = formatSetResultJson("ci-watcher", true, false, null);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test("local (non-saved) output includes persistence hint", () => {
    const output = formatSetResult("tips.show-duration", "5m", false, null);
    // Hint tells the user how to persist across environments
    expect(output).toContain("dx set");
  });

  test("hint quotes string values for copy-paste correctness", () => {
    const output = formatSetResult("tips.label", "", false, null);
    // Empty string should be quoted in the hint: dx set tips.label "" --save
    expect(output).toContain('""');
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

  test("writeLocalOverride writes string value to local config", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, JSON.stringify({ overrides: {} }));

    writeLocalOverride(localPath, "tips.show-duration", "10m");

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["tips.show-duration"]).toBe("10m");
  });

  test("writeLocalOverride writes number value to local config", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, JSON.stringify({ overrides: {} }));

    writeLocalOverride(localPath, "tips.max-count", 42);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["tips.max-count"]).toBe(42);
  });

  test("writeLocalOverride writes boolean value to local config", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, JSON.stringify({ overrides: {} }));

    writeLocalOverride(localPath, "ci-watcher", true);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["ci-watcher"]).toBe(true);
  });

  test("writeUserOverride writes typed value to user config", () => {
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

    writeUserOverride(configPath, "nitsan", "tips.show-duration", "5m");

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.nitsan.overrides["tips.show-duration"]).toBe("5m");
  });

  test("writeLocalOverride creates local config file when it doesn't exist yet", () => {
    const localPath = join(tempDir, "config.local.json");
    // Intentionally NOT seeding the file -- it shouldn't exist yet.

    writeLocalOverride(localPath, "tips.show-duration", "10m");

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["tips.show-duration"]).toBe("10m");
  });
});

// ===========================================================================
// dx resolve — typed output (AC 8)
// ===========================================================================

describe("dx resolve — typed output", () => {
  test('string feature "10m": outputs "10m" (not "true")', () => {
    const info = {
      value: "10m",
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolve("tips.show-duration", info as FeatureInfo);
    expect(output).toBe("10m");
  });

  test("number feature 42: outputs '42'", () => {
    const info = {
      value: 42,
      enabled: true,
      source: "default" as const,
    };
    const output = formatResolve("tips.max-count", info as FeatureInfo);
    expect(output).toBe("42");
  });

  test("number feature 0: outputs '0' (not 'false')", () => {
    const info = {
      value: 0,
      enabled: false,
      source: "default" as const,
    };
    const output = formatResolve("tips.max-count", info as FeatureInfo);
    expect(output).toBe("0");
  });

  test("empty string feature: outputs empty string (not 'false')", () => {
    const info = {
      value: "",
      enabled: false,
      source: "default" as const,
    };
    const output = formatResolve("tips.label", info as FeatureInfo);
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
// ===========================================================================

describe("dx status — typed display", () => {
  /** Build a StatusData with mixed-type features. */
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

// ===========================================================================
// --save flag reaches subcommands through Commander (ENG-4687 bug fix)
//
// Regression test: Commander was capturing --save at the parent program
// level, so subcommands (set, enable, disable, reset) never received it.
// The fix adds `enablePositionalOptions()` to the parent program so
// options are only parsed at the level they're defined.
// ===========================================================================

describe("--save flag reaches subcommands through Commander", () => {
  /**
   * Build a Commander program that mirrors the real cli.ts structure:
   * parent program with --save option + real subcommand builders.
   *
   * We intercept the subcommand actions to capture opts without triggering
   * real I/O (the action handlers read dx.getContext() which needs a real
   * .dx directory). Instead, we add spy subcommands that just capture opts.
   *
   * The critical thing: the parent program structure must match cli.ts --
   * same .option("--save") on the parent, same enablePositionalOptions().
   */
  function buildTestCli() {
    const captured: Record<string, { save?: boolean }> = {};

    // Mirrors cli.ts lines 27-33
    const program = new Command()
      .name("dx")
      .enablePositionalOptions()
      .option("--save", "Persist changes to config.json (personal override)");

    // Suppress help output and exit
    program.exitOverride();
    program.configureOutput({ writeErr: () => {}, writeOut: () => {} });

    // Add spy subcommands that mirror the real command structure
    // (same arguments and options) but just capture opts
    const setCmdSpy = new Command("set")
      .argument("<feature>")
      .argument("<value>")
      .option("--save", "Persist to config.json (user override)")
      .option("--json", "Output as JSON")
      .action((_feature: string, _value: string, opts: { save?: boolean }) => {
        captured.set = { save: opts.save };
      });

    const enableCmdSpy = new Command("enable")
      .argument("<feature>")
      .option("--save", "Persist to config.json (user override)")
      .option("--json", "Output as JSON")
      .action((_feature: string, opts: { save?: boolean }) => {
        captured.enable = { save: opts.save };
      });

    const disableCmdSpy = new Command("disable")
      .argument("<feature>")
      .option("--save", "Persist to config.json (user override)")
      .option("--json", "Output as JSON")
      .action((_feature: string, opts: { save?: boolean }) => {
        captured.disable = { save: opts.save };
      });

    const resetCmdSpy = new Command("reset")
      .argument("[feature]")
      .option("--save", "Clear overrides from config.json (user override)")
      .option("--json", "Output as JSON")
      .action((_feature: string | undefined, opts: { save?: boolean }) => {
        captured.reset = { save: opts.save };
      });

    program.addCommand(setCmdSpy);
    program.addCommand(enableCmdSpy);
    program.addCommand(disableCmdSpy);
    program.addCommand(resetCmdSpy);

    return { program, captured };
  }

  test("dx set <feature> <value> --save passes save=true to the set action", () => {
    const { program, captured } = buildTestCli();
    program.parse(["node", "dx", "set", "tips.show-duration", "5m", "--save"]);
    expect(captured.set?.save).toBe(true);
  });

  test("dx enable <feature> --save passes save=true to the enable action", () => {
    const { program, captured } = buildTestCli();
    program.parse(["node", "dx", "enable", "ci-watcher", "--save"]);
    expect(captured.enable?.save).toBe(true);
  });

  test("dx disable <feature> --save passes save=true to the disable action", () => {
    const { program, captured } = buildTestCli();
    program.parse(["node", "dx", "disable", "ci-watcher", "--save"]);
    expect(captured.disable?.save).toBe(true);
  });

  test("dx reset --save passes save=true to the reset action", () => {
    const { program, captured } = buildTestCli();
    program.parse(["node", "dx", "reset", "--save"]);
    expect(captured.reset?.save).toBe(true);
  });

  test("dx reset <feature> --save passes save=true to the reset action", () => {
    const { program, captured } = buildTestCli();
    program.parse(["node", "dx", "reset", "ci-watcher", "--save"]);
    expect(captured.reset?.save).toBe(true);
  });

  test("dx set <feature> <value> without --save has save undefined", () => {
    const { program, captured } = buildTestCli();
    program.parse(["node", "dx", "set", "tips.show-duration", "5m"]);
    expect(captured.set?.save).toBeUndefined();
  });

  test("bare dx --save passes save to parent opts (interactive mode)", () => {
    const { program } = buildTestCli();
    program.action(() => {}); // bare action
    program.parse(["node", "dx", "--save"]);
    expect(program.opts().save).toBe(true);
  });
});
