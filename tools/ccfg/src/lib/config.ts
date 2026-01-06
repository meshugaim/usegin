import { homedir } from "os";
import { join } from "path";

export interface ProjectConfig {
  disabledMcpServers?: string[];
  [key: string]: unknown;
}

export interface ClaudeConfig {
  projects?: Record<string, ProjectConfig>;
  [key: string]: unknown;
}

export function getDefaultConfigPath(): string {
  return join(homedir(), ".claude.json");
}

export async function readClaudeConfig(configPath: string = getDefaultConfigPath()): Promise<ClaudeConfig> {
  try {
    const file = Bun.file(configPath);
    if (!(await file.exists())) {
      return {};
    }
    return await file.json();
  } catch {
    return {};
  }
}

export async function writeClaudeConfig(configPath: string, config: ClaudeConfig): Promise<void> {
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}

export async function getDisabledServers(
  projectPath: string,
  configPath: string = getDefaultConfigPath()
): Promise<string[]> {
  const config = await readClaudeConfig(configPath);
  return config.projects?.[projectPath]?.disabledMcpServers ?? [];
}

export async function setDisabledServers(
  projectPath: string,
  servers: string[],
  configPath: string = getDefaultConfigPath()
): Promise<void> {
  const config = await readClaudeConfig(configPath);

  if (!config.projects) {
    config.projects = {};
  }

  if (!config.projects[projectPath]) {
    config.projects[projectPath] = {};
  }

  config.projects[projectPath].disabledMcpServers = servers;

  await writeClaudeConfig(configPath, config);
}
