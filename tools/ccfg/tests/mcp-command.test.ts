import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("ccfg mcp command integration", () => {
  let testDir: string;
  let projectPath: string;
  let configPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-cmd-test-${Date.now()}`);
    projectPath = join(testDir, "project");
    configPath = join(testDir, ".claude.json");
    await mkdir(projectPath, { recursive: true });

    // Setup .mcp.json
    const mcpConfig = {
      mcpServers: {
        "alpha": { type: "stdio", command: "cmd1" },
        "beta": { type: "stdio", command: "cmd2" },
        "gamma": { type: "stdio", command: "cmd3" }
      }
    };
    await writeFile(join(projectPath, ".mcp.json"), JSON.stringify(mcpConfig));

    // Setup .claude.json
    const claudeConfig = {
      projects: {
        [projectPath]: {
          disabledMcpServers: ["beta"]
        }
      }
    };
    await writeFile(configPath, JSON.stringify(claudeConfig));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("lists servers with correct status", async () => {
    // Import and test the actual list functionality
    const { getServerStatuses } = await import("../src/lib/toggle");
    const statuses = await getServerStatuses(projectPath, configPath);

    expect(statuses).toEqual([
      { name: "alpha", enabled: true },
      { name: "beta", enabled: false },
      { name: "gamma", enabled: true }
    ]);
  });

  it("enable command removes from disabled list", async () => {
    const { enableServer } = await import("../src/lib/toggle");
    const { getDisabledServers } = await import("../src/lib/config");

    await enableServer(projectPath, "beta", configPath);

    const disabled = await getDisabledServers(projectPath, configPath);
    expect(disabled).not.toContain("beta");
  });

  it("disable command adds to disabled list", async () => {
    const { disableServer } = await import("../src/lib/toggle");
    const { getDisabledServers } = await import("../src/lib/config");

    await disableServer(projectPath, "alpha", configPath);

    const disabled = await getDisabledServers(projectPath, configPath);
    expect(disabled).toContain("alpha");
  });

  it("enable --all clears disabled list", async () => {
    const { enableAll } = await import("../src/lib/toggle");
    const { getDisabledServers } = await import("../src/lib/config");

    await enableAll(projectPath, configPath);

    const disabled = await getDisabledServers(projectPath, configPath);
    expect(disabled).toEqual([]);
  });

  it("disable --all adds all servers to disabled list", async () => {
    const { disableAll } = await import("../src/lib/toggle");
    const { getDisabledServers } = await import("../src/lib/config");

    await disableAll(projectPath, configPath);

    const disabled = await getDisabledServers(projectPath, configPath);
    expect(disabled.sort()).toEqual(["alpha", "beta", "gamma"]);
  });
});
