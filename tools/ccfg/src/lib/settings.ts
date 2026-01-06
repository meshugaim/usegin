import { join } from "path";
import { homedir } from "os";
import { mkdir } from "fs/promises";

export interface ProjectSettings {
  autoCompactEnabled?: boolean;
  [key: string]: unknown;
}

export interface UserSettings {
  autoCompactEnabled?: boolean;
  [key: string]: unknown;
}

export function getSettingsPath(projectPath: string): string {
  return join(projectPath, ".claude", "settings.json");
}

export function getUserSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
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

export async function readUserSettings(
  settingsPath: string = getUserSettingsPath()
): Promise<UserSettings> {
  try {
    const file = Bun.file(settingsPath);
    if (!(await file.exists())) {
      return {};
    }
    return await file.json();
  } catch {
    return {};
  }
}

export async function writeUserSettings(
  settings: UserSettings,
  settingsPath: string = getUserSettingsPath()
): Promise<void> {
  const claudeDir = join(settingsPath, "..");

  // Ensure parent directory exists
  await mkdir(claudeDir, { recursive: true });

  await Bun.write(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}

export async function getAutoCompactEnabled(
  settingsPath: string = getUserSettingsPath()
): Promise<boolean | undefined> {
  const settings = await readUserSettings(settingsPath);
  return settings.autoCompactEnabled;
}

export async function setAutoCompactEnabled(
  enabled: boolean,
  settingsPath: string = getUserSettingsPath()
): Promise<void> {
  const settings = await readUserSettings(settingsPath);
  settings.autoCompactEnabled = enabled;
  await writeUserSettings(settings, settingsPath);
}
