/**
 * dx core module — pure functions for developer experience config.
 *
 * Provides config loading, user resolution, and feature flag evaluation
 * with a three-layer merge chain: default → user-override → local-override.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeatureDefinition {
  description: string;
  mechanism: string;
  default: boolean;
}

export interface UserDefinition {
  aliases: string[];
  overrides: Record<string, boolean>;
}

export interface DxConfig {
  features: Record<string, FeatureDefinition>;
  users: Record<string, UserDefinition>;
}

export interface DxLocalConfig {
  overrides: Record<string, boolean>;
}

export interface DxContext {
  config: DxConfig;
  local: DxLocalConfig | null;
  env: Record<string, string | undefined>;
  gitUserName: string | null;
  gitUserEmail: string | null;
  whoami: string | null;
  warn?: (msg: string) => void;
  /** Absolute path to .dx/config.json (set by SDK, absent in pure tests). */
  configPath?: string;
  /** Absolute path to .dx/config.local.json (set by SDK, absent in pure tests). */
  localPath?: string;
}

export type FeatureSource = "default" | "user-override" | "local-override";

export interface FeatureInfo {
  enabled: boolean;
  source: FeatureSource;
}

/** Which env var or git config field matched during identity resolution. */
export type UserSignal =
  | "DX_USER"
  | "GITHUB_USER"
  | "USER"
  | "whoami"
  | "gitUserName"
  | "gitUserEmail";

/** How the signal was matched: "exact" for DX_USER, "key" for user key, "alias" for alias. */
export type UserMatch = "exact" | "key" | "alias";

/** Identity resolution result with provenance (how the user was found). */
export interface UserProvenance {
  user: string | null;
  signal: UserSignal | null;
  match: UserMatch | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the prefix before `@` from an email address.
 *
 * Returns the prefix string, or null if the prefix is empty
 * (e.g. "@domain.com"). If no `@` is present, returns the full string
 * (treating it as a bare username).
 */
export function extractEmailPrefix(email: string): string | null {
  const atIndex = email.indexOf("@");
  const prefix = atIndex === -1 ? email : email.substring(0, atIndex);
  return prefix.length > 0 ? prefix : null;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Resolve the current user with provenance — which signal matched and how.
 *
 * This is the canonical identity resolution function. `resolveUser` is a
 * thin wrapper that returns only the user string.
 */
export function resolveUserWithProvenance(ctx: DxContext): UserProvenance {
  // $DX_USER is checked with !== undefined, so DX_USER="" is treated as "set"
  // (returns empty string). In practice, shells don't set vars to empty strings
  // for "unset" — they unset them. If this causes issues, unset the var instead.
  if (ctx.env.DX_USER !== undefined) {
    return {
      user: ctx.env.DX_USER || null,
      signal: "DX_USER",
      match: "exact",
    };
  }

  // Scan signals in order: $GITHUB_USER, $USER, whoami, gitUserName
  // (gitUserEmail handled separately below — needs prefix extraction)
  const signals: Array<{ value: string | null | undefined; signal: UserSignal }> = [
    { value: ctx.env.GITHUB_USER, signal: "GITHUB_USER" },
    { value: ctx.env.USER, signal: "USER" },
    { value: ctx.whoami, signal: "whoami" },
    { value: ctx.gitUserName, signal: "gitUserName" },
  ];

  for (const { value, signal } of signals) {
    if (value == null) continue;
    const result = matchSignalToUser(value, ctx.config.users);
    if (result !== null) {
      return { user: result.user, signal, match: result.match };
    }
  }

  // gitUserEmail — extract prefix before @
  if (ctx.gitUserEmail != null) {
    const prefix = extractEmailPrefix(ctx.gitUserEmail);

    if (prefix !== null) {
      const result = matchSignalToUser(prefix, ctx.config.users);
      if (result !== null) {
        return { user: result.user, signal: "gitUserEmail", match: result.match };
      }
    }
  }

  return { user: null, signal: null, match: null };
}

/**
 * Resolve the current user from context signals.
 *
 * Thin wrapper around `resolveUserWithProvenance` — returns only the user key.
 */
export function resolveUser(ctx: DxContext): string | null {
  return resolveUserWithProvenance(ctx).user;
}

/**
 * Case-insensitive match of a signal against user keys and aliases.
 * Returns the user key and match type ("key" or "alias"), or null.
 */
export function matchSignalToUser(
  signal: string,
  users: Record<string, UserDefinition>,
): { user: string; match: "key" | "alias" } | null {
  const signalLower = signal.toLowerCase();

  for (const [userKey, userDef] of Object.entries(users)) {
    // Check user key
    if (userKey.toLowerCase() === signalLower) {
      return { user: userKey, match: "key" };
    }
    // Check aliases
    for (const alias of userDef.aliases) {
      if (alias.toLowerCase() === signalLower) {
        return { user: userKey, match: "alias" };
      }
    }
  }

  return null;
}

export function isEnabled(featureName: string, ctx: DxContext, user?: string | null): boolean {
  return getFeature(featureName, ctx, user).enabled;
}

export function getFeature(featureName: string, ctx: DxContext, user?: string | null): FeatureInfo {
  // Auto-resolve user if not provided
  const resolvedUser = user === undefined ? resolveUser(ctx) : user;

  const feature = ctx.config.features[featureName];
  const isUnknown = feature === undefined;

  if (isUnknown) {
    ctx.warn?.(`dx: unknown feature "${featureName}" — defaulting to enabled\n`);
  }

  // Start with default
  let enabled = isUnknown ? true : feature.default;
  let source: FeatureSource = "default";

  // User override layer
  if (resolvedUser !== null) {
    const userDef = ctx.config.users[resolvedUser];
    if (userDef !== undefined && featureName in userDef.overrides) {
      enabled = userDef.overrides[featureName];
      source = "user-override";
    }
  }

  // Local override layer (highest priority)
  if (ctx.local?.overrides && featureName in ctx.local.overrides) {
    enabled = ctx.local.overrides[featureName];
    source = "local-override";
  }

  return { enabled, source };
}

export function allFeatures(ctx: DxContext, user?: string | null): Record<string, FeatureInfo> {
  const result: Record<string, FeatureInfo> = {};
  for (const featureName of Object.keys(ctx.config.features)) {
    result[featureName] = getFeature(featureName, ctx, user);
  }
  return result;
}

