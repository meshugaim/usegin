/**
 * Workflow presets for crun --remind flag
 *
 * Presets can be loaded from two sources:
 * 1. Repo presets: .claude/workflow-presets/ (relative to cwd) - takes precedence
 * 2. User presets: ~/.claude/workflow-presets/ - fallback
 */

import { join } from "path";
import { homedir } from "os";
import { readdir } from "fs/promises";

export interface Preset {
  name: string;
  reminder?: string;
  includes?: string[];
}

export interface PresetDeps {
  /** User presets directory (~/.claude/workflow-presets/) */
  userPresetsDir: string;
  /** Repo presets directory (.claude/workflow-presets/) - optional */
  repoPresetsDir?: string;
}

/**
 * Get default user presets directory (~/.claude/workflow-presets/)
 */
export function getDefaultPresetsDir(): string {
  return join(homedir(), ".claude", "workflow-presets");
}

/**
 * Get repo presets directory (.claude/workflow-presets/ relative to cwd)
 */
export function getRepoPresetsDir(): string {
  return join(process.cwd(), ".claude", "workflow-presets");
}

/**
 * Create default dependencies with both repo and user dirs
 */
export function createDefaultPresetDeps(): PresetDeps {
  return {
    userPresetsDir: getDefaultPresetsDir(),
    repoPresetsDir: getRepoPresetsDir(),
  };
}

/**
 * Try to load a preset from a specific directory
 */
async function loadPresetFromDir(
  name: string,
  dir: string
): Promise<Preset | null> {
  const path = join(dir, `${name}.json`);
  try {
    const content = await Bun.file(path).json();
    return content as Preset;
  } catch {
    return null;
  }
}

/**
 * Load a single preset by name
 * Checks repo presets first (if available), then falls back to user presets
 */
export async function loadPreset(
  name: string,
  deps: PresetDeps
): Promise<Preset | null> {
  // Try repo presets first (takes precedence)
  if (deps.repoPresetsDir) {
    const repoPreset = await loadPresetFromDir(name, deps.repoPresetsDir);
    if (repoPreset) return repoPreset;
  }

  // Fall back to user presets
  return loadPresetFromDir(name, deps.userPresetsDir);
}

/**
 * Load multiple presets by name, expanding combined presets
 */
export async function loadPresets(
  names: string[],
  deps: PresetDeps
): Promise<Preset[]> {
  const seen = new Set<string>();
  const result: Preset[] = [];

  async function expandPreset(name: string): Promise<void> {
    if (seen.has(name)) return;

    const preset = await loadPreset(name, deps);
    if (!preset) return;

    // If it's a combined preset, expand its includes
    if (preset.includes && preset.includes.length > 0) {
      for (const includedName of preset.includes) {
        await expandPreset(includedName);
      }
    } else {
      // It's a leaf preset with a reminder
      seen.add(name);
      result.push(preset);
    }
  }

  for (const name of names) {
    await expandPreset(name);
  }

  return result;
}

/**
 * List preset names from a specific directory
 */
async function listPresetsFromDir(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

/**
 * List all available preset names from both repo and user dirs
 * Returns unique names (deduped)
 */
export async function listPresets(deps: PresetDeps): Promise<string[]> {
  const userPresets = await listPresetsFromDir(deps.userPresetsDir);

  if (!deps.repoPresetsDir) {
    return userPresets;
  }

  const repoPresets = await listPresetsFromDir(deps.repoPresetsDir);

  // Merge and deduplicate
  const allPresets = new Set([...repoPresets, ...userPresets]);
  return Array.from(allPresets);
}
