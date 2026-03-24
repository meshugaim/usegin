import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  loadConfig,
  resolveUser,
  isEnabled,
  getFeature,
  allFeatures,
  reload,
  type DxConfig,
  type DxLocalConfig,
  type DxContext,
  type FeatureInfo,
} from "./core";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid config with two features and one user. */
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

/** Build a DxContext with sensible defaults. */
function makeCtx(overrides?: Partial<DxContext>): DxContext {
  return {
    config: makeConfig(),
    local: null,
    env: {},
    gitUserName: null,
    gitUserEmail: null,
    whoami: null,
    ...overrides,
  };
}

/** Local config that enables autosync. */
function makeLocal(overrides?: Partial<DxLocalConfig>): DxLocalConfig {
  return {
    overrides: {
      autosync: true,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Global test isolation — reset cache before every test
// ---------------------------------------------------------------------------
beforeEach(() => {
  reload();
});

// ===========================================================================
// loadConfig
// ===========================================================================

describe("loadConfig", () => {
  test("passes through config and local from context", () => {
    const ctx = makeCtx({ local: makeLocal() });
    const result = loadConfig(ctx);

    expect(result.features).toBe(ctx.config.features);
    expect(result.users).toBe(ctx.config.users);
    expect(result.local).toBe(ctx.local);
  });

  test("local is null when no local config exists", () => {
    const ctx = makeCtx({ local: null });
    const result = loadConfig(ctx);

    expect(result.local).toBeNull();
  });
});

// ===========================================================================
// resolveUser — identity resolution
// ===========================================================================

describe("resolveUser", () => {
  // -----------------------------------------------------------------------
  // $DX_USER (highest priority)
  // -----------------------------------------------------------------------

  test("returns $DX_USER when set", () => {
    const ctx = makeCtx({ env: { DX_USER: "nitsan" } });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  test("$DX_USER takes precedence over all other signals", () => {
    const ctx = makeCtx({
      env: {
        DX_USER: "explicit-user",
        GITHUB_USER: "nitsan-ona",
        USER: "nitsan",
      },
    });
    const result = resolveUser(ctx);
    expect(result).toBe("explicit-user");
  });

  // -----------------------------------------------------------------------
  // Alias matching via $GITHUB_USER
  // -----------------------------------------------------------------------

  test("matches user by $GITHUB_USER against aliases", () => {
    const ctx = makeCtx({ env: { GITHUB_USER: "nitsan-ona" } });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  test("alias matching is case-insensitive", () => {
    const ctx = makeCtx({ env: { GITHUB_USER: "NITSAN-ONA" } });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  // -----------------------------------------------------------------------
  // Alias matching via $USER
  // -----------------------------------------------------------------------

  test("matches user by $USER against aliases", () => {
    const ctx = makeCtx({ env: { USER: "Nitsan Avni" } });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  test("$USER case-insensitive alias match", () => {
    const ctx = makeCtx({ env: { USER: "nitsan avni" } });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  // -----------------------------------------------------------------------
  // Matching user keys directly (not just aliases)
  // -----------------------------------------------------------------------

  test("matches user key directly against $USER", () => {
    const ctx = makeCtx({ env: { USER: "nitsan" } });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  test("matches user key case-insensitively against $USER", () => {
    const ctx = makeCtx({ env: { USER: "NITSAN" } });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  test("matches user key against $GITHUB_USER", () => {
    const ctx = makeCtx({ env: { GITHUB_USER: "nitsan" } });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  // -----------------------------------------------------------------------
  // Alias matching via git config
  // -----------------------------------------------------------------------

  test("matches user by git user.name against aliases", () => {
    const ctx = makeCtx({ gitUserName: "Nitsan Avni" });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  test("matches user by git user.email prefix against aliases", () => {
    const config = makeConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona", "nitsan"],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({ config, gitUserEmail: "nitsan@example.com" });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  test("git email prefix match is case-insensitive", () => {
    const config = makeConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona", "NITSAN"],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({ config, gitUserEmail: "Nitsan@example.com" });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  // -----------------------------------------------------------------------
  // Resolution order
  // -----------------------------------------------------------------------

  test("$GITHUB_USER is checked before $USER", () => {
    const config = makeConfig({
      users: {
        alice: {
          aliases: ["alice-gh"],
          overrides: {},
        },
        bob: {
          aliases: ["bob-local"],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({
      config,
      env: { GITHUB_USER: "alice-gh", USER: "bob-local" },
    });
    const result = resolveUser(ctx);
    expect(result).toBe("alice");
  });

  test("$USER is checked before git config", () => {
    const config = makeConfig({
      users: {
        alice: {
          aliases: ["alice-local"],
          overrides: {},
        },
        bob: {
          aliases: ["Bob Git"],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({
      config,
      env: { USER: "alice-local" },
      gitUserName: "Bob Git",
    });
    const result = resolveUser(ctx);
    expect(result).toBe("alice");
  });

  // -----------------------------------------------------------------------
  // No match
  // -----------------------------------------------------------------------

  test("returns null when no signals match any user", () => {
    const ctx = makeCtx({
      env: { USER: "unknown-person" },
      gitUserName: "Nobody Known",
      gitUserEmail: "nobody@example.com",
    });
    const result = resolveUser(ctx);
    expect(result).toBeNull();
  });

  test("returns null when no env vars and no git config", () => {
    const ctx = makeCtx();
    const result = resolveUser(ctx);
    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Multiple users
  // -----------------------------------------------------------------------

  test("resolves correct user when multiple users exist", () => {
    const config = makeConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni", "nitsan-ona"],
          overrides: {},
        },
        alice: {
          aliases: ["Alice Smith", "alice-gh"],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({ config, env: { GITHUB_USER: "alice-gh" } });
    const result = resolveUser(ctx);
    expect(result).toBe("alice");
  });

  // -----------------------------------------------------------------------
  // whoami fallback (spec step 2c)
  // -----------------------------------------------------------------------

  test("whoami matches user key", () => {
    const ctx = makeCtx({ whoami: "nitsan" });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  test("whoami matches alias", () => {
    const ctx = makeCtx({ whoami: "nitsan-ona" });
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  test("$USER is checked before whoami in resolution order", () => {
    const config = makeConfig({
      users: {
        alice: {
          aliases: ["alice-local"],
          overrides: {},
        },
        bob: {
          aliases: ["bob-whoami"],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({
      config,
      env: { USER: "alice-local" },
      whoami: "bob-whoami",
    });
    const result = resolveUser(ctx);
    // $USER should win over whoami (spec: $GITHUB_USER → $USER → whoami → git config)
    expect(result).toBe("alice");
  });

  // -----------------------------------------------------------------------
  // Email prefix matching
  // -----------------------------------------------------------------------

  test("matches git email prefix before @ against aliases", () => {
    const config = makeConfig({
      users: {
        alice: {
          aliases: ["alice-dev"],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({
      config,
      gitUserEmail: "alice-dev@company.com",
    });
    const result = resolveUser(ctx);
    expect(result).toBe("alice");
  });

  test("matches git email prefix against user keys", () => {
    const config = makeConfig({
      users: {
        bob: {
          aliases: [],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({
      config,
      gitUserEmail: "bob@company.com",
    });
    const result = resolveUser(ctx);
    expect(result).toBe("bob");
  });

  // -----------------------------------------------------------------------
  // Email edge cases
  // -----------------------------------------------------------------------

  test("gitUserEmail with no @ sign — tries to match the full string", () => {
    const config = makeConfig({
      users: {
        nitsan: {
          aliases: ["nitsan"],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({ config, gitUserEmail: "nitsan" });
    const result = resolveUser(ctx);
    // No @ sign means the "prefix" is the whole string — should match alias
    expect(result).toBe("nitsan");
  });

  test("gitUserEmail with empty prefix — does not match anything", () => {
    const config = makeConfig({
      users: {
        nitsan: {
          aliases: ["", "nitsan-ona"],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({ config, gitUserEmail: "@domain.com" });
    const result = resolveUser(ctx);
    // Empty prefix should not match any user
    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Partial alias and duplicate alias
  // -----------------------------------------------------------------------

  test("does not match partial alias — requires full string match", () => {
    const config = makeConfig({
      users: {
        nitsan: {
          aliases: ["Nitsan Avni"],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({ config, env: { USER: "Nitsan" } });
    // "Nitsan" is not the full alias "Nitsan Avni" — should not match alias
    // But it should match the user key "nitsan" (case-insensitive)
    const result = resolveUser(ctx);
    expect(result).toBe("nitsan");
  });

  test("first matching user wins (deterministic order)", () => {
    const config: DxConfig = {
      features: {},
      users: {
        alice: {
          aliases: ["shared-alias"],
          overrides: {},
        },
        bob: {
          aliases: ["shared-alias"],
          overrides: {},
        },
      },
    };
    const ctx = makeCtx({ config, env: { USER: "shared-alias" } });
    const result = resolveUser(ctx);
    // V8 iterates object keys in insertion order, so the first key ("alice") wins.
    expect(result).toBe("alice");
  });
});

// ===========================================================================
// isEnabled — three-layer merge chain
// ===========================================================================

describe("isEnabled", () => {
  // -----------------------------------------------------------------------
  // Default layer
  // -----------------------------------------------------------------------

  test("returns feature default when no user and no local override", () => {
    const ctx = makeCtx();
    expect(isEnabled("ci-watcher", ctx, null)).toBe(true);
    expect(isEnabled("autosync", ctx, null)).toBe(false);
  });

  test("returns feature default when user has no override for this feature", () => {
    const ctx = makeCtx();
    // nitsan has no override for "autosync"
    expect(isEnabled("autosync", ctx, "nitsan")).toBe(false);
  });

  // -----------------------------------------------------------------------
  // User override layer
  // -----------------------------------------------------------------------

  test("user override false overrides default true", () => {
    const ctx = makeCtx();
    // nitsan overrides ci-watcher to false (default is true)
    expect(isEnabled("ci-watcher", ctx, "nitsan")).toBe(false);
  });

  test("user override true overrides default false", () => {
    const config = makeConfig({
      users: {
        nitsan: {
          aliases: [],
          overrides: {
            autosync: true,
          },
        },
      },
    });
    const ctx = makeCtx({ config });
    expect(isEnabled("autosync", ctx, "nitsan")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Local override layer (highest priority)
  // -----------------------------------------------------------------------

  test("local override true overrides user override false", () => {
    const ctx = makeCtx({
      local: {
        overrides: {
          "ci-watcher": true,
        },
      },
    });
    // nitsan has ci-watcher: false, but local says true → true wins
    expect(isEnabled("ci-watcher", ctx, "nitsan")).toBe(true);
  });

  test("local override false overrides default true", () => {
    const ctx = makeCtx({
      local: {
        overrides: {
          "ci-watcher": false,
        },
      },
    });
    expect(isEnabled("ci-watcher", ctx, null)).toBe(false);
  });

  test("local override true enables a default-false feature", () => {
    const ctx = makeCtx({
      local: makeLocal(), // autosync: true
    });
    expect(isEnabled("autosync", ctx, null)).toBe(true);
  });

  test("full three-layer chain: default true → user false → local true", () => {
    const ctx = makeCtx({
      local: {
        overrides: {
          "ci-watcher": true,
        },
      },
    });
    // default: true, nitsan override: false, local: true → true
    expect(isEnabled("ci-watcher", ctx, "nitsan")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Unknown feature
  // -----------------------------------------------------------------------

  test("unknown feature returns true", () => {
    const ctx = makeCtx();
    const result = isEnabled("nonexistent-feature", ctx, null);
    expect(result).toBe(true);
  });

  test("unknown feature warns to stderr", () => {
    const ctx = makeCtx();
    const stderrWrite = mock(() => {});
    const originalWrite = process.stderr.write;
    process.stderr.write = stderrWrite as any;

    try {
      isEnabled("nonexistent-feature", ctx, null);
      expect(stderrWrite).toHaveBeenCalled();
      const output = stderrWrite.mock.calls[0][0] as string;
      expect(output).toContain("nonexistent-feature");
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  // -----------------------------------------------------------------------
  // No matching user
  // -----------------------------------------------------------------------

  test("non-existent user falls back to defaults only", () => {
    const ctx = makeCtx();
    expect(isEnabled("ci-watcher", ctx, "unknown-user")).toBe(true);
    expect(isEnabled("autosync", ctx, "unknown-user")).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Automatic user resolution
  // -----------------------------------------------------------------------

  test("resolves user automatically when user param is not provided", () => {
    const ctx = makeCtx({ env: { DX_USER: "nitsan" } });
    // nitsan overrides ci-watcher to false
    expect(isEnabled("ci-watcher", ctx)).toBe(false);
  });

  // -----------------------------------------------------------------------
  // $DX_USER → non-existent user → falls back to defaults
  // -----------------------------------------------------------------------

  test("$DX_USER set to non-existent user falls back to feature defaults", () => {
    const ctx = makeCtx({ env: { DX_USER: "explicit-user" } });
    // resolveUser returns "explicit-user", which has no entry in users
    const resolved = resolveUser(ctx);
    expect(resolved).toBe("explicit-user");
    // isEnabled should fall back to feature defaults (no user overrides apply)
    expect(isEnabled("ci-watcher", ctx, resolved)).toBe(true);
    expect(isEnabled("autosync", ctx, resolved)).toBe(false);
  });
});

// ===========================================================================
// getFeature — returns enabled + source
// ===========================================================================

describe("getFeature", () => {
  test("returns source 'default' when no overrides apply", () => {
    const ctx = makeCtx();
    const result = getFeature("ci-watcher", ctx, null);
    expect(result).toEqual({ enabled: true, source: "default" });
  });

  test("returns source 'default' for default-false feature", () => {
    const ctx = makeCtx();
    const result = getFeature("autosync", ctx, null);
    expect(result).toEqual({ enabled: false, source: "default" });
  });

  test("returns source 'user-override' when user overrides", () => {
    const ctx = makeCtx();
    const result = getFeature("ci-watcher", ctx, "nitsan");
    expect(result).toEqual({ enabled: false, source: "user-override" });
  });

  test("returns source 'local-override' when local overrides", () => {
    const ctx = makeCtx({
      local: { overrides: { "ci-watcher": false } },
    });
    const result = getFeature("ci-watcher", ctx, null);
    expect(result).toEqual({ enabled: false, source: "local-override" });
  });

  test("local-override source wins over user-override", () => {
    const ctx = makeCtx({
      local: { overrides: { "ci-watcher": true } },
    });
    // nitsan overrides ci-watcher to false, but local says true
    const result = getFeature("ci-watcher", ctx, "nitsan");
    expect(result).toEqual({ enabled: true, source: "local-override" });
  });

  test("user-override source when user overrides default", () => {
    const config = makeConfig({
      users: {
        nitsan: {
          aliases: [],
          overrides: { autosync: true },
        },
      },
    });
    const ctx = makeCtx({ config });
    const result = getFeature("autosync", ctx, "nitsan");
    expect(result).toEqual({ enabled: true, source: "user-override" });
  });

  test("unknown feature returns enabled true with source 'default'", () => {
    const ctx = makeCtx();
    const result = getFeature("nonexistent", ctx, null);
    expect(result.enabled).toBe(true);
    // Source for unknown features — they're effectively defaults
    expect(result.source).toBe("default");
  });

  test("resolves user automatically when user param is not provided", () => {
    const ctx = makeCtx({ env: { DX_USER: "nitsan" } });
    const result = getFeature("ci-watcher", ctx);
    expect(result).toEqual({ enabled: false, source: "user-override" });
  });
});

// ===========================================================================
// allFeatures — full feature map
// ===========================================================================

describe("allFeatures", () => {
  test("returns all registered features with their resolved state", () => {
    const ctx = makeCtx();
    const result = allFeatures(ctx, null);

    expect(Object.keys(result)).toContain("ci-watcher");
    expect(Object.keys(result)).toContain("autosync");
    expect(Object.keys(result)).toHaveLength(2);
  });

  test("each entry has enabled and source", () => {
    const ctx = makeCtx();
    const result = allFeatures(ctx, null);

    expect(result["ci-watcher"]).toEqual({ enabled: true, source: "default" });
    expect(result.autosync).toEqual({ enabled: false, source: "default" });
  });

  test("reflects user overrides", () => {
    const ctx = makeCtx();
    const result = allFeatures(ctx, "nitsan");

    expect(result["ci-watcher"]).toEqual({
      enabled: false,
      source: "user-override",
    });
    // nitsan has no autosync override, so it stays at default
    expect(result.autosync).toEqual({ enabled: false, source: "default" });
  });

  test("reflects local overrides", () => {
    const ctx = makeCtx({ local: makeLocal() });
    const result = allFeatures(ctx, null);

    expect(result.autosync).toEqual({
      enabled: true,
      source: "local-override",
    });
    // ci-watcher is not in local overrides, stays at default
    expect(result["ci-watcher"]).toEqual({
      enabled: true,
      source: "default",
    });
  });

  test("local override wins over user override in full map", () => {
    const ctx = makeCtx({
      local: { overrides: { "ci-watcher": true } },
    });
    const result = allFeatures(ctx, "nitsan");

    expect(result["ci-watcher"]).toEqual({
      enabled: true,
      source: "local-override",
    });
  });

  test("returns empty record when no features defined", () => {
    const config = makeConfig({ features: {} });
    const ctx = makeCtx({ config });
    const result = allFeatures(ctx, null);

    expect(Object.keys(result)).toHaveLength(0);
  });

  test("resolves user automatically when user param is not provided", () => {
    const ctx = makeCtx({ env: { DX_USER: "nitsan" } });
    const result = allFeatures(ctx);

    expect(result["ci-watcher"]).toEqual({
      enabled: false,
      source: "user-override",
    });
  });
});

// ===========================================================================
// Caching
// ===========================================================================

describe("caching", () => {
  test("loadConfig returns cached result on second call", () => {
    const ctx = makeCtx();
    const first = loadConfig(ctx);
    const second = loadConfig(ctx);
    expect(first).toBe(second); // same reference
  });

  test("reload() forces re-read on next loadConfig call", () => {
    const ctx = makeCtx();
    const first = loadConfig(ctx);

    reload();

    // After reload, a new context should produce a new result
    const ctx2 = makeCtx({
      config: makeConfig({
        features: {
          "new-feature": {
            description: "Added after reload",
            mechanism: "test",
            default: true,
          },
        },
      }),
    });
    const second = loadConfig(ctx2);

    expect(second).not.toBe(first);
    expect(second.features["new-feature"]).toBeDefined();
  });

  test("isEnabled uses cached config (fast path)", () => {
    const ctx = makeCtx();

    // Prime the cache
    loadConfig(ctx);

    // isEnabled should work without re-reading
    expect(isEnabled("ci-watcher", ctx, null)).toBe(true);
    expect(isEnabled("autosync", ctx, null)).toBe(false);
  });

  test("isEnabled completes in <5ms after cache is primed", () => {
    const ctx = makeCtx();
    loadConfig(ctx); // prime cache
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      isEnabled("ci-watcher", ctx, null);
    }
    const elapsed = (performance.now() - start) / 100;
    expect(elapsed).toBeLessThan(5);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe("edge cases", () => {
  test("empty users object — all features use defaults", () => {
    const config = makeConfig({ users: {} });
    const ctx = makeCtx({ config });

    expect(isEnabled("ci-watcher", ctx, null)).toBe(true);
    expect(isEnabled("autosync", ctx, null)).toBe(false);
  });

  test("user with empty overrides — all features use defaults", () => {
    const config = makeConfig({
      users: {
        nitsan: {
          aliases: [],
          overrides: {},
        },
      },
    });
    const ctx = makeCtx({ config });

    expect(isEnabled("ci-watcher", ctx, "nitsan")).toBe(true);
    expect(isEnabled("autosync", ctx, "nitsan")).toBe(false);
  });

  test("local overrides for features not in registry still apply", () => {
    const ctx = makeCtx({
      local: {
        overrides: {
          "unregistered-feature": true,
        },
      },
    });
    // unregistered-feature is not in features — unknown features return true
    // but with a local override of true, it should still be true
    expect(isEnabled("unregistered-feature", ctx, null)).toBe(true);
  });

  test("user override for a feature not in registry", () => {
    const config = makeConfig({
      users: {
        nitsan: {
          aliases: [],
          overrides: {
            "ghost-feature": false,
          },
        },
      },
    });
    const ctx = makeCtx({ config });
    // ghost-feature is not in features registry, but user has an override
    // Unknown features default to true, but user overrides to false
    // This tests that user overrides are respected even for unregistered features
    expect(isEnabled("ghost-feature", ctx, "nitsan")).toBe(false);
  });

  test("multiple features with mixed sources", () => {
    const config = makeConfig({
      features: {
        a: { description: "A", mechanism: "test", default: true },
        b: { description: "B", mechanism: "test", default: false },
        c: { description: "C", mechanism: "test", default: true },
        d: { description: "D", mechanism: "test", default: false },
      },
      users: {
        dev: {
          aliases: [],
          overrides: {
            b: true,
            c: false,
          },
        },
      },
    });
    const ctx = makeCtx({
      config,
      local: {
        overrides: {
          c: true,
          d: true,
        },
      },
    });

    const result = allFeatures(ctx, "dev");

    // a: default true, no overrides → true, source: default
    expect(result.a).toEqual({ enabled: true, source: "default" });
    // b: default false, user: true → true, source: user-override
    expect(result.b).toEqual({ enabled: true, source: "user-override" });
    // c: default true, user: false, local: true → true, source: local-override
    expect(result.c).toEqual({ enabled: true, source: "local-override" });
    // d: default false, no user, local: true → true, source: local-override
    expect(result.d).toEqual({ enabled: true, source: "local-override" });
  });

  test("local config with empty overrides object", () => {
    const ctx = makeCtx({
      local: { overrides: {} },
    });
    // Should behave the same as no local config
    expect(isEnabled("ci-watcher", ctx, null)).toBe(true);
    expect(isEnabled("autosync", ctx, null)).toBe(false);
  });

  test("config with no features defined", () => {
    const config = makeConfig({ features: {} });
    const ctx = makeCtx({ config });
    const result = allFeatures(ctx, null);
    expect(result).toEqual({});
  });
});

