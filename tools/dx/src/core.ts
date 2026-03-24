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
}

export type FeatureSource = "default" | "user-override" | "local-override";

export interface FeatureInfo {
  enabled: boolean;
  source: FeatureSource;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export function resolveUser(ctx: DxContext): string | null {
  // 1. $DX_USER — return directly if set (no validation)
  if (ctx.env.DX_USER !== undefined) {
    return ctx.env.DX_USER;
  }

  // 2. Scan signals in order: $GITHUB_USER, $USER, whoami, gitUserName
  //    (gitUserEmail handled separately below — needs prefix extraction)
  const signals: (string | null)[] = [
    ctx.env.GITHUB_USER ?? null,
    ctx.env.USER ?? null,
    ctx.whoami,
    ctx.gitUserName,
  ];

  // Try each non-email signal
  for (const signal of signals) {
    if (signal == null) continue;
    const match = matchSignalToUser(signal, ctx.config.users);
    if (match !== null) return match;
  }

  // gitUserEmail — extract prefix before @
  if (ctx.gitUserEmail != null) {
    const atIndex = ctx.gitUserEmail.indexOf("@");
    let prefix: string;
    if (atIndex === -1) {
      prefix = ctx.gitUserEmail;
    } else {
      prefix = ctx.gitUserEmail.substring(0, atIndex);
    }

    if (prefix.length > 0) {
      const match = matchSignalToUser(prefix, ctx.config.users);
      if (match !== null) return match;
    }
  }

  return null;
}

/**
 * Case-insensitive match of a signal against user keys and aliases.
 * Returns the user key if matched, null otherwise.
 */
function matchSignalToUser(
  signal: string,
  users: Record<string, UserDefinition>,
): string | null {
  const signalLower = signal.toLowerCase();

  for (const [userKey, userDef] of Object.entries(users)) {
    // Check user key
    if (userKey.toLowerCase() === signalLower) {
      return userKey;
    }
    // Check aliases
    for (const alias of userDef.aliases) {
      if (alias.toLowerCase() === signalLower) {
        return userKey;
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

