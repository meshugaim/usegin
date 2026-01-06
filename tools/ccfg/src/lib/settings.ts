import { join } from "path";
import { mkdir } from "fs/promises";

export interface ProjectSettings {
  autoCompactEnabled?: boolean;
  [key: string]: unknown;
}

export function getSettingsPath(projectPath: string): string {
  return join(projectPath, ".claude", "settings.json");
}

export async function readProjectSettings(projectPath: string): Promise<ProjectSettings> {
  try {
    const file = Bun.file(getSettingsPath(projectPath));
    if (!(await file.exists())) {
      return {};
    }
    return await file.json();
  } catch {
    return {};
  }
}

export async function writeProjectSettings(
  projectPath: string,
  settings: ProjectSettings
): Promise<void> {
  const settingsPath = getSettingsPath(projectPath);
  const claudeDir = join(projectPath, ".claude");

  // Ensure .claude directory exists
  await mkdir(claudeDir, { recursive: true });

  await Bun.write(settingsPath, JSON.stringify(settings, null, 2));
}

export async function getAutoCompactEnabled(projectPath: string): Promise<boolean | undefined> {
  const settings = await readProjectSettings(projectPath);
  return settings.autoCompactEnabled;
}

export async function setAutoCompactEnabled(
  projectPath: string,
  enabled: boolean
): Promise<void> {
  const settings = await readProjectSettings(projectPath);
  settings.autoCompactEnabled = enabled;
  await writeProjectSettings(projectPath, settings);
}
