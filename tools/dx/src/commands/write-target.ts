/**
 * Shared write-target resolution for dx write commands.
 *
 * Centralizes the --save fallback logic that set, enable/disable, and
 * reset all share: resolve user, warn if --save fails, fall back to local.
 *
 * Part of: ENG-4687
 */

import { dirname, resolve } from "path";
import type { DxContext } from "../core";
import { resolveUser } from "../core";

/** Result of resolving where a write command should persist its override. */
export type WriteTarget =
  | {
      /** Override will be saved to config.json (user override). */
      saved: true;
      /** Resolved user key (guaranteed non-null when saved). */
      user: string;
      /** Absolute path to config.json. */
      configPath: string;
      /** Absolute path to the local config file (always resolved). */
      localPath: string;
    }
  | {
      /** Override will be written to local config only. */
      saved: false;
      /** Resolved user key, or null if unknown. */
      user: string | null;
      /** Absolute path to the local config file. */
      localPath: string;
    };

/** Options for customizing the fallback message when --save cannot proceed. */
export interface ResolveWriteTargetOptions {
  /**
   * Message printed when --save falls back to local.
   * Defaults to "dx: writing to local config instead."
   */
  fallbackMessage?: string;
}

/**
 * Resolve the write target for a dx write command.
 *
 * When `save` is true and a user can be identified, returns `saved: true`
 * so the caller writes a user override to config.json. Otherwise falls
 * back to local (with warnings on stderr when --save was requested but
 * the user couldn't be identified).
 *
 * Throws if no local config path can be determined.
 */
export function resolveWriteTarget(
  ctx: DxContext,
  save: boolean,
  opts?: ResolveWriteTargetOptions,
): WriteTarget {
  const user = resolveUser(ctx);

  if (save) {
    if (user) {
      if (!ctx.configPath) {
        throw new Error("dx: configPath not set in context -- cannot --save");
      }

      const localPath = resolveLocalPath(ctx);
      return { saved: true, user, configPath: ctx.configPath, localPath };
    }

    // --save requires a known user; fall back to local with a warning
    process.stderr.write(
      "dx: cannot --save: user not identified. Run `dx identify` first.\n",
    );
    process.stderr.write(
      (opts?.fallbackMessage ?? "dx: writing to local config instead.") + "\n",
    );
  }

  const localPath = resolveLocalPath(ctx);
  return { saved: false, user, localPath };
}

/**
 * Resolve the local config path from context.
 *
 * Falls back to `config.local.json` beside `config.json` when
 * `ctx.localPath` is not set.
 *
 * Throws if neither localPath nor configPath is available.
 */
function resolveLocalPath(ctx: DxContext): string {
  const localPath =
    ctx.localPath ??
    (ctx.configPath
      ? resolve(dirname(ctx.configPath), "config.local.json")
      : null);
  if (!localPath) throw new Error("dx: cannot determine local config path");
  return localPath;
}

/**
 * Warn on stderr if a feature is not registered in the config.
 *
 * Used by set, enable/disable, and reset to give a heads-up about
 * unknown features (the operation still proceeds).
 */
export function warnUnregisteredFeature(
  feature: string,
  ctx: DxContext,
): void {
  if (ctx.config.features && !(feature in ctx.config.features)) {
    process.stderr.write(
      `dx: warning: "${feature}" is not a registered feature\n`,
    );
  }
}
