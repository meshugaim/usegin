import { describe, expect, it } from "bun:test";
import { formatListHuman, formatListJson } from "../src/lib/output";
import type { PlanIssue } from "../src/types";

const mockIssues: PlanIssue[] = [
  {
    id: "issue-1",
    identifier: "ENG-12",
    title: "Fix auth redirect",
    status: "In Progress",
    sortOrder: 1.0,
    assignee: { id: "user-1", name: "nitsan", displayName: "Nitsan" },
    children: [],
  },
  {
    id: "issue-2",
    identifier: "ENG-20",
    title: "Refactor API client",
    status: "Backlog",
    sortOrder: 2.0,
    children: [
      {
        id: "issue-3",
        identifier: "ENG-21",
        title: "Extract types",
        status: "Backlog",
        sortOrder: 2.1,
        parent: { id: "issue-2", identifier: "ENG-20" },
        children: [],
      },
    ],
  },
  {
    id: "issue-4",
    identifier: "ENG-15",
    title: "Add webhook support",
    status: "Backlog",
    sortOrder: 3.0,
    children: [],
  },
];

describe("formatListHuman", () => {
  it("formats issues as a table with position numbers", () => {
    const output = formatListHuman(mockIssues);

    // Should have header
    expect(output).toContain("#");
    expect(output).toContain("ID");
    expect(output).toContain("Title");
    expect(output).toContain("Status");

    // Should have position numbers for top-level
    expect(output).toContain("1");
    expect(output).toContain("ENG-12");
    expect(output).toContain("Fix auth redirect");

    expect(output).toContain("2");
    expect(output).toContain("ENG-20");
  });

  it("shows sub-issues with tree prefix", () => {
    const output = formatListHuman(mockIssues, { depth: 1 });

    // Sub-issue should have tree prefix, not position number
    expect(output).toContain("ENG-21");
    expect(output).toContain("└");
    expect(output).toContain("Extract types");
  });

  it("hides sub-issues when depth is 0", () => {
    const output = formatListHuman(mockIssues, { depth: 0 });

    expect(output).not.toContain("ENG-21");
    expect(output).not.toContain("Extract types");
  });

  it("aligns columns properly", () => {
    const output = formatListHuman(mockIssues);
    const lines = output.split("\n").filter(Boolean);

    // All data rows should align with header
    // This is a basic check - columns should be consistent
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe("formatListJson", () => {
  it("returns valid JSON with items array", () => {
    const output = formatListJson(mockIssues);
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty("items");
    expect(Array.isArray(parsed.items)).toBe(true);
    expect(parsed.items).toHaveLength(3);
  });

  it("includes position numbers in JSON", () => {
    const output = formatListJson(mockIssues);
    const parsed = JSON.parse(output);

    expect(parsed.items[0].position).toBe(1);
    expect(parsed.items[1].position).toBe(2);
    expect(parsed.items[2].position).toBe(3);
  });

  it("nests children in parent objects", () => {
    const output = formatListJson(mockIssues);
    const parsed = JSON.parse(output);

    const parent = parsed.items.find((i: any) => i.identifier === "ENG-20");
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0].identifier).toBe("ENG-21");
  });

  it("includes all required fields", () => {
    const output = formatListJson(mockIssues);
    const parsed = JSON.parse(output);

    const issue = parsed.items[0];
    expect(issue).toHaveProperty("id");
    expect(issue).toHaveProperty("identifier");
    expect(issue).toHaveProperty("title");
    expect(issue).toHaveProperty("status");
    expect(issue).toHaveProperty("position");
    expect(issue).toHaveProperty("children");
  });
});
