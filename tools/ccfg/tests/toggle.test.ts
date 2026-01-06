import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { enableServer, disableServer, enableAll, disableAll, getServerStatuses } from "../src/lib/toggle";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("enableServer", () => {
  let testDir: string;
  let testConfigPath: string;
  let projectPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-toggle-test-${Date.now()}`);
    projectPath = join(testDir, "project");
    await mkdir(projectPath, { recursive: true });
    testConfigPath = join(testDir, ".claude.json");

    // Setup .mcp.json
    const mcpConfig = {
      mcpServers: {
        "server1": { type: "stdio", command: "cmd1" },
        "server2": { type: "stdio", command: "cmd2" },
        "server3": { type: "stdio", command: "cmd3" }
      }
    };
    await writeFile(join(projectPath, ".mcp.json"), JSON.stringify(mcpConfig));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("removes server from disabledMcpServers", async () => {
    const config = {
      projects: {
        [projectPath]: {
          disabledMcpServers: ["server1", "server2", "server3"]
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    await enableServer(projectPath, "server2", testConfigPath);

    const file = Bun.file(testConfigPath);
    const result = await file.json();
    expect(result.projects[projectPath].disabledMcpServers).toEqual(["server1", "server3"]);
  });

  it("does nothing if server is already enabled", async () => {
    const config = {
      projects: {
        [projectPath]: {
          disabledMcpServers: ["server1"]
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    await enableServer(projectPath, "server2", testConfigPath);

    const file = Bun.file(testConfigPath);
    const result = await file.json();
    expect(result.projects[projectPath].disabledMcpServers).toEqual(["server1"]);
  });

  it("throws error for unknown server", async () => {
    const config = {
      projects: {
        [projectPath]: {
          disabledMcpServers: []
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    expect(enableServer(projectPath, "unknown-server", testConfigPath)).rejects.toThrow("Unknown MCP server");
  });
});

describe("disableServer", () => {
  let testDir: string;
  let testConfigPath: string;
  let projectPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-toggle-test-${Date.now()}`);
    projectPath = join(testDir, "project");
    await mkdir(projectPath, { recursive: true });
    testConfigPath = join(testDir, ".claude.json");

    const mcpConfig = {
      mcpServers: {
        "server1": { type: "stdio", command: "cmd1" },
        "server2": { type: "stdio", command: "cmd2" }
      }
    };
    await writeFile(join(projectPath, ".mcp.json"), JSON.stringify(mcpConfig));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("adds server to disabledMcpServers", async () => {
    const config = {
      projects: {
        [projectPath]: {
          disabledMcpServers: ["server1"]
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    await disableServer(projectPath, "server2", testConfigPath);

    const file = Bun.file(testConfigPath);
    const result = await file.json();
    expect(result.projects[projectPath].disabledMcpServers).toContain("server2");
  });

  it("does nothing if server is already disabled", async () => {
    const config = {
      projects: {
        [projectPath]: {
          disabledMcpServers: ["server1"]
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    await disableServer(projectPath, "server1", testConfigPath);

    const file = Bun.file(testConfigPath);
    const result = await file.json();
    expect(result.projects[projectPath].disabledMcpServers).toEqual(["server1"]);
  });

  it("throws error for unknown server", async () => {
    const config = {
      projects: {
        [projectPath]: {
          disabledMcpServers: []
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    expect(disableServer(projectPath, "unknown-server", testConfigPath)).rejects.toThrow("Unknown MCP server");
  });
});

describe("enableAll", () => {
  let testDir: string;
  let testConfigPath: string;
  let projectPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-toggle-test-${Date.now()}`);
    projectPath = join(testDir, "project");
    await mkdir(projectPath, { recursive: true });
    testConfigPath = join(testDir, ".claude.json");

    const mcpConfig = {
      mcpServers: {
        "server1": { type: "stdio", command: "cmd1" },
        "server2": { type: "stdio", command: "cmd2" }
      }
    };
    await writeFile(join(projectPath, ".mcp.json"), JSON.stringify(mcpConfig));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("clears disabledMcpServers", async () => {
    const config = {
      projects: {
        [projectPath]: {
          disabledMcpServers: ["server1", "server2"]
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    await enableAll(projectPath, testConfigPath);

    const file = Bun.file(testConfigPath);
    const result = await file.json();
    expect(result.projects[projectPath].disabledMcpServers).toEqual([]);
  });
});

describe("disableAll", () => {
  let testDir: string;
  let testConfigPath: string;
  let projectPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-toggle-test-${Date.now()}`);
    projectPath = join(testDir, "project");
    await mkdir(projectPath, { recursive: true });
    testConfigPath = join(testDir, ".claude.json");

    const mcpConfig = {
      mcpServers: {
        "server1": { type: "stdio", command: "cmd1" },
        "server2": { type: "stdio", command: "cmd2" }
      }
    };
    await writeFile(join(projectPath, ".mcp.json"), JSON.stringify(mcpConfig));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("adds all servers to disabledMcpServers", async () => {
    const config = {
      projects: {
        [projectPath]: {
          disabledMcpServers: []
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    await disableAll(projectPath, testConfigPath);

    const file = Bun.file(testConfigPath);
    const result = await file.json();
    expect(result.projects[projectPath].disabledMcpServers.sort()).toEqual(["server1", "server2"]);
  });
});

describe("getServerStatuses", () => {
  let testDir: string;
  let testConfigPath: string;
  let projectPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-toggle-test-${Date.now()}`);
    projectPath = join(testDir, "project");
    await mkdir(projectPath, { recursive: true });
    testConfigPath = join(testDir, ".claude.json");

    const mcpConfig = {
      mcpServers: {
        "alpha": { type: "stdio", command: "cmd1" },
        "beta": { type: "stdio", command: "cmd2" },
        "gamma": { type: "stdio", command: "cmd3" }
      }
    };
    await writeFile(join(projectPath, ".mcp.json"), JSON.stringify(mcpConfig));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("returns all servers with enabled/disabled status", async () => {
    const config = {
      projects: {
        [projectPath]: {
          disabledMcpServers: ["beta"]
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    const result = await getServerStatuses(projectPath, testConfigPath);

    expect(result).toEqual([
      { name: "alpha", enabled: true },
      { name: "beta", enabled: false },
      { name: "gamma", enabled: true }
    ]);
  });

  it("treats all servers as enabled when no disabled list", async () => {
    await writeFile(testConfigPath, JSON.stringify({}));

    const result = await getServerStatuses(projectPath, testConfigPath);

    expect(result).toEqual([
      { name: "alpha", enabled: true },
      { name: "beta", enabled: true },
      { name: "gamma", enabled: true }
    ]);
  });
});
