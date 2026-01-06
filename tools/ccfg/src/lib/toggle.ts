import { getDisabledServers, setDisabledServers } from "./config";
import { getMcpServerNames } from "./mcp";

export interface ServerStatus {
  name: string;
  enabled: boolean;
}

async function validateServer(projectPath: string, serverName: string): Promise<void> {
  const available = await getMcpServerNames(projectPath);
  if (!available.includes(serverName)) {
    throw new Error(`Unknown MCP server: ${serverName}. Available: ${available.join(", ")}`);
  }
}

export async function enableServer(
  projectPath: string,
  serverName: string,
  configPath?: string
): Promise<void> {
  await validateServer(projectPath, serverName);
  const disabled = await getDisabledServers(projectPath, configPath);
  const updated = disabled.filter((s) => s !== serverName);
  await setDisabledServers(projectPath, updated, configPath);
}

export async function disableServer(
  projectPath: string,
  serverName: string,
  configPath?: string
): Promise<void> {
  await validateServer(projectPath, serverName);
  const disabled = await getDisabledServers(projectPath, configPath);
  if (!disabled.includes(serverName)) {
    disabled.push(serverName);
  }
  await setDisabledServers(projectPath, disabled, configPath);
}

export async function enableAll(projectPath: string, configPath?: string): Promise<void> {
  await setDisabledServers(projectPath, [], configPath);
}

export async function disableAll(projectPath: string, configPath?: string): Promise<void> {
  const available = await getMcpServerNames(projectPath);
  await setDisabledServers(projectPath, available, configPath);
}

export async function getServerStatuses(
  projectPath: string,
  configPath?: string
): Promise<ServerStatus[]> {
  const available = await getMcpServerNames(projectPath);
  const disabled = await getDisabledServers(projectPath, configPath);

  return available.map((name) => ({
    name,
    enabled: !disabled.includes(name),
  }));
}
