import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readMcpConfig, getMcpServerNames } from "../src/lib/mcp";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("readMcpConfig", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-mcp-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("reads .mcp.json file", async () => {
    const mcpConfig = {
      mcpServers: {
        "server1": { type: "stdio", command: "cmd1" },
        "server2": { type: "stdio", command: "cmd2" }
      }
    };
    await writeFile(join(testDir, ".mcp.json"), JSON.stringify(mcpConfig));

    const result = await readMcpConfig(testDir);
    expect(result).toEqual(mcpConfig);
  });

  it("returns null for missing .mcp.json", async () => {
    const result = await readMcpConfig(testDir);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", async () => {
    await writeFile(join(testDir, ".mcp.json"), "not valid json");
    const result = await readMcpConfig(testDir);
    expect(result).toBeNull();
  });
});

describe("getMcpServerNames", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-mcp-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("extracts server names from mcpServers", async () => {
    const mcpConfig = {
      mcpServers: {
        "alpha": { type: "stdio", command: "cmd1" },
        "beta": { type: "stdio", command: "cmd2" },
        "gamma": { type: "stdio", command: "cmd3" }
      }
    };
    await writeFile(join(testDir, ".mcp.json"), JSON.stringify(mcpConfig));

    const result = await getMcpServerNames(testDir);
    expect(result).toEqual(["alpha", "beta", "gamma"]);
  });

  it("returns empty array when no .mcp.json", async () => {
    const result = await getMcpServerNames(testDir);
    expect(result).toEqual([]);
  });

  it("returns empty array when mcpServers is empty", async () => {
    await writeFile(join(testDir, ".mcp.json"), JSON.stringify({ mcpServers: {} }));
    const result = await getMcpServerNames(testDir);
    expect(result).toEqual([]);
  });

  it("returns sorted server names", async () => {
    const mcpConfig = {
      mcpServers: {
        "zebra": { type: "stdio", command: "cmd1" },
        "apple": { type: "stdio", command: "cmd2" },
        "mango": { type: "stdio", command: "cmd3" }
      }
    };
    await writeFile(join(testDir, ".mcp.json"), JSON.stringify(mcpConfig));

    const result = await getMcpServerNames(testDir);
    expect(result).toEqual(["apple", "mango", "zebra"]);
  });
});
