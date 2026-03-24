/**
 * Shared test fixtures for dx CLI tests.
 *
 * Provides `makeConfig()` and `makeContext()` factories used across
 * core, CLI, and write-command test suites.
 */

import type { DxConfig, DxContext } from "./core";

/** Minimal valid config with two features and one user. */
export function makeConfig(overrides?: Partial<DxConfig>): DxConfig {
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

/** Build a DxContext with sensible defaults. */
export function makeContext(overrides?: Partial<DxContext>): DxContext {
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
