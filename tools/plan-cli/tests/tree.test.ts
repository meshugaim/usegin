import { describe, it, expect } from "bun:test";
import { formatTreeContext, type IssueTreeContext } from "../src/lib/output/tree";
import { stripAnsi } from "../src/lib/colors";

describe("formatTreeContext", () => {
  describe("issue with parent (case 1)", () => {
    it("shows parent, siblings with current marked, using tree connectors", () => {
      const context: IssueTreeContext = {
        parent: { identifier: "ENG-100", title: "Epic: Auth overhaul" },
        siblings: [
          { identifier: "ENG-101", title: "Login flow", id: "s1" },
          { identifier: "ENG-102", title: "Signup flow", id: "s2" },
          { identifier: "ENG-103", title: "Password reset", id: "s3" },
        ],
        children: [],
        currentIssueId: "s2",
      };

      const result = stripAnsi(formatTreeContext(context));

      // Parent line
      expect(result).toContain("ENG-100 Epic: Auth overhaul");
      // Current issue is marked
      expect(result).toContain("ENG-102 Signup flow ← (you are here)");
      // Other siblings are present but not marked
      expect(result).toContain("ENG-101 Login flow");
      expect(result).not.toContain("ENG-101 Login flow ←");
      expect(result).toContain("ENG-103 Password reset");
      expect(result).not.toContain("ENG-103 Password reset ←");
    });

    it("uses └─ for the last sibling and ├─ for others", () => {
      const context: IssueTreeContext = {
        parent: { identifier: "ENG-1", title: "Parent" },
        siblings: [
          { identifier: "ENG-2", title: "First", id: "a" },
          { identifier: "ENG-3", title: "Last", id: "b" },
        ],
        children: [],
        currentIssueId: "a",
      };

      const result = stripAnsi(formatTreeContext(context));
      const lines = result.split("\n");

      // First sibling gets ├─
      expect(lines[1]).toContain("├─");
      // Last sibling gets └─
      expect(lines[2]).toContain("└─");
    });

    it("handles a single sibling (current issue is only child)", () => {
      const context: IssueTreeContext = {
        parent: { identifier: "ENG-10", title: "Parent issue" },
        siblings: [
          { identifier: "ENG-11", title: "Only child", id: "only" },
        ],
        children: [],
        currentIssueId: "only",
      };

      const result = stripAnsi(formatTreeContext(context));

      expect(result).toContain("ENG-10 Parent issue");
      expect(result).toContain("└─ ENG-11 Only child ← (you are here)");
    });
  });

  describe("issue with children but no parent (case 2)", () => {
    it("shows current issue at top with children below", () => {
      const context: IssueTreeContext = {
        siblings: [
          { identifier: "ENG-50", title: "Top-level epic", id: "top" },
        ],
        children: [
          { identifier: "ENG-51", title: "Sub-task A" },
          { identifier: "ENG-52", title: "Sub-task B" },
        ],
        currentIssueId: "top",
      };

      const result = stripAnsi(formatTreeContext(context));

      // Current issue at top, marked
      expect(result).toContain("ENG-50 Top-level epic ← (you are here)");
      // Children listed
      expect(result).toContain("ENG-51 Sub-task A");
      expect(result).toContain("ENG-52 Sub-task B");
    });

    it("uses └─ for the last child and ├─ for others", () => {
      const context: IssueTreeContext = {
        siblings: [
          { identifier: "ENG-60", title: "Parent", id: "p" },
        ],
        children: [
          { identifier: "ENG-61", title: "Child 1" },
          { identifier: "ENG-62", title: "Child 2" },
          { identifier: "ENG-63", title: "Child 3" },
        ],
        currentIssueId: "p",
      };

      const result = stripAnsi(formatTreeContext(context));
      const lines = result.split("\n");

      expect(lines[1]).toContain("├─");
      expect(lines[2]).toContain("├─");
      expect(lines[3]).toContain("└─");
    });

    it("handles a single child", () => {
      const context: IssueTreeContext = {
        siblings: [
          { identifier: "ENG-70", title: "Solo parent", id: "sp" },
        ],
        children: [
          { identifier: "ENG-71", title: "Only child" },
        ],
        currentIssueId: "sp",
      };

      const result = stripAnsi(formatTreeContext(context));

      expect(result).toContain("ENG-70 Solo parent ← (you are here)");
      expect(result).toContain("└─ ENG-71 Only child");
    });
  });

  describe("standalone issue — no parent, no children (case 3)", () => {
    it("shows the issue marked as current with a standalone message", () => {
      const context: IssueTreeContext = {
        siblings: [
          { identifier: "ENG-99", title: "Lone wolf", id: "lone" },
        ],
        children: [],
        currentIssueId: "lone",
      };

      const result = stripAnsi(formatTreeContext(context));

      expect(result).toContain("ENG-99 Lone wolf ← (you are here)");
      expect(result).toContain("(no parent or children)");
    });
  });
});
