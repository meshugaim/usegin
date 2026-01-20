import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Tests for the planning team state machine.
 *
 * The planning workflow has the following phases:
 * setup -> analyzing -> proposing -> reviewing -> approved -> creating_issues -> complete
 *
 * With a revision loop: reviewing -> (feedback) -> proposing -> reviewing
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-state-machine");

interface WorkspaceDeps {
  workspacesDir: string;
}

type PlanningPhase =
  | "setup"
  | "analyzing"
  | "proposing"
  | "reviewing"
  | "approved"
  | "creating_issues"
  | "complete";

// Valid state transitions
const VALID_TRANSITIONS: Record<PlanningPhase, PlanningPhase[]> = {
  setup: ["analyzing"],
  analyzing: ["proposing"],
  proposing: ["reviewing"],
  reviewing: ["approved", "proposing"], // Can go back to proposing for revisions
  approved: ["creating_issues"],
  creating_issues: ["complete"],
  complete: [], // Terminal state
};

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

// Helper to create a workspace with a specific state
async function createWorkspaceWithState(
  specId: string,
  phase: PlanningPhase,
  extras: Record<string, unknown> = {}
): Promise<string> {
  const workspacePath = join(TEST_WORKSPACES_DIR, specId);
  await mkdir(workspacePath, { recursive: true });
  await mkdir(join(workspacePath, "sessions"), { recursive: true });

  const now = new Date().toISOString();
  const state = {
    type: "plan",
    specId,
    phase,
    revisionCount: 0,
    createdAt: now,
    updatedAt: now,
    ...extras,
  };

  await writeFile(
    join(workspacePath, "state.json"),
    JSON.stringify(state, null, 2)
  );
  await writeFile(join(workspacePath, "events.jsonl"), "");

  return workspacePath;
}

describe("isValidTransition", () => {
  test("setup -> analyzing is valid", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("setup", "analyzing")).toBe(true);
  });

  test("analyzing -> proposing is valid", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("analyzing", "proposing")).toBe(true);
  });

  test("proposing -> reviewing is valid", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("proposing", "reviewing")).toBe(true);
  });

  test("reviewing -> approved is valid", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("reviewing", "approved")).toBe(true);
  });

  test("reviewing -> proposing is valid (revision loop)", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("reviewing", "proposing")).toBe(true);
  });

  test("approved -> creating_issues is valid", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("approved", "creating_issues")).toBe(true);
  });

  test("creating_issues -> complete is valid", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("creating_issues", "complete")).toBe(true);
  });

  test("complete -> any is invalid (terminal state)", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("complete", "setup")).toBe(false);
    expect(isValidTransition("complete", "analyzing")).toBe(false);
    expect(isValidTransition("complete", "proposing")).toBe(false);
  });

  test("setup -> complete is invalid (skipping phases)", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("setup", "complete")).toBe(false);
  });

  test("analyzing -> reviewing is invalid (skipping proposing)", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("analyzing", "reviewing")).toBe(false);
  });

  test("approved -> proposing is invalid (can't go back after approval)", async () => {
    const { isValidTransition } = await import("../src/state-machine");

    expect(isValidTransition("approved", "proposing")).toBe(false);
  });
});

describe("transitionTo", () => {
  test("transitions from setup to analyzing", async () => {
    const { transitionTo, readPlanningState } = await import(
      "../src/state-machine"
    );

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-100", "setup");

    await transitionTo("ENG-100", "analyzing", deps);

    const state = await readPlanningState("ENG-100", deps);
    expect(state.phase).toBe("analyzing");
  });

  test("transitions through full happy path", async () => {
    const { transitionTo, readPlanningState } = await import(
      "../src/state-machine"
    );

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-101", "setup");

    await transitionTo("ENG-101", "analyzing", deps);
    await transitionTo("ENG-101", "proposing", deps);
    await transitionTo("ENG-101", "reviewing", deps);
    await transitionTo("ENG-101", "approved", deps);
    await transitionTo("ENG-101", "creating_issues", deps);
    await transitionTo("ENG-101", "complete", deps);

    const state = await readPlanningState("ENG-101", deps);
    expect(state.phase).toBe("complete");
  });

  test("throws on invalid transition", async () => {
    const { transitionTo } = await import("../src/state-machine");

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-102", "setup");

    await expect(transitionTo("ENG-102", "complete", deps)).rejects.toThrow(
      "Invalid transition"
    );
  });

  test("throws when transitioning from complete state", async () => {
    const { transitionTo } = await import("../src/state-machine");

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-103", "complete");

    await expect(transitionTo("ENG-103", "setup", deps)).rejects.toThrow(
      "terminal state"
    );
  });

  test("updates updatedAt timestamp on transition", async () => {
    const { transitionTo, readPlanningState } = await import(
      "../src/state-machine"
    );

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-104", "setup");

    const before = new Date().toISOString();
    await transitionTo("ENG-104", "analyzing", deps);
    const after = new Date().toISOString();

    const state = await readPlanningState("ENG-104", deps);
    expect(state.updatedAt >= before).toBe(true);
    expect(state.updatedAt <= after).toBe(true);
  });

  test("sets startedAt on first transition from setup", async () => {
    const { transitionTo, readPlanningState } = await import(
      "../src/state-machine"
    );

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-105", "setup");

    const before = new Date().toISOString();
    await transitionTo("ENG-105", "analyzing", deps);
    const after = new Date().toISOString();

    const state = await readPlanningState("ENG-105", deps);
    expect(state.startedAt).toBeDefined();
    expect(state.startedAt! >= before).toBe(true);
    expect(state.startedAt! <= after).toBe(true);
  });

  test("sets completedAt on transition to complete", async () => {
    const { transitionTo, readPlanningState } = await import(
      "../src/state-machine"
    );

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-106", "creating_issues");

    const before = new Date().toISOString();
    await transitionTo("ENG-106", "complete", deps);
    const after = new Date().toISOString();

    const state = await readPlanningState("ENG-106", deps);
    expect(state.completedAt).toBeDefined();
    expect(state.completedAt! >= before).toBe(true);
    expect(state.completedAt! <= after).toBe(true);
  });
});

