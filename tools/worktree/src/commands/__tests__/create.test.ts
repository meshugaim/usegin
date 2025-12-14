import { describe, expect, it } from "bun:test";
import {
  buildWorktreePath,
  buildBranchName,
  worktreeExists,
  getDefaultConfig,
  getDefaultDeps,
  runCreate,
  WORKTREES_DIR,
  BRANCH_PREFIX,
  createCreateCommand,
  type CreateConfig,
  type CreateDeps,
} from "../create";

describe("create command", () => {
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
      expect(typeof deps.createWorktree).toBe("function");
      expect(typeof deps.output).toBe("function");
      expect(typeof deps.errorOutput).toBe("function");
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

  describe("createCreateCommand", () => {
    it("creates a Command instance", () => {
      const cmd = createCreateCommand();
      expect(cmd).toBeDefined();
      expect(cmd.name()).toBe("create");
    });

    it("has correct description", () => {
      const cmd = createCreateCommand();
      expect(cmd.description()).toBe("Create a new worktree");
    });

    it("requires name argument", () => {
      const cmd = createCreateCommand();
      const args = cmd.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe("name");
      expect(args[0].required).toBe(true);
    });
  });

  describe("runCreate", () => {
    function createMockDeps(overrides: Partial<CreateDeps> = {}): CreateDeps {
      let exitCalled = false;
      return {
        getWorktreeList: async () => "",
        createWorktree: async () => {},
        output: () => {},
        errorOutput: () => {},
        exit: ((code: number) => {
          exitCalled = true;
          throw new Error(`Exit called with code ${code}`);
        }) as (code: number) => never,
        ...overrides,
      };
    }

    it("creates worktree successfully when it does not exist", async () => {
      let outputMessage = "";
      let createWorktreeCalled = false;
      let createdPath = "";
      let createdBranch = "";

      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo
HEAD abc123
branch refs/heads/main`,
        createWorktree: async (path, branch) => {
          createWorktreeCalled = true;
          createdPath = path;
          createdBranch = branch;
        },
        output: (msg) => { outputMessage = msg; },
      });

      await runCreate("ENG-999", getDefaultConfig(), deps);

      expect(createWorktreeCalled).toBe(true);
      expect(createdPath).toBe(".worktrees/ENG-999");
      expect(createdBranch).toBe("wt/ENG-999");
      expect(outputMessage).toContain("Created:");
      expect(outputMessage).toContain(".worktrees/ENG-999");
    });

    it("exits with error when worktree already exists", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo/.worktrees/ENG-123
HEAD abc123
branch refs/heads/wt/ENG-123`,
        errorOutput: (msg) => { errorMessage = msg; },
      });

      await expect(runCreate("ENG-123", getDefaultConfig(), deps)).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("already exists");
    });

    it("handles createWorktree failure", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        getWorktreeList: async () => "",
        createWorktree: async () => {
          throw new Error("Git error");
        },
        errorOutput: (msg) => { errorMessage = msg; },
      });

      await expect(runCreate("ENG-999", getDefaultConfig(), deps)).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("Error creating worktree");
    });

    it("uses custom config when provided", async () => {
      let createdPath = "";
      let createdBranch = "";

      const customConfig: CreateConfig = {
        worktreesDir: "custom-dir",
        branchPrefix: "feature/",
      };

      const deps = createMockDeps({
        getWorktreeList: async () => "",
        createWorktree: async (path, branch) => {
          createdPath = path;
          createdBranch = branch;
        },
      });

      await runCreate("test", customConfig, deps);

      expect(createdPath).toBe("custom-dir/test");
      expect(createdBranch).toBe("feature/test");
    });

    it("outputs success message with path and branch", async () => {
      let outputMessage = "";

      const deps = createMockDeps({
        getWorktreeList: async () => "",
        createWorktree: async () => {},
        output: (msg) => { outputMessage = msg; },
      });

      await runCreate("ENG-999", getDefaultConfig(), deps);

      expect(outputMessage).toContain(".worktrees/ENG-999");
      expect(outputMessage).toContain("wt/ENG-999");
    });
  });
});
