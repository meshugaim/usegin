import { describe, expect, it } from "bun:test";
import { formatShowHuman, formatShowJson, formatHistoryHuman } from "../src/lib/output";
import type { PlanIssueDetail, PlanComment, IssueHistoryEntry } from "../src/types";
import type { IssueTreeContext } from "../src/lib/output/tree";
import { createShowCommand } from "../src/commands/show";

// Helper to strip ANSI color codes from output for testing
function stripAnsi(str: string): string {
  return str.replace(/\u001B\[[0-9;]*m/g, "");
}

const mockComments: PlanComment[] = [
  {
    id: "comment-1",
    body: "This is the first comment.\nIt has multiple lines.",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    user: { id: "user-1", name: "nitsan", displayName: "Nitsan" },
  },
  {
    id: "comment-2",
    body: "A quick follow-up",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    user: { id: "user-2", name: "alice", displayName: "Alice" },
  },
];

const mockIssue: PlanIssueDetail = {
  id: "issue-2",
  identifier: "ENG-20",
  title: "Refactor API client",
  description: "Break up the monolithic API client into smaller modules.",
  status: "Backlog",
  sortOrder: 2.0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  url: "https://linear.app/team/issue/ENG-20",
  position: 2,
  assignee: { id: "user-1", name: "nitsan", displayName: "Nitsan" },
  labels: ["refactor", "tech-debt"],
  project: "MVP",
  children: [
    {
      id: "issue-3",
      identifier: "ENG-21",
      title: "Extract types",
      status: "Backlog",
      sortOrder: 2.1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      children: [],
    },
    {
      id: "issue-4",
      identifier: "ENG-23",
      title: "Update imports",
      status: "Backlog",
      sortOrder: 2.2,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      children: [],
    },
  ],
  blockedBy: [],
  blocks: [{ id: "issue-30", identifier: "ENG-30", title: "Deploy new API" }],
};

describe("formatShowHuman", () => {
  it("shows identifier and title as header", () => {
    const output = formatShowHuman(mockIssue);
    expect(stripAnsi(output)).toContain("ENG-20: Refactor API client");
  });

  it("shows status", () => {
    const output = formatShowHuman(mockIssue);
    expect(stripAnsi(output)).toContain("Status: Backlog");
  });

  it("shows assignee with @ prefix", () => {
    const output = formatShowHuman(mockIssue);
    expect(stripAnsi(output)).toContain("Assignee: @nitsan");
  });

  it("shows position", () => {
    const output = formatShowHuman(mockIssue);
    expect(stripAnsi(output)).toContain("Position: #2");
  });

  it("shows description indented", () => {
    const output = formatShowHuman(mockIssue);
    expect(stripAnsi(output)).toContain("Description:");
    expect(stripAnsi(output)).toContain("Break up the monolithic API client");
  });

  it("shows sub-issues section when present", () => {
    const output = formatShowHuman(mockIssue);
    expect(stripAnsi(output)).toContain("Sub-issues:");
    expect(stripAnsi(output)).toContain("ENG-21");
    expect(stripAnsi(output)).toContain("Extract types");
    expect(stripAnsi(output)).toContain("ENG-23");
    expect(stripAnsi(output)).toContain("Update imports");
  });

  it("shows blockedBy as (none) when empty", () => {
    const output = formatShowHuman(mockIssue);
    expect(stripAnsi(output)).toContain("Blocked by: (none)");
  });

  it("shows blocks list when present", () => {
    const output = formatShowHuman(mockIssue);
    expect(stripAnsi(output)).toContain("Blocks: ENG-30");
  });

  it("handles missing optional fields gracefully", () => {
    const minimalIssue: PlanIssueDetail = {
      id: "issue-1",
      identifier: "ENG-1",
      title: "Simple issue",
      status: "Backlog",
      sortOrder: 1.0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      url: "https://linear.app/askeffi/issue/ENG-1",
      position: 1,
      children: [],
      blockedBy: [],
      blocks: [],
    };

    const output = formatShowHuman(minimalIssue);
    expect(stripAnsi(output)).toContain("ENG-1: Simple issue");
    expect(stripAnsi(output)).toContain("Assignee: (unassigned)");
    expect(output).not.toContain("Sub-issues:");
  });

  it("shows labels when present", () => {
    const output = formatShowHuman(mockIssue);
    expect(stripAnsi(output)).toContain("Labels: refactor, tech-debt");
  });

  it("shows project when present", () => {
    const output = formatShowHuman(mockIssue);
    expect(stripAnsi(output)).toContain("Project: MVP");
  });

  it("renders markdown in description (removes markdown markers)", () => {
    const issueWithMarkdown: PlanIssueDetail = {
      ...mockIssue,
      description: "## Header\n\nThis has `inline code` and **bold** text.",
    };
    const output = formatShowHuman(issueWithMarkdown);
    // Should contain the text
    expect(stripAnsi(output)).toContain("Header");
    expect(stripAnsi(output)).toContain("inline code");
    expect(stripAnsi(output)).toContain("bold");
    // Markdown markers should be removed by the renderer
    expect(output).not.toContain("##");
    expect(output).not.toContain("**");
  });
});

describe("formatShowJson", () => {
  it("returns valid JSON", () => {
    const output = formatShowJson(mockIssue);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("includes all core fields", () => {
    const output = formatShowJson(mockIssue);
    const parsed = JSON.parse(output);

    expect(parsed.id).toBe("issue-2");
    expect(parsed.identifier).toBe("ENG-20");
    expect(parsed.title).toBe("Refactor API client");
    expect(parsed.status).toBe("Backlog");
    expect(parsed.position).toBe(2);
  });

  it("includes relationships", () => {
    const output = formatShowJson(mockIssue);
    const parsed = JSON.parse(output);

    expect(parsed.blockedBy).toEqual([]);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0].identifier).toBe("ENG-30");
  });

  it("includes children", () => {
    const output = formatShowJson(mockIssue);
    const parsed = JSON.parse(output);

    expect(parsed.children).toHaveLength(2);
    expect(parsed.children[0].identifier).toBe("ENG-21");
  });

  it("includes assignee when present", () => {
    const output = formatShowJson(mockIssue);
    const parsed = JSON.parse(output);

    expect(parsed.assignee.name).toBe("nitsan");
    expect(parsed.assignee.displayName).toBe("Nitsan");
  });

  it("excludes comments when not present", () => {
    const output = formatShowJson(mockIssue);
    const parsed = JSON.parse(output);

    expect(parsed.comments).toBeUndefined();
  });

  it("includes comments when present", () => {
    const issueWithComments = { ...mockIssue, comments: mockComments };
    const output = formatShowJson(issueWithComments);
    const parsed = JSON.parse(output);

    expect(parsed.comments).toHaveLength(2);
    expect(parsed.comments[0].id).toBe("comment-1");
    expect(parsed.comments[0].body).toContain("first comment");
    expect(parsed.comments[0].user.name).toBe("nitsan");
  });

  it("includes history when provided", () => {
    const history: IssueHistoryEntry[] = [
      {
        id: "h1",
        createdAt: new Date().toISOString(),
        actor: { name: "user@test.com", displayName: "Test User" },
        fromState: "Backlog",
        toState: "In Progress",
      },
    ];
    const output = formatShowJson(mockIssue, history);
    const parsed = JSON.parse(output);

    expect(parsed.history).toBeDefined();
    expect(parsed.history).toHaveLength(1);
    expect(parsed.history[0].fromState).toBe("Backlog");
  });

  it("omits history when not provided", () => {
    const output = formatShowJson(mockIssue);
    const parsed = JSON.parse(output);

    expect(parsed.history).toBeUndefined();
  });
});

describe("formatShowHuman with comments", () => {
  it("does not show comments section when comments not present", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).not.toContain("Comments");
  });

  it("shows comments section header with count when comments present", () => {
    const issueWithComments = { ...mockIssue, comments: mockComments };
    const output = formatShowHuman(issueWithComments);
    expect(stripAnsi(output)).toContain("Comments (2):");
  });

  it("shows comment author with @ prefix", () => {
    const issueWithComments = { ...mockIssue, comments: mockComments };
    const output = formatShowHuman(issueWithComments);
    expect(stripAnsi(output)).toContain("@nitsan");
    expect(stripAnsi(output)).toContain("@alice");
  });

  it("shows comment body", () => {
    const issueWithComments = { ...mockIssue, comments: mockComments };
    const output = formatShowHuman(issueWithComments);
    expect(stripAnsi(output)).toContain("This is the first comment");
    expect(stripAnsi(output)).toContain("A quick follow-up");
  });

  it("shows relative time for comments", () => {
    const issueWithComments = { ...mockIssue, comments: mockComments };
    const output = formatShowHuman(issueWithComments);
    // Should contain relative timestamps like "30m ago" or "2h ago"
    expect(output).toMatch(/\d+[mh] ago/);
  });

  it("handles comments without user gracefully", () => {
    const commentWithoutUser: PlanComment = {
      id: "comment-3",
      body: "Anonymous comment",
      createdAt: new Date().toISOString(),
    };
    const issueWithComment = { ...mockIssue, comments: [commentWithoutUser] };
    const output = formatShowHuman(issueWithComment);
    expect(stripAnsi(output)).toContain("(unknown)");
    expect(stripAnsi(output)).toContain("Anonymous comment");
  });

  it("renders markdown in comment body (removes markdown markers)", () => {
    const commentWithMarkdown: PlanComment = {
      id: "comment-md",
      body: "Check `this code` and **important** note.",
      createdAt: new Date().toISOString(),
      user: { id: "user-1", name: "test", displayName: "Test" },
    };
    const issueWithComment = { ...mockIssue, comments: [commentWithMarkdown] };
    const output = formatShowHuman(issueWithComment);
    // Should contain the text
    expect(stripAnsi(output)).toContain("this code");
    expect(stripAnsi(output)).toContain("important");
    // Markdown markers should be removed by the renderer
    expect(output).not.toContain("**");
  });
});

