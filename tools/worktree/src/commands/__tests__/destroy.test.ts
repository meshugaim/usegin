import { describe, expect, it } from "bun:test";
import {
  buildWorktreePath,
  buildBranchName,
  worktreeExists,
  getDefaultConfig,
  getDefaultDeps,
  runDestroy,
  WORKTREES_DIR,
  BRANCH_PREFIX,
  createDestroyCommand,
  type DestroyConfig,
  type DestroyDeps,
} from "../destroy";

describe("destroy command", () => {
  describe("constants", () => {
    it("WORKTREES_DIR is .worktrees", () => {
      expect(WORKTREES_DIR).toBe(".worktrees");
    });

    it("BRANCH_PREFIX is wt/", () => {
      expect(BRANCH_PREFIX).toBe("wt/");
    });
  });

  describe("getDefaultConfig", () => {
    it("returns default config with correct values", () => {
      const config = getDefaultConfig();

      expect(config.worktreesDir).toBe(".worktrees");
      expect(config.branchPrefix).toBe("wt/");
    });
  });

  describe("getDefaultDeps", () => {
    it("returns object with required methods", () => {
      const deps = getDefaultDeps();

      expect(typeof deps.getWorktreeList).toBe("function");
      expect(typeof deps.removeWorktree).toBe("function");
      expect(typeof deps.deleteBranch).toBe("function");
      expect(typeof deps.output).toBe("function");
      expect(typeof deps.errorOutput).toBe("function");
      expect(typeof deps.warnOutput).toBe("function");
      expect(typeof deps.exit).toBe("function");
    });
  });

  describe("buildWorktreePath", () => {
    it("builds path with default config", () => {
      const path = buildWorktreePath("ENG-123");
      expect(path).toBe(".worktrees/ENG-123");
    });

    it("builds path with custom config", () => {
      const path = buildWorktreePath("ENG-123", {
        worktreesDir: "custom-dir",
        branchPrefix: "prefix/",
      });
      expect(path).toBe("custom-dir/ENG-123");
    });

    it("handles names with special characters", () => {
      const path = buildWorktreePath("feature-add-auth");
      expect(path).toBe(".worktrees/feature-add-auth");
    });

    it("handles numeric names", () => {
      const path = buildWorktreePath("12345");
      expect(path).toBe(".worktrees/12345");
    });
  });

  describe("buildBranchName", () => {
    it("builds branch name with default config", () => {
      const branch = buildBranchName("ENG-123");
      expect(branch).toBe("wt/ENG-123");
    });

    it("builds branch name with custom config", () => {
      const branch = buildBranchName("ENG-123", {
        worktreesDir: ".worktrees",
        branchPrefix: "feature/",
      });
      expect(branch).toBe("feature/ENG-123");
    });

    it("handles names with dashes", () => {
      const branch = buildBranchName("my-feature-branch");
      expect(branch).toBe("wt/my-feature-branch");
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

    it("does partial matching correctly", () => {
      expect(worktreeExists(samplePorcelainOutput, ".worktrees/ENG-12")).toBe(
        true
      );
      expect(worktreeExists(samplePorcelainOutput, "ENG-123")).toBe(true);
    });

    it("handles full paths", () => {
      expect(
        worktreeExists(samplePorcelainOutput, "/path/to/repo/.worktrees/ENG-123")
      ).toBe(true);
    });
  });

  describe("createDestroyCommand", () => {
    it("creates a Command instance", () => {
      const cmd = createDestroyCommand();
      expect(cmd).toBeDefined();
      expect(cmd.name()).toBe("destroy");
    });

    it("has correct description", () => {
      const cmd = createDestroyCommand();
      expect(cmd.description()).toBe("Remove a worktree and its branch");
    });

    it("requires name argument", () => {
      const cmd = createDestroyCommand();
      const args = cmd.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe("name");
      expect(args[0].required).toBe(true);
    });

    it("has --force option", () => {
      const cmd = createDestroyCommand();
      const forceOption = cmd.options.find((opt) => opt.long === "--force");
      expect(forceOption).toBeDefined();
    });
  });

  describe("runDestroy", () => {
    function createMockDeps(overrides: Partial<DestroyDeps> = {}): DestroyDeps {
      return {
        getWorktreeList: async () => `worktree /path/to/repo/.worktrees/ENG-123
HEAD abc123
branch refs/heads/wt/ENG-123`,
        removeWorktree: async () => {},
        deleteBranch: async () => {},
        output: () => {},
        errorOutput: () => {},
        warnOutput: () => {},
        exit: ((code: number) => {
          throw new Error(`Exit called with code ${code}`);
        }) as (code: number) => never,
        ...overrides,
      };
    }

    it("destroys worktree successfully when it exists", async () => {
      let outputMessage = "";
      let removeWorktreeCalled = false;
      let deleteBranchCalled = false;
      let removedPath = "";
      let removedForce = false;

      const deps = createMockDeps({
        removeWorktree: async (path, force) => {
          removeWorktreeCalled = true;
          removedPath = path;
          removedForce = force;
        },
        deleteBranch: async () => {
          deleteBranchCalled = true;
        },
        output: (msg) => { outputMessage = msg; },
      });

      await runDestroy("ENG-123", {}, getDefaultConfig(), deps);

      expect(removeWorktreeCalled).toBe(true);
      expect(deleteBranchCalled).toBe(true);
      expect(removedPath).toBe(".worktrees/ENG-123");
      expect(removedForce).toBe(false);
      expect(outputMessage).toContain("Destroyed:");
    });

    it("exits with error when worktree does not exist", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo
HEAD abc123
branch refs/heads/main`,
        errorOutput: (msg) => { errorMessage = msg; },
      });

      await expect(runDestroy("ENG-999", {}, getDefaultConfig(), deps)).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("does not exist");
    });

    it("uses force flag when provided", async () => {
      let removedForce = false;

      const deps = createMockDeps({
        removeWorktree: async (_path, force) => {
          removedForce = force;
        },
      });

      await runDestroy("ENG-123", { force: true }, getDefaultConfig(), deps);

      expect(removedForce).toBe(true);
    });

    it("handles branch delete failure with force flag", async () => {
      let forceBranchDeleteCalled = false;

      const deps = createMockDeps({
        deleteBranch: async (_branch, force) => {
          if (!force) {
            throw new Error("Branch has unmerged changes");
          }
          forceBranchDeleteCalled = true;
        },
      });

      await runDestroy("ENG-123", { force: true }, getDefaultConfig(), deps);

      expect(forceBranchDeleteCalled).toBe(true);
    });

    it("shows warning when branch delete fails without force", async () => {
      let warnMessage = "";

      const deps = createMockDeps({
        deleteBranch: async () => {
          throw new Error("Branch has unmerged changes");
        },
        warnOutput: (msg) => { warnMessage = msg; },
      });

      await runDestroy("ENG-123", {}, getDefaultConfig(), deps);

      expect(warnMessage).toContain("unmerged changes");
      expect(warnMessage).toContain("--force");
    });

    it("handles removeWorktree failure", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        removeWorktree: async () => {
          throw new Error("Git error");
        },
        errorOutput: (msg) => { errorMessage = msg; },
      });

      await expect(runDestroy("ENG-123", {}, getDefaultConfig(), deps)).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("Error destroying worktree");
    });

    it("uses custom config when provided", async () => {
      let removedPath = "";

      const customConfig: DestroyConfig = {
        worktreesDir: "custom-dir",
        branchPrefix: "feature/",
      };

      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo/custom-dir/test
HEAD abc123
branch refs/heads/feature/test`,
        removeWorktree: async (path) => {
          removedPath = path;
        },
      });

      await runDestroy("test", {}, customConfig, deps);

      expect(removedPath).toBe("custom-dir/test");
    });

    it("outputs success message after destroying", async () => {
      let outputMessage = "";

      const deps = createMockDeps({
        output: (msg) => { outputMessage = msg; },
      });

      await runDestroy("ENG-123", {}, getDefaultConfig(), deps);

      expect(outputMessage).toContain("Destroyed:");
      expect(outputMessage).toContain(".worktrees/ENG-123");
    });
  });
});
