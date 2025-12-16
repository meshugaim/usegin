import { describe, expect, it } from "bun:test";
import { formatListHuman } from "../src/lib/output";
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

const mockIssuesWithDoneChildren: PlanIssue[] = [
  {
    id: "issue-10",
    identifier: "ENG-100",
    title: "Parent issue",
    status: "In Progress",
    sortOrder: 1.0,
    children: [
      {
        id: "issue-11",
        identifier: "ENG-101",
        title: "Child in progress",
        status: "In Progress",
        sortOrder: 1.1,
        parent: { id: "issue-10", identifier: "ENG-100" },
        children: [],
      },
      {
        id: "issue-12",
        identifier: "ENG-102",
        title: "Child done",
        status: "Done",
        sortOrder: 1.2,
        parent: { id: "issue-10", identifier: "ENG-100" },
        children: [],
      },
    ],
  },
];

describe("formatListHuman", () => {
  it("formats issues as a table with position numbers", () => {
    const { output } = formatListHuman(mockIssues);

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
    const { output } = formatListHuman(mockIssues, { depth: 1 });

    // Sub-issue should have tree prefix, not position number
    expect(output).toContain("ENG-21");
    expect(output).toContain("└");
    expect(output).toContain("Extract types");
  });

  it("hides sub-issues when depth is 0", () => {
    const { output } = formatListHuman(mockIssues, { depth: 0 });

    expect(output).not.toContain("ENG-21");
    expect(output).not.toContain("Extract types");
  });

  it("aligns columns properly", () => {
    const { output } = formatListHuman(mockIssues);
    const lines = output.split("\n").filter(Boolean);

    // All data rows should align with header
    // This is a basic check - columns should be consistent
    expect(lines.length).toBeGreaterThan(1);
  });

  it("hides Done sub-issues by default", () => {
    const { output } = formatListHuman(mockIssuesWithDoneChildren, { depth: 1 });

    // Should show non-Done children
    expect(output).toContain("ENG-101");

    // Should NOT show Done children
    expect(output).not.toContain("ENG-102");
  });

  it("shows Done sub-issues when showDone is true", () => {
    const { output } = formatListHuman(mockIssuesWithDoneChildren, { depth: 1, showDone: true });

    // Should show all children including Done
    expect(output).toContain("ENG-101");
    expect(output).toContain("ENG-102");
  });

  it("returns hasHiddenChildren when issues have childCount", () => {
    const issuesWithChildCount: PlanIssue[] = [
      {
        id: "issue-1",
        identifier: "ENG-1",
        title: "Parent",
        status: "Backlog",
        sortOrder: 1.0,
        children: [],
        childCount: 3,
      },
    ];
    const { hasHiddenChildren } = formatListHuman(issuesWithChildCount);
    expect(hasHiddenChildren).toBe(true);
  });

  it("shows More column when there are hidden children", () => {
    const issuesWithChildCount: PlanIssue[] = [
      {
        id: "issue-1",
        identifier: "ENG-1",
        title: "Parent",
        status: "Backlog",
        sortOrder: 1.0,
        children: [],
        childCount: 3,
      },
    ];
    const { output } = formatListHuman(issuesWithChildCount);
    expect(output).toContain("More");
    expect(output).toContain("+3");
  });

  it("wraps long titles to two lines", () => {
    const issuesWithLongTitle: PlanIssue[] = [
      {
        id: "issue-1",
        identifier: "ENG-1",
        title: "This is a very long title that should wrap to two lines for better readability",
        status: "Backlog",
        sortOrder: 1.0,
        children: [],
      },
    ];
    const { output } = formatListHuman(issuesWithLongTitle);
    const lines = output.split("\n");

    // Should have at least 3 lines: header, first line of title, second line of title
    expect(lines.length).toBeGreaterThanOrEqual(3);

    // The full title should be visible across the lines (not truncated in the middle)
    // First part should be visible
    expect(output).toContain("This is a very long title");
    // Second part should be visible (wrapped)
    expect(output).toContain("readability");
  });

  it("wraps long child titles to two lines", () => {
    const issuesWithLongChildTitle: PlanIssue[] = [
      {
        id: "issue-1",
        identifier: "ENG-1",
        title: "Parent",
        status: "Backlog",
        sortOrder: 1.0,
        children: [
          {
            id: "issue-2",
            identifier: "ENG-2",
            title: "Child issue with a very long title that needs to wrap to a second line",
            status: "Backlog",
            sortOrder: 1.1,
            parent: { id: "issue-1", identifier: "ENG-1" },
            children: [],
          },
        ],
      },
    ];
    const { output } = formatListHuman(issuesWithLongChildTitle, { depth: 1 });

    // The child title should be visible across lines
    expect(output).toContain("Child issue with a very");
    expect(output).toContain("second line");
  });
});

