/**
 * CLI read commands — RED phase tests.
 *
 * Tests for the dx CLI's read-only commands: status, resolve, sync, whoami.
 * These test pure formatting functions (layer 1) and Commander command
 * structure (layer 2), following the three-layer architecture.
 *
 * All tests here should FAIL because the implementations throw
 * "Not implemented". This is the RED phase of TDD.
 *
 * Part of: ENG-3442
 */

import { describe, test, expect } from "bun:test";
import { Command } from "commander";

// --- Shared lib (static imports — finding #8) ---
import { shouldDefaultToJson } from "../../lib/output-mode";
import { enablePrefixMatching } from "../../lib/commander-prefix";
import { applyStandardAliases } from "../../lib/standard-aliases";

// --- Pure functions (layer 1) ---
import {
  formatStatus,
  formatStatusJson,
  buildStatusData,
  type StatusData,
} from "./commands/status";
import {
  formatResolve,
  formatResolveJson,
  resolveExitCode,
} from "./commands/resolve";
import { buildSyncEntries, type SyncEntry } from "./commands/sync";
import {
  formatWhoami,
  formatWhoamiJson,
  type IdentityInfo,
} from "./commands/whoami";

// --- Commander builders (layer 2) ---
import { buildStatusCommand } from "./commands/status";
import { buildResolveCommand } from "./commands/resolve";
import { buildSyncCommand } from "./commands/sync";
import { buildWhoamiCommand } from "./commands/whoami";

// --- Core types for fixtures ---
import type { DxConfig, DxContext, FeatureInfo } from "./core";

// ---------------------------------------------------------------------------
// Fixtures — reuse the same patterns as core.test.ts
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<DxConfig>): DxConfig {
  return {
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
    },
    users: {
      nitsan: {
        aliases: ["Nitsan Avni", "nitsan-ona"],
        overrides: {
          "ci-watcher": false,
        },
      },
    },
    ...overrides,
  };
}

/** Build a StatusData fixture with sensible defaults (finding #4: clean destructure). */
function makeStatusData(overrides?: Partial<StatusData>): StatusData {
  const { config: overrideConfig, ...rest } = overrides ?? {};
  const config = overrideConfig ?? makeConfig();
  return {
    user: "nitsan",
    config,
    features: {
      "ci-watcher": {
        enabled: false,
        source: "user-override",
        description: "Monitor CI after push",
      },
      autosync: {
        enabled: false,
        source: "default",
        description: "Push to origin after every commit",
      },
    },
    ...rest,
  };
}

/** Build a FeatureInfo fixture. */
function makeFeatureInfo(
  overrides?: Partial<FeatureInfo>,
): FeatureInfo {
  return {
    enabled: true,
    source: "default",
    ...overrides,
  };
}

/** Build an IdentityInfo fixture. */
function makeIdentityInfo(
  overrides?: Partial<IdentityInfo>,
): IdentityInfo {
  return {
    user: "nitsan",
    signal: "USER",
    match: "alias",
    ...overrides,
  };
}

/** Build a DxContext fixture for buildStatusData tests. */
function makeContext(overrides?: Partial<DxContext>): DxContext {
  return {
    config: makeConfig(),
    local: null,
    env: { USER: "nitsan" },
    gitUserName: null,
    gitUserEmail: null,
    whoami: null,
    ...overrides,
  };
}

/**
 * Build a Commander program with the four dx commands (status, resolve, sync, whoami).
 * Used by prefix matching tests (finding #9).
 */
function buildTestProgram(): { program: Command; invoked: string[] } {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {},
  });

  const invoked: string[] = [];
  program.command("status").action(() => invoked.push("status"));
  program.command("resolve").action(() => invoked.push("resolve"));
  program.command("sync").action(() => invoked.push("sync"));
  program.command("whoami").action(() => invoked.push("whoami"));

  return { program, invoked };
}

// ===========================================================================
// formatStatus — human-readable table
// ===========================================================================