describe("formatShowHuman with comment count hint", () => {
  it("shows comment count with hint when commentCount > 0 and comments not loaded", () => {
    const issueWithCommentCount = { ...mockIssue, commentCount: 3 };
    const output = formatShowHuman(issueWithCommentCount);
    expect(stripAnsi(output)).toContain("Comments:");
    expect(stripAnsi(output)).toContain("3 comments");
    expect(stripAnsi(output)).toContain("(use --comments to view)");
  });

  it("shows singular form for 1 comment", () => {
    const issueWithOneComment = { ...mockIssue, commentCount: 1 };
    const output = formatShowHuman(issueWithOneComment);
    expect(stripAnsi(output)).toContain("1 comment");
    expect(output).not.toContain("1 comments");
  });

  it("does not show comment hint when commentCount is 0", () => {
    const issueWithNoComments = { ...mockIssue, commentCount: 0 };
    const output = formatShowHuman(issueWithNoComments);
    expect(output).not.toContain("Comments:");
    expect(output).not.toContain("use --comments to view");
  });

  it("does not show comment hint when commentCount is undefined", () => {
    const issueWithoutCommentCount = { ...mockIssue };
    delete (issueWithoutCommentCount as Partial<typeof mockIssue>).commentCount;
    const output = formatShowHuman(issueWithoutCommentCount);
    expect(output).not.toContain("use --comments to view");
  });

  it("shows full comments instead of hint when comments are loaded", () => {
    const issueWithBothCommentsAndCount = {
      ...mockIssue,
      comments: mockComments,
      commentCount: 2,
    };
    const output = formatShowHuman(issueWithBothCommentsAndCount);
    // Should show full comments, not the hint
    expect(stripAnsi(output)).toContain("Comments (2):");
    expect(stripAnsi(output)).toContain("@nitsan");
    expect(output).not.toContain("use --comments to view");
  });
});

