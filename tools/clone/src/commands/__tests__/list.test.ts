import { describe, expect, it } from "bun:test";
import {
  parseClones,
  CLONES_DIR,
  formatTableRow,
  formatTable,
  runList,
  getDefaultDeps,
  type CloneInfo,
  type ListDeps,
} from "../list";

describe("list command", () => {
  describe("CLONES_DIR constant", () => {
    it("is set to .clones", () => {
      expect(CLONES_DIR).toBe(".clones");
    });
  });

  describe("parseClones", () => {
    it("returns empty array when directory is empty", async () => {
      const result = await parseClones(async () => []);
      expect(result).toEqual([]);
    });

    it("parses clone directories with git info", async () => {
      const result = await parseClones(
        async () => ["ENG-123", "ENG-456"],
        async (name) => {
          if (name === "ENG-123") {
            return { branch: "main", commit: "abc123def456789" };
          }
          return { branch: "feature", commit: "def456abc789012" };
        }
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "ENG-123",
        path: ".clones/ENG-123",
        branch: "main",
        commit: "abc123def456789",
      });
      expect(result[1]).toEqual({
        name: "ENG-456",
        path: ".clones/ENG-456",
        branch: "feature",
        commit: "def456abc789012",
      });
    });

    it("handles clones without git info gracefully", async () => {
      const result = await parseClones(
        async () => ["broken-clone"],
        async () => {
          throw new Error("Not a git repository");
        }
      );

      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe("(unknown)");
      expect(result[0].commit).toBe("(unknown)");
    });
  });

  describe("formatTableRow", () => {
    it("formats a clone info as a table row", () => {
      const clone: CloneInfo = {
        name: "ENG-123",
        path: ".clones/ENG-123",
        branch: "main",
        commit: "abc123def456789",
      };

      const result = formatTableRow(clone);

      expect(result).toBe("ENG-123        main                abc123d");
    });

    it("pads short names correctly", () => {
      const clone: CloneInfo = {
        name: "X",
        path: ".clones/X",
        branch: "feature",
        commit: "abc123def456789",
      };

      const result = formatTableRow(clone);

      expect(result.startsWith("X")).toBe(true);
      expect(result).toContain("feature");
    });

    it("truncates commit to 7 characters", () => {
      const clone: CloneInfo = {
        name: "test",
        path: ".clones/test",
        branch: "branch",
        commit: "abcdefghijklmnop",
      };

      const result = formatTableRow(clone);

      expect(result).toContain("abcdefg");
      expect(result).not.toContain("hijklmnop");
    });
  });

  describe("formatTable", () => {
    it("formats clones as a table with header", () => {
      const clones: CloneInfo[] = [
        {
          name: "ENG-123",
          path: ".clones/ENG-123",
          branch: "main",
          commit: "abc1234567890",
        },
      ];

      const result = formatTable(clones);

      expect(result).toContain("Name");
      expect(result).toContain("Branch");
      expect(result).toContain("Commit");
      expect(result).toContain("-".repeat(50));
      expect(result).toContain("ENG-123");
    });

    it("formats multiple clones", () => {
      const clones: CloneInfo[] = [
        {
          name: "ENG-123",
          path: ".clones/ENG-123",
          branch: "main",
          commit: "abc1234",
        },
        {
          name: "ENG-456",
          path: ".clones/ENG-456",
          branch: "feature",
          commit: "def5678",
        },
      ];

      const result = formatTable(clones);
      const lines = result.split("\n");

      expect(lines).toHaveLength(4); // header + separator + 2 rows
      expect(lines[2]).toContain("ENG-123");
      expect(lines[3]).toContain("ENG-456");
    });
  });

  describe("runList", () => {
    function createMockDeps(overrides: Partial<ListDeps> = {}): ListDeps {
      return {
        listCloneDirectories: async () => [],
        getCloneGitInfo: async () => ({ branch: "main", commit: "abc123" }),
        output: () => {},
        ...overrides,
      };
    }

    it("outputs 'No clones found' when no clones", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => [],
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runList({}, deps);

      expect(outputMessage).toBe("No clones found");
    });

    it("outputs table format by default", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123"],
        getCloneGitInfo: async () => ({
          branch: "main",
          commit: "abc123def456789",
        }),
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runList({}, deps);

      expect(outputMessage).toContain("Name");
      expect(outputMessage).toContain("ENG-123");
    });

    it("outputs JSON format when json option is true", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123"],
        getCloneGitInfo: async () => ({
          branch: "main",
          commit: "abc123def456789",
        }),
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runList({ json: true }, deps);

      const parsed = JSON.parse(outputMessage);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("ENG-123");
    });

    it("includes all clone info in JSON output", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123"],
        getCloneGitInfo: async () => ({
          branch: "feature",
          commit: "abc123def456789",
        }),
        output: (msg) => {
          outputMessage = msg;
        },
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

      expect(typeof deps.listCloneDirectories).toBe("function");
      expect(typeof deps.getCloneGitInfo).toBe("function");
      expect(typeof deps.output).toBe("function");
    });
  });
});
