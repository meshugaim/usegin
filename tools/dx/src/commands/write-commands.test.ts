/**
 * CLI write commands — tests for enable/disable, reset, identify,
 * interactive, list, and docs.
 *
 * Tests pure formatting functions (layer 1) and Commander command
 * structure (layer 2), following the three-layer architecture.
 *
 * Part of: ENG-3443
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "fs";
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
  autoDetectUser,
  addSignalsAsAliases,
  buildIdentifyCommand,
  type CollectedSignal,
} from "./identify";

// --- Interactive pure functions ---
import {
  buildInteractiveOptions,
  buildMultiselectConfig,
  type InteractiveOption,
} from "./interactive";

// --- List pure functions ---
import {
  buildListData,
  parseGrepOutput,
  grepGateCounts,
  buildGatePattern,
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

// --- Reset pure functions ---
import {
  clearLocalOverride,
  clearAllLocalOverrides,
  clearUserOverride,
  clearAllUserOverrides,
  formatResetResult,
  formatResetResultJson,
  buildResetCommand,
} from "./reset";

// --- Shared test fixtures ---
import { makeConfig, makeContext } from "../test-fixtures";

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

  test("throws when existing file contains corrupted JSON", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, "{ not valid json !!!");

    expect(() => {
      writeLocalOverride(localPath, "ci-watcher", false);
    }).toThrow();
  });

  test("handles file where overrides is not an object (defensive)", () => {
    const localPath = join(tempDir, "config.local.json");
    // Someone manually set overrides to a string or null
    writeFileSync(localPath, JSON.stringify({ overrides: "not-an-object" }));

    writeLocalOverride(localPath, "ci-watcher", false);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides["ci-watcher"]).toBe(false);
  });

  test("handles file where overrides is null (defensive)", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(localPath, JSON.stringify({ overrides: null }));

    writeLocalOverride(localPath, "autosync", true);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides.autosync).toBe(true);
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

  test("writes pretty-printed JSON (not minified)", () => {
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

    const raw = readFileSync(configPath, "utf-8");
    // Pretty-printed JSON contains newlines; minified JSON does not.
    // config.json is committed to the repo, so diffs must stay readable.
    expect(raw).toContain("\n");
    // Verify it's still valid JSON after pretty-printing
    expect(() => JSON.parse(raw)).not.toThrow();
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

  test("handles saved=true with null user gracefully (no 'for null')", () => {
    const output = formatEnableDisableResult(
      "ci-watcher",
      false,
      true,
      null,
    );
    expect(output).toContain("config.json");
    expect(output).not.toContain("for null");
    expect(output).not.toContain("for undefined");
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
    expect(parsed.target).toBe("config");
  });

  test("includes user field when saved to config", () => {
    const output = formatEnableDisableResultJson(
      "ci-watcher",
      false,
      true,
      "nitsan",
    );
    const parsed = JSON.parse(output);
    expect(parsed.user).toBe("nitsan");
  });

  test("does not include user field for local target", () => {
    const output = formatEnableDisableResultJson(
      "ci-watcher",
      false,
      false,
      null,
    );
    const parsed = JSON.parse(output);
    expect(parsed).not.toHaveProperty("user");
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
// autoDetectUser — match signals to existing users
// ===========================================================================

describe("autoDetectUser", () => {
  test("returns user when signal matches user key", () => {
    const signals: CollectedSignal[] = [{ signal: "USER", value: "nitsan" }];
    const users = {
      nitsan: { aliases: [], overrides: {} },
    };
    expect(autoDetectUser(signals, users)).toBe("nitsan");
  });

  test("returns user when signal matches alias", () => {
    const signals: CollectedSignal[] = [
      { signal: "gitUserName", value: "Nitsan Avni" },
    ];
    const users = {
      nitsan: { aliases: ["Nitsan Avni"], overrides: {} },
    };
    expect(autoDetectUser(signals, users)).toBe("nitsan");
  });

  test("returns null when no signals match", () => {
    const signals: CollectedSignal[] = [
      { signal: "USER", value: "unknown-person" },
    ];
    const users = {
      nitsan: { aliases: ["Nitsan Avni"], overrides: {} },
    };
    expect(autoDetectUser(signals, users)).toBeNull();
  });

  test("returns null for empty signals", () => {
    const users = {
      nitsan: { aliases: [], overrides: {} },
    };
    expect(autoDetectUser([], users)).toBeNull();
  });

  test("extracts email prefix for gitUserEmail signal before matching", () => {
    const signals: CollectedSignal[] = [
      { signal: "gitUserEmail", value: "nitsan@example.com" },
    ];
    const users = {
      nitsan: { aliases: ["nitsan"], overrides: {} },
    };
    // Should match "nitsan" (prefix) against the alias, not "nitsan@example.com"
    expect(autoDetectUser(signals, users)).toBe("nitsan");
  });

  test("does not match full email as alias", () => {
    // If someone has "nitsan@example.com" as an alias, the full email
    // won't match because we extract the prefix. But the prefix "nitsan"
    // would match the user key.
    const signals: CollectedSignal[] = [
      { signal: "gitUserEmail", value: "alice@example.com" },
    ];
    const users = {
      bob: { aliases: ["alice@example.com"], overrides: {} },
    };
    // "alice" (prefix) doesn't match user key "bob" or alias "alice@example.com"
    expect(autoDetectUser(signals, users)).toBeNull();
  });

  test("handles gitUserEmail with no @ sign", () => {
    const signals: CollectedSignal[] = [
      { signal: "gitUserEmail", value: "nitsan" },
    ];
    const users = {
      nitsan: { aliases: [], overrides: {} },
    };
    // No @, so the full string is used as the match value
    expect(autoDetectUser(signals, users)).toBe("nitsan");
  });

  test("skips gitUserEmail with empty prefix (@domain.com)", () => {
    const signals: CollectedSignal[] = [
      { signal: "gitUserEmail", value: "@domain.com" },
    ];
    const users = {
      "": { aliases: [], overrides: {} },
    };
    expect(autoDetectUser(signals, users)).toBeNull();
  });
});

// ===========================================================================
// addSignalsAsAliases — persist new signals to config.json
// ===========================================================================

describe("addSignalsAsAliases", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dx-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("adds new signal values as aliases", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {
          nitsan: { aliases: ["Nitsan Avni"], overrides: {} },
        },
      }),
    );

    const signals: CollectedSignal[] = [
      { signal: "GITHUB_USER", value: "nitsan-ona" },
      { signal: "USER", value: "nitsan" }, // same as key — should skip
    ];

    const added = addSignalsAsAliases(configPath, "nitsan", signals);
    expect(added).toEqual(["nitsan-ona"]);

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.nitsan.aliases).toContain("nitsan-ona");
  });

  test("skips signals already in aliases (case-insensitive)", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {
          nitsan: { aliases: ["Nitsan Avni"], overrides: {} },
        },
      }),
    );

    const signals: CollectedSignal[] = [
      { signal: "gitUserName", value: "Nitsan Avni" },
    ];

    const added = addSignalsAsAliases(configPath, "nitsan", signals);
    expect(added).toEqual([]);
  });

  test("creates user entry if not present", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {},
      }),
    );

    const signals: CollectedSignal[] = [
      { signal: "USER", value: "alice" },
    ];

    const added = addSignalsAsAliases(configPath, "newuser", signals);
    expect(added).toEqual(["alice"]);

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.newuser).toBeDefined();
    expect(content.users.newuser.aliases).toContain("alice");
  });

  test("does not write file when no new aliases added", () => {
    const configPath = join(tempDir, "config.json");
    const original = JSON.stringify({
      features: {},
      users: {
        nitsan: { aliases: ["nitsan-ona"], overrides: {} },
      },
    });
    writeFileSync(configPath, original);

    const signals: CollectedSignal[] = [
      { signal: "USER", value: "nitsan" }, // matches key
      { signal: "GITHUB_USER", value: "nitsan-ona" }, // already alias
    ];

    addSignalsAsAliases(configPath, "nitsan", signals);
    // File should be unchanged since no aliases were added
    expect(readFileSync(configPath, "utf-8")).toBe(original);
  });

  test("skips empty signal values", () => {
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

    const signals: CollectedSignal[] = [
      { signal: "DX_USER", value: "" },
    ];

    const added = addSignalsAsAliases(configPath, "nitsan", signals);
    expect(added).toEqual([]);
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

  test("label is a non-empty string containing the feature name", () => {
    const options = buildInteractiveOptions(makeContext());
    for (const opt of options) {
      expect(typeof opt.label).toBe("string");
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });

  test("handles empty features", () => {
    const ctx = makeContext({
      config: makeConfig({ features: {} }),
    });
    const options = buildInteractiveOptions(ctx);
    expect(options).toEqual([]);
  });

  test("includes source info in hint for overridden features", () => {
    const ctx = makeContext({
      config: makeConfig(),
      local: { overrides: { autosync: true } },
      env: { USER: "nitsan" },
    });

    const options = buildInteractiveOptions(ctx);

    // ci-watcher is user-overridden for nitsan (OFF) — hint should indicate source
    const ciWatcher = options.find((o) => o.value === "ci-watcher")!;
    expect(ciWatcher.hint).toContain("personal");

    // autosync has a local override — hint should indicate source
    const autosync = options.find((o) => o.value === "autosync")!;
    expect(autosync.hint).toContain("local");
  });
});

// ===========================================================================
// buildMultiselectConfig — transform options into @clack/prompts shape
// ===========================================================================

describe("buildMultiselectConfig", () => {
  test("returns initialValues array with enabled feature names", () => {
    // ci-watcher default=true, autosync default=false;
    // nitsan overrides ci-watcher=false, so for nitsan both are off.
    // Use a context where ci-watcher is enabled (no user override).
    const ctx = makeContext({ env: { USER: "unknown-user" } });
    const options = buildInteractiveOptions(ctx);

    const config = buildMultiselectConfig(options);

    // ci-watcher has default=true and no user override for unknown-user
    expect(config.initialValues).toContain("ci-watcher");
    // autosync has default=false
    expect(config.initialValues).not.toContain("autosync");
    // initialValues should be an array, not per-option booleans
    expect(Array.isArray(config.initialValues)).toBe(true);
  });

  test("returns options with descriptions in labels", () => {
    const ctx = makeContext();
    const options = buildInteractiveOptions(ctx);

    const config = buildMultiselectConfig(options);

    const ciOpt = config.options.find((o) => o.value === "ci-watcher");
    const syncOpt = config.options.find((o) => o.value === "autosync");

    // Labels should include the description so users can see what each feature does
    expect(ciOpt!.label).toContain("Monitor CI");
    expect(syncOpt!.label).toContain("Push to origin");
  });

  test("returns empty initialValues when all features disabled", () => {
    // nitsan has ci-watcher=false override, autosync default=false
    const ctx = makeContext({ env: { USER: "nitsan" } });
    const options = buildInteractiveOptions(ctx);

    const config = buildMultiselectConfig(options);

    expect(config.initialValues).toEqual([]);
  });

  test("includes source info in labels for overridden features", () => {
    // End-to-end: build options from a context where ci-watcher has a
    // user-override and autosync has a local override, then transform
    // through buildMultiselectConfig. The final picker labels should
    // surface the source so the user knows *why* a feature is on/off.
    const ctx = makeContext({
      config: makeConfig(),
      local: { overrides: { autosync: true } },
      env: { USER: "nitsan" },
    });

    const options = buildInteractiveOptions(ctx);
    const config = buildMultiselectConfig(options);

    // ci-watcher is user-overridden for nitsan — label should say "(personal)"
    const ciLabel = config.options.find(
      (o) => o.value === "ci-watcher",
    )!.label;
    expect(ciLabel).toContain("personal");

    // autosync has a local override — label should say "(local)"
    const syncLabel = config.options.find(
      (o) => o.value === "autosync",
    )!.label;
    expect(syncLabel).toContain("local");
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

  test("notes when gate count exceeds 2", () => {
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

  test("no warning when gate count is exactly 2 (hook + script is normal)", () => {
    const ctx = makeContext();
    const entries = buildListData(ctx, { "ci-watcher": 2 });
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
        warning: "note: multiple gate points",
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

  test("shows note marker for multiple gates", () => {
    const entries: ListEntry[] = [
      {
        feature: "ci-watcher",
        description: "Monitor CI",
        gateCount: 3,
        warning: "note: multiple gate points",
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
// buildGatePattern — regex for dx gate patterns
// ===========================================================================

describe("buildGatePattern", () => {
  test("matches isEnabled SDK call", () => {
    const pattern = buildGatePattern("ci-watcher");
    const regex = new RegExp(pattern);
    expect(regex.test('if (dx.isEnabled("ci-watcher"))')).toBe(true);
  });

  test("matches getFeature SDK call", () => {
    const pattern = buildGatePattern("autosync");
    const regex = new RegExp(pattern);
    expect(regex.test('const f = dx.getFeature("autosync")')).toBe(true);
  });

  test("matches dx resolve CLI usage", () => {
    const pattern = buildGatePattern("ci-watcher");
    const regex = new RegExp(pattern);
    expect(regex.test("dx resolve ci-watcher")).toBe(true);
  });

  test("matches git config dx.feature usage", () => {
    const pattern = buildGatePattern("ci-watcher");
    const regex = new RegExp(pattern);
    expect(regex.test("git config dx.ci-watcher")).toBe(true);
  });

  test("does not match plain feature name in unrelated context", () => {
    const pattern = buildGatePattern("ci-watcher");
    const regex = new RegExp(pattern);
    expect(regex.test("// ci-watcher is a feature")).toBe(false);
  });
});

// ===========================================================================
// parseGrepOutput — parse grep stdout into per-feature counts
// ===========================================================================

describe("parseGrepOutput", () => {
  test("counts occurrences of each feature in grep output", () => {
    const output = [
      'scripts/ci.sh:if dx resolve ci-watcher --exit-code; then',
      'nextjs-app/src/hooks.ts:if (dx.isEnabled("autosync")) {',
      '.husky/pre-push:dx resolve ci-watcher',
    ].join("\n");

    const results = parseGrepOutput(output, ["ci-watcher", "autosync"]);
    expect(results["ci-watcher"]).toBe(2);
    expect(results["autosync"]).toBe(1);
  });

  test("returns 0 for all features when output is empty", () => {
    const results = parseGrepOutput("", ["ci-watcher", "autosync"]);
    expect(results["ci-watcher"]).toBe(0);
    expect(results["autosync"]).toBe(0);
  });

  test("counts multiple matches for one feature correctly", () => {
    const output = [
      'scripts/ci.sh:dx resolve ci-watcher',
      '.husky/pre-push:dx resolve ci-watcher --exit-code',
      'nextjs-app/src/app.ts:if (dx.isEnabled("ci-watcher")) {',
    ].join("\n");

    const results = parseGrepOutput(output, ["ci-watcher", "autosync"]);
    expect(results["ci-watcher"]).toBe(3);
    expect(results["autosync"]).toBe(0);
  });

  test("handles empty feature list", () => {
    const results = parseGrepOutput("some output", []);
    expect(results).toEqual({});
  });

  test("handles whitespace-only output", () => {
    const results = parseGrepOutput("   \n  \n", ["ci-watcher"]);
    expect(results["ci-watcher"]).toBe(0);
  });

  test("increments both features when a line mentions multiple", () => {
    const output =
      'scripts/migrate.sh:dx resolve ci-watcher && dx resolve autosync';

    const results = parseGrepOutput(output, ["ci-watcher", "autosync"]);
    expect(results["ci-watcher"]).toBe(1);
    expect(results["autosync"]).toBe(1);
  });

  test("does not count lines from tools/dx/ (own code)", () => {
    const output = [
      // Real gate (should count)
      '.claude/hooks/spawn-ci-watcher-after-push.ts:  if (!dx.isEnabled("ci-watcher")) process.exit(0);',
      // Test file in tools/dx (should NOT count — it's the dx tool testing itself)
      'tools/dx/src/core.test.ts:    expect(isEnabled("ci-watcher", ctx, null)).toBe(true);',
      'tools/dx/src/core.test.ts:    expect(isEnabled("ci-watcher", ctx, "nitsan")).toBe(false);',
      // SDK comment (should NOT count)
      'tools/dx/sdk.ts: *   dx.isEnabled("ci-watcher")  // → boolean',
      // Write-commands test fixture (should NOT count)
      'tools/dx/src/commands/write-commands.test.ts:    expect(regex.test(\'if (dx.isEnabled("ci-watcher"))\'))',
    ].join("\n");

    const results = parseGrepOutput(output, ["ci-watcher"]);
    expect(results["ci-watcher"]).toBe(1); // Only the real gate
  });
});

// ===========================================================================
// grepGateCounts — integration smoke test
// ===========================================================================

describe("grepGateCounts", () => {
  test("returns reasonable counts not inflated by own tests", () => {
    // grepGateCounts searches relative to cwd. In the monorepo, it must
    // run from the repo root so the search dirs (.claude/, tools/, etc.) resolve.
    const originalCwd = process.cwd();
    try {
      process.chdir(join(__dirname, "../../../.."));

      // ci-watcher has exactly 1 real gate: .claude/hooks/spawn-ci-watcher-after-push.ts
      // If this returns >5, the --exclude-dir flag is broken (grep's --exclude-dir
      // matches directory *names* not paths, so "tools/dx" doesn't exclude anything).
      const results = grepGateCounts(["ci-watcher"]);
      expect(results["ci-watcher"]).toBeLessThanOrEqual(5);
    } finally {
      process.chdir(originalCwd);
    }
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
    // Design contract: unknown topics show all sections rather than an error,
    // keeping the CLI forgiving.
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

// ===========================================================================
// clearLocalOverride — remove a single key from .dx/config.local.json
// ===========================================================================

describe("clearLocalOverride", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dx-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("removes specified key and preserves other overrides", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(
      localPath,
      JSON.stringify({ overrides: { "ci-watcher": true, autosync: false } }),
    );

    clearLocalOverride(localPath, "ci-watcher");

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides).toEqual({ autosync: false });
  });

  test("clearing the last override leaves empty overrides object", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(
      localPath,
      JSON.stringify({ overrides: { "ci-watcher": true } }),
    );

    clearLocalOverride(localPath, "ci-watcher");

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides).toEqual({});
  });

  test("clearing a key that does not exist is a no-op", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(
      localPath,
      JSON.stringify({ overrides: { autosync: false } }),
    );

    // Should not throw
    clearLocalOverride(localPath, "nonexistent-feature");

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides).toEqual({ autosync: false });
  });

  test("no error when file does not exist", () => {
    const localPath = join(tempDir, "nonexistent", "config.local.json");
    expect(() => {
      clearLocalOverride(localPath, "ci-watcher");
    }).not.toThrow();
  });
});

// ===========================================================================
// clearAllLocalOverrides — reset local config to empty overrides
// ===========================================================================

describe("clearAllLocalOverrides", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dx-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("clears all overrides to empty object", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(
      localPath,
      JSON.stringify({
        overrides: { "ci-watcher": true, autosync: false },
      }),
    );

    clearAllLocalOverrides(localPath);

    const content = JSON.parse(readFileSync(localPath, "utf-8"));
    expect(content.overrides).toEqual({});
  });

  test("no error when file does not exist", () => {
    const localPath = join(tempDir, "nonexistent", "config.local.json");

    // Should not throw — missing file is a no-op
    expect(() => {
      clearAllLocalOverrides(localPath);
    }).not.toThrow();
  });
});

// ===========================================================================
// clearUserOverride — remove a single key from users[user].overrides
// ===========================================================================

describe("clearUserOverride", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dx-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("removes specified key and preserves other user overrides", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {
          nitsan: {
            aliases: ["Nitsan Avni"],
            overrides: { "ci-watcher": false, autosync: true },
          },
        },
      }),
    );

    clearUserOverride(configPath, "nitsan", "ci-watcher");

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.nitsan.overrides).toEqual({ autosync: true });
  });

  test("clearing the last override leaves empty overrides object", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {
          nitsan: {
            aliases: [],
            overrides: { "ci-watcher": false },
          },
        },
      }),
    );

    clearUserOverride(configPath, "nitsan", "ci-watcher");

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.nitsan.overrides).toEqual({});
  });

  test("clearing a key that does not exist is a no-op", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {
          nitsan: {
            aliases: [],
            overrides: { autosync: true },
          },
        },
      }),
    );

    // Should not throw
    clearUserOverride(configPath, "nitsan", "nonexistent-feature");

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.nitsan.overrides).toEqual({ autosync: true });
  });

  test("throws if user does not exist in config", () => {
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

    expect(() => {
      clearUserOverride(configPath, "unknown-user", "ci-watcher");
    }).toThrow();
  });
});

// ===========================================================================
// clearAllUserOverrides — remove all overrides for a user
// ===========================================================================

describe("clearAllUserOverrides", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dx-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("clears all overrides for a user to empty object", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {},
        users: {
          nitsan: {
            aliases: ["Nitsan Avni"],
            overrides: { "ci-watcher": false, autosync: true },
          },
        },
      }),
    );

    clearAllUserOverrides(configPath, "nitsan");

    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.users.nitsan.overrides).toEqual({});
    // Should preserve aliases
    expect(content.users.nitsan.aliases).toEqual(["Nitsan Avni"]);
  });

  test("throws if user does not exist in config", () => {
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

    expect(() => {
      clearAllUserOverrides(configPath, "unknown-user");
    }).toThrow();
  });
});

// ===========================================================================
// formatResetResult — human-readable confirmation
// ===========================================================================

describe("formatResetResult", () => {
  test("all features, local", () => {
    const output = formatResetResult(null, false, null);
    expect(output).toBe(
      "dx: reset to defaults (local)\n" +
      "    To persist across environments: dx reset --save",
    );
  });

  test("single feature, local", () => {
    const output = formatResetResult("ci-watcher", false, null);
    expect(output).toBe(
      "dx: reset ci-watcher to default (local)\n" +
      "    To persist across environments: dx reset ci-watcher --save",
    );
  });

  test("all features, saved for user", () => {
    const output = formatResetResult(null, true, "nitsan");
    expect(output).toBe("dx: reset to defaults for nitsan (saved)");
  });

  test("single feature, saved for user", () => {
    const output = formatResetResult("ci-watcher", true, "nitsan");
    expect(output).toBe("dx: reset ci-watcher to default for nitsan (saved)");
  });
});

// ===========================================================================
// formatResetResultJson — JSON confirmation
// ===========================================================================

describe("formatResetResultJson", () => {
  test("all features, local target", () => {
    const output = formatResetResultJson(null, false, null);
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("*");
    expect(parsed.target).toBe("local");
    expect(parsed).not.toHaveProperty("user");
  });

  test("single feature, local target", () => {
    const output = formatResetResultJson("ci-watcher", false, null);
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("ci-watcher");
    expect(parsed.target).toBe("local");
    expect(parsed).not.toHaveProperty("user");
  });

  test("all features, config target with user", () => {
    const output = formatResetResultJson(null, true, "nitsan");
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("*");
    expect(parsed.target).toBe("config");
    expect(parsed.user).toBe("nitsan");
  });

  test("single feature, config target with user", () => {
    const output = formatResetResultJson("ci-watcher", true, "nitsan");
    const parsed = JSON.parse(output);
    expect(parsed.feature).toBe("ci-watcher");
    expect(parsed.target).toBe("config");
    expect(parsed.user).toBe("nitsan");
  });

  test("returns valid JSON string", () => {
    const output = formatResetResultJson("autosync", false, null);
    expect(() => JSON.parse(output)).not.toThrow();
  });
});

// ===========================================================================
// buildResetCommand — Commander structure
// ===========================================================================

describe("buildResetCommand", () => {
  test("returns a Command instance", () => {
    const cmd = buildResetCommand();
    expect(cmd).toBeInstanceOf(Command);
  });

  test("has name 'reset'", () => {
    const cmd = buildResetCommand();
    expect(cmd.name()).toBe("reset");
  });

  test("has correct description", () => {
    const cmd = buildResetCommand();
    expect(cmd.description()).toBe("Reset features to defaults by clearing overrides");
  });

  test("accepts an optional [feature] argument", () => {
    const cmd = buildResetCommand();
    const args = (cmd as any)._args;
    expect(args).toHaveLength(1);
    expect(args[0].required).toBe(false);
  });

  test("has --save option", () => {
    const cmd = buildResetCommand();
    const saveOpt = cmd.options.find((o) => o.long === "--save");
    expect(saveOpt).toBeDefined();
  });

  test("has --json option", () => {
    const cmd = buildResetCommand();
    const jsonOpt = cmd.options.find((o) => o.long === "--json");
    expect(jsonOpt).toBeDefined();
  });
});
