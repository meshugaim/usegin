#!/usr/bin/env bun
/**
 * dx SDK — stateful layer that reads config from disk and caches it.
 *
 * Usage:
 *   import dx from "../../dx/sdk";
 *   dx.isEnabled("ci-watcher")  // → boolean
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import {
  resolveUser as coreResolveUser,
  isEnabled as coreIsEnabled,
  getFeature as coreGetFeature,
  getValue as coreGetValue,
  allFeatures as coreAllFeatures,
  type DxConfig,
  type DxLocalConfig,
  type DxContext,
  type FeatureInfo,
  type FeatureValue,
} from "./src/core";

// Find repo root (walk up from this file to find .dx/)
function findRepoRoot(): string {
  let dir = __dirname;
  while (dir !== "/") {
    if (existsSync(resolve(dir, ".dx/config.json"))) {
      return dir;
    }
    dir = resolve(dir, "..");
  }
  throw new Error("dx: could not find .dx/config.json in any parent directory");
}

let cached: DxContext | null = null;

function execQuiet(cmd: string, args: string[]): string | null {
  const result = spawnSync(cmd, args, { encoding: "utf-8" });
  if (result.status !== 0 || !result.stdout) return null;
  return result.stdout.trim() || null;
}

function getContext(): DxContext {
  if (cached) return cached;

  const root = findRepoRoot();
  const configPath = resolve(root, ".dx/config.json");
  const localPath = resolve(root, ".dx/config.local.json");

  const config: DxConfig = JSON.parse(readFileSync(configPath, "utf-8"));

  let local: DxLocalConfig | null = null;
  try {
    local = JSON.parse(readFileSync(localPath, "utf-8"));
  } catch {
    // Local config is optional
  }

  // Collect git config signals
  const gitUserName = execQuiet("git", ["config", "user.name"]);
  const gitUserEmail = execQuiet("git", ["config", "user.email"]);
  const whoami = execQuiet("whoami", []);

  cached = {
    config,
    local,
    env: process.env,
    gitUserName,
    gitUserEmail,
    whoami,
    warn: (msg) => process.stderr.write(msg),
    configPath,
    localPath,
  };

  return cached;
}

function reload(): void {
  cached = null;
}

const dx = {
  isEnabled: (feature: string) => coreIsEnabled(feature, getContext()),
  resolveUser: () => coreResolveUser(getContext()),
  getFeature: (feature: string) => coreGetFeature(feature, getContext()),
  getValue: (feature: string) => coreGetValue(feature, getContext()),
  allFeatures: () => coreAllFeatures(getContext()),
  reload,
  /** Escape hatch: get the raw context for advanced usage */
  getContext,
};

export default dx;
export { reload };
export type { DxConfig, DxLocalConfig, DxContext, FeatureInfo, FeatureValue };
