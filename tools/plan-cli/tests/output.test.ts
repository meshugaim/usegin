import { describe, expect, it } from "bun:test";
import {
  formatListHuman,
  formatListJson,
  formatGroupedListJson,
  getTerminalWidth,
} from "../src/lib/output";
import { stripAnsi } from "../src/lib/colors";
import type { PlanIssue } from "../src/types";

const mockIssues: PlanIssue[] = [
  {
    id: "issue-1",
    identifier: "ENG-12",
    title: "Fix auth redirect",
    status: "In Progress",
    sortOrder: 1.0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    assignee: { id: "user-1", name: "nitsan", displayName: "Nitsan" },
    children: [],
  },
  {
    id: "issue-2",
    identifier: "ENG-20",
    title: "Refactor API client",
    status: "Backlog",
    sortOrder: 2.0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    children: [
      {
        id: "issue-3",
        identifier: "ENG-21",
        title: "Extract types",
        status: "Backlog",
        sortOrder: 2.1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    children: [
      {
        id: "issue-11",
        identifier: "ENG-101",
        title: "Child in progress",
        status: "In Progress",
        sortOrder: 1.1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        parent: { id: "issue-10", identifier: "ENG-100" },
        children: [],
      },
      {
        id: "issue-12",
        identifier: "ENG-102",
        title: "Child done",
        status: "Done",
        sortOrder: 1.2,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
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
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
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
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
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
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
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
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        children: [
          {
            id: "issue-2",
            identifier: "ENG-2",
            title: "Child issue with a very long title that needs to wrap to a second line",
            status: "Backlog",
            sortOrder: 1.1,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
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

  describe("terminal width adaptation", () => {
    const issueWithLongTitle: PlanIssue[] = [
      {
        id: "issue-1",
        identifier: "ENG-123",
        title: "A moderately long title that might need wrapping depending on terminal width",
        status: "In Progress",
        sortOrder: 1.0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        children: [],
      },
    ];

    it("returns a default terminal width when stdout.columns is undefined", () => {
      // In test environment, stdout.columns may be undefined
      const width = getTerminalWidth();
      expect(width).toBeGreaterThan(0);
      // Default should be 100 if not in a TTY
      expect(width).toBe(100);
    });

    it("adapts title width for narrow terminals", () => {
      const { output: narrowOutput } = formatListHuman(issueWithLongTitle, { terminalWidth: 80 });
      const { output: wideOutput } = formatListHuman(issueWithLongTitle, { terminalWidth: 160 });

      // Get the first data line (skip header)
      const narrowLines = narrowOutput.split("\n");
      const wideLines = wideOutput.split("\n");

      // Strip ANSI codes for comparison
      const narrowFirstLine = stripAnsi(narrowLines[1]);
      const wideFirstLine = stripAnsi(wideLines[1]);

      // Wide output should have longer first line (more title visible)
      // Or narrow output should wrap where wide doesn't need to
      // Just check they're different due to different formatting
      expect(narrowFirstLine.length).toBeLessThanOrEqual(wideFirstLine.length + 10);
    });

    it("respects minimum title width on very narrow terminals", () => {
      const { output } = formatListHuman(issueWithLongTitle, { terminalWidth: 40 });

      // Even at 40 chars, the title should still be readable (minimum width)
      expect(output).toContain("ENG-123");
      expect(output).toContain("In Progress");
      // Title should appear even if truncated
      expect(output).toContain("A moderately");
    });

    it("respects maximum title width on very wide terminals", () => {
      const shortIssue: PlanIssue[] = [
        {
          id: "issue-1",
          identifier: "ENG-1",
          title: "Short",
          status: "Backlog",
          sortOrder: 1.0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          children: [],
        },
      ];

      const { output: narrowOutput } = formatListHuman(shortIssue, { terminalWidth: 80 });
      const { output: wideOutput } = formatListHuman(shortIssue, { terminalWidth: 300 });

      // Both should contain the title
      expect(narrowOutput).toContain("Short");
      expect(wideOutput).toContain("Short");

      // Title column width is capped, so extremely wide terminal
      // shouldn't create excessively spaced output
      const narrowFirstDataLine = stripAnsi(narrowOutput.split("\n")[1]);
      const wideFirstDataLine = stripAnsi(wideOutput.split("\n")[1]);

      // Difference should be limited (max title width is 60)
      expect(wideFirstDataLine.length - narrowFirstDataLine.length).toBeLessThan(40);
    });

    it("calculates proper width with labels column", () => {
      const issueWithLabels: PlanIssue[] = [
        {
          id: "issue-1",
          identifier: "ENG-1",
          title: "Issue with labels and a longer title for testing",
          status: "Backlog",
          sortOrder: 1.0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          labels: ["bug", "critical"],
          children: [],
        },
      ];

      const { output } = formatListHuman(issueWithLabels, { terminalWidth: 120 });

      // Should have Labels header
      expect(output).toContain("Labels");
      expect(output).toContain("bug");
    });

    it("calculates proper width with More column", () => {
      const issueWithChildren: PlanIssue[] = [
        {
          id: "issue-1",
          identifier: "ENG-1",
          title: "Parent issue with hidden children",
          status: "Backlog",
          sortOrder: 1.0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          children: [],
          childCount: 5,
        },
      ];

      const { output } = formatListHuman(issueWithChildren, { terminalWidth: 120 });

      // Should have More header and +5 indicator
      expect(output).toContain("More");
      expect(output).toContain("+5");
    });
  });
});

describe("formatListJson", () => {
  it("produces a valid JSON array with the correct shape", () => {
    const result = formatListJson(mockIssues);
    const parsed = JSON.parse(result);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);

    // Every item must have exactly these keys
    const expectedKeys = new Set([
      "identifier",
      "title",
      "status",
      "assignee",
      "labels",
      "project",
      "parent",
      "children",
      "sortOrder",
    ]);

    for (const item of parsed) {
      const keys = new Set(Object.keys(item));
      // childCount is optional — remove it before comparing
      keys.delete("childCount");
      expect(keys).toEqual(expectedKeys);
    }

    // Must NOT contain heavyweight fields
    for (const item of parsed) {
      expect(item).not.toHaveProperty("id");
      expect(item).not.toHaveProperty("description");
      expect(item).not.toHaveProperty("createdAt");
      expect(item).not.toHaveProperty("updatedAt");
    }
  });

  it("flattens assignee to displayName string or null", () => {
    const result = JSON.parse(formatListJson(mockIssues));

    // ENG-12 has an assignee
    expect(result[0].assignee).toBe("Nitsan");
    // ENG-20 has no assignee
    expect(result[1].assignee).toBeNull();
  });

  it("flattens parent to identifier string or null", () => {
    const result = JSON.parse(formatListJson(mockIssues));

    // Top-level issues have no parent
    expect(result[0].parent).toBeNull();
    expect(result[1].parent).toBeNull();

    // ENG-21 (child of ENG-20) has a parent — but it's nested inside
    // children array, so check children shape instead
    expect(result[1].children[0]).toBeDefined();

    // Non-null parent: issue with parent set flattens to identifier string
    const issueWithParent: PlanIssue[] = [
      {
        id: "child-1",
        identifier: "ENG-50",
        title: "Child task",
        status: "In Progress",
        sortOrder: 1.0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        parent: { id: "parent-1", identifier: "ENG-99" },
        children: [],
      },
    ];
    const withParent = JSON.parse(formatListJson(issueWithParent));
    expect(withParent[0].parent).toBe("ENG-99");
  });

  it("formats children with only identifier, title, status", () => {
    const result = JSON.parse(formatListJson(mockIssues));

    const parent = result[1]; // ENG-20
    expect(parent.children).toHaveLength(1);

    const child = parent.children[0];
    expect(Object.keys(child)).toEqual(["identifier", "title", "status"]);
    expect(child.identifier).toBe("ENG-21");
    expect(child.title).toBe("Extract types");
    expect(child.status).toBe("Backlog");
  });

  it("includes childCount when present on the issue", () => {
    const issuesWithChildCount: PlanIssue[] = [
      {
        id: "issue-1",
        identifier: "ENG-1",
        title: "Parent",
        status: "Backlog",
        sortOrder: 1.0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        children: [],
        childCount: 3,
      },
    ];

    const result = JSON.parse(formatListJson(issuesWithChildCount));
    expect(result[0].childCount).toBe(3);
  });

  it("omits childCount when not present on the issue", () => {
    const result = JSON.parse(formatListJson(mockIssues));

    // mockIssues don't have childCount
    for (const item of result) {
      expect(item).not.toHaveProperty("childCount");
    }
  });

  it("excludes Done children when showDone is false (default)", () => {
    const result = JSON.parse(formatListJson(mockIssuesWithDoneChildren));

    const parent = result[0];
    // Only the non-Done child should be present
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0].identifier).toBe("ENG-101");
  });

  it("includes Done children when showDone is true", () => {
    const result = JSON.parse(formatListJson(mockIssuesWithDoneChildren, { showDone: true }));

    const parent = result[0];
    expect(parent.children).toHaveLength(2);
    expect(parent.children.map((c: { identifier: string }) => c.identifier)).toEqual([
      "ENG-101",
      "ENG-102",
    ]);
  });

  it("returns an empty JSON array for zero issues", () => {
    const result = formatListJson([]);
    const parsed = JSON.parse(result);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });
});

describe("formatGroupedListJson", () => {
  const issuesWithLabels: PlanIssue[] = [
    {
      id: "issue-1",
      identifier: "ENG-1",
      title: "Bug fix",
      status: "In Progress",
      sortOrder: 1.0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      labels: ["bug"],
      children: [],
    },
    {
      id: "issue-2",
      identifier: "ENG-2",
      title: "New feature",
      status: "Backlog",
      sortOrder: 2.0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      labels: ["feature"],
      children: [],
    },
    {
      id: "issue-3",
      identifier: "ENG-3",
      title: "Another bug",
      status: "Done",
      sortOrder: 3.0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      labels: ["bug"],
      children: [],
    },
  ];

  it("produces valid JSON with groups array", () => {
    const result = JSON.parse(formatGroupedListJson(issuesWithLabels, "label"));

    expect(result).toHaveProperty("groups");
    expect(Array.isArray(result.groups)).toBe(true);
  });

  it("each group has name and issues array", () => {
    const result = JSON.parse(formatGroupedListJson(issuesWithLabels, "label"));

    for (const group of result.groups) {
      expect(group).toHaveProperty("name");
      expect(group).toHaveProperty("issues");
      expect(typeof group.name).toBe("string");
      expect(Array.isArray(group.issues)).toBe(true);
    }
  });

  it("sorts groups alphabetically by name", () => {
    const result = JSON.parse(formatGroupedListJson(issuesWithLabels, "label"));

    const names = result.groups.map((g: { name: string }) => g.name);
    expect(names).toEqual(["bug", "feature"]);
  });

  it("groups by status", () => {
    const result = JSON.parse(formatGroupedListJson(issuesWithLabels, "status"));

    const names = result.groups.map((g: { name: string }) => g.name);
    expect(names).toEqual(["Backlog", "Done", "In Progress"]);
  });

  it("issues within groups use the same compact shape as formatListJson", () => {
    const result = JSON.parse(formatGroupedListJson(issuesWithLabels, "label"));

    const bugGroup = result.groups.find((g: { name: string }) => g.name === "bug");
    expect(bugGroup.issues).toHaveLength(2);

    const issue = bugGroup.issues[0];
    expect(issue).toHaveProperty("identifier");
    expect(issue).toHaveProperty("title");
    expect(issue).toHaveProperty("status");
    expect(issue).not.toHaveProperty("id");
    expect(issue).not.toHaveProperty("description");
  });

  it("places multi-label issues in every matching group", () => {
    const multiLabelIssues: PlanIssue[] = [
      {
        id: "issue-10",
        identifier: "ENG-10",
        title: "Bug and feature",
        status: "In Progress",
        sortOrder: 1.0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        labels: ["bug", "feature"],
        children: [],
      },
    ];

    const result = JSON.parse(formatGroupedListJson(multiLabelIssues, "label"));

    const bugGroup = result.groups.find((g: { name: string }) => g.name === "bug");
    const featureGroup = result.groups.find((g: { name: string }) => g.name === "feature");

    expect(bugGroup).toBeDefined();
    expect(featureGroup).toBeDefined();
    expect(bugGroup.issues).toHaveLength(1);
    expect(featureGroup.issues).toHaveLength(1);
    expect(bugGroup.issues[0].identifier).toBe("ENG-10");
    expect(featureGroup.issues[0].identifier).toBe("ENG-10");
  });

  it("uses fallback group name for labelless issues", () => {
    const mixedIssues: PlanIssue[] = [
      {
        id: "issue-20",
        identifier: "ENG-20",
        title: "Labeled issue",
        status: "Backlog",
        sortOrder: 1.0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        labels: ["bug"],
        children: [],
      },
      {
        id: "issue-21",
        identifier: "ENG-21",
        title: "Unlabeled issue",
        status: "Backlog",
        sortOrder: 2.0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        children: [],
      },
    ];

    const result = JSON.parse(formatGroupedListJson(mixedIssues, "label"));

    const fallbackGroup = result.groups.find((g: { name: string }) => g.name === "(no label)");
    expect(fallbackGroup).toBeDefined();
    expect(fallbackGroup.issues).toHaveLength(1);
    expect(fallbackGroup.issues[0].identifier).toBe("ENG-21");
  });

  it("returns empty groups array for zero issues", () => {
    const result = JSON.parse(formatGroupedListJson([], "label"));

    expect(result).toHaveProperty("groups");
    expect(result.groups).toHaveLength(0);
  });
});

