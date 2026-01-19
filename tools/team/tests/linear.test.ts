import { describe, test, expect, mock, beforeEach } from "bun:test";
import {
  getIssueDetails,
  createSliceIssue,
  updateIssueDescription,
  type LinearDeps,
  type IssueDetails,
} from "../src/linear";

// Mock plan CLI via shell execution
const mockPlanShow = mock(async (issueId: string) => {
  if (issueId === "ENG-100") {
    return {
      exitCode: 0,
      stdout: JSON.stringify({
        id: "ENG-100",
        title: "Feature: User authentication system",
        description: "## Overview\nImplement user auth...",
        status: "In Progress",
      }),
    };
  }
  return { exitCode: 1, stdout: "", stderr: "Issue not found" };
});

const mockPlanCreate = mock(
  async (title: string, options: { parent?: string; description?: string }) => {
    return {
      exitCode: 0,
      stdout: "Created: ENG-101 - " + title,
      issueId: "ENG-101",
    };
  }
);

const mockPlanUpdate = mock(async (issueId: string, description: string) => {
  return {
    exitCode: 0,
    stdout: "Updated: " + issueId,
  };
});

function createTestDeps(): LinearDeps {
  return {
    planShow: mockPlanShow,
    planCreate: mockPlanCreate,
    planUpdate: mockPlanUpdate,
  };
}

beforeEach(() => {
  mockPlanShow.mockClear();
  mockPlanCreate.mockClear();
  mockPlanUpdate.mockClear();
});

describe("getIssueDetails", () => {
  test("fetches issue from Linear via plan CLI", async () => {
    const deps = createTestDeps();
    const issue = await getIssueDetails("ENG-100", deps);

    expect(issue.id).toBe("ENG-100");
    expect(issue.title).toContain("User authentication");
    expect(issue.description).toContain("## Overview");
    expect(mockPlanShow).toHaveBeenCalledWith("ENG-100");
  });

  test("throws error if issue not found", async () => {
    const deps = createTestDeps();

    await expect(getIssueDetails("ENG-999", deps)).rejects.toThrow(
      "Failed to fetch issue"
    );
  });
});

describe("createSliceIssue", () => {
  test("creates sub-issue with parent reference", async () => {
    const deps = createTestDeps();

    const result = await createSliceIssue(
      "ENG-100",
      "Slice 1: Login form UI",
      "## Acceptance Criteria\n- Form renders...",
      deps
    );

    expect(result.issueId).toBe("ENG-101");
    expect(mockPlanCreate).toHaveBeenCalled();

    // Verify it was called with correct arguments
    const call = mockPlanCreate.mock.calls[0];
    expect(call[0]).toBe("Slice 1: Login form UI");
    expect(call[1].parent).toBe("ENG-100");
    expect(call[1].description).toContain("## Acceptance Criteria");
  });

  test("marks slice as independent if specified", async () => {
    const deps = createTestDeps();

    await createSliceIssue(
      "ENG-100",
      "Slice 2: API endpoints",
      "## Acceptance Criteria\n- Endpoints work...",
      deps,
      { independent: true }
    );

    const call = mockPlanCreate.mock.calls[0];
    expect(call[1].description).toContain("**Independent:** Yes");
  });

  test("marks slice as dependent by default", async () => {
    const deps = createTestDeps();

    await createSliceIssue(
      "ENG-100",
      "Slice 3: Integration",
      "## Acceptance Criteria\n- Works end-to-end...",
      deps
    );

    const call = mockPlanCreate.mock.calls[0];
    expect(call[1].description).toContain("**Independent:** No");
  });
});

describe("updateIssueDescription", () => {
  test("updates issue description via plan CLI", async () => {
    const deps = createTestDeps();

    await updateIssueDescription(
      "ENG-100",
      "## Updated Description\nNew content...",
      deps
    );

    expect(mockPlanUpdate).toHaveBeenCalledWith(
      "ENG-100",
      "## Updated Description\nNew content..."
    );
  });

  test("throws error if update fails", async () => {
    const deps = createTestDeps();
    const failingUpdate = mock(async () => ({
      exitCode: 1,
      stderr: "Update failed",
    }));
    deps.planUpdate = failingUpdate;

    await expect(
      updateIssueDescription("ENG-100", "New content", deps)
    ).rejects.toThrow("Failed to update issue");
  });
});
