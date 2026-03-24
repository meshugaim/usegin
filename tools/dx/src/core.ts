/**
 * dx core module — pure functions for developer experience config.
 *
 * Stub file: exports exist for type-checking but are not implemented.
 * Implementation will be driven by the tests in core.test.ts.
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
}

export type FeatureSource = "default" | "user-override" | "local-override";

export interface FeatureInfo {
  enabled: boolean;
  source: FeatureSource;
}

// ---------------------------------------------------------------------------
// Functions (stubs — not implemented)
// ---------------------------------------------------------------------------

export function loadConfig(_ctx: DxContext): DxConfig & { local: DxLocalConfig | null } {
  throw new Error("Not implemented");
}

export function resolveUser(_ctx: DxContext): string | null {
  throw new Error("Not implemented");
}

export function isEnabled(_featureName: string, _ctx: DxContext, _user?: string | null): boolean {
  throw new Error("Not implemented");
}

export function getFeature(_featureName: string, _ctx: DxContext, _user?: string | null): FeatureInfo {
  throw new Error("Not implemented");
}

export function allFeatures(_ctx: DxContext, _user?: string | null): Record<string, FeatureInfo> {
  throw new Error("Not implemented");
}

export function reload(): void {
  throw new Error("Not implemented");
}
