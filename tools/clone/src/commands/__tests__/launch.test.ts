import { describe, expect, it } from "bun:test";
import {
  buildClonePath,
  cloneExists,
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

      expect(typeof deps.cloneExists).toBe("function");
      expect(typeof deps.spawn).toBe("function");
      expect(typeof deps.errorOutput).toBe("function");
      expect(typeof deps.exit).toBe("function");
    });
  });

  describe("buildClonePath", () => {
    it("builds path correctly", () => {
      const path = buildClonePath("ENG-123");
      expect(path).toBe(".clones/ENG-123");
    });

    it("handles numeric names", () => {
      const path = buildClonePath("492");
      expect(path).toBe(".clones/492");
    });

    it("handles feature branch names", () => {
      const path = buildClonePath("feature-auth");
      expect(path).toBe(".clones/feature-auth");
    });
  });

  describe("cloneExists", () => {
    it("returns true when clone path exists", async () => {
      const result = await cloneExists(async () => true, ".clones/ENG-123");
      expect(result).toBe(true);
    });

    it("returns false when clone path does not exist", async () => {
      const result = await cloneExists(async () => false, ".clones/ENG-123");
      expect(result).toBe(false);
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
      expect(cmd.description()).toBe("Launch Claude in a clone with MCP control");
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
      const option = cmd.options.find((o) => o.long === "--no-mcp");
      expect(option).toBeDefined();
      expect(option?.description).toContain("Disable all MCP servers");
    });

    it("has --mcp-config option", () => {
      const cmd = createLaunchCommand();
      const option = cmd.options.find((o) => o.long === "--mcp-config");
      expect(option).toBeDefined();
      expect(option?.description).toContain("Path to custom MCP config");
    });
  });

  describe("runLaunch", () => {
    function createMockDeps(overrides: Partial<LaunchDeps> = {}): LaunchDeps {
      return {
        cloneExists: async () => false,
        spawn: async () => {},
        errorOutput: () => {},
        exit: ((code: number) => {
          throw new Error(`Exit called with code ${code}`);
        }) as (code: number) => never,
        ...overrides,
      };
    }

    it("exits with error when clone does not exist", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        cloneExists: async () => false,
        errorOutput: (msg) => {
          errorMessage = msg;
        },
      });

      await expect(runLaunch("ENG-999", {}, deps)).rejects.toThrow(
        "Exit called with code 1"
      );
      expect(errorMessage).toContain("does not exist");
    });

    it("launches Claude without MCP when --no-mcp is set", async () => {
      let spawnedCommand = "";
      let spawnedArgs: string[] = [];
      let spawnedCwd = "";

      const deps = createMockDeps({
        cloneExists: async () => true,
        spawn: async (command, args, cwd) => {
          spawnedCommand = command;
          spawnedArgs = args;
          spawnedCwd = cwd;
        },
      });

      await runLaunch("ENG-123", { noMcp: true }, deps);

      expect(spawnedCommand).toBe("claude");
      expect(spawnedArgs).toEqual(["--strict-mcp-config"]);
      expect(spawnedCwd).toBe(".clones/ENG-123");
    });

    it("launches Claude with custom MCP config when --mcp-config is set", async () => {
      let spawnedCommand = "";
      let spawnedArgs: string[] = [];
      let spawnedCwd = "";

      const deps = createMockDeps({
        cloneExists: async () => true,
        spawn: async (command, args, cwd) => {
          spawnedCommand = command;
          spawnedArgs = args;
          spawnedCwd = cwd;
        },
      });

      await runLaunch("ENG-123", { mcpConfig: "/path/to/custom.json" }, deps);

      expect(spawnedCommand).toBe("claude");
      expect(spawnedArgs).toEqual([
        "--strict-mcp-config",
        "--mcp-config",
        "/path/to/custom.json",
      ]);
      expect(spawnedCwd).toBe(".clones/ENG-123");
    });

    it("launches Claude with default MCP config when no options are set", async () => {
      let spawnedCommand = "";
      let spawnedArgs: string[] = [];
      let spawnedCwd = "";

      const deps = createMockDeps({
        cloneExists: async () => true,
        spawn: async (command, args, cwd) => {
          spawnedCommand = command;
          spawnedArgs = args;
          spawnedCwd = cwd;
        },
      });

      await runLaunch("ENG-123", {}, deps);

      expect(spawnedCommand).toBe("claude");
      expect(spawnedArgs).toEqual([]);
      expect(spawnedCwd).toBe(".clones/ENG-123");
    });

    it("handles spawn failure", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        cloneExists: async () => true,
        spawn: async () => {
          throw new Error("Spawn failed");
        },
        errorOutput: (msg) => {
          errorMessage = msg;
        },
      });

      await expect(runLaunch("ENG-123", {}, deps)).rejects.toThrow(
        "Exit called with code 1"
      );
      expect(errorMessage).toContain("Error launching Claude");
    });

    it("handles numeric clone names", async () => {
      let spawnedCwd = "";

      const deps = createMockDeps({
        cloneExists: async () => true,
        spawn: async (command, args, cwd) => {
          spawnedCwd = cwd;
        },
      });

      await runLaunch("492", {}, deps);

      expect(spawnedCwd).toBe(".clones/492");
    });
  });
});
