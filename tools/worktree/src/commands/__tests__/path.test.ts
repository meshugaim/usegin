import { describe, expect, it } from "bun:test";
import { runPath, type PathDeps, resolveWorktreePath } from "../path";
import { WORKTREES_DIR } from "../list";

describe("path command", () => {
  describe("resolveWorktreePath", () => {
    it("returns absolute path for worktree name", () => {
      const result = resolveWorktreePath("eng-975", "/workspaces/test-mvp");
      expect(result).toBe("/workspaces/test-mvp/.worktrees/eng-975");
    });

    it("handles uppercase names", () => {
      const result = resolveWorktreePath("ENG-123", "/workspaces/test-mvp");
      expect(result).toBe("/workspaces/test-mvp/.worktrees/ENG-123");
    });

    it("uses WORKTREES_DIR constant", () => {
      const result = resolveWorktreePath("test", "/root");
      expect(result).toContain(WORKTREES_DIR);
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

    it("outputs the absolute path when worktree exists", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        exists: async () => true,
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runPath("eng-975", deps);

      expect(outputMessage).toBe("/workspaces/test-mvp/.worktrees/eng-975");
    });

    it("errors when worktree does not exist", async () => {
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

      expect(outputMessage).toBe("/different/path/.worktrees/test");
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

      await runPath("my-worktree", deps);

      expect(checkedPath).toBe("/root/.worktrees/my-worktree");
    });
  });
});