describe("formatShowJson with commentCount", () => {
  it("includes commentCount in JSON output", () => {
    const issueWithCommentCount = { ...mockIssue, commentCount: 5 };
    const output = formatShowJson(issueWithCommentCount);
    const parsed = JSON.parse(output);
    expect(parsed.commentCount).toBe(5);
  });

  it("includes commentCount as 0 when no comments", () => {
    const issueWithZeroComments = { ...mockIssue, commentCount: 0 };
    const output = formatShowJson(issueWithZeroComments);
    const parsed = JSON.parse(output);
    expect(parsed.commentCount).toBe(0);
  });

  it("includes commentCount as undefined when not set", () => {
    const issueWithoutCommentCount = { ...mockIssue };
    const output = formatShowJson(issueWithoutCommentCount);
    const parsed = JSON.parse(output);
    expect(parsed.commentCount).toBeUndefined();
  });
});

describe("formatHistoryHuman", () => {
  it("shows (no history) for empty array", () => {
    const output = formatHistoryHuman([]);
    expect(stripAnsi(output)).toContain("(no history)");
  });

  it("shows status changes", () => {
    const history: IssueHistoryEntry[] = [
      {
        id: "h1",
        createdAt: new Date().toISOString(),
        actor: { name: "user@test.com", displayName: "Test User" },
        fromState: "Backlog",
        toState: "In Progress",
      },
    ];
    const output = formatHistoryHuman(history);
    expect(stripAnsi(output)).toContain("@Test User");
    expect(stripAnsi(output)).toContain("Backlog");
    expect(stripAnsi(output)).toContain("In Progress");
  });

  it("shows assignment changes", () => {
    const history: IssueHistoryEntry[] = [
      {
        id: "h1",
        createdAt: new Date().toISOString(),
        actor: { name: "admin@test.com", displayName: "Admin" },
        toAssignee: "Developer",
      },
    ];
    const output = formatHistoryHuman(history);
    expect(stripAnsi(output)).toContain("Assigned to @Developer");
  });

  it("shows title changes", () => {
    const history: IssueHistoryEntry[] = [
      {
        id: "h1",
        createdAt: new Date().toISOString(),
        actor: { name: "admin@test.com", displayName: "Admin" },
        fromTitle: "Old title",
        toTitle: "New title",
      },
    ];
    const output = formatHistoryHuman(history);
    expect(stripAnsi(output)).toContain('Title changed: "Old title" → "New title"');
  });

  it("shows (no meaningful changes recorded) for entries with no tracked changes", () => {
    const history: IssueHistoryEntry[] = [
      {
        id: "h1",
        createdAt: new Date().toISOString(),
        actor: { name: "admin@test.com", displayName: "Admin" },
        // No actual changes tracked
      },
    ];
    const output = formatHistoryHuman(history);
    expect(stripAnsi(output)).toContain("(no meaningful changes recorded)");
  });
});

