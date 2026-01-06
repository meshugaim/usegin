import { join } from "path";

export interface McpServerConfig {
  type: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export async function readMcpConfig(projectPath: string): Promise<McpConfig | null> {
  try {
    const mcpPath = join(projectPath, ".mcp.json");
    const file = Bun.file(mcpPath);
    if (!(await file.exists())) {
      return null;
    }
    return await file.json();
  } catch {
    return null;
  }
}

export async function getMcpServerNames(projectPath: string): Promise<string[]> {
  const config = await readMcpConfig(projectPath);
  if (!config?.mcpServers) {
    return [];
  }
  return Object.keys(config.mcpServers).sort();
}
