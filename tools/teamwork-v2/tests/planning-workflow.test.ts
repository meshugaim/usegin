import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Integration tests for the complete planning workflow.
 *
 * These tests verify the acceptance criteria:
 * 1. `teamwork-v2 plan <spec-id>` runs complete workflow
 * 2. Workspace created with state.json, events.jsonl, progress.md
 * 3. Reviewer agent spawned and manages worker
 * 4. Worker reads spec, proposes slices
 * 5. Review loop operates (revise if feedback provided)
 * 6. Linear sub-issues created with: title, acceptance criteria, dependencies, independence marker
 * 7. Events emitted for all phase transitions
 * 8. Completes within 60 minutes or escalates to human
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-workflow");

interface WorkspaceDeps {
  workspacesDir: string;
}

interface SliceDefinition {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  testApproach: string;
  dependencies: string[];
  isIndependent: boolean;
}

interface PlanningWorkflowConfig {
  specId: string;
  timeoutMinutes: number;
  maxRevisions: number;
}

beforeEach(async () => {
  await rm(TEST_WORKSPACES_DIR, { recursive: true, force: true });
  await mkdir(TEST_WORKSPACES_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_WORKSPACES_DIR, { recursive: true, force: true });
});

function createTestDeps(): WorkspaceDeps {
  return {
    workspacesDir: TEST_WORKSPACES_DIR,
  };
}

// Helper to create test spec content
function createTestSpecContent(): string {
  return `
# ENG-1268: Planning Team Orchestration

## Overview
Implement the planning team workflow for the teamwork-v2 system.

## Requirements
1. Create workspace with state tracking
2. Spawn reviewer agent
3. Worker proposes slices
4. Review and revision loop
5. Create Linear sub-issues

## Acceptance Criteria
- [ ] Workspace created with state.json, events.jsonl, progress.md
- [ ] State machine transitions through phases correctly
- [ ] Events emitted for all actions
- [ ] Linear issues created for approved slices
`;
}

describe("runPlanningWorkflow", () => {
  test("creates workspace files on start", async () => {
    const { runPlanningWorkflow } = await import("../src/workflow");

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-1268",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    // Start workflow but don't wait for completion (mock mode)
    const workflow = await runPlanningWorkflow(config, deps, { dryRun: true });

    // Verify files exist
    const statePath = join(TEST_WORKSPACES_DIR, "ENG-1268", "state.json");
    const eventsPath = join(TEST_WORKSPACES_DIR, "ENG-1268", "events.jsonl");
    const progressPath = join(TEST_WORKSPACES_DIR, "ENG-1268", "progress.md");

    const stateExists = await Bun.file(statePath).exists();
    const eventsExists = await Bun.file(eventsPath).exists();
    const progressExists = await Bun.file(progressPath).exists();

    expect(stateExists).toBe(true);
    expect(eventsExists).toBe(true);
    expect(progressExists).toBe(true);
  });

  test("transitions through setup phase", async () => {
    const { runPlanningWorkflow, readPlanningState } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-100",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, { dryRun: true, stopAfter: "setup" });

    const state = await readPlanningState("ENG-100", deps);
    expect(state.phase).toBe("analyzing");
  });

  test("emits phase_transition events", async () => {
    const { runPlanningWorkflow, readEvents } = await import("../src/workflow");

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-101",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, { dryRun: true, stopAfter: "analyzing" });

    const events = await readEvents("ENG-101", deps);
    const transitionEvents = events.filter(
      (e: { event: string }) => e.event === "phase_transition"
    );

    expect(transitionEvents.length).toBeGreaterThan(0);
    expect(transitionEvents[0].data.to).toBe("analyzing");
  });
});

describe("slice proposal workflow", () => {
  test("worker proposes slices after analyzing", async () => {
    const { runPlanningWorkflow, readSliceProposals } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-200",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    // Mock the worker to return slice proposals
    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "proposing",
      mockSlices: [
        {
          title: "Workspace Creation",
          description: "Create workspace with state files",
          acceptanceCriteria: ["state.json created", "events.jsonl created"],
          testApproach: "Unit tests for file creation",
          dependencies: [],
          isIndependent: true,
        },
        {
          title: "State Machine",
          description: "Implement phase transitions",
          acceptanceCriteria: ["Valid transitions work", "Invalid transitions throw"],
          testApproach: "Unit tests for state machine",
          dependencies: ["Workspace Creation"],
          isIndependent: false,
        },
      ],
    });

    const slices = await readSliceProposals("ENG-200", deps);

    expect(slices.length).toBe(2);
    expect(slices[0].title).toBe("Workspace Creation");
    expect(slices[0].isIndependent).toBe(true);
    expect(slices[1].dependencies).toContain("Workspace Creation");
  });

  test("slices include acceptance criteria", async () => {
    const { runPlanningWorkflow, readSliceProposals } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-201",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "proposing",
      mockSlices: [
        {
          title: "Test Slice",
          description: "A test slice",
          acceptanceCriteria: ["Criterion 1", "Criterion 2", "Criterion 3"],
          testApproach: "Unit and integration tests",
          dependencies: [],
          isIndependent: true,
        },
      ],
    });

    const slices = await readSliceProposals("ENG-201", deps);

    expect(slices[0].acceptanceCriteria).toHaveLength(3);
    expect(slices[0].acceptanceCriteria).toContain("Criterion 1");
  });

  test("slices include test approach", async () => {
    const { runPlanningWorkflow, readSliceProposals } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-202",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "proposing",
      mockSlices: [
        {
          title: "Test Slice",
          description: "A test slice",
          acceptanceCriteria: ["Works"],
          testApproach: "E2E tests with Playwright",
          dependencies: [],
          isIndependent: true,
        },
      ],
    });

    const slices = await readSliceProposals("ENG-202", deps);

    expect(slices[0].testApproach).toContain("E2E");
  });
});

