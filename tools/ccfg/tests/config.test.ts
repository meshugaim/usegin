import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readClaudeConfig, writeClaudeConfig, getDisabledServers, setDisabledServers } from "../src/lib/config";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("claude config read/write", () => {
  let testDir: string;
  let testConfigPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    testConfigPath = join(testDir, ".claude.json");
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("reads existing config", async () => {
    const config = {
      projects: {
        "/test/project": {
          disabledMcpServers: ["server1", "server2"]
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    const result = await readClaudeConfig(testConfigPath);
    expect(result).toEqual(config);
  });

  it("returns empty object for missing config", async () => {
    const result = await readClaudeConfig(join(testDir, "nonexistent.json"));
    expect(result).toEqual({});
  });

  it("writes config to file", async () => {
    const config = {
      projects: {
        "/test/project": {
          disabledMcpServers: ["server1"]
        }
      }
    };
    await writeClaudeConfig(testConfigPath, config);

    const content = await Bun.file(testConfigPath).text();
    expect(JSON.parse(content)).toEqual(config);
  });

  it("preserves other config fields when writing", async () => {
    const initial = {
      userID: "test-user",
      projects: {
        "/test/project": {
          disabledMcpServers: ["server1"],
          otherField: "preserved"
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(initial));

    const config = await readClaudeConfig(testConfigPath);
    config.projects!["/test/project"].disabledMcpServers = ["server2"];
    await writeClaudeConfig(testConfigPath, config);

    const result = await readClaudeConfig(testConfigPath);
    expect(result.userID).toBe("test-user");
    expect(result.projects!["/test/project"].otherField).toBe("preserved");
    expect(result.projects!["/test/project"].disabledMcpServers).toEqual(["server2"]);
  });
});

describe("getDisabledServers", () => {
  let testDir: string;
  let testConfigPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    testConfigPath = join(testDir, ".claude.json");
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("returns empty array when no project config exists", async () => {
    await writeFile(testConfigPath, JSON.stringify({}));
    const result = await getDisabledServers("/test/project", testConfigPath);
    expect(result).toEqual([]);
  });

  it("returns empty array when disabledMcpServers is not set", async () => {
    const config = {
      projects: {
        "/test/project": {}
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));
    const result = await getDisabledServers("/test/project", testConfigPath);
    expect(result).toEqual([]);
  });

  it("returns disabled servers list", async () => {
    const config = {
      projects: {
        "/test/project": {
          disabledMcpServers: ["server1", "server2"]
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));
    const result = await getDisabledServers("/test/project", testConfigPath);
    expect(result).toEqual(["server1", "server2"]);
  });
});

describe("setDisabledServers", () => {
  let testDir: string;
  let testConfigPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    testConfigPath = join(testDir, ".claude.json");
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("creates project config if it doesn't exist", async () => {
    await writeFile(testConfigPath, JSON.stringify({}));
    await setDisabledServers("/test/project", ["server1"], testConfigPath);

    const config = await readClaudeConfig(testConfigPath);
    expect(config.projects!["/test/project"].disabledMcpServers).toEqual(["server1"]);
  });

  it("updates existing disabled servers", async () => {
    const config = {
      projects: {
        "/test/project": {
          disabledMcpServers: ["server1"]
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));
    await setDisabledServers("/test/project", ["server2", "server3"], testConfigPath);

    const result = await readClaudeConfig(testConfigPath);
    expect(result.projects!["/test/project"].disabledMcpServers).toEqual(["server2", "server3"]);
  });

  it("preserves other project fields", async () => {
    const config = {
      projects: {
        "/test/project": {
          disabledMcpServers: ["server1"],
          otherField: "value"
        }
      }
    };
    await writeFile(testConfigPath, JSON.stringify(config));
    await setDisabledServers("/test/project", ["server2"], testConfigPath);

    const result = await readClaudeConfig(testConfigPath);
    expect((result.projects!["/test/project"] as any).otherField).toBe("value");
  });
});