describe("--tree default behavior (Commander parsing)", () => {
  it("defaults --tree to true when no flag is provided", () => {
    const cmd = createShowCommand();
    // Parse with no --tree or --no-tree flag
    cmd.exitOverride(); // prevent process.exit on parse errors
    cmd.action(() => {}); // override action to prevent execution
    cmd.parse(["node", "plan", "ENG-123"], { from: "user" });
    const opts = cmd.opts();
    expect(opts.tree).toBe(true);
  });

  it("sets tree to false when --no-tree is provided", () => {
    const cmd = createShowCommand();
    cmd.exitOverride();
    cmd.action(() => {});
    cmd.parse(["node", "plan", "ENG-123", "--no-tree"], { from: "user" });
    const opts = cmd.opts();
    expect(opts.tree).toBe(false);
  });

  it("keeps tree as true when --tree is explicitly provided", () => {
    const cmd = createShowCommand();
    cmd.exitOverride();
    cmd.action(() => {});
    cmd.parse(["node", "plan", "ENG-123", "--tree"], { from: "user" });
    const opts = cmd.opts();
    expect(opts.tree).toBe(true);
  });
});

describe("formatShowJson with treeContext", () => {
  const treeContext: IssueTreeContext = {
    parent: { identifier: "ENG-10", title: "Parent issue" },
    siblings: [
      { identifier: "ENG-20", title: "Refactor API client", id: "issue-2" },
      { identifier: "ENG-22", title: "Sibling issue", id: "issue-5" },
    ],
    children: [
      { identifier: "ENG-21", title: "Extract types" },
      { identifier: "ENG-23", title: "Update imports" },
    ],
    currentIssueId: "issue-2",
  };

  it("includes treeContext in JSON output when provided", () => {
    const output = formatShowJson(mockIssue, undefined, treeContext);
    const parsed = JSON.parse(output);

    expect(parsed.treeContext).toBeDefined();
    expect(parsed.treeContext.parent.identifier).toBe("ENG-10");
    expect(parsed.treeContext.siblings).toHaveLength(2);
    expect(parsed.treeContext.children).toHaveLength(2);
    expect(parsed.treeContext.currentIssueId).toBe("issue-2");
  });

  it("omits treeContext from JSON output when not provided", () => {
    const output = formatShowJson(mockIssue);
    const parsed = JSON.parse(output);

    expect(parsed.treeContext).toBeUndefined();
  });
});
