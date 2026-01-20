import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Tests for event emission in the planning workflow.
 *
 * Events are appended to events.jsonl for each significant action.
 * The event log provides a complete audit trail of the planning process.
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-events");

interface WorkspaceDeps {
  workspacesDir: string;
}

interface PlanningEvent {
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
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

// Helper to create a workspace with events
async function createWorkspaceWithEvents(
  specId: string,
  existingEvents: PlanningEvent[] = []
): Promise<string> {
  const workspacePath = join(TEST_WORKSPACES_DIR, specId);
  await mkdir(workspacePath, { recursive: true });
  await mkdir(join(workspacePath, "sessions"), { recursive: true });

  const now = new Date().toISOString();
  const state = {
    type: "plan",
    specId,
    phase: "setup",
    revisionCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await writeFile(
    join(workspacePath, "state.json"),
    JSON.stringify(state, null, 2)
  );

  const eventsContent = existingEvents.map((e) => JSON.stringify(e)).join("\n");
  await writeFile(
    join(workspacePath, "events.jsonl"),
    eventsContent + (eventsContent ? "\n" : "")
  );

  return workspacePath;
}

// Helper to read all events from workspace
async function readEvents(workspacePath: string): Promise<PlanningEvent[]> {
  const eventsPath = join(workspacePath, "events.jsonl");
  const content = await readFile(eventsPath, "utf-8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe("emitEvent", () => {
  test("appends event to events.jsonl", async () => {
    const { emitEvent } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-100");

    await emitEvent("ENG-100", "test_event", { foo: "bar" }, deps);

    const events = await readEvents(workspacePath);
    expect(events.length).toBe(1);
    expect(events[0].event).toBe("test_event");
    expect(events[0].data.foo).toBe("bar");
  });

  test("includes timestamp in event", async () => {
    const { emitEvent } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-101");

    const before = new Date().toISOString();
    await emitEvent("ENG-101", "test_event", {}, deps);
    const after = new Date().toISOString();

    const events = await readEvents(workspacePath);
    expect(events[0].timestamp).toBeDefined();
    expect(events[0].timestamp >= before).toBe(true);
    expect(events[0].timestamp <= after).toBe(true);
  });

  test("preserves existing events when appending", async () => {
    const { emitEvent } = await import("../src/events");

    const deps = createTestDeps();
    const existingEvent: PlanningEvent = {
      timestamp: new Date().toISOString(),
      event: "existing_event",
      data: { id: 1 },
    };
    const workspacePath = await createWorkspaceWithEvents("ENG-102", [
      existingEvent,
    ]);

    await emitEvent("ENG-102", "new_event", { id: 2 }, deps);

    const events = await readEvents(workspacePath);
    expect(events.length).toBe(2);
    expect(events[0].event).toBe("existing_event");
    expect(events[1].event).toBe("new_event");
  });
});

describe("phase transition events", () => {
  test("emits phase_transition event on setup -> analyzing", async () => {
    const { emitPhaseTransition } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-200");

    await emitPhaseTransition("ENG-200", "setup", "analyzing", deps);

    const events = await readEvents(workspacePath);
    const transitionEvent = events.find(
      (e) => e.event === "phase_transition"
    );

    expect(transitionEvent).toBeDefined();
    expect(transitionEvent?.data.from).toBe("setup");
    expect(transitionEvent?.data.to).toBe("analyzing");
  });

  test("emits phase_transition for full workflow", async () => {
    const { emitPhaseTransition } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-201");

    await emitPhaseTransition("ENG-201", "setup", "analyzing", deps);
    await emitPhaseTransition("ENG-201", "analyzing", "proposing", deps);
    await emitPhaseTransition("ENG-201", "proposing", "reviewing", deps);
    await emitPhaseTransition("ENG-201", "reviewing", "approved", deps);
    await emitPhaseTransition("ENG-201", "approved", "creating_issues", deps);
    await emitPhaseTransition("ENG-201", "creating_issues", "complete", deps);

    const events = await readEvents(workspacePath);
    const transitionEvents = events.filter(
      (e) => e.event === "phase_transition"
    );

    expect(transitionEvents.length).toBe(6);
    expect(transitionEvents[0].data.to).toBe("analyzing");
    expect(transitionEvents[5].data.to).toBe("complete");
  });

  test("phase_transition includes specId in data", async () => {
    const { emitPhaseTransition } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-202");

    await emitPhaseTransition("ENG-202", "setup", "analyzing", deps);

    const events = await readEvents(workspacePath);
    const transitionEvent = events.find(
      (e) => e.event === "phase_transition"
    );

    expect(transitionEvent?.data.specId).toBe("ENG-202");
  });
});

describe("worker events", () => {
  test("emits worker_spawned event", async () => {
    const { emitWorkerSpawned } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-300");

    await emitWorkerSpawned(
      "ENG-300",
      {
        workerId: "worker-123",
        role: "analyzer",
        sessionId: "session-abc",
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const workerEvent = events.find((e) => e.event === "worker_spawned");

    expect(workerEvent).toBeDefined();
    expect(workerEvent?.data.workerId).toBe("worker-123");
    expect(workerEvent?.data.role).toBe("analyzer");
    expect(workerEvent?.data.sessionId).toBe("session-abc");
  });

  test("emits worker_completed event", async () => {
    const { emitWorkerCompleted } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-301");

    await emitWorkerCompleted(
      "ENG-301",
      {
        workerId: "worker-123",
        exitCode: 0,
        duration: 12345,
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const completedEvent = events.find((e) => e.event === "worker_completed");

    expect(completedEvent).toBeDefined();
    expect(completedEvent?.data.workerId).toBe("worker-123");
    expect(completedEvent?.data.exitCode).toBe(0);
    expect(completedEvent?.data.duration).toBe(12345);
  });

  test("emits worker_failed event", async () => {
    const { emitWorkerFailed } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-302");

    await emitWorkerFailed(
      "ENG-302",
      {
        workerId: "worker-123",
        error: "Process crashed",
        exitCode: 1,
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const failedEvent = events.find((e) => e.event === "worker_failed");

    expect(failedEvent).toBeDefined();
    expect(failedEvent?.data.workerId).toBe("worker-123");
    expect(failedEvent?.data.error).toBe("Process crashed");
    expect(failedEvent?.data.exitCode).toBe(1);
  });
});

describe("slice events", () => {
  test("emits slices_proposed event", async () => {
    const { emitSlicesProposed } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-400");

    await emitSlicesProposed(
      "ENG-400",
      {
        slices: [
          { title: "Slice 1", description: "First slice" },
          { title: "Slice 2", description: "Second slice" },
        ],
        totalCount: 2,
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const proposedEvent = events.find((e) => e.event === "slices_proposed");

    expect(proposedEvent).toBeDefined();
    expect(proposedEvent?.data.totalCount).toBe(2);
    expect((proposedEvent?.data.slices as unknown[]).length).toBe(2);
  });

  test("emits slices_approved event", async () => {
    const { emitSlicesApproved } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-401");

    await emitSlicesApproved(
      "ENG-401",
      {
        approvedCount: 3,
        reviewerId: "reviewer-456",
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const approvedEvent = events.find((e) => e.event === "slices_approved");

    expect(approvedEvent).toBeDefined();
    expect(approvedEvent?.data.approvedCount).toBe(3);
    expect(approvedEvent?.data.reviewerId).toBe("reviewer-456");
  });

  test("emits revision_requested event", async () => {
    const { emitRevisionRequested } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-402");

    await emitRevisionRequested(
      "ENG-402",
      {
        feedback: "Slice 2 needs clearer acceptance criteria",
        reviewerId: "reviewer-789",
        revisionNumber: 1,
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const revisionEvent = events.find((e) => e.event === "revision_requested");

    expect(revisionEvent).toBeDefined();
    expect(revisionEvent?.data.feedback).toContain("Slice 2");
    expect(revisionEvent?.data.reviewerId).toBe("reviewer-789");
    expect(revisionEvent?.data.revisionNumber).toBe(1);
  });
});

describe("Linear issue events", () => {
  test("emits issue_creation_started event", async () => {
    const { emitIssueCreationStarted } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-500");

    await emitIssueCreationStarted(
      "ENG-500",
      {
        totalSlices: 4,
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const startedEvent = events.find(
      (e) => e.event === "issue_creation_started"
    );

    expect(startedEvent).toBeDefined();
    expect(startedEvent?.data.totalSlices).toBe(4);
  });

  test("emits issue_created event for each slice", async () => {
    const { emitIssueCreated } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-501");

    await emitIssueCreated(
      "ENG-501",
      {
        issueId: "ENG-502",
        title: "Slice 1: Auth UI",
        sliceIndex: 0,
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const createdEvent = events.find((e) => e.event === "issue_created");

    expect(createdEvent).toBeDefined();
    expect(createdEvent?.data.issueId).toBe("ENG-502");
    expect(createdEvent?.data.title).toBe("Slice 1: Auth UI");
    expect(createdEvent?.data.sliceIndex).toBe(0);
  });

  test("emits issue_creation_completed event", async () => {
    const { emitIssueCreationCompleted } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-502");

    await emitIssueCreationCompleted(
      "ENG-502",
      {
        createdIssues: ["ENG-503", "ENG-504", "ENG-505"],
        totalCount: 3,
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const completedEvent = events.find(
      (e) => e.event === "issue_creation_completed"
    );

    expect(completedEvent).toBeDefined();
    expect((completedEvent?.data.createdIssues as string[]).length).toBe(3);
    expect(completedEvent?.data.totalCount).toBe(3);
  });
});

describe("timeout and escalation events", () => {
  test("emits timeout_warning event", async () => {
    const { emitTimeoutWarning } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-600");

    await emitTimeoutWarning(
      "ENG-600",
      {
        elapsedMinutes: 50,
        timeoutMinutes: 60,
        currentPhase: "reviewing",
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const warningEvent = events.find((e) => e.event === "timeout_warning");

    expect(warningEvent).toBeDefined();
    expect(warningEvent?.data.elapsedMinutes).toBe(50);
    expect(warningEvent?.data.timeoutMinutes).toBe(60);
    expect(warningEvent?.data.currentPhase).toBe("reviewing");
  });

  test("emits escalation event", async () => {
    const { emitEscalation } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-601");

    await emitEscalation(
      "ENG-601",
      {
        reason: "Planning exceeded 60 minute timeout",
        elapsedMinutes: 65,
        currentPhase: "proposing",
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const escalationEvent = events.find((e) => e.event === "escalation");

    expect(escalationEvent).toBeDefined();
    expect(escalationEvent?.data.reason).toContain("60 minute timeout");
    expect(escalationEvent?.data.elapsedMinutes).toBe(65);
    expect(escalationEvent?.data.currentPhase).toBe("proposing");
  });
});

describe("planning completion events", () => {
  test("emits planning_completed event", async () => {
    const { emitPlanningCompleted } = await import("../src/events");

    const deps = createTestDeps();
    const workspacePath = await createWorkspaceWithEvents("ENG-700");

    await emitPlanningCompleted(
      "ENG-700",
      {
        createdIssues: ["ENG-701", "ENG-702", "ENG-703"],
        totalSlices: 3,
        revisionCount: 1,
        durationMinutes: 45,
      },
      deps
    );

    const events = await readEvents(workspacePath);
    const completedEvent = events.find((e) => e.event === "planning_completed");

    expect(completedEvent).toBeDefined();
    expect((completedEvent?.data.createdIssues as string[]).length).toBe(3);
    expect(completedEvent?.data.totalSlices).toBe(3);
    expect(completedEvent?.data.revisionCount).toBe(1);
    expect(completedEvent?.data.durationMinutes).toBe(45);
  });
});

describe("readEvents", () => {
  test("returns all events in chronological order", async () => {
    const { emitEvent, readEvents: readEventsFunc } = await import(
      "../src/events"
    );

    const deps = createTestDeps();
    await createWorkspaceWithEvents("ENG-800");

    await emitEvent("ENG-800", "event_1", { order: 1 }, deps);
    await emitEvent("ENG-800", "event_2", { order: 2 }, deps);
    await emitEvent("ENG-800", "event_3", { order: 3 }, deps);

    const events = await readEventsFunc("ENG-800", deps);

    expect(events.length).toBe(3);
    expect(events[0].data.order).toBe(1);
    expect(events[1].data.order).toBe(2);
    expect(events[2].data.order).toBe(3);
  });

  test("returns empty array for workspace with no events", async () => {
    const { readEvents: readEventsFunc } = await import("../src/events");

    const deps = createTestDeps();
    await createWorkspaceWithEvents("ENG-801");

    const events = await readEventsFunc("ENG-801", deps);
    expect(events).toEqual([]);
  });
});

describe("getEventsByType", () => {
  test("filters events by type", async () => {
    const { emitEvent, getEventsByType } = await import("../src/events");

    const deps = createTestDeps();
    await createWorkspaceWithEvents("ENG-900");

    await emitEvent("ENG-900", "type_a", { id: 1 }, deps);
    await emitEvent("ENG-900", "type_b", { id: 2 }, deps);
    await emitEvent("ENG-900", "type_a", { id: 3 }, deps);

    const typeAEvents = await getEventsByType("ENG-900", "type_a", deps);

    expect(typeAEvents.length).toBe(2);
    expect(typeAEvents[0].data.id).toBe(1);
    expect(typeAEvents[1].data.id).toBe(3);
  });
});
