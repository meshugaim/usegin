import { describe, expect, it } from "bun:test";
import {
  parseWorktrees,
  WORKTREES_DIR,
  filterManagedWorktrees,
  formatTableRow,
  formatTable,
  runList,
  getDefaultDeps,
  type WorktreeInfo,
  type ListDeps,
} from "../list";

describe("list command", () => {
  describe("parseWorktrees", () => {
    it("parses empty output as empty array", () => {
      const result = parseWorktrees("");
      expect(result).toEqual([]);
    });

    it("parses single worktree entry", () => {
      const porcelainOutput = `worktree /path/to/repo
HEAD abc123def456789
branch refs/heads/main`;

      const result = parseWorktrees(porcelainOutput);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "repo",
        path: "/path/to/repo",
        branch: "main",
        commit: "abc123def456789",
      });
    });

    it("parses multiple worktree entries", () => {
      const porcelainOutput = `worktree /path/to/repo
HEAD abc123def456789
branch refs/heads/main

worktree /path/to/repo/.worktrees/ENG-123
HEAD def456789abc123
branch refs/heads/wt/ENG-123

worktree /path/to/repo/.worktrees/ENG-456
HEAD 789abc123def456
branch refs/heads/wt/ENG-456`;

      const result = parseWorktrees(porcelainOutput);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("repo");
      expect(result[0].branch).toBe("main");
      expect(result[1].name).toBe("ENG-123");
      expect(result[1].branch).toBe("wt/ENG-123");
      expect(result[2].name).toBe("ENG-456");
      expect(result[2].branch).toBe("wt/ENG-456");
    });

    it("handles detached HEAD state", () => {
      const porcelainOutput = `worktree /path/to/repo
HEAD abc123def456789
detached`;

      const result = parseWorktrees(porcelainOutput);

      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe("(detached)");
    });

    it("extracts name from path correctly", () => {
      const porcelainOutput = `worktree /long/path/to/some/deep/directory
HEAD abc123
branch refs/heads/feature`;

      const result = parseWorktrees(porcelainOutput);

      expect(result[0].name).toBe("directory");
    });

    it("handles single path segment", () => {
      const porcelainOutput = `worktree /repo
HEAD abc123
branch refs/heads/main`;

      const result = parseWorktrees(porcelainOutput);

      expect(result[0].name).toBe("repo");
    });

    it("handles entries without branch line", () => {
      const porcelainOutput = `worktree /path/to/repo
HEAD abc123`;

      const result = parseWorktrees(porcelainOutput);

      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe("(detached)");
    });

    it("handles whitespace in output", () => {
      const porcelainOutput = `
worktree /path/to/repo
HEAD abc123def456789
branch refs/heads/main

`;

      const result = parseWorktrees(porcelainOutput);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("repo");
    });

    it("skips entries without path line", () => {
      const porcelainOutput = `HEAD abc123
branch refs/heads/main

worktree /valid/path
HEAD def456
branch refs/heads/feature`;

      const result = parseWorktrees(porcelainOutput);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe("/valid/path");
    });

    it("skips entries without HEAD line", () => {
      const porcelainOutput = `worktree /no/head
branch refs/heads/main

worktree /valid/path
HEAD def456
branch refs/heads/feature`;

      const result = parseWorktrees(porcelainOutput);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe("/valid/path");
    });
  });

  describe("WORKTREES_DIR constant", () => {
    it("is set to .worktrees", () => {
      expect(WORKTREES_DIR).toBe(".worktrees");
    });
  });

  describe("filterManagedWorktrees", () => {
    it("filters worktrees to only those in .worktrees directory", () => {
      const worktrees: WorktreeInfo[] = [
        { name: "repo", path: "/path/to/repo", branch: "main", commit: "abc123" },
        { name: "ENG-123", path: "/path/to/repo/.worktrees/ENG-123", branch: "wt/ENG-123", commit: "def456" },
        { name: "other", path: "/other/path", branch: "feature", commit: "ghi789" },
      ];

      const result = filterManagedWorktrees(worktrees);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ENG-123");
    });

    it("returns empty array when no managed worktrees", () => {
      const worktrees: WorktreeInfo[] = [
        { name: "repo", path: "/path/to/repo", branch: "main", commit: "abc123" },
      ];

      const result = filterManagedWorktrees(worktrees);

      expect(result).toHaveLength(0);
    });

    it("returns all worktrees when all are managed", () => {
      const worktrees: WorktreeInfo[] = [
        { name: "ENG-123", path: "/repo/.worktrees/ENG-123", branch: "wt/ENG-123", commit: "abc123" },
        { name: "ENG-456", path: "/repo/.worktrees/ENG-456", branch: "wt/ENG-456", commit: "def456" },
      ];

      const result = filterManagedWorktrees(worktrees);

      expect(result).toHaveLength(2);
    });
  });

  describe("formatTableRow", () => {
    it("formats a worktree info as a table row", () => {
      const wt: WorktreeInfo = {
        name: "ENG-123",
        path: "/path/.worktrees/ENG-123",
        branch: "wt/ENG-123",
        commit: "abc123def456789",
      };

      const result = formatTableRow(wt);

      expect(result).toBe("ENG-123        wt/ENG-123          abc123d");
    });

    it("pads short names correctly", () => {
      const wt: WorktreeInfo = {
        name: "X",
        path: "/path/.worktrees/X",
        branch: "wt/X",
        commit: "abc123def456789",
      };

      const result = formatTableRow(wt);

      expect(result.startsWith("X")).toBe(true);
      expect(result).toContain("wt/X");
    });

    it("truncates commit to 7 characters", () => {
      const wt: WorktreeInfo = {
        name: "test",
        path: "/path",
        branch: "branch",
        commit: "abcdefghijklmnop",
      };

      const result = formatTableRow(wt);

      expect(result).toContain("abcdefg");
      expect(result).not.toContain("hijklmnop");
    });
  });

  describe("formatTable", () => {
    it("formats worktrees as a table with header", () => {
      const worktrees: WorktreeInfo[] = [
        { name: "ENG-123", path: "/p/.worktrees/ENG-123", branch: "wt/ENG-123", commit: "abc1234567890" },
      ];

      const result = formatTable(worktrees);

      expect(result).toContain("Name");
      expect(result).toContain("Branch");
      expect(result).toContain("Commit");
      expect(result).toContain("-".repeat(50));
      expect(result).toContain("ENG-123");
    });

    it("formats multiple worktrees", () => {
      const worktrees: WorktreeInfo[] = [
        { name: "ENG-123", path: "/p/.worktrees/ENG-123", branch: "wt/ENG-123", commit: "abc1234" },
        { name: "ENG-456", path: "/p/.worktrees/ENG-456", branch: "wt/ENG-456", commit: "def5678" },
      ];

      const result = formatTable(worktrees);
      const lines = result.split("\n");

      expect(lines).toHaveLength(4); // header + separator + 2 rows
      expect(lines[2]).toContain("ENG-123");
      expect(lines[3]).toContain("ENG-456");
    });
  });

  describe("runList", () => {
    function createMockDeps(overrides: Partial<ListDeps> = {}): ListDeps {
      return {
        getWorktreeList: async () => "",
        output: () => {},
        ...overrides,
      };
    }

    it("outputs 'No worktrees found' when no managed worktrees", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo
HEAD abc123
branch refs/heads/main`,
        output: (msg) => { outputMessage = msg; },
      });

      await runList({}, deps);

      expect(outputMessage).toBe("No worktrees found");
    });

    it("outputs table format by default", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo/.worktrees/ENG-123
HEAD abc123def456789
branch refs/heads/wt/ENG-123`,
        output: (msg) => { outputMessage = msg; },
      });

      await runList({}, deps);

      expect(outputMessage).toContain("Name");
      expect(outputMessage).toContain("ENG-123");
    });

    it("outputs JSON format when json option is true", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo/.worktrees/ENG-123
HEAD abc123def456789
branch refs/heads/wt/ENG-123`,
        output: (msg) => { outputMessage = msg; },
      });

      await runList({ json: true }, deps);

      const parsed = JSON.parse(outputMessage);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("ENG-123");
    });

    it("includes all worktree info in JSON output", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        getWorktreeList: async () => `worktree /path/to/repo/.worktrees/ENG-123
HEAD abc123def456789
branch refs/heads/wt/ENG-123`,
        output: (msg) => { outputMessage = msg; },
      });

      await runList({ json: true }, deps);

      const parsed = JSON.parse(outputMessage);
      expect(parsed[0]).toHaveProperty("name");
      expect(parsed[0]).toHaveProperty("path");
      expect(parsed[0]).toHaveProperty("branch");
      expect(parsed[0]).toHaveProperty("commit");
    });
  });

  describe("getDefaultDeps", () => {
    it("returns object with required methods", () => {
      const deps = getDefaultDeps();

      expect(typeof deps.getWorktreeList).toBe("function");
      expect(typeof deps.output).toBe("function");
    });
  });
});
