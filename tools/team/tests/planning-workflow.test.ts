import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdir, rm, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Tests for planning workflow phase transitions and timeout/escalation.
 *
 * These tests cover GAPS in the current implementation:
 * 1. Comprehensive phase transition events for all planning phases
 * 2. Timeout tracking and escalation
 *
 * All tests are expected to FAIL initially - no implementation exists yet.
 */

const TEST_TEAMS_DIR = join(tmpdir(), "team-test-planning-workflow");

// Helper to create test workspace with state
async function createTestWorkspace(
  issueId: string,
  stateOverrides: Record<string, unknown> = {}
): Promise<string> {
  const workspacePath = join(TEST_TEAMS_DIR, issueId);
  await mkdir(workspacePath, { recursive: true });
  await mkdir(join(workspacePath, "sessions"), { recursive: true });

  const now = new Date().toISOString();
  const state = {
    type: "plan",
    issueId,
    phase: "analysis",
    createdAt: now,
    updatedAt: now,
    ...stateOverrides,
  };

  await writeFile(
    join(workspacePath, "state.json"),
    JSON.stringify(state, null, 2)
  );
  await writeFile(join(workspacePath, "events.jsonl"), "");

  return workspacePath;
}

// Helper to read events from events.jsonl
async function readEvents(
  workspacePath: string
): Promise<Array<{ event: string; data: Record<string, unknown> }>> {
  const content = await readFile(join(workspacePath, "events.jsonl"), "utf-8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

beforeEach(async () => {
  await rm(TEST_TEAMS_DIR, { recursive: true, force: true });
  await mkdir(TEST_TEAMS_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_TEAMS_DIR, { recursive: true, force: true });
});

// =============================================================================
// Phase Transition Events
// =============================================================================

describe("phase transition events", () => {
  describe("analysis_start event", () => {
    test("emitPhaseEvent emits analysis_start when worker begins analyzing", async () => {
      const workspacePath = await createTestWorkspace("ENG-100");

      // Import the function that should emit phase events
      // This function doesn't exist yet - test should fail
      const { emitPhaseEvent } = await import("../src/planning-workflow");

      await emitPhaseEvent("ENG-100", "analysis_start", {
        workerId: "worker-123",
      }, { teamsDir: TEST_TEAMS_DIR });

      const events = await readEvents(workspacePath);
      const analysisEvent = events.find((e) => e.event === "analysis_start");

      expect(analysisEvent).toBeDefined();
      expect(analysisEvent?.data.workerId).toBe("worker-123");
    });

    test("analysis_start event includes timestamp", async () => {
      const workspacePath = await createTestWorkspace("ENG-101");

      const { emitPhaseEvent } = await import("../src/planning-workflow");

      const before = Date.now();
      await emitPhaseEvent("ENG-101", "analysis_start", {
        workerId: "worker-456",
      }, { teamsDir: TEST_TEAMS_DIR });
      const after = Date.now();

      const events = await readEvents(workspacePath);
      const analysisEvent = events.find((e) => e.event === "analysis_start");

      expect(analysisEvent).toBeDefined();
      const eventTime = new Date((analysisEvent as any).timestamp).getTime();
      expect(eventTime).toBeGreaterThanOrEqual(before);
      expect(eventTime).toBeLessThanOrEqual(after);
    });
  });

  describe("slices_proposed event", () => {
    test("emitPhaseEvent emits slices_proposed when worker returns proposals", async () => {
      const workspacePath = await createTestWorkspace("ENG-200");

      const { emitPhaseEvent } = await import("../src/planning-workflow");

      await emitPhaseEvent("ENG-200", "slices_proposed", {
        sliceCount: 3,
        slices: ["Slice 1: Auth UI", "Slice 2: API", "Slice 3: Integration"],
      }, { teamsDir: TEST_TEAMS_DIR });

      const events = await readEvents(workspacePath);
      const proposedEvent = events.find((e) => e.event === "slices_proposed");

      expect(proposedEvent).toBeDefined();
      expect(proposedEvent?.data.sliceCount).toBe(3);
      expect(proposedEvent?.data.slices).toHaveLength(3);
    });

    test("slices_proposed updates phase to 'proposed'", async () => {
      const workspacePath = await createTestWorkspace("ENG-201");

      const { emitPhaseEvent, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      await emitPhaseEvent("ENG-201", "slices_proposed", {
        sliceCount: 2,
      }, { teamsDir: TEST_TEAMS_DIR });

      const state = await readPlanningState("ENG-201", { teamsDir: TEST_TEAMS_DIR });
      expect(state.phase).toBe("proposed");
    });
  });

  describe("review_start event", () => {
    test("emitPhaseEvent emits review_start when reviewer begins", async () => {
      const workspacePath = await createTestWorkspace("ENG-300", {
        phase: "proposed",
      });

      const { emitPhaseEvent } = await import("../src/planning-workflow");

      await emitPhaseEvent("ENG-300", "review_start", {
        reviewerId: "reviewer-789",
      }, { teamsDir: TEST_TEAMS_DIR });

      const events = await readEvents(workspacePath);
      const reviewEvent = events.find((e) => e.event === "review_start");

      expect(reviewEvent).toBeDefined();
      expect(reviewEvent?.data.reviewerId).toBe("reviewer-789");
    });

    test("review_start updates phase to 'reviewing'", async () => {
      const workspacePath = await createTestWorkspace("ENG-301", {
        phase: "proposed",
      });

      const { emitPhaseEvent, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      await emitPhaseEvent("ENG-301", "review_start", {
        reviewerId: "reviewer-001",
      }, { teamsDir: TEST_TEAMS_DIR });

      const state = await readPlanningState("ENG-301", { teamsDir: TEST_TEAMS_DIR });
      expect(state.phase).toBe("reviewing");
    });
  });

  describe("review_feedback event", () => {
    test("emitPhaseEvent emits review_feedback when reviewer provides feedback", async () => {
      const workspacePath = await createTestWorkspace("ENG-400", {
        phase: "reviewing",
      });

      const { emitPhaseEvent } = await import("../src/planning-workflow");

      await emitPhaseEvent("ENG-400", "review_feedback", {
        feedbackType: "revision_requested",
        feedbackSummary: "Slice 2 needs clearer acceptance criteria",
      }, { teamsDir: TEST_TEAMS_DIR });

      const events = await readEvents(workspacePath);
      const feedbackEvent = events.find((e) => e.event === "review_feedback");

      expect(feedbackEvent).toBeDefined();
      expect(feedbackEvent?.data.feedbackType).toBe("revision_requested");
      expect(feedbackEvent?.data.feedbackSummary).toContain("Slice 2");
    });

    test("review_feedback with revision_requested updates phase to 'revising'", async () => {
      const workspacePath = await createTestWorkspace("ENG-401", {
        phase: "reviewing",
      });

      const { emitPhaseEvent, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      await emitPhaseEvent("ENG-401", "review_feedback", {
        feedbackType: "revision_requested",
      }, { teamsDir: TEST_TEAMS_DIR });

      const state = await readPlanningState("ENG-401", { teamsDir: TEST_TEAMS_DIR });
      expect(state.phase).toBe("revising");
    });

    test("review_feedback increments revision count", async () => {
      const workspacePath = await createTestWorkspace("ENG-402", {
        phase: "reviewing",
        revisionCount: 0,
      });

      const { emitPhaseEvent, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      await emitPhaseEvent("ENG-402", "review_feedback", {
        feedbackType: "revision_requested",
      }, { teamsDir: TEST_TEAMS_DIR });

      const state = await readPlanningState("ENG-402", { teamsDir: TEST_TEAMS_DIR });
      expect(state.revisionCount).toBe(1);
    });
  });

  describe("review_approved event", () => {
    test("emitPhaseEvent emits review_approved when slices are approved", async () => {
      const workspacePath = await createTestWorkspace("ENG-500", {
        phase: "reviewing",
      });

      const { emitPhaseEvent } = await import("../src/planning-workflow");

      await emitPhaseEvent("ENG-500", "review_approved", {
        approvedSliceCount: 4,
      }, { teamsDir: TEST_TEAMS_DIR });

      const events = await readEvents(workspacePath);
      const approvedEvent = events.find((e) => e.event === "review_approved");

      expect(approvedEvent).toBeDefined();
      expect(approvedEvent?.data.approvedSliceCount).toBe(4);
    });

    test("review_approved updates phase to 'approved'", async () => {
      const workspacePath = await createTestWorkspace("ENG-501", {
        phase: "reviewing",
      });

      const { emitPhaseEvent, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      await emitPhaseEvent("ENG-501", "review_approved", {
        approvedSliceCount: 3,
      }, { teamsDir: TEST_TEAMS_DIR });

      const state = await readPlanningState("ENG-501", { teamsDir: TEST_TEAMS_DIR });
      expect(state.phase).toBe("approved");
    });
  });

  describe("creating_issues event", () => {
    test("emitPhaseEvent emits creating_issues when Linear issues are being created", async () => {
      const workspacePath = await createTestWorkspace("ENG-600", {
        phase: "approved",
      });

      const { emitPhaseEvent } = await import("../src/planning-workflow");

      await emitPhaseEvent("ENG-600", "creating_issues", {
        totalSlices: 5,
      }, { teamsDir: TEST_TEAMS_DIR });

      const events = await readEvents(workspacePath);
      const creatingEvent = events.find((e) => e.event === "creating_issues");

      expect(creatingEvent).toBeDefined();
      expect(creatingEvent?.data.totalSlices).toBe(5);
    });

    test("creating_issues updates phase to 'creating_issues'", async () => {
      const workspacePath = await createTestWorkspace("ENG-601", {
        phase: "approved",
      });

      const { emitPhaseEvent, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      await emitPhaseEvent("ENG-601", "creating_issues", {
        totalSlices: 4,
      }, { teamsDir: TEST_TEAMS_DIR });

      const state = await readPlanningState("ENG-601", { teamsDir: TEST_TEAMS_DIR });
      expect(state.phase).toBe("creating_issues");
    });
  });

  describe("planning_complete event", () => {
    test("emitPhaseEvent emits planning_complete when planning is done", async () => {
      const workspacePath = await createTestWorkspace("ENG-700", {
        phase: "creating_issues",
      });

      const { emitPhaseEvent } = await import("../src/planning-workflow");

      await emitPhaseEvent("ENG-700", "planning_complete", {
        createdIssues: ["ENG-701", "ENG-702", "ENG-703"],
        totalIssues: 3,
      }, { teamsDir: TEST_TEAMS_DIR });

      const events = await readEvents(workspacePath);
      const completeEvent = events.find((e) => e.event === "planning_complete");

      expect(completeEvent).toBeDefined();
      expect(completeEvent?.data.createdIssues).toHaveLength(3);
      expect(completeEvent?.data.totalIssues).toBe(3);
    });

    test("planning_complete updates phase to 'complete'", async () => {
      const workspacePath = await createTestWorkspace("ENG-701", {
        phase: "creating_issues",
      });

      const { emitPhaseEvent, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      await emitPhaseEvent("ENG-701", "planning_complete", {
        createdIssues: ["ENG-702"],
        totalIssues: 1,
      }, { teamsDir: TEST_TEAMS_DIR });

      const state = await readPlanningState("ENG-701", { teamsDir: TEST_TEAMS_DIR });
      expect(state.phase).toBe("complete");
    });

    test("planning_complete records completion timestamp", async () => {
      const workspacePath = await createTestWorkspace("ENG-702", {
        phase: "creating_issues",
      });

      const { emitPhaseEvent, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      const before = new Date().toISOString();
      await emitPhaseEvent("ENG-702", "planning_complete", {
        createdIssues: [],
        totalIssues: 0,
      }, { teamsDir: TEST_TEAMS_DIR });
      const after = new Date().toISOString();

      const state = await readPlanningState("ENG-702", { teamsDir: TEST_TEAMS_DIR });
      expect(state.completedAt).toBeDefined();
      expect(state.completedAt! >= before).toBe(true);
      expect(state.completedAt! <= after).toBe(true);
    });
  });
});

// =============================================================================
// Timeout and Escalation
// =============================================================================

describe("timeout and escalation", () => {
  describe("startedAt tracking", () => {
    test("planning state includes startedAt timestamp", async () => {
      const workspacePath = await createTestWorkspace("ENG-800");

      const { readPlanningState, initializePlanningState } = await import(
        "../src/planning-workflow"
      );

      await initializePlanningState("ENG-800", { teamsDir: TEST_TEAMS_DIR });

      const state = await readPlanningState("ENG-800", { teamsDir: TEST_TEAMS_DIR });
      expect(state.startedAt).toBeDefined();
      expect(new Date(state.startedAt!).getTime()).toBeGreaterThan(0);
    });

    test("startedAt is set when analysis_start event is emitted", async () => {
      const workspacePath = await createTestWorkspace("ENG-801");

      const { emitPhaseEvent, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      const before = new Date().toISOString();
      await emitPhaseEvent("ENG-801", "analysis_start", {
        workerId: "worker-123",
      }, { teamsDir: TEST_TEAMS_DIR });
      const after = new Date().toISOString();

      const state = await readPlanningState("ENG-801", { teamsDir: TEST_TEAMS_DIR });
      expect(state.startedAt).toBeDefined();
      expect(state.startedAt! >= before).toBe(true);
      expect(state.startedAt! <= after).toBe(true);
    });
  });

  describe("timeout check function", () => {
    test("isPlanningTimedOut returns false for recent planning", async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // 30 minutes ago
      await createTestWorkspace("ENG-900", { startedAt });

      const { isPlanningTimedOut } = await import("../src/planning-workflow");

      const isTimedOut = await isPlanningTimedOut("ENG-900", { teamsDir: TEST_TEAMS_DIR });
      expect(isTimedOut).toBe(false);
    });

    test("isPlanningTimedOut returns true after 60 minutes", async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 61 * 60 * 1000).toISOString(); // 61 minutes ago
      await createTestWorkspace("ENG-901", { startedAt });

      const { isPlanningTimedOut } = await import("../src/planning-workflow");

      const isTimedOut = await isPlanningTimedOut("ENG-901", { teamsDir: TEST_TEAMS_DIR });
      expect(isTimedOut).toBe(true);
    });

    test("isPlanningTimedOut returns false for completed planning", async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 120 * 60 * 1000).toISOString(); // 2 hours ago
      await createTestWorkspace("ENG-902", {
        startedAt,
        phase: "complete",
        completedAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
      });

      const { isPlanningTimedOut } = await import("../src/planning-workflow");

      const isTimedOut = await isPlanningTimedOut("ENG-902", { teamsDir: TEST_TEAMS_DIR });
      expect(isTimedOut).toBe(false);
    });

    test("isPlanningTimedOut accepts custom timeout in minutes", async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 45 * 60 * 1000).toISOString(); // 45 minutes ago
      await createTestWorkspace("ENG-903", { startedAt });

      const { isPlanningTimedOut } = await import("../src/planning-workflow");

      // Default 60 minute timeout - should not be timed out
      const notTimedOut = await isPlanningTimedOut("ENG-903", { teamsDir: TEST_TEAMS_DIR });
      expect(notTimedOut).toBe(false);

      // Custom 30 minute timeout - should be timed out
      const timedOut = await isPlanningTimedOut("ENG-903", {
        teamsDir: TEST_TEAMS_DIR,
        timeoutMinutes: 30,
      });
      expect(timedOut).toBe(true);
    });
  });

  describe("escalation event", () => {
    test("emitEscalation emits timeout_escalation event", async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 65 * 60 * 1000).toISOString();
      const workspacePath = await createTestWorkspace("ENG-1000", {
        startedAt,
        phase: "reviewing",
      });

      const { emitEscalation } = await import("../src/planning-workflow");

      await emitEscalation("ENG-1000", {
        reason: "Planning exceeded 60 minute timeout",
        currentPhase: "reviewing",
        elapsedMinutes: 65,
      }, { teamsDir: TEST_TEAMS_DIR });

      const events = await readEvents(workspacePath);
      const escalationEvent = events.find(
        (e) => e.event === "timeout_escalation"
      );

      expect(escalationEvent).toBeDefined();
      expect(escalationEvent?.data.reason).toContain("60 minute timeout");
      expect(escalationEvent?.data.currentPhase).toBe("reviewing");
      expect(escalationEvent?.data.elapsedMinutes).toBe(65);
    });

    test("emitEscalation sets escalated flag in state", async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 70 * 60 * 1000).toISOString();
      await createTestWorkspace("ENG-1001", {
        startedAt,
        phase: "analysis",
      });

      const { emitEscalation, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      await emitEscalation("ENG-1001", {
        reason: "Timeout",
        currentPhase: "analysis",
        elapsedMinutes: 70,
      }, { teamsDir: TEST_TEAMS_DIR });

      const state = await readPlanningState("ENG-1001", { teamsDir: TEST_TEAMS_DIR });
      expect(state.escalated).toBe(true);
    });

    test("emitEscalation records escalatedAt timestamp", async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 75 * 60 * 1000).toISOString();
      await createTestWorkspace("ENG-1002", {
        startedAt,
        phase: "proposed",
      });

      const { emitEscalation, readPlanningState } = await import(
        "../src/planning-workflow"
      );

      const before = new Date().toISOString();
      await emitEscalation("ENG-1002", {
        reason: "Timeout",
        currentPhase: "proposed",
        elapsedMinutes: 75,
      }, { teamsDir: TEST_TEAMS_DIR });
      const after = new Date().toISOString();

      const state = await readPlanningState("ENG-1002", { teamsDir: TEST_TEAMS_DIR });
      expect(state.escalatedAt).toBeDefined();
      expect(state.escalatedAt! >= before).toBe(true);
      expect(state.escalatedAt! <= after).toBe(true);
    });
  });

  describe("escalation prevention", () => {
    test("already escalated planning cannot be escalated again", async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 80 * 60 * 1000).toISOString();
      const escalatedAt = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      await createTestWorkspace("ENG-1003", {
        startedAt,
        phase: "reviewing",
        escalated: true,
        escalatedAt,
      });

      const { emitEscalation } = await import("../src/planning-workflow");

      // Should throw or return early without emitting another event
      await expect(
        emitEscalation("ENG-1003", {
          reason: "Second timeout",
          currentPhase: "reviewing",
          elapsedMinutes: 80,
        }, { teamsDir: TEST_TEAMS_DIR })
      ).rejects.toThrow("already escalated");
    });

    test("completed planning cannot be escalated", async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 120 * 60 * 1000).toISOString();
      await createTestWorkspace("ENG-1004", {
        startedAt,
        phase: "complete",
        completedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      });

      const { emitEscalation } = await import("../src/planning-workflow");

      await expect(
        emitEscalation("ENG-1004", {
          reason: "Timeout",
          currentPhase: "complete",
          elapsedMinutes: 120,
        }, { teamsDir: TEST_TEAMS_DIR })
      ).rejects.toThrow("cannot escalate completed");
    });
  });
});
