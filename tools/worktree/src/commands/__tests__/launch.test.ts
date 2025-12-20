import { describe, expect, it } from "bun:test";
import {
  buildWorktreePath,
  worktreeExists,
  getDefaultDeps,
  runLaunch,
  createLaunchCommand,
  type LaunchOptions,
  type LaunchDeps,
} from "../launch";

describe("launch command", () => {
  describe("getDefaultDeps", () => {
    it("returns object with required methods", () => {
      const deps = getDefaultDeps();

      expect(typeof deps.getWorktreeList).toBe("function");
      expect(typeof deps.spawn).toBe("function");
      expect(typeof deps.errorOutput).toBe("function");
      expect(typeof deps.exit).toBe("function");
    });
  });

  describe("buildWorktreePath", () => {
    it("builds path correctly", () => {
      const path = buildWorktreePath("ENG-123");
      expect(path).toBe(".worktrees/ENG-123");
    });

    it("handles numeric names", () => {
      const path = buildWorktreePath("492");
      expect(path).toBe(".worktrees/492");
    });
  });

  describe("worktreeExists", () => {
    const samplePorcelainOutput = `worktree /path/to/repo
HEAD abc123
branch refs/heads/main

worktree /path/to/repo/.worktrees/ENG-123
HEAD def456
branch refs/heads/wt/ENG-123`;

    it("returns true when worktree path exists in output", () => {
      expect(worktreeExists(samplePorcelainOutput, ".worktrees/ENG-123")).toBe(
        true
      );
    });

    it("returns false when worktree path does not exist", () => {
      expect(worktreeExists(samplePorcelainOutput, ".worktrees/ENG-999")).toBe(
        false
      );
    });

    it("returns false for empty output", () => {
      expect(worktreeExists("", ".worktrees/ENG-123")).toBe(false);
    });
  });

  describe("createLaunchCommand", () => {
    it("creates a Command instance", () => {
      const cmd = createLaunchCommand();
      expect(cmd).toBeDefined();
      expect(cmd.name()).toBe("launch");
    });

    it("has correct description", () => {
      const cmd = createLaunchCommand();
      expect(cmd.description()).toBe("Launch Claude in a worktree with MCP control");
    });

    it("requires name argument", () => {
      const cmd = createLaunchCommand();
      const args = cmd.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe("name");
      expect(args[0].required).toBe(true);
    });

    it("has --no-mcp option", () => {
      const cmd = createLaunchCommand();
      const option = cmd.options.find(o => o.long === "--no-mcp");
      expect(option).toBeDefined();
      expect(option?.description).toContain("Disable all MCP servers");
    });

    it("has --mcp-config option", () => {
      const cmd = createLaunchCommand();
      const option = cmd.options.find(o => o.long === "--mcp-config");
      expect(option).toBeDefined();
      expect(option?.description).toContain("Path to custom MCP config");
    });
  });

  describe("runLaunch", () => {
    function createMockDeps(overrides: Partial<LaunchDeps> = {}): LaunchDeps {
      return {
        getWorktreeList: async () => "",
        spawn: async () => {},
        errorOutput: () => {},
        exit: ((code: number) => {
          throw new Error(`Exit called with code ${code}`);
        }) as (code: number) => never,
        ...overrides,
      };
    }

    it("exits with error when worktree does not exist", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo
HEAD abc123
branch refs/heads/main`,
        errorOutput: (msg) => { errorMessage = msg; },
      });

      await expect(runLaunch("ENG-999", {}, deps)).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("does not exist");
    });

    it("launches Claude without MCP when --no-mcp is set", async () => {
      let spawnedCommand = "";
      let spawnedArgs: string[] = [];
      let spawnedCwd = "";

      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo/.worktrees/ENG-123
HEAD def456
branch refs/heads/wt/ENG-123`,
        spawn: async (command, args, cwd) => {
          spawnedCommand = command;
          spawnedArgs = args;
          spawnedCwd = cwd;
        },
      });

      await runLaunch("ENG-123", { noMcp: true }, deps);

      expect(spawnedCommand).toBe("claude");
      expect(spawnedArgs).toEqual(["--strict-mcp-config"]);
      expect(spawnedCwd).toBe(".worktrees/ENG-123");
    });

    it("launches Claude with custom MCP config when --mcp-config is set", async () => {
      let spawnedCommand = "";
      let spawnedArgs: string[] = [];
      let spawnedCwd = "";

      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo/.worktrees/ENG-123
HEAD def456
branch refs/heads/wt/ENG-123`,
        spawn: async (command, args, cwd) => {
          spawnedCommand = command;
          spawnedArgs = args;
          spawnedCwd = cwd;
        },
      });

      await runLaunch("ENG-123", { mcpConfig: "/path/to/custom.json" }, deps);

      expect(spawnedCommand).toBe("claude");
      expect(spawnedArgs).toEqual(["--strict-mcp-config", "--mcp-config", "/path/to/custom.json"]);
      expect(spawnedCwd).toBe(".worktrees/ENG-123");
    });

    it("launches Claude with default MCP config when no options are set", async () => {
      let spawnedCommand = "";
      let spawnedArgs: string[] = [];
      let spawnedCwd = "";

      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo/.worktrees/ENG-123
HEAD def456
branch refs/heads/wt/ENG-123`,
        spawn: async (command, args, cwd) => {
          spawnedCommand = command;
          spawnedArgs = args;
          spawnedCwd = cwd;
        },
      });

      await runLaunch("ENG-123", {}, deps);

      expect(spawnedCommand).toBe("claude");
      expect(spawnedArgs).toEqual([]);
      expect(spawnedCwd).toBe(".worktrees/ENG-123");
    });

    it("handles spawn failure", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo/.worktrees/ENG-123
HEAD def456
branch refs/heads/wt/ENG-123`,
        spawn: async () => {
          throw new Error("Spawn failed");
        },
        errorOutput: (msg) => { errorMessage = msg; },
      });

      await expect(runLaunch("ENG-123", {}, deps)).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("Error launching Claude");
    });

    it("handles numeric worktree names", async () => {
      let spawnedCwd = "";

      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo/.worktrees/492
HEAD def456
branch refs/heads/wt/492`,
        spawn: async (command, args, cwd) => {
          spawnedCwd = cwd;
        },
      });

      await runLaunch("492", {}, deps);

      expect(spawnedCwd).toBe(".worktrees/492");
    });
  });
});
