/**
 * Slice 3 — Namespace filtering for dx commands.
 *
 * Tests for:
 * - filterByNamespace: pure function for prefix-based filtering (AC 11-14)
 * - dx status [namespace]: optional namespace argument filters features (AC 11, 14)
 * - dx ls [namespace]: optional namespace argument filters gate list (AC 12, 14)
 * - dx reset [namespace]: reset overrides matching prefix (AC 13)
 *
 * Part of: ENG-4688
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { makeConfig, makeContext } from "./test-fixtures";
import type { FeatureInfo } from "./core";

// --- Existing exports (static imports) ---
import {
  buildStatusCommand,
  buildStatusData,
} from "./commands/status";
import {
  buildListCommand,
  buildListData,
} from "./commands/list";
import {
  buildResetCommand,
  clearAllLocalOverrides,
} from "./commands/reset";

// ===========================================================================
// filterByNamespace — pure prefix-based filtering (AC 11-14)
// ===========================================================================

describe("filterByNamespace", () => {
  // Lazy import: filterByNamespace doesn't exist yet.
  // We import inside each test to get a clear "module not found" or
  // "not a function" error — the Red signal.
  function getFilterByNamespace(): (
    features: Record<string, unknown>,
    namespace: string | undefined,
  ) => Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./namespace");
    return mod.filterByNamespace;
  }

  test("returns only keys starting with 'tips.' when namespace is 'tips'", () => {
    const filterByNamespace = getFilterByNamespace();

    const features: Record<string, FeatureInfo> = {
      "ci-watcher": { value: true, enabled: true, source: "default" },
      "tips.enabled": { value: true, enabled: true, source: "default" },
      "tips.show-duration": { value: "10m", enabled: true, source: "default" },
      "tips.rest-duration": { value: "2h", enabled: true, source: "default" },
      autosync: { value: false, enabled: false, source: "default" },
    };

    const filtered = filterByNamespace(features, "tips");
    const keys = Object.keys(filtered).sort();

    expect(keys).toEqual([
      "tips.enabled",
      "tips.rest-duration",
      "tips.show-duration",
    ]);
  });

  test("returns all keys when namespace is undefined (no filter)", () => {
    const filterByNamespace = getFilterByNamespace();

    const features: Record<string, FeatureInfo> = {
      "ci-watcher": { value: true, enabled: true, source: "default" },
      "tips.enabled": { value: true, enabled: true, source: "default" },
      autosync: { value: false, enabled: false, source: "default" },
    };

    const filtered = filterByNamespace(features, undefined);
    expect(Object.keys(filtered).sort()).toEqual(
      Object.keys(features).sort(),
    );
  });

  test("returns empty when namespace matches nothing", () => {
    const filterByNamespace = getFilterByNamespace();

    const features: Record<string, FeatureInfo> = {
      "ci-watcher": { value: true, enabled: true, source: "default" },
      "tips.enabled": { value: true, enabled: true, source: "default" },
    };

    const filtered = filterByNamespace(features, "nonexistent");
    expect(Object.keys(filtered)).toEqual([]);
  });

  test("exact match: 'ci-watcher' returns only 'ci-watcher'", () => {
    const filterByNamespace = getFilterByNamespace();

    const features: Record<string, FeatureInfo> = {
      "ci-watcher": { value: true, enabled: true, source: "default" },
      "tips.enabled": { value: true, enabled: true, source: "default" },
      "tips.show-duration": { value: "10m", enabled: true, source: "default" },
    };

    const filtered = filterByNamespace(features, "ci-watcher");
    expect(Object.keys(filtered)).toEqual(["ci-watcher"]);
  });

  test("does not match partial prefixes without dot separator: 'tip' does not match 'tips.enabled'", () => {
    const filterByNamespace = getFilterByNamespace();

    const features: Record<string, FeatureInfo> = {
      "tips.enabled": { value: true, enabled: true, source: "default" },
      "tipster": { value: false, enabled: false, source: "default" },
    };

    // "tip" is not an exact match for either key, and "tip." is not a prefix
    // of either key, so nothing should match.
    const filtered = filterByNamespace(features, "tip");
    expect(Object.keys(filtered)).toEqual([]);
  });

  test("when namespace is both an exact feature name and a prefix, returns exact + prefixed", () => {
    const filterByNamespace = getFilterByNamespace();

    // "tips" is both a registered feature AND a prefix of tips.* features.
    // filterByNamespace should return all matches — the disambiguation
    // (exact-match-wins) is the reset command's responsibility, not this function.
    const features: Record<string, FeatureInfo> = {
      "ci-watcher": { value: true, enabled: true, source: "default" },
      tips: { value: true, enabled: true, source: "default" },
      "tips.enabled": { value: true, enabled: true, source: "default" },
      "tips.show-duration": { value: "10m", enabled: true, source: "default" },
    };

    const filtered = filterByNamespace(features, "tips");
    const keys = Object.keys(filtered).sort();

    expect(keys).toEqual(["tips", "tips.enabled", "tips.show-duration"]);
  });
});

// ===========================================================================
// dx status [namespace] — AC 11, 14
// ===========================================================================

describe("buildStatusCommand — namespace argument", () => {
  test("accepts optional [namespace] argument", () => {
    const cmd = buildStatusCommand();

    // Commander stores arguments in _args (no public API as of commander@12)
    const args = (cmd as any)._args;
    const nsArg = args.find((a: any) => a._name === "namespace");

    expect(nsArg).toBeDefined();
    expect(nsArg.required).toBe(false);
  });
});

describe("buildStatusData — namespace filtering", () => {
  /** Build a context with tips.* + non-tips features for namespace tests. */
  function makeNamespacedContext() {
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
        },
      }),
    });
  }

  test("with namespace 'tips' returns only tips.* features", () => {
    const ctx = makeNamespacedContext();
    const data = buildStatusData(ctx, "tips");

    const keys = Object.keys(data.features).sort();
    expect(keys).toEqual([
      "tips.enabled",
      "tips.rest-duration",
      "tips.show-duration",
    ]);
  });

  test("without namespace returns all features (backward compat)", () => {
    const ctx = makeNamespacedContext();
    const data = buildStatusData(ctx);

    const keys = Object.keys(data.features).sort();
    expect(keys).toEqual([
      "autosync",
      "ci-watcher",
      "tips.enabled",
      "tips.rest-duration",
      "tips.show-duration",
    ]);
  });
});

