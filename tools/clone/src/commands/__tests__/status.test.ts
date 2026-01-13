import { describe, expect, it } from "bun:test";
import {
  runStatus,
  formatStatusRow,
  formatStatusTable,
  type StatusInfo,
  type StatusDeps,
} from "../status";

describe("status command", () => {
  describe("StatusInfo interface", () => {
    it("has required fields", () => {
      const status: StatusInfo = {
        name: "ENG-123",
        path: ".clones/ENG-123",
        branch: "main",
        isDirty: false,
        ahead: 0,
        behind: 0,
      };

      expect(status.name).toBe("ENG-123");
      expect(status.path).toBe(".clones/ENG-123");
      expect(status.branch).toBe("main");
      expect(status.isDirty).toBe(false);
      expect(status.ahead).toBe(0);
      expect(status.behind).toBe(0);
    });
  });

  describe("formatStatusRow", () => {
    it("formats clean status with no ahead/behind", () => {
      const status: StatusInfo = {
        name: "ENG-123",
        path: ".clones/ENG-123",
        branch: "main",
        isDirty: false,
        ahead: 0,
        behind: 0,
      };

      const result = formatStatusRow(status);

      expect(result).toContain("ENG-123");
      expect(result).toContain("main");
      expect(result).toContain("clean");
    });

    it("formats dirty status", () => {
      const status: StatusInfo = {
        name: "ENG-123",
        path: ".clones/ENG-123",
        branch: "feature",
        isDirty: true,
        ahead: 0,
        behind: 0,
      };

      const result = formatStatusRow(status);

      expect(result).toContain("dirty");
    });

    it("shows commits ahead", () => {
      const status: StatusInfo = {
        name: "ENG-123",
        path: ".clones/ENG-123",
        branch: "main",
        isDirty: false,
        ahead: 3,
        behind: 0,
      };

      const result = formatStatusRow(status);

      expect(result).toContain("+3");
    });

    it("shows commits behind", () => {
      const status: StatusInfo = {
        name: "ENG-123",
        path: ".clones/ENG-123",
        branch: "main",
        isDirty: false,
        ahead: 0,
        behind: 5,
      };

      const result = formatStatusRow(status);

      expect(result).toContain("-5");
    });

    it("shows both ahead and behind", () => {
      const status: StatusInfo = {
        name: "ENG-123",
        path: ".clones/ENG-123",
        branch: "main",
        isDirty: false,
        ahead: 2,
        behind: 3,
      };

      const result = formatStatusRow(status);

      expect(result).toContain("+2");
      expect(result).toContain("-3");
    });
  });

  describe("formatStatusTable", () => {
    it("formats table with header", () => {
      const statuses: StatusInfo[] = [
        {
          name: "ENG-123",
          path: ".clones/ENG-123",
          branch: "main",
          isDirty: false,
          ahead: 0,
          behind: 0,
        },
      ];

      const result = formatStatusTable(statuses);

      expect(result).toContain("Name");
      expect(result).toContain("Branch");
      expect(result).toContain("Status");
      expect(result).toContain("Ahead/Behind");
      expect(result).toContain("-".repeat(60));
    });

    it("formats multiple clones", () => {
      const statuses: StatusInfo[] = [
        {
          name: "ENG-123",
          path: ".clones/ENG-123",
          branch: "main",
          isDirty: false,
          ahead: 0,
          behind: 0,
        },
        {
          name: "ENG-456",
          path: ".clones/ENG-456",
          branch: "feature",
          isDirty: true,
          ahead: 1,
          behind: 2,
        },
      ];

      const result = formatStatusTable(statuses);
      const lines = result.split("\n");

      expect(lines.length).toBe(4); // header + separator + 2 rows
    });
  });

  describe("runStatus", () => {
    function createMockDeps(overrides: Partial<StatusDeps> = {}): StatusDeps {
      return {
        listCloneDirectories: async () => [],
        getCloneStatus: async () => ({
          branch: "main",
          isDirty: false,
          ahead: 0,
          behind: 0,
        }),
        output: () => {},
        ...overrides,
      };
    }

    it("outputs 'No clones found' when no clones exist", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => [],
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runStatus({}, deps);

      expect(outputMessage).toBe("No clones found");
    });

    it("outputs status table for all clones", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123", "ENG-456"],
        getCloneStatus: async () => ({
          branch: "main",
          isDirty: false,
          ahead: 0,
          behind: 0,
        }),
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runStatus({}, deps);

      expect(outputMessage).toContain("ENG-123");
      expect(outputMessage).toContain("ENG-456");
    });

    it("filters to specific clone when name provided", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123", "ENG-456"],
        getCloneStatus: async () => ({
          branch: "main",
          isDirty: false,
          ahead: 0,
          behind: 0,
        }),
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runStatus({ name: "ENG-123" }, deps);

      expect(outputMessage).toContain("ENG-123");
      expect(outputMessage).not.toContain("ENG-456");
    });

    it("outputs error when specified clone not found", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123"],
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runStatus({ name: "nonexistent" }, deps);

      expect(outputMessage).toContain("Clone 'nonexistent' not found");
    });

    it("outputs JSON format when json option is true", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123"],
        getCloneStatus: async () => ({
          branch: "main",
          isDirty: false,
          ahead: 1,
          behind: 2,
        }),
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runStatus({ json: true }, deps);

      const parsed = JSON.parse(outputMessage);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("ENG-123");
      expect(parsed[0].branch).toBe("main");
      expect(parsed[0].isDirty).toBe(false);
      expect(parsed[0].ahead).toBe(1);
      expect(parsed[0].behind).toBe(2);
    });

    it("handles git errors gracefully", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123"],
        getCloneStatus: async () => {
          throw new Error("Not a git repository");
        },
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runStatus({}, deps);

      expect(outputMessage).toContain("ENG-123");
      expect(outputMessage).toContain("(unknown)");
    });
  });
});