describe("formatStatus", () => {
  test("includes user name in output", () => {
    const data = makeStatusData();
    const output = formatStatus(data);
    expect(output).toContain("User: nitsan");
  });

  test("shows 'unknown' when user is null", () => {
    const data = makeStatusData({ user: null });
    const output = formatStatus(data);
    expect(output).toContain("User: unknown");
  });

  test("lists all features", () => {
    const data = makeStatusData();
    const output = formatStatus(data);
    expect(output).toContain("ci-watcher");
    expect(output).toContain("autosync");
  });

  test("shows enabled/disabled state for each feature", () => {
    const data = makeStatusData({
      features: {
        "ci-watcher": {
          enabled: true,
          source: "default",
          description: "Monitor CI after push",
        },
        autosync: {
          enabled: false,
          source: "default",
          description: "Push to origin after every commit",
        },
      },
    });
    const output = formatStatus(data);
    const lines = output.split("\n");

    // Finding #3: assert that each feature line contains an enabled/disabled indicator.
    // ci-watcher is enabled — its line should contain "on" or "enabled" or a checkmark
    const ciLine = lines.find((l) => l.includes("ci-watcher"));
    expect(ciLine).toBeDefined();
    expect(ciLine).toMatch(/on|enabled|✓|true/i);

    // autosync is disabled — its line should contain "off" or "disabled" or an x
    const syncLine = lines.find((l) => l.includes("autosync"));
    expect(syncLine).toBeDefined();
    expect(syncLine).toMatch(/off|disabled|✗|false/i);
  });

  test("marks user overrides with *", () => {
    const data = makeStatusData({
      features: {
        "ci-watcher": {
          enabled: false,
          source: "user-override",
          description: "Monitor CI after push",
        },
        autosync: {
          enabled: false,
          source: "default",
          description: "Push to origin after every commit",
        },
      },
    });
    const output = formatStatus(data);
    // The ci-watcher line should have a * marker (user override)
    const lines = output.split("\n");
    const ciLine = lines.find((l) => l.includes("ci-watcher"));
    expect(ciLine).toContain("*");
    // The autosync line should NOT have a * marker
    const syncLine = lines.find((l) => l.includes("autosync"));
    expect(syncLine).not.toContain("*");
  });

  test("marks local overrides with ~", () => {
    const data = makeStatusData({
      features: {
        "ci-watcher": {
          enabled: true,
          source: "local-override",
          description: "Monitor CI after push",
        },
        autosync: {
          enabled: false,
          source: "default",
          description: "Push to origin after every commit",
        },
      },
    });
    const output = formatStatus(data);
    const lines = output.split("\n");
    const ciLine = lines.find((l) => l.includes("ci-watcher"));
    expect(ciLine).toContain("~");
  });

  test("handles empty features list", () => {
    const data = makeStatusData({
      features: {},
      config: makeConfig({ features: {} }),
    });
    const output = formatStatus(data);
    // Should still show user, just no feature rows
    expect(output).toContain("User: nitsan");
  });
});

// ===========================================================================
// formatStatusJson — JSON output
// ===========================================================================