// Note: formatStatus rendering of pre-filtered data is already covered by
// the formatStatus tests in cli.test.ts. Namespace filtering is tested
// at the buildStatusData level above (where the filtering actually happens).

// ===========================================================================
// dx ls [namespace] — AC 12, 14
// ===========================================================================

describe("buildListCommand — namespace argument", () => {
  test("accepts optional [namespace] argument", () => {
    const cmd = buildListCommand();

    const args = (cmd as any)._args;
    const nsArg = args.find((a: any) => a._name === "namespace");

    expect(nsArg).toBeDefined();
    expect(nsArg.required).toBe(false);
  });
});

describe("buildListData — namespace filtering", () => {
  function makeNamespacedContext() {
    return makeContext({
      config: makeConfig({
        features: {
          "ci-watcher": {
            description: "Monitor CI after push",
            mechanism: "Claude PostToolUse hook",
            default: true,
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
        },
      }),
    });
  }

  test("with namespace 'tips' returns only tips.* entries", () => {
    const ctx = makeNamespacedContext();
    const grepResults = {
      "ci-watcher": 2,
      "tips.enabled": 1,
      "tips.show-duration": 1,
    };

    const data = buildListData(ctx, grepResults, "tips");
    const features = data.map((e) => e.feature).sort();

    expect(features).toEqual(["tips.enabled", "tips.show-duration"]);
  });

  test("without namespace returns all entries (backward compat)", () => {
    const ctx = makeNamespacedContext();
    const grepResults = {
      "ci-watcher": 2,
      "tips.enabled": 1,
      "tips.show-duration": 1,
    };

    const data = buildListData(ctx, grepResults);
    const features = data.map((e) => e.feature).sort();

    expect(features).toEqual([
      "ci-watcher",
      "tips.enabled",
      "tips.show-duration",
    ]);
  });
});

// ===========================================================================
// dx reset [namespace] — AC 13
// ===========================================================================

describe("buildResetCommand — namespace argument", () => {
  test("existing [feature] argument already optional (namespace will reuse it)", () => {
    const cmd = buildResetCommand();

    // The existing [feature] argument should work for both single features
    // and namespace prefixes. The command's action handler decides the
    // interpretation based on the resolution rules in the spec.
    const args = (cmd as any)._args;
    expect(args.length).toBeGreaterThanOrEqual(1);
    expect(args[0].required).toBe(false);
  });
});

describe("dx reset — namespace behavior", () => {
  /**
   * These tests use real filesystem operations to verify that
   * namespace-scoped reset clears the correct overrides.
   */

  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dx-reset-ns-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("reset 'tips' clears only tips.* local overrides, preserves others", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(
      localPath,
      JSON.stringify({
        overrides: {
          "ci-watcher": false,
          "tips.enabled": false,
          "tips.show-duration": "5m",
          "tips.rest-duration": "1h",
        },
      }),
    );

    // Lazy import: clearNamespaceLocalOverrides doesn't exist yet
    const { clearNamespaceLocalOverrides } = require("./commands/reset");
    clearNamespaceLocalOverrides(localPath, "tips");

    const result = JSON.parse(readFileSync(localPath, "utf-8"));

    // tips.* overrides should be gone
    expect(result.overrides["tips.enabled"]).toBeUndefined();
    expect(result.overrides["tips.show-duration"]).toBeUndefined();
    expect(result.overrides["tips.rest-duration"]).toBeUndefined();

    // ci-watcher should be preserved
    expect(result.overrides["ci-watcher"]).toBe(false);
  });

  test("reset with no args clears all local overrides (existing behavior preserved)", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(
      localPath,
      JSON.stringify({
        overrides: {
          "ci-watcher": false,
          "tips.enabled": false,
          "tips.show-duration": "5m",
        },
      }),
    );

    // Using existing function — this tests backward compat
    clearAllLocalOverrides(localPath);

    const result = JSON.parse(readFileSync(localPath, "utf-8"));

    // All overrides should be cleared
    expect(result.overrides).toEqual({});
  });

  test("reset 'tips' clears only tips.* user overrides (--save), preserves others", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        features: {
          "ci-watcher": { description: "Monitor CI", mechanism: "hook", default: true },
          "tips.enabled": { description: "Tips", mechanism: "statusline", default: true },
          "tips.show-duration": { description: "Duration", mechanism: "timing", default: "10m" },
        },
        users: {
          nitsan: {
            aliases: ["Nitsan Avni"],
            overrides: {
              "ci-watcher": false,
              "tips.enabled": false,
              "tips.show-duration": "5m",
            },
          },
        },
      }),
    );

    const { clearNamespaceUserOverrides } = require("./commands/reset");
    clearNamespaceUserOverrides(configPath, "nitsan", "tips");

    const result = JSON.parse(readFileSync(configPath, "utf-8"));

    // tips.* user overrides should be gone
    expect(result.users.nitsan.overrides["tips.enabled"]).toBeUndefined();
    expect(result.users.nitsan.overrides["tips.show-duration"]).toBeUndefined();

    // ci-watcher should be preserved
    expect(result.users.nitsan.overrides["ci-watcher"]).toBe(false);
  });

  test("reset namespace matching nothing is a no-op", () => {
    const localPath = join(tempDir, "config.local.json");
    writeFileSync(
      localPath,
      JSON.stringify({
        overrides: {
          "ci-watcher": false,
          "tips.enabled": false,
        },
      }),
    );

    const { clearNamespaceLocalOverrides } = require("./commands/reset");
    clearNamespaceLocalOverrides(localPath, "nonexistent");

    const result = JSON.parse(readFileSync(localPath, "utf-8"));

    // All overrides should be untouched
    expect(result.overrides["ci-watcher"]).toBe(false);
    expect(result.overrides["tips.enabled"]).toBe(false);
  });
});
