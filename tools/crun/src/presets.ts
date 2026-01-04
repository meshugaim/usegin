/**
 * Workflow presets for crun --remind flag
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
  presetsDir: string;
}

/**
 * Get default presets directory
 */
export function getDefaultPresetsDir(): string {
  return join(homedir(), ".claude", "workflow-presets");
}

/**
 * Create default dependencies
 */
export function createDefaultPresetDeps(): PresetDeps {
  return {
    presetsDir: getDefaultPresetsDir(),
  };
}

/**
 * Load a single preset by name
 */
export async function loadPreset(
  name: string,
  deps: PresetDeps
): Promise<Preset | null> {
  const path = join(deps.presetsDir, `${name}.json`);
  try {
    const content = await Bun.file(path).json();
    return content as Preset;
  } catch {
    return null;
  }
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
 * List all available preset names
 */
export async function listPresets(deps: PresetDeps): Promise<string[]> {
  try {
    const files = await readdir(deps.presetsDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}
