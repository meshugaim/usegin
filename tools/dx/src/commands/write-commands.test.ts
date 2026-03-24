/**
 * CLI write commands — tests for enable/disable, identify, interactive,
 * list, and docs.
 *
 * RED phase: these tests should all fail because the implementations
 * throw "Not implemented".
 *
 * Tests pure formatting functions (layer 1) and Commander command
 * structure (layer 2), following the three-layer architecture.
 *
 * Part of: ENG-3443
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Command } from "commander";

// --- Enable/disable pure functions ---
import {
  writeLocalOverride,
  writeUserOverride,
  formatEnableDisableResult,
  formatEnableDisableResultJson,
  buildEnableCommand,
  buildDisableCommand,
} from "./enable-disable";

// --- Identify pure functions ---
import {
  collectIdentitySignals,
  buildIdentifyCommand,
  type CollectedSignal,
} from "./identify";

// --- Interactive pure functions ---
import {
  buildInteractiveOptions,
  type InteractiveOption,
} from "./interactive";

// --- List pure functions ---
import {
  buildListData,
  formatList,
  formatListJson,
  buildListCommand,
  type ListEntry,
} from "./list";

// --- Docs pure functions ---
import {
  buildDocsContent,
  formatDocs,
  formatDocsJson,
  buildDocsCommand,
  type DocsSection,
} from "./docs";

// --- Core types for fixtures ---
import type { DxConfig, DxContext } from "../core";

// ---------------------------------------------------------------------------
// Fixtures
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

// ===========================================================================
// writeLocalOverride — synchronous file I/O for .dx/config.local.json
// ===========================================================================

describe("writeLocalOverride", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dx-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("creates config.local.json when it does not exist", () => {
    const localPath = join(tempDir, "config.local.json");
    writeLocalOverride(localPath, "ci-watcher", false);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["ci-watcher"]).toBe(false);
  });

  test("reads existing file and preserves other overrides", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(
      localPath,
      JSON.stringify({ overrides: { autosync: true } }),
    );

    writeLocalOverride(localPath, "ci-watcher", false);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides.autosync).toBe(true);
    expect(content.overrides["ci-watcher"]).toBe(false);
  });

  test("overwrites an existing override for the same feature", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(
      localPath,
      JSON.stringify({ overrides: { "ci-watcher": true } }),
    );

    writeLocalOverride(localPath, "ci-watcher", false);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["ci-watcher"]).toBe(false);
  });

  test("sets enabled=true when enabling a feature", () => {
    const localPath = join(tempDir, "config.local.json");
    writeLocalOverride(localPath, "autosync", true);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides.autosync).toBe(true);
  });

  test("creates parent directory if needed", () => {
    const nestedPath = join(tempDir, ".dx", "config.local.json");
    // Parent dir does not exist yet — writeLocalOverride should create it
    writeLocalOverride(nestedPath, "ci-watcher", false);

    const content = JSON.parse(readFileSync(nestedPath, "utf-8"));
    expect(content.overrides["ci-watcher"]).toBe(false);
  });
});

// ===========================================================================
// writeUserOverride — synchronous file I/O for .dx/config.json
// ===========================================================================

describe("writeUserOverride", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dx-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("writes override under the user's entry", () => {
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

    writeUserOverride(configPath, "nitsan", "ci-watcher", false);

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.nitsan.overrides["ci-watcher"]).toBe(false);
  });

  test("creates user entry when it does not exist", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {},
      }),
    );

    writeUserOverride(configPath, "newuser", "autosync", true);

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.newuser).toBeDefined();
    expect(content.users.newuser.overrides.autosync).toBe(true);
  });

  test("preserves existing user overrides for other features", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {
          nitsan: {
            aliases: ["Nitsan Avni"],
            overrides: { "ci-watcher": false },
          },
        },
      }),
    );

    writeUserOverride(configPath, "nitsan", "autosync", true);

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.nitsan.overrides["ci-watcher"]).toBe(false);
    expect(content.users.nitsan.overrides.autosync).toBe(true);
  });

  test("preserves existing user aliases", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {
          nitsan: {
            aliases: ["Nitsan Avni", "nitsan-ona"],
            overrides: {},
          },
        },
      }),
    );

    writeUserOverride(configPath, "nitsan", "ci-watcher", true);

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.nitsan.aliases).toEqual([
      "Nitsan Avni",
      "nitsan-ona",
    ]);
  });

  test("preserves other users when writing to one user", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {
          nitsan: { aliases: [], overrides: { "ci-watcher": false } },
          alice: { aliases: [], overrides: { autosync: true } },
        },
      }),
    );

    writeUserOverride(configPath, "nitsan", "autosync", true);

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.alice.overrides.autosync).toBe(true);
  });

  test("preserves features section", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {
          "ci-watcher": {
            description: "Monitor CI",
            mechanism: "hook",
            default: true,
          },
        },
        users: {
          nitsan: { aliases: [], overrides: {} },
        },
      }),
    );

    writeUserOverride(configPath, "nitsan", "ci-watcher", false);

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.features["ci-watcher"].description).toBe("Monitor CI");
  });

  test("throws when config file does not exist", () => {
    const configPath = join(tempDir, "nonexistent", "config.json");
    // config.json should always exist — it's committed to the repo.
    // Unlike writeLocalOverride which creates the file, writeUserOverride
    // should throw if the file is missing.
    expect(() => {
      writeUserOverride(configPath, "nitsan", "ci-watcher", false);
    }).toThrow();
  });
});

// ===========================================================================
// formatEnableDisableResult — human-readable output
// ===========================================================================

describe("formatEnableDisableResult", () => {
  test("shows feature name and disabled state for local disable", () => {
    const output = formatEnableDisableResult(
      "ci-watcher",
      false,
      false,
      null,
    );
    expect(output).toContain("ci-watcher");
    expect(output).toContain("disabled");
    expect(output).toContain("local");
  });

  test("shows feature name and enabled state for local enable", () => {
    const output = formatEnableDisableResult(
      "autosync",
      true,
      false,
      null,
    );
    expect(output).toContain("autosync");
    expect(output).toContain("enabled");
    expect(output).toContain("local");
  });

  test("shows user and saved-to-config message with --save", () => {
    const output = formatEnableDisableResult(
      "ci-watcher",
      false,
      true,
      "nitsan",
    );
    expect(output).toContain("ci-watcher");
    expect(output).toContain("disabled");
    expect(output).toContain("nitsan");
    expect(output).toContain("config.json");
  });

  test("includes --save hint when saving locally (not saved)", () => {
    const output = formatEnableDisableResult(
      "ci-watcher",
      false,
      false,
      null,
    );
    expect(output).toContain("--save");
  });

  test("does not include --save hint when already saved", () => {
    const output = formatEnableDisableResult(
      "ci-watcher",
      false,
      true,
      "nitsan",
    );
    expect(output).not.toContain("To persist");
  });

  test("starts with 'dx:' prefix", () => {
    const output = formatEnableDisableResult(
      "ci-watcher",
      false,
      false,
      null,
    );
    expect(output).toMatch(/^dx:/);
  });
});

// ===========================================================================
// formatEnableDisableResultJson — JSON output
// ===========================================================================

describe("formatEnableDisableResultJson", () => {
  test("returns valid JSON with feature, enabled, and target fields", () => {
    const output = formatEnableDisableResultJson(
      "ci-watcher",
      false,
      false,
      null,
    );
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("ci-watcher");
    expect(parsed.enabled).toBe(false);
    expect(parsed.target).toBe("local");
  });

  test("sets target to user config when saved", () => {
    const output = formatEnableDisableResultJson(
      "ci-watcher",
      false,
      true,
      "nitsan",
    );
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("ci-watcher");
    expect(parsed.enabled).toBe(false);
    // When saved, target should not be "local"
    expect(parsed.target).not.toBe("local");
  });
});

// ===========================================================================
// buildEnableCommand — Commander structure
// ===========================================================================

describe("buildEnableCommand", () => {
  test("returns a Command instance", () => {
    const cmd = buildEnableCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("has name 'enable'", () => {
    const cmd = buildEnableCommand();
    expect(cmd.name()).toBe("enable");
  });

  test("accepts a required <feature> argument", () => {
    const cmd = buildEnableCommand();
    const args = (cmd as any)._args;
    expect(args).toHaveLength(1);
    expect(args[0].required).toBe(true);
  });

  test("has --save option", () => {
    const cmd = buildEnableCommand();
    const saveOpt = cmd.options.find((o) => o.long === "--save");
    expect(saveOpt).toBeDefined();
  });

  test("has --json option", () => {
    const cmd = buildEnableCommand();
    const jsonOpt = cmd.options.find((o) => o.long === "--json");
    expect(jsonOpt).toBeDefined();
  });
});

// ===========================================================================
// buildDisableCommand — Commander structure
// ===========================================================================

describe("buildDisableCommand", () => {
  test("returns a Command instance", () => {
    const cmd = buildDisableCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("has name 'disable'", () => {
    const cmd = buildDisableCommand();
    expect(cmd.name()).toBe("disable");
  });

  test("accepts a required <feature> argument", () => {
    const cmd = buildDisableCommand();
    const args = (cmd as any)._args;
    expect(args).toHaveLength(1);
    expect(args[0].required).toBe(true);
  });

  test("has --save option", () => {
    const cmd = buildDisableCommand();
    const saveOpt = cmd.options.find((o) => o.long === "--save");
    expect(saveOpt).toBeDefined();
  });

  test("has --json option", () => {
    const cmd = buildDisableCommand();
    const jsonOpt = cmd.options.find((o) => o.long === "--json");
    expect(jsonOpt).toBeDefined();
  });
});

// ===========================================================================
// collectIdentitySignals — gather current identity signals
// ===========================================================================

describe("collectIdentitySignals", () => {
  test("returns USER signal when present", () => {
    const ctx = makeContext({ env: { USER: "nitsan" } });
    const signals = collectIdentitySignals(ctx);
    const userSignal = signals.find((s) => s.signal === "USER");
    expect(userSignal).toBeDefined();
    expect(userSignal!.value).toBe("nitsan");
  });

  test("returns DX_USER signal when present", () => {
    const ctx = makeContext({ env: { DX_USER: "nitsan" } });
    const signals = collectIdentitySignals(ctx);
    const dxSignal = signals.find((s) => s.signal === "DX_USER");
    expect(dxSignal).toBeDefined();
    expect(dxSignal!.value).toBe("nitsan");
  });

  test("returns DX_USER signal with empty string value", () => {
    // Signal collection reports what signals exist, not what they resolve to.
    // DX_USER="" should still appear in the signals list with value "".
    const ctx = makeContext({ env: { DX_USER: "" } });
    const signals = collectIdentitySignals(ctx);
    const dxSignal = signals.find((s) => s.signal === "DX_USER");
    expect(dxSignal).toBeDefined();
    expect(dxSignal!.value).toBe("");
  });

  test("returns GITHUB_USER signal when present", () => {
    const ctx = makeContext({ env: { GITHUB_USER: "nitsan-ona" } });
    const signals = collectIdentitySignals(ctx);
    const ghSignal = signals.find((s) => s.signal === "GITHUB_USER");
    expect(ghSignal).toBeDefined();
    expect(ghSignal!.value).toBe("nitsan-ona");
  });

  test("returns gitUserName signal when present", () => {
    const ctx = makeContext({ gitUserName: "Nitsan Avni" });
    const signals = collectIdentitySignals(ctx);
    const gitSignal = signals.find((s) => s.signal === "gitUserName");
    expect(gitSignal).toBeDefined();
    expect(gitSignal!.value).toBe("Nitsan Avni");
  });

  test("returns gitUserEmail signal when present", () => {
    const ctx = makeContext({ gitUserEmail: "nitsan@example.com" });
    const signals = collectIdentitySignals(ctx);
    const emailSignal = signals.find((s) => s.signal === "gitUserEmail");
    expect(emailSignal).toBeDefined();
    expect(emailSignal!.value).toBe("nitsan@example.com");
  });

  test("returns whoami signal when present", () => {
    const ctx = makeContext({ whoami: "nitsan" });
    const signals = collectIdentitySignals(ctx);
    const whoamiSignal = signals.find((s) => s.signal === "whoami");
    expect(whoamiSignal).toBeDefined();
    expect(whoamiSignal!.value).toBe("nitsan");
  });

  test("omits signals that are null/undefined", () => {
    const ctx = makeContext({
      env: {},
      gitUserName: null,
      gitUserEmail: null,
      whoami: null,
    });
    const signals = collectIdentitySignals(ctx);
    // Should not contain gitUserName, gitUserEmail, whoami, USER, etc.
    expect(signals).toEqual([]);
  });

  test("returns multiple signals when multiple are present", () => {
    const ctx = makeContext({
      env: { USER: "nitsan", GITHUB_USER: "nitsan-ona" },
      gitUserName: "Nitsan Avni",
    });
    const signals = collectIdentitySignals(ctx);
    expect(signals.length).toBeGreaterThanOrEqual(3);
  });
});

// ===========================================================================
// buildIdentifyCommand — Commander structure
// ===========================================================================

describe("buildIdentifyCommand", () => {
  test("returns a Command instance", () => {
    const cmd = buildIdentifyCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("has name 'identify'", () => {
    const cmd = buildIdentifyCommand();
    expect(cmd.name()).toBe("identify");
  });

  test("has --as option", () => {
    const cmd = buildIdentifyCommand();
    const asOpt = cmd.options.find((o) => o.long === "--as");
    expect(asOpt).toBeDefined();
  });
});

// ===========================================================================
// buildInteractiveOptions — data prep for interactive picker
// ===========================================================================

describe("buildInteractiveOptions", () => {
  test("returns one option per feature", () => {
    const ctx = makeContext();
    const options = buildInteractiveOptions(ctx);
    expect(options).toHaveLength(2);
  });

  test("each option has value, label, hint, and initialValue", () => {
    const ctx = makeContext();
    const options = buildInteractiveOptions(ctx);
    for (const opt of options) {
      expect(opt).toHaveProperty("value");
      expect(opt).toHaveProperty("label");
      expect(opt).toHaveProperty("hint");
      expect(opt).toHaveProperty("initialValue");
    }
  });

  test("value is the feature name", () => {
    const ctx = makeContext();
    const options = buildInteractiveOptions(ctx);
    const names = options.map((o) => o.value).sort();
    expect(names).toEqual(["autosync", "ci-watcher"]);
  });

  test("hint contains the feature description", () => {
    const ctx = makeContext();
    const options = buildInteractiveOptions(ctx);
    const ciOpt = options.find((o) => o.value === "ci-watcher");
    expect(ciOpt!.hint).toContain("Monitor CI");
  });

  test("initialValue reflects resolved enabled state", () => {
    // nitsan has ci-watcher disabled via user-override, autosync is default false
    const ctx = makeContext({ env: { USER: "nitsan" } });
    const options = buildInteractiveOptions(ctx);

    const ciOpt = options.find((o) => o.value === "ci-watcher");
    const syncOpt = options.find((o) => o.value === "autosync");

    expect(ciOpt!.initialValue).toBe(false);
    expect(syncOpt!.initialValue).toBe(false);
  });

  test("initialValue reflects local overrides", () => {
    const ctx = makeContext({
      local: { overrides: { autosync: true } },
    });
    const options = buildInteractiveOptions(ctx);
    const syncOpt = options.find((o) => o.value === "autosync");
    expect(syncOpt!.initialValue).toBe(true);
  });

  test("handles empty features", () => {
    const ctx = makeContext({
      config: makeConfig({ features: {} }),
    });
    const options = buildInteractiveOptions(ctx);
    expect(options).toEqual([]);
  });
});

// ===========================================================================
// buildListData — enrich features with gate counts
// ===========================================================================

describe("buildListData", () => {
  test("returns one entry per feature", () => {
    const ctx = makeContext();
    const entries = buildListData(ctx, {
      "ci-watcher": 1,
      autosync: 1,
    });
    expect(entries).toHaveLength(2);
  });

  test("each entry has feature, description, gateCount, warning", () => {
    const ctx = makeContext();
    const entries = buildListData(ctx, { "ci-watcher": 1 });
    for (const entry of entries) {
      expect(entry).toHaveProperty("feature");
      expect(entry).toHaveProperty("description");
      expect(entry).toHaveProperty("gateCount");
      expect(entry).toHaveProperty("warning");
    }
  });

  test("uses grep results for gate count", () => {
    const ctx = makeContext();
    const entries = buildListData(ctx, {
      "ci-watcher": 3,
      autosync: 0,
    });
    const ciEntry = entries.find((e) => e.feature === "ci-watcher");
    const syncEntry = entries.find((e) => e.feature === "autosync");
    expect(ciEntry!.gateCount).toBe(3);
    expect(syncEntry!.gateCount).toBe(0);
  });

  test("sets gate count to 0 when feature not in grep results", () => {
    const ctx = makeContext();
    const entries = buildListData(ctx, {});
    for (const entry of entries) {
      expect(entry.gateCount).toBe(0);
    }
  });

  test("warns when gate count is 0", () => {
    const ctx = makeContext();
    const entries = buildListData(ctx, { "ci-watcher": 0, autosync: 0 });
    for (const entry of entries) {
      expect(entry.warning).not.toBeNull();
      expect(entry.warning).toContain("not gated");
    }
  });

  test("warns when gate count exceeds 1", () => {
    const ctx = makeContext();
    const entries = buildListData(ctx, { "ci-watcher": 3 });
    const ciEntry = entries.find((e) => e.feature === "ci-watcher");
    expect(ciEntry!.warning).not.toBeNull();
    expect(ciEntry!.warning).toContain("multiple");
  });

  test("no warning when gate count is exactly 1", () => {
    const ctx = makeContext();
    const entries = buildListData(ctx, { "ci-watcher": 1 });
    const ciEntry = entries.find((e) => e.feature === "ci-watcher");
    expect(ciEntry!.warning).toBeNull();
  });

  test("includes description from config", () => {
    const ctx = makeContext();
    const entries = buildListData(ctx, {});
    const ciEntry = entries.find((e) => e.feature === "ci-watcher");
    expect(ciEntry!.description).toBe("Monitor CI after push");
  });

  test("silently ignores unknown features in grepResults", () => {
    // When grepResults contains a feature not in config, it should not
    // appear in the output — only config-registered features are listed.
    const ctx = makeContext();
    const entries = buildListData(ctx, {
      "ci-watcher": 1,
      autosync: 1,
      "nonexistent-feature": 5,
    });
    expect(entries).toHaveLength(2);
    const names = entries.map((e) => e.feature).sort();
    expect(names).toEqual(["autosync", "ci-watcher"]);
  });
});

// ===========================================================================
// formatList — human-readable table with warnings
// ===========================================================================

describe("formatList", () => {
  test("includes feature names", () => {
    const entries: ListEntry[] = [
      {
        feature: "ci-watcher",
        description: "Monitor CI",
        gateCount: 1,
        warning: null,
      },
    ];
    const output = formatList(entries);
    expect(output).toContain("ci-watcher");
  });

  test("includes gate counts", () => {
    const entries: ListEntry[] = [
      {
        feature: "ci-watcher",
        description: "Monitor CI",
        gateCount: 3,
        warning: "multiple gate points",
      },
    ];
    const output = formatList(entries);
    expect(output).toContain("3");
  });

  test("shows warning marker for 0 gates", () => {
    const entries: ListEntry[] = [
      {
        feature: "ci-watcher",
        description: "Monitor CI",
        gateCount: 0,
        warning: "registered but not gated",
      },
    ];
    const output = formatList(entries);
    expect(output).toContain("not gated");
  });

  test("shows warning marker for multiple gates", () => {
    const entries: ListEntry[] = [
      {
        feature: "ci-watcher",
        description: "Monitor CI",
        gateCount: 3,
        warning: "multiple gate points",
      },
    ];
    const output = formatList(entries);
    expect(output).toContain("multiple");
  });

  test("returns empty or 'no features' message for empty entries list", () => {
    const output = formatList([]);
    expect(typeof output).toBe("string");
    // Contract: empty list should produce either empty string or a
    // human-friendly "no features" message — not arbitrary content.
    const normalized = output.toLowerCase();
    const isEmpty = output.trim() === "";
    const hasNoFeaturesMessage = normalized.includes("no features");
    expect(isEmpty || hasNoFeaturesMessage).toBe(true);
  });
});

// ===========================================================================
// formatListJson — JSON output
// ===========================================================================

describe("formatListJson", () => {
  test("returns valid JSON array of entries", () => {
    const entries: ListEntry[] = [
      {
        feature: "ci-watcher",
        description: "Monitor CI",
        gateCount: 1,
        warning: null,
      },
      {
        feature: "autosync",
        description: "Auto push",
        gateCount: 0,
        warning: "registered but not gated",
      },
    ];
    const output = formatListJson(entries);
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].feature).toBe("ci-watcher");
    expect(parsed[1].feature).toBe("autosync");
  });

  test("returns empty JSON array for empty entries", () => {
    const output = formatListJson([]);
    const parsed = JSON.parse(output);
    expect(parsed).toEqual([]);
  });
});

// ===========================================================================
// buildListCommand — Commander structure
// ===========================================================================

describe("buildListCommand", () => {
  test("returns a Command instance", () => {
    const cmd = buildListCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("has name 'list'", () => {
    const cmd = buildListCommand();
    expect(cmd.name()).toBe("list");
  });

  test("has --json option", () => {
    const cmd = buildListCommand();
    const jsonOpt = cmd.options.find((o) => o.long === "--json");
    expect(jsonOpt).toBeDefined();
  });
});

// ===========================================================================
// buildDocsContent — documentation sections
// ===========================================================================

describe("buildDocsContent", () => {
  test("returns an array of sections", () => {
    const sections = buildDocsContent();
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThan(0);
  });

  test("each section has id, title, and content", () => {
    const sections = buildDocsContent();
    for (const section of sections) {
      expect(section).toHaveProperty("id");
      expect(section).toHaveProperty("title");
      expect(section).toHaveProperty("content");
      expect(typeof section.id).toBe("string");
      expect(typeof section.title).toBe("string");
      expect(typeof section.content).toBe("string");
    }
  });

  test("includes adding-features section", () => {
    const sections = buildDocsContent();
    const addingFeatures = sections.find(
      (s) => s.id === "adding-features",
    );
    expect(addingFeatures).toBeDefined();
  });

  test("includes config-format section", () => {
    const sections = buildDocsContent();
    const configFormat = sections.find((s) => s.id === "config-format");
    expect(configFormat).toBeDefined();
  });

  test("includes identity section", () => {
    const sections = buildDocsContent();
    const identity = sections.find((s) => s.id === "identity");
    expect(identity).toBeDefined();
  });
});

// ===========================================================================
// formatDocs — render documentation for display
// ===========================================================================

describe("formatDocs", () => {
  const sampleSections: DocsSection[] = [
    {
      id: "adding-features",
      title: "Adding Features",
      content: "Register in config.json under features.",
    },
    {
      id: "config-format",
      title: "Config Format",
      content: "JSON with features and users keys.",
    },
    {
      id: "identity",
      title: "Identity",
      content: "Resolved from env vars and git config.",
    },
  ];

  test("shows all sections when no topic is provided", () => {
    const output = formatDocs(sampleSections);
    expect(output).toContain("Adding Features");
    expect(output).toContain("Config Format");
    expect(output).toContain("Identity");
  });

  test("shows only the requested section when topic is provided", () => {
    const output = formatDocs(sampleSections, "config-format");
    expect(output).toContain("Config Format");
    expect(output).not.toContain("Adding Features");
    expect(output).not.toContain("Identity");
  });

  test("includes section content", () => {
    const output = formatDocs(sampleSections, "identity");
    expect(output).toContain("Resolved from env vars");
  });

  test("returns all sections for unknown topic (graceful fallback)", () => {
    // When topic doesn't match any section, show all — same as no topic
    const output = formatDocs(sampleSections, "nonexistent");
    expect(output).toContain("Adding Features");
    expect(output).toContain("Config Format");
    expect(output).toContain("Identity");
  });
});

// ===========================================================================
// formatDocsJson — JSON output
// ===========================================================================

describe("formatDocsJson", () => {
  const sampleSections: DocsSection[] = [
    {
      id: "adding-features",
      title: "Adding Features",
      content: "Register in config.json under features.",
    },
    {
      id: "config-format",
      title: "Config Format",
      content: "JSON with features and users keys.",
    },
    {
      id: "identity",
      title: "Identity",
      content: "Resolved from env vars and git config.",
    },
  ];

  test("returns valid JSON of all sections when no topic", () => {
    const output = formatDocsJson(sampleSections);
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);
  });

  test("returns filtered JSON when topic is provided", () => {
    const output = formatDocsJson(sampleSections, "identity");
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("identity");
  });
});

// ===========================================================================
// buildDocsCommand — Commander structure
// ===========================================================================

describe("buildDocsCommand", () => {
  test("returns a Command instance", () => {
    const cmd = buildDocsCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("has name 'docs'", () => {
    const cmd = buildDocsCommand();
    expect(cmd.name()).toBe("docs");
  });

  test("accepts an optional [topic] argument", () => {
    const cmd = buildDocsCommand();
    const args = (cmd as any)._args;
    expect(args).toHaveLength(1);
    expect(args[0].required).toBe(false);
  });

  test("has --json option", () => {
    const cmd = buildDocsCommand();
    const jsonOpt = cmd.options.find((o) => o.long === "--json");
    expect(jsonOpt).toBeDefined();
  });
});