describe("formatStatusJson", () => {
  test("returns valid JSON", () => {
    const data = makeStatusData();
    const output = formatStatusJson(data);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test("includes user field", () => {
    const data = makeStatusData();
    const parsed = JSON.parse(formatStatusJson(data));
    expect(parsed.user).toBe("nitsan");
  });

  test("includes user as null when unknown", () => {
    const data = makeStatusData({ user: null });
    const parsed = JSON.parse(formatStatusJson(data));
    expect(parsed.user).toBeNull();
  });

  test("includes features map with enabled, source, and description", () => {
    const data = makeStatusData();
    const parsed = JSON.parse(formatStatusJson(data));
    expect(parsed.features["ci-watcher"]).toEqual({
      enabled: false,
      source: "user-override",
      description: "Monitor CI after push",
    });
    expect(parsed.features.autosync).toEqual({
      enabled: false,
      source: "default",
      description: "Push to origin after every commit",
    });
  });

  test("JSON structure matches spec", () => {
    const data = makeStatusData();
    const parsed = JSON.parse(formatStatusJson(data));
    // Spec: { user, features: { [name]: { enabled, source, description } } }
    expect(parsed).toHaveProperty("user");
    expect(parsed).toHaveProperty("features");
    expect(Object.keys(parsed)).toHaveLength(2);
    for (const [, info] of Object.entries(parsed.features)) {
      const fi = info as Record<string, unknown>;
      expect(fi).toHaveProperty("enabled");
      expect(fi).toHaveProperty("source");
      expect(fi).toHaveProperty("description");
    }
  });

  test("handles empty features", () => {
    const data = makeStatusData({
      features: {},
      config: makeConfig({ features: {} }),
    });
    const parsed = JSON.parse(formatStatusJson(data));
    expect(parsed.features).toEqual({});
  });
});

// ===========================================================================
// buildStatusData — enrichment from DxContext (finding #2)
// ===========================================================================

describe("buildStatusData", () => {
  test("returns correct shape with enriched features", () => {
    const ctx = makeContext();
    const data = buildStatusData(ctx);

    expect(data).toHaveProperty("user");
    expect(data).toHaveProperty("features");
    expect(data).toHaveProperty("config");
    expect(data.features).toHaveProperty("ci-watcher");
    expect(data.features).toHaveProperty("autosync");
    // Each feature should have enabled, source, and description
    for (const info of Object.values(data.features)) {
      expect(info).toHaveProperty("enabled");
      expect(info).toHaveProperty("source");
      expect(info).toHaveProperty("description");
    }
  });

  test("includes description from config", () => {
    const ctx = makeContext();
    const data = buildStatusData(ctx);

    expect(data.features["ci-watcher"].description).toBe(
      "Monitor CI after push",
    );
    expect(data.features.autosync.description).toBe(
      "Push to origin after every commit",
    );
  });

  test("resolves user automatically", () => {
    const ctx = makeContext({ env: { USER: "nitsan" } });
    const data = buildStatusData(ctx);
    expect(data.user).toBe("nitsan");
  });
});

// ===========================================================================
// formatResolve — human-readable single feature
// ===========================================================================

describe("formatResolve", () => {
  test("returns 'true' for enabled feature", () => {
    const info = makeFeatureInfo({ enabled: true });
    const output = formatResolve("ci-watcher", info);
    expect(output).toBe("true");
  });

  test("returns 'false' for disabled feature", () => {
    const info = makeFeatureInfo({ enabled: false });
    const output = formatResolve("autosync", info);
    expect(output).toBe("false");
  });

  test("output is purely the boolean string regardless of feature name", () => {
    // Finding #5: verify output doesn't include the feature name
    const enabledInfo = makeFeatureInfo({ enabled: true });
    const disabledInfo = makeFeatureInfo({ enabled: false });

    const out1 = formatResolve("ci-watcher", enabledInfo);
    const out2 = formatResolve("some-other-feature", enabledInfo);
    const out3 = formatResolve("autosync", disabledInfo);
    const out4 = formatResolve("yet-another-feature", disabledInfo);

    expect(out1).toBe("true");
    expect(out2).toBe("true");
    expect(out3).toBe("false");
    expect(out4).toBe("false");
  });
});

// ===========================================================================
// formatResolveJson — JSON single feature
// ===========================================================================

describe("formatResolveJson", () => {
  test("returns valid JSON", () => {
    const info = makeFeatureInfo();
    const output = formatResolveJson("ci-watcher", info);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test("includes feature name", () => {
    const info = makeFeatureInfo();
    const parsed = JSON.parse(formatResolveJson("ci-watcher", info));
    expect(parsed.feature).toBe("ci-watcher");
  });

  test("includes enabled boolean", () => {
    const info = makeFeatureInfo({ enabled: true });
    const parsed = JSON.parse(formatResolveJson("ci-watcher", info));
    expect(parsed.enabled).toBe(true);
  });

  test("includes source", () => {
    const info = makeFeatureInfo({ source: "user-override" });
    const parsed = JSON.parse(formatResolveJson("ci-watcher", info));
    expect(parsed.source).toBe("user-override");
  });

  test("matches spec shape", () => {
    const info = makeFeatureInfo({
      enabled: true,
      source: "default",
    });
    const parsed = JSON.parse(formatResolveJson("ci-watcher", info));
    expect(parsed).toEqual({
      feature: "ci-watcher",
      enabled: true,
      source: "default",
    });
  });
});

// ===========================================================================
// resolveExitCode — process exit code for feature state (finding #7)
// ===========================================================================

describe("resolveExitCode", () => {
  test("returns 0 for enabled feature", () => {
    const info = makeFeatureInfo({ enabled: true });
    expect(resolveExitCode(info)).toBe(0);
  });

  test("returns 1 for disabled feature", () => {
    const info = makeFeatureInfo({ enabled: false });
    expect(resolveExitCode(info)).toBe(1);
  });
});

// ===========================================================================
// buildSyncEntries — pure sync logic
// ===========================================================================

describe("buildSyncEntries", () => {
  test("returns one entry per feature", () => {
    const features: Record<string, FeatureInfo> = {
      "ci-watcher": { enabled: true, source: "default" },
      autosync: { enabled: false, source: "default" },
    };
    const entries = buildSyncEntries(features);
    expect(entries).toHaveLength(2);
  });

  test("each entry has key and boolean value", () => {
    const features: Record<string, FeatureInfo> = {
      "ci-watcher": { enabled: true, source: "default" },
    };
    const entries = buildSyncEntries(features);
    expect(entries[0]).toEqual({
      key: "ci-watcher",
      value: true,
    });
  });

  test("maps enabled state correctly", () => {
    const features: Record<string, FeatureInfo> = {
      "ci-watcher": { enabled: true, source: "default" },
      autosync: { enabled: false, source: "user-override" },
    };
    const entries = buildSyncEntries(features);
    const ciEntry = entries.find((e) => e.key === "ci-watcher");
    const syncEntry = entries.find((e) => e.key === "autosync");
    expect(ciEntry!.value).toBe(true);
    expect(syncEntry!.value).toBe(false);
  });

  test("handles empty features map", () => {
    const entries = buildSyncEntries({});
    expect(entries).toEqual([]);
  });

  test("includes features from all sources", () => {
    const features: Record<string, FeatureInfo> = {
      a: { enabled: true, source: "default" },
      b: { enabled: false, source: "user-override" },
      c: { enabled: true, source: "local-override" },
    };
    const entries = buildSyncEntries(features);
    expect(entries).toHaveLength(3);
    // Ordering is unspecified — alphabetical is fine but not required.
    // Sort before comparing to avoid brittle ordering assumptions.
    const keys = entries.map((e) => e.key).sort();
    expect(keys).toEqual(["a", "b", "c"]);
  });
});

// ===========================================================================
// formatWhoami — human-readable identity
// ===========================================================================

describe("formatWhoami", () => {
  test("shows user name", () => {
    const info = makeIdentityInfo();
    const output = formatWhoami(info);
    expect(output).toContain("User: nitsan");
  });

  test("shows resolution via $USER with alias match", () => {
    const info = makeIdentityInfo({
      user: "nitsan",
      signal: "USER",
      match: "alias",
    });
    const output = formatWhoami(info);
    expect(output).toContain("$USER");
    expect(output).toContain("alias");
  });

  test("shows resolution via exact match", () => {
    const info = makeIdentityInfo({
      user: "nitsan",
      signal: "USER",
      match: "exact",
    });
    const output = formatWhoami(info);
    expect(output).toContain("exact");
  });

  test("shows resolution via $DX_USER", () => {
    const info = makeIdentityInfo({
      user: "nitsan",
      signal: "DX_USER",
      match: "exact",
    });
    const output = formatWhoami(info);
    expect(output).toContain("$DX_USER");
  });

  test("shows resolution via $GITHUB_USER", () => {
    const info = makeIdentityInfo({
      user: "nitsan",
      signal: "GITHUB_USER",
      match: "alias",
    });
    const output = formatWhoami(info);
    expect(output).toContain("$GITHUB_USER");
  });

  test("handles null user (unknown)", () => {
    const info: IdentityInfo = {
      user: null,
      signal: null,
      match: null,
    };
    const output = formatWhoami(info);
    expect(output).toContain("unknown");
  });
});

// ===========================================================================
// formatWhoamiJson — JSON identity
// ===========================================================================

describe("formatWhoamiJson", () => {
  test("returns valid JSON", () => {
    const info = makeIdentityInfo();
    const output = formatWhoamiJson(info);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test("includes user, signal, and match", () => {
    const info = makeIdentityInfo({
      user: "nitsan",
      signal: "USER",
      match: "alias",
    });
    const parsed = JSON.parse(formatWhoamiJson(info));
    expect(parsed).toEqual({
      user: "nitsan",
      signal: "USER",
      match: "alias",
    });
  });

  test("handles null user", () => {
    const info: IdentityInfo = {
      user: null,
      signal: null,
      match: null,
    };
    const parsed = JSON.parse(formatWhoamiJson(info));
    expect(parsed.user).toBeNull();
    expect(parsed.signal).toBeNull();
    expect(parsed.match).toBeNull();
  });
});

// ===========================================================================
// Commander command structure (layer 2)
// ===========================================================================

describe("buildStatusCommand", () => {
  test("returns a Command instance", () => {
    const cmd = buildStatusCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("has name 'status'", () => {
    const cmd = buildStatusCommand();
    expect(cmd.name()).toBe("status");
  });

  test("has --json option", () => {
    const cmd = buildStatusCommand();
    const jsonOpt = cmd.options.find(
      (o) => o.long === "--json",
    );
    expect(jsonOpt).toBeDefined();
  });
});

describe("buildResolveCommand", () => {
  test("returns a Command instance", () => {
    const cmd = buildResolveCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("has name 'resolve'", () => {
    const cmd = buildResolveCommand();
    expect(cmd.name()).toBe("resolve");
  });

  test("accepts a required <feature> argument", () => {
    const cmd = buildResolveCommand();
    // Commander stores arguments in _args
    const args = (cmd as any)._args;
    expect(args).toHaveLength(1);
    expect(args[0].required).toBe(true);
  });

  test("has --json option", () => {
    const cmd = buildResolveCommand();
    const jsonOpt = cmd.options.find(
      (o) => o.long === "--json",
    );
    expect(jsonOpt).toBeDefined();
  });

  test("has --exit-code option", () => {
    const cmd = buildResolveCommand();
    const exitOpt = cmd.options.find(
      (o) => o.long === "--exit-code",
    );
    expect(exitOpt).toBeDefined();
  });
});

describe("buildSyncCommand", () => {
  test("returns a Command instance", () => {
    const cmd = buildSyncCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("has name 'sync'", () => {
    const cmd = buildSyncCommand();
    expect(cmd.name()).toBe("sync");
  });
});

describe("buildWhoamiCommand", () => {
  test("returns a Command instance", () => {
    const cmd = buildWhoamiCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("has name 'whoami'", () => {
    const cmd = buildWhoamiCommand();
    expect(cmd.name()).toBe("whoami");
  });

  test("has --json option", () => {
    const cmd = buildWhoamiCommand();
    const jsonOpt = cmd.options.find(
      (o) => o.long === "--json",
    );
    expect(jsonOpt).toBeDefined();
  });
});

// ===========================================================================
// Headless detection
// ===========================================================================

describe("headless detection", () => {
  test("CLAUDECODE=1 + no TTY should default to JSON output", () => {
    // This tests the shouldDefaultToJson integration.
    // The dx CLI should use DX_OUTPUT as its env var name.
    const result = shouldDefaultToJson({
      envVarName: "DX_OUTPUT",
      env: { CLAUDECODE: "1" },
      isTTY: false,
    });
    expect(result).toBe(true);
  });

  test("TTY session defaults to human output even with CLAUDECODE=1", () => {
    const result = shouldDefaultToJson({
      envVarName: "DX_OUTPUT",
      env: { CLAUDECODE: "1" },
      isTTY: true,
    });
    expect(result).toBe(false);
  });

  test("explicit --json always wins", () => {
    const result = shouldDefaultToJson({
      envVarName: "DX_OUTPUT",
      json: true,
      env: {},
      isTTY: true,
    });
    expect(result).toBe(true);
  });

  test("DX_OUTPUT=human forces human output", () => {
    const result = shouldDefaultToJson({
      envVarName: "DX_OUTPUT",
      env: { DX_OUTPUT: "human", CLAUDECODE: "1" },
      isTTY: false,
    });
    expect(result).toBe(false);
  });

  test("DX_OUTPUT=json forces JSON output", () => {
    const result = shouldDefaultToJson({
      envVarName: "DX_OUTPUT",
      env: { DX_OUTPUT: "json" },
      isTTY: true,
    });
    expect(result).toBe(true);
  });
});

// ===========================================================================
// Standard aliases + prefix matching
// ===========================================================================

describe("standard aliases", () => {
  test("status command gets 'st' as prefix match", () => {
    // This tests that the CLI wiring enables prefix matching
    // so `dx st` resolves to `dx status`.
    const { program, invoked } = buildTestProgram();
    enablePrefixMatching(program);

    // "s" is ambiguous between "status" and "sync" — need "st" or "sy"
    program.parse(["node", "test", "st"]);
    expect(invoked).toEqual(["status"]);
  });

  test("'sy' prefix resolves to sync", () => {
    const { program, invoked } = buildTestProgram();
    enablePrefixMatching(program);

    program.parse(["node", "test", "sy"]);
    expect(invoked).toEqual(["sync"]);
  });

  test("'r' prefix resolves to resolve (unambiguous)", () => {
    const { program, invoked } = buildTestProgram();
    enablePrefixMatching(program);

    program.parse(["node", "test", "r"]);
    expect(invoked).toEqual(["resolve"]);
  });

  test("'w' prefix resolves to whoami (unambiguous)", () => {
    const { program, invoked } = buildTestProgram();
    enablePrefixMatching(program);

    program.parse(["node", "test", "w"]);
    expect(invoked).toEqual(["whoami"]);
  });

  // Finding #10: list alias is for a future slice — mark as todo
  test.todo("registers 'ls' alias for list command (slice 3)");
});
