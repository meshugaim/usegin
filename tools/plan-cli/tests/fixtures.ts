import type { PlanIssue, PlanIssueDetail } from "../src/types";

const DEFAULT_TIMESTAMP = "2026-01-01T00:00:00.000Z";

export function makeIssue(overrides: Partial<PlanIssue> & Pick<PlanIssue, "id" | "identifier" | "title" | "status" | "sortOrder">): PlanIssue {
  return {
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
    children: [],
    ...overrides,
  };
}

export function makeIssueDetail(
  overrides: Partial<PlanIssueDetail> &
    Pick<PlanIssueDetail, "id" | "identifier" | "title" | "status" | "sortOrder" | "url" | "position">,
): PlanIssueDetail {
  return {
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
    children: [],
    blockedBy: [],
    blocks: [],
    ...overrides,
  };
}
