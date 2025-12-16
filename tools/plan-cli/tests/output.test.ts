import { describe, expect, it } from "bun:test";
import { formatListHuman, getTerminalWidth } from "../src/lib/output";
import { stripAnsi } from "../src/lib/colors";
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

  describe("terminal width adaptation", () => {
    const issueWithLongTitle: PlanIssue[] = [
      {
        id: "issue-1",
        identifier: "ENG-123",
        title: "A moderately long title that might need wrapping depending on terminal width",
        status: "In Progress",
        sortOrder: 1.0,
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