describe("review loop", () => {
  test("reviewer can approve slices", async () => {
    const { runPlanningWorkflow, readPlanningState } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-300",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "approved",
      mockSlices: [{ title: "Slice 1", description: "Test", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true }],
      mockReviewResult: "approved",
    });

    const state = await readPlanningState("ENG-300", deps);
    expect(state.phase).toBe("approved");
  });

  test("reviewer can request revisions", async () => {
    const { runPlanningWorkflow, readPlanningState } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-301",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "reviewing",
      mockSlices: [{ title: "Slice 1", description: "Test", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true }],
      mockReviewResult: "revise",
      mockReviewFeedback: "Slice 1 needs clearer acceptance criteria",
    });

    const state = await readPlanningState("ENG-301", deps);
    expect(state.phase).toBe("proposing"); // Goes back to proposing for revision
    expect(state.revisionCount).toBe(1);
  });

  test("revision count is tracked", async () => {
    const { runPlanningWorkflow, readPlanningState } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-302",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    // Simulate multiple revision cycles
    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "approved",
      mockSlices: [{ title: "Slice 1", description: "Test", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true }],
      mockReviewSequence: ["revise", "revise", "approved"],
    });

    const state = await readPlanningState("ENG-302", deps);
    expect(state.revisionCount).toBe(2);
  });

  test("stops after max revisions and escalates", async () => {
    const { runPlanningWorkflow, readPlanningState, readEvents } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-303",
      timeoutMinutes: 60,
      maxRevisions: 2,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      mockSlices: [{ title: "Slice 1", description: "Test", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true }],
      mockReviewSequence: ["revise", "revise", "revise"], // 3 revisions, but max is 2
    });

    const state = await readPlanningState("ENG-303", deps);
    expect(state.escalated).toBe(true);

    const events = await readEvents("ENG-303", deps);
    const escalationEvent = events.find(
      (e: { event: string }) => e.event === "escalation"
    );
    expect(escalationEvent).toBeDefined();
    expect(escalationEvent?.data.reason).toContain("max revisions");
  });
});

