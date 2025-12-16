import { describe, expect, it } from "bun:test";
import { formatShowHuman, formatShowJson } from "../src/lib/output";
import type { PlanIssueDetail, PlanComment } from "../src/types";

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
      children: [],
    },
    {
      id: "issue-4",
      identifier: "ENG-23",
      title: "Update imports",
      status: "Backlog",
      sortOrder: 2.2,
      children: [],
    },
  ],
  blockedBy: [],
  blocks: [{ id: "issue-30", identifier: "ENG-30", title: "Deploy new API" }],
};

describe("formatShowHuman", () => {
  it("shows identifier and title as header", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).toContain("ENG-20: Refactor API client");
  });

  it("shows status", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).toContain("Status: Backlog");
  });

  it("shows assignee with @ prefix", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).toContain("Assignee: @nitsan");
  });

  it("shows position", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).toContain("Position: #2");
  });

  it("shows description indented", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).toContain("Description:");
    expect(output).toContain("Break up the monolithic API client");
  });

  it("shows sub-issues section when present", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).toContain("Sub-issues:");
    expect(output).toContain("ENG-21");
    expect(output).toContain("Extract types");
    expect(output).toContain("ENG-23");
    expect(output).toContain("Update imports");
  });

  it("shows blockedBy as (none) when empty", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).toContain("Blocked by: (none)");
  });

  it("shows blocks list when present", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).toContain("Blocks: ENG-30");
  });

  it("handles missing optional fields gracefully", () => {
    const minimalIssue: PlanIssueDetail = {
      id: "issue-1",
      identifier: "ENG-1",
      title: "Simple issue",
      status: "Backlog",
      sortOrder: 1.0,
      position: 1,
      children: [],
      blockedBy: [],
      blocks: [],
    };

    const output = formatShowHuman(minimalIssue);
    expect(output).toContain("ENG-1: Simple issue");
    expect(output).toContain("Assignee: (unassigned)");
    expect(output).not.toContain("Sub-issues:");
  });

  it("shows labels when present", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).toContain("Labels: refactor, tech-debt");
  });

  it("shows project when present", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).toContain("Project: MVP");
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
});

describe("formatShowHuman with comments", () => {
  it("does not show comments section when comments not present", () => {
    const output = formatShowHuman(mockIssue);
    expect(output).not.toContain("Comments");
  });

  it("shows comments section header with count when comments present", () => {
    const issueWithComments = { ...mockIssue, comments: mockComments };
    const output = formatShowHuman(issueWithComments);
    expect(output).toContain("Comments (2):");
  });

  it("shows comment author with @ prefix", () => {
    const issueWithComments = { ...mockIssue, comments: mockComments };
    const output = formatShowHuman(issueWithComments);
    expect(output).toContain("@nitsan");
    expect(output).toContain("@alice");
  });

  it("shows comment body", () => {
    const issueWithComments = { ...mockIssue, comments: mockComments };
    const output = formatShowHuman(issueWithComments);
    expect(output).toContain("This is the first comment");
    expect(output).toContain("A quick follow-up");
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
    expect(output).toContain("(unknown)");
    expect(output).toContain("Anonymous comment");
  });
});
