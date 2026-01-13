import { describe, expect, it } from "bun:test";
import {
  runPath,
  type PathDeps,
  resolveClonePath,
  createPathCommand,
  getDefaultDeps,
} from "../path";
import { CLONES_DIR } from "../list";

describe("path command", () => {
  describe("resolveClonePath", () => {
    it("returns absolute path for clone name", () => {
      const result = resolveClonePath("eng-975", "/workspaces/test-mvp");
      expect(result).toBe("/workspaces/test-mvp/.clones/eng-975");
    });

    it("handles uppercase names", () => {
      const result = resolveClonePath("ENG-123", "/workspaces/test-mvp");
      expect(result).toBe("/workspaces/test-mvp/.clones/ENG-123");
    });

    it("uses CLONES_DIR constant", () => {
      const result = resolveClonePath("test", "/root");
      expect(result).toContain(CLONES_DIR);
    });
  });

  describe("createPathCommand", () => {
    it("creates a Command instance", () => {
      const cmd = createPathCommand();
      expect(cmd).toBeDefined();
      expect(cmd.name()).toBe("path");
    });

    it("has correct description", () => {
      const cmd = createPathCommand();
      expect(cmd.description()).toBe(
        "Get the absolute path to a clone directory"
      );
    });

    it("requires name argument", () => {
      const cmd = createPathCommand();
      const args = cmd.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe("name");
      expect(args[0].required).toBe(true);
    });
  });

  describe("getDefaultDeps", () => {
    it("returns object with required methods", () => {
      const deps = getDefaultDeps();

      expect(typeof deps.getCwd).toBe("function");
      expect(typeof deps.exists).toBe("function");
      expect(typeof deps.output).toBe("function");
      expect(typeof deps.exitWithError).toBe("function");
    });
  });

  describe("runPath", () => {
    function createMockDeps(overrides: Partial<PathDeps> = {}): PathDeps {
      return {
        getCwd: () => "/workspaces/test-mvp",
        exists: async () => true,
        output: () => {},
        exitWithError: () => {
          throw new Error("exit");
        },
        ...overrides,
      };
    }

    it("outputs the absolute path when clone exists", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        exists: async () => true,
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runPath("eng-975", deps);

      expect(outputMessage).toBe("/workspaces/test-mvp/.clones/eng-975");
    });

    it("errors when clone does not exist", async () => {
      let errorMessage = "";
      const deps = createMockDeps({
        exists: async () => false,
        exitWithError: (msg) => {
          errorMessage = msg;
          throw new Error("exit");
        },
      });

      await expect(runPath("nonexistent", deps)).rejects.toThrow("exit");
      expect(errorMessage).toContain("nonexistent");
      expect(errorMessage).toContain("does not exist");
    });

    it("uses cwd from deps", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        getCwd: () => "/different/path",
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runPath("test", deps);

      expect(outputMessage).toBe("/different/path/.clones/test");
    });

    it("checks existence at resolved path", async () => {
      let checkedPath = "";
      const deps = createMockDeps({
        getCwd: () => "/root",
        exists: async (path) => {
          checkedPath = path;
          return true;
        },
        output: () => {},
      });

      await runPath("my-clone", deps);

      expect(checkedPath).toBe("/root/.clones/my-clone");
    });
  });
});
