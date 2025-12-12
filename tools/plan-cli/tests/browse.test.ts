import { describe, expect, it } from "bun:test";
import { formatIssuesForFzf, extractIdentifier } from "../src/commands/browse";
import type { PlanIssue } from "../src/types";

const mockIssues: PlanIssue[] = [
  {
    id: "issue-1",
    identifier: "ENG-12",
    title: "Fix auth redirect",
    status: "In Progress",
    sortOrder: 1.0,
    children: [],
  },
  {
    id: "issue-2",
    identifier: "ENG-20",
    title: "Refactor API client",
    status: "Backlog",
    sortOrder: 2.0,
    children: [],
  },
];

describe("formatIssuesForFzf", () => {
  it("formats issues as tab-separated lines", () => {
    const output = formatIssuesForFzf(mockIssues);
    const lines = output.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("ENG-12");
    expect(lines[0]).toContain("Fix auth redirect");
    expect(lines[0]).toContain("[In Progress]");
  });

  it("includes position numbers", () => {
    const output = formatIssuesForFzf(mockIssues);
    const lines = output.split("\n");

    expect(lines[0]).toMatch(/^\s*1/);
    expect(lines[1]).toMatch(/^\s*2/);
  });
});

describe("extractIdentifier", () => {
  it("extracts identifier from formatted line", () => {
    const line = " 1  ENG-12\tFix auth redirect\t[In Progress]";
    expect(extractIdentifier(line)).toBe("ENG-12");
  });

  it("handles different formats", () => {
    expect(extractIdentifier("12  ABC-999\tSome title\t[Done]")).toBe("ABC-999");
    expect(extractIdentifier(" 5  TEST-1\tTitle\t[Open]")).toBe("TEST-1");
  });

  it("returns null for invalid lines", () => {
    expect(extractIdentifier("invalid")).toBeNull();
    expect(extractIdentifier("")).toBeNull();
  });
});
