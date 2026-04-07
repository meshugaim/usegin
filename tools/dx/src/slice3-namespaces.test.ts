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

import { describe, test, expect } from "bun:test";
import { Command } from "commander";

import { makeConfig, makeContext } from "./test-fixtures";
import type { FeatureInfo } from "./core";

// --- Existing exports (static imports) ---
import {
  buildStatusCommand,
  buildStatusData,
  formatStatus,
  type StatusData,
} from "./commands/status";
import {
  buildListCommand,
  buildListData,
} from "./commands/list";
import {
  buildResetCommand,
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

  test.failing("returns only keys starting with 'tips.' when namespace is 'tips'", () => {
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

  test.failing("returns all keys when namespace is undefined (no filter)", () => {
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

  test.failing("returns empty when namespace matches nothing", () => {
    const filterByNamespace = getFilterByNamespace();

    const features: Record<string, FeatureInfo> = {
      "ci-watcher": { value: true, enabled: true, source: "default" },
      "tips.enabled": { value: true, enabled: true, source: "default" },
    };

    const filtered = filterByNamespace(features, "nonexistent");
    expect(Object.keys(filtered)).toEqual([]);
  });

  test.failing("exact match: 'ci-watcher' returns only 'ci-watcher'", () => {
    const filterByNamespace = getFilterByNamespace();

    const features: Record<string, FeatureInfo> = {
      "ci-watcher": { value: true, enabled: true, source: "default" },
      "tips.enabled": { value: true, enabled: true, source: "default" },
      "tips.show-duration": { value: "10m", enabled: true, source: "default" },
    };

    const filtered = filterByNamespace(features, "ci-watcher");
    expect(Object.keys(filtered)).toEqual(["ci-watcher"]);
  });

  test.failing("does not match partial prefixes without dot separator: 'tip' does not match 'tips.enabled'", () => {
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
});

// ===========================================================================
// dx status [namespace] — AC 11, 14
// ===========================================================================

describe("buildStatusCommand — namespace argument", () => {
  test.failing("accepts optional [namespace] argument", () => {
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

  test.failing("with namespace 'tips' returns only tips.* features", () => {
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

describe("formatStatus — namespace filtering", () => {
  test("with namespace shows only filtered features", () => {
    const data: StatusData = {
      user: "nitsan",
      features: {
        "tips.enabled": {
          value: true,
          enabled: true,
          source: "default",
          description: "Show tips in status line",
        },
        "tips.show-duration": {
          value: "10m",
          enabled: true,
          source: "default",
          description: "How long a tip stays visible",
        },
      },
    };

    const output = formatStatus(data);

    // Should show tips features
    expect(output).toContain("tips.enabled");
    expect(output).toContain("tips.show-duration");

    // Should NOT show non-tips features (they weren't in the data)
    expect(output).not.toContain("ci-watcher");
    expect(output).not.toContain("autosync");

    // This test verifies that formatStatus correctly renders
    // pre-filtered data. The filtering itself is tested in
    // buildStatusData tests above.
  });
});

// ===========================================================================
// dx ls [namespace] — AC 12, 14
// ===========================================================================

describe("buildListCommand — namespace argument", () => {
  test.failing("accepts optional [namespace] argument", () => {
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

  test.failing("with namespace 'tips' returns only tips.* entries", () => {
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

  const { mkdtempSync, rmSync, readFileSync, writeFileSync } = require("fs");
  const { tmpdir } = require("os");
  const { join } = require("path");

  let tempDir: string;

  function setup() {
    tempDir = mkdtempSync(join(tmpdir(), "dx-reset-ns-"));
  }

  function teardown() {
    rmSync(tempDir, { recursive: true, force: true });
  }

  test.failing("reset 'tips' clears only tips.* local overrides, preserves others", () => {
    setup();
    try {
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
    } finally {
      teardown();
    }
  });

  test("reset with no args clears all local overrides (existing behavior preserved)", () => {
    setup();
    try {
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
      const { clearAllLocalOverrides } = require("./commands/reset");
      clearAllLocalOverrides(localPath);

      const result = JSON.parse(readFileSync(localPath, "utf-8"));

      // All overrides should be cleared
      expect(result.overrides).toEqual({});
    } finally {
      teardown();
    }
  });

  test.failing("reset 'tips' clears only tips.* user overrides (--save), preserves others", () => {
    setup();
    try {
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
    } finally {
      teardown();
    }
  });
});