describe("Linear issue creation", () => {
  test("creates issues for approved slices", async () => {
    const { runPlanningWorkflow, readCreatedIssues } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-400",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "creating_issues",
      mockSlices: [
        { title: "Slice 1", description: "First", acceptanceCriteria: ["AC1"], testApproach: "Test", dependencies: [], isIndependent: true },
        { title: "Slice 2", description: "Second", acceptanceCriteria: ["AC2"], testApproach: "Test", dependencies: [], isIndependent: true },
      ],
      mockReviewResult: "approved",
      mockCreatedIssueIds: ["ENG-401", "ENG-402"],
    });

    const issues = await readCreatedIssues("ENG-400", deps);

    expect(issues.length).toBe(2);
    expect(issues[0].issueId).toBe("ENG-401");
    expect(issues[1].issueId).toBe("ENG-402");
  });

  test("issues include title from slice", async () => {
    const { runPlanningWorkflow, readCreatedIssues } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-401",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "creating_issues",
      mockSlices: [
        { title: "Auth UI Components", description: "Build auth UI", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
      ],
      mockReviewResult: "approved",
      mockCreatedIssueIds: ["ENG-402"],
    });

    const issues = await readCreatedIssues("ENG-401", deps);

    expect(issues[0].title).toBe("Auth UI Components");
  });

  test("issues include acceptance criteria", async () => {
    const { runPlanningWorkflow, readCreatedIssues } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-402",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "creating_issues",
      mockSlices: [
        {
          title: "Slice",
          description: "Test",
          acceptanceCriteria: ["Login form renders", "Password validation works"],
          testApproach: "",
          dependencies: [],
          isIndependent: true,
        },
      ],
      mockReviewResult: "approved",
      mockCreatedIssueIds: ["ENG-403"],
    });

    const issues = await readCreatedIssues("ENG-402", deps);

    expect(issues[0].acceptanceCriteria).toContain("Login form renders");
    expect(issues[0].acceptanceCriteria).toContain("Password validation works");
  });

  test("issues include dependencies", async () => {
    const { runPlanningWorkflow, readCreatedIssues } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-403",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "creating_issues",
      mockSlices: [
        { title: "Slice A", description: "First", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
        { title: "Slice B", description: "Second", acceptanceCriteria: [], testApproach: "", dependencies: ["Slice A"], isIndependent: false },
      ],
      mockReviewResult: "approved",
      mockCreatedIssueIds: ["ENG-404", "ENG-405"],
    });

    const issues = await readCreatedIssues("ENG-403", deps);

    expect(issues[1].dependencies).toContain("ENG-404");
  });

  test("issues include independence marker", async () => {
    const { runPlanningWorkflow, readCreatedIssues } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-404",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "creating_issues",
      mockSlices: [
        { title: "Independent Slice", description: "Can be done alone", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
        { title: "Dependent Slice", description: "Needs other", acceptanceCriteria: [], testApproach: "", dependencies: ["Independent Slice"], isIndependent: false },
      ],
      mockReviewResult: "approved",
      mockCreatedIssueIds: ["ENG-405", "ENG-406"],
    });

    const issues = await readCreatedIssues("ENG-404", deps);

    expect(issues[0].isIndependent).toBe(true);
    expect(issues[1].isIndependent).toBe(false);
  });

  test("emits issue_created events", async () => {
    const { runPlanningWorkflow, readEvents } = await import("../src/workflow");

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-405",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "creating_issues",
      mockSlices: [
        { title: "Slice 1", description: "Test", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
        { title: "Slice 2", description: "Test", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
      ],
      mockReviewResult: "approved",
      mockCreatedIssueIds: ["ENG-406", "ENG-407"],
    });

    const events = await readEvents("ENG-405", deps);
    const issueEvents = events.filter(
      (e: { event: string }) => e.event === "issue_created"
    );

    expect(issueEvents.length).toBe(2);
  });
});

describe("timeout and escalation", () => {
  test("escalates after timeout", async () => {
    const { runPlanningWorkflow, readPlanningState, readEvents } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-500",
      timeoutMinutes: 1, // 1 minute timeout for testing
      maxRevisions: 3,
    };

    // Simulate timeout by setting startedAt to past
    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      mockStartedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
    });

    const state = await readPlanningState("ENG-500", deps);
    expect(state.escalated).toBe(true);
    expect(state.escalatedAt).toBeDefined();

    const events = await readEvents("ENG-500", deps);
    const escalationEvent = events.find(
      (e: { event: string }) => e.event === "escalation"
    );
    expect(escalationEvent).toBeDefined();
    expect(escalationEvent?.data.reason).toContain("timeout");
  });

  test("completes within timeout", async () => {
    const { runPlanningWorkflow, readPlanningState } = await import(
      "../src/workflow"
    );

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-501",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "complete",
      mockSlices: [{ title: "Slice 1", description: "Test", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true }],
      mockReviewResult: "approved",
      mockCreatedIssueIds: ["ENG-502"],
    });

    const state = await readPlanningState("ENG-501", deps);
    expect(state.phase).toBe("complete");
    expect(state.completedAt).toBeDefined();
    expect(state.escalated).toBeUndefined();
  });
});

describe("complete workflow", () => {
  test("runs complete happy path", async () => {
    const { runPlanningWorkflow, readPlanningState, readEvents, readCreatedIssues } =
      await import("../src/workflow");

    const deps = createTestDeps();
    const config: PlanningWorkflowConfig = {
      specId: "ENG-600",
      timeoutMinutes: 60,
      maxRevisions: 3,
    };

    await runPlanningWorkflow(config, deps, {
      dryRun: true,
      mockSlices: [
        { title: "Slice 1", description: "First slice", acceptanceCriteria: ["AC1"], testApproach: "Unit tests", dependencies: [], isIndependent: true },
        { title: "Slice 2", description: "Second slice", acceptanceCriteria: ["AC2"], testApproach: "Integration tests", dependencies: ["Slice 1"], isIndependent: false },
      ],
      mockReviewResult: "approved",
      mockCreatedIssueIds: ["ENG-601", "ENG-602"],
    });

    // Verify final state
    const state = await readPlanningState("ENG-600", deps);
    expect(state.phase).toBe("complete");
    expect(state.completedAt).toBeDefined();

    // Verify events cover all phases
    const events = await readEvents("ENG-600", deps);
    const phases = events
      .filter((e) => e.event === "phase_transition")
      .map((e) => (e.data as { to: string }).to);

    expect(phases).toContain("analyzing");
    expect(phases).toContain("proposing");
    expect(phases).toContain("reviewing");
    expect(phases).toContain("approved");
    expect(phases).toContain("creating_issues");
    expect(phases).toContain("complete");

    // Verify issues created
    const issues = await readCreatedIssues("ENG-600", deps);
    expect(issues.length).toBe(2);
  });
});