describe("revision loop", () => {
  test("reviewing -> proposing increments revisionCount", async () => {
    const { transitionTo, readPlanningState } = await import(
      "../src/state-machine"
    );

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-200", "reviewing", { revisionCount: 0 });

    await transitionTo("ENG-200", "proposing", deps);

    const state = await readPlanningState("ENG-200", deps);
    expect(state.revisionCount).toBe(1);
  });

  test("multiple revisions increment count correctly", async () => {
    const { transitionTo, readPlanningState } = await import(
      "../src/state-machine"
    );

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-201", "reviewing", { revisionCount: 0 });

    // First revision
    await transitionTo("ENG-201", "proposing", deps);
    await transitionTo("ENG-201", "reviewing", deps);

    // Second revision
    await transitionTo("ENG-201", "proposing", deps);

    const state = await readPlanningState("ENG-201", deps);
    expect(state.revisionCount).toBe(2);
  });

  test("approved -> doesn't allow going back to proposing", async () => {
    const { transitionTo } = await import("../src/state-machine");

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-202", "approved");

    await expect(transitionTo("ENG-202", "proposing", deps)).rejects.toThrow(
      "Invalid transition"
    );
  });
});

describe("getNextValidPhases", () => {
  test("returns valid next phases for setup", async () => {
    const { getNextValidPhases } = await import("../src/state-machine");

    const next = getNextValidPhases("setup");
    expect(next).toEqual(["analyzing"]);
  });

  test("returns valid next phases for reviewing (can approve or revise)", async () => {
    const { getNextValidPhases } = await import("../src/state-machine");

    const next = getNextValidPhases("reviewing");
    expect(next).toContain("approved");
    expect(next).toContain("proposing");
    expect(next).toHaveLength(2);
  });

  test("returns empty array for complete (terminal state)", async () => {
    const { getNextValidPhases } = await import("../src/state-machine");

    const next = getNextValidPhases("complete");
    expect(next).toEqual([]);
  });
});

describe("getCurrentPhase", () => {
  test("returns current phase from state", async () => {
    const { getCurrentPhase } = await import("../src/state-machine");

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-300", "proposing");

    const phase = await getCurrentPhase("ENG-300", deps);
    expect(phase).toBe("proposing");
  });
});

describe("isTerminalPhase", () => {
  test("complete is terminal", async () => {
    const { isTerminalPhase } = await import("../src/state-machine");

    expect(isTerminalPhase("complete")).toBe(true);
  });

  test("setup is not terminal", async () => {
    const { isTerminalPhase } = await import("../src/state-machine");

    expect(isTerminalPhase("setup")).toBe(false);
  });

  test("reviewing is not terminal", async () => {
    const { isTerminalPhase } = await import("../src/state-machine");

    expect(isTerminalPhase("reviewing")).toBe(false);
  });
});

describe("canEscalate", () => {
  test("can escalate from non-terminal phases", async () => {
    const { canEscalate } = await import("../src/state-machine");

    expect(canEscalate("setup")).toBe(true);
    expect(canEscalate("analyzing")).toBe(true);
    expect(canEscalate("proposing")).toBe(true);
    expect(canEscalate("reviewing")).toBe(true);
  });

  test("cannot escalate from complete", async () => {
    const { canEscalate } = await import("../src/state-machine");

    expect(canEscalate("complete")).toBe(false);
  });

  test("cannot escalate if already escalated", async () => {
    const { canEscalate, readPlanningState } = await import(
      "../src/state-machine"
    );

    const deps = createTestDeps();
    await createWorkspaceWithState("ENG-400", "reviewing", { escalated: true });

    const state = await readPlanningState("ENG-400", deps);
    expect(canEscalate(state.phase, state.escalated)).toBe(false);
  });
});
