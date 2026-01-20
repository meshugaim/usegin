import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, access, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Tests for workspace creation in teamwork-v2.
 *
 * These tests verify:
 * 1. Workspace directory structure (state.json, events.jsonl, progress.md)
 * 2. Initial state values for planning workflow
 * 3. Workspace path resolution
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-workspaces");

// Type definitions for the workspace module that will be implemented
interface WorkspaceDeps {
  workspacesDir: string;
}

interface PlanningState {
  type: "plan";
  specId: string;
  phase: PlanningPhase;
  startedAt?: string;
  completedAt?: string;
  escalated?: boolean;
  escalatedAt?: string;
  revisionCount?: number;
  createdAt: string;
  updatedAt: string;
}

type PlanningPhase =
  | "setup"
  | "analyzing"
  | "proposing"
  | "reviewing"
  | "approved"
  | "creating_issues"
  | "complete";

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

describe("getWorkspacePath", () => {
  test("returns correct path for spec ID", async () => {
    // Import the function that should return workspace paths
    // This function doesn't exist yet - test should fail
    const { getWorkspacePath } = await import("../src/workspace");

    const deps = createTestDeps();
    const path = getWorkspacePath("ENG-1268", deps);
    expect(path).toBe(join(TEST_WORKSPACES_DIR, "ENG-1268"));
  });

  test("handles spec IDs with different prefixes", async () => {
    const { getWorkspacePath } = await import("../src/workspace");

    const deps = createTestDeps();
    expect(getWorkspacePath("SPEC-100", deps)).toBe(
      join(TEST_WORKSPACES_DIR, "SPEC-100")
    );
    expect(getWorkspacePath("PLAN-200", deps)).toBe(
      join(TEST_WORKSPACES_DIR, "PLAN-200")
    );
  });
});

describe("createPlanningWorkspace", () => {
  test("creates workspace directory", async () => {
    const { createPlanningWorkspace } = await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    const workspacePath = join(TEST_WORKSPACES_DIR, "ENG-1268");
    // access() resolves successfully if directory exists, throws otherwise
    await access(workspacePath);
    expect(true).toBe(true);
  });

  test("creates sessions subdirectory", async () => {
    const { createPlanningWorkspace } = await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    const sessionsPath = join(TEST_WORKSPACES_DIR, "ENG-1268", "sessions");
    await access(sessionsPath);
    expect(true).toBe(true);
  });

  test("creates state.json with initial setup phase", async () => {
    const { createPlanningWorkspace } = await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    const statePath = join(TEST_WORKSPACES_DIR, "ENG-1268", "state.json");
    const stateContent = await readFile(statePath, "utf-8");
    const state = JSON.parse(stateContent) as PlanningState;

    expect(state.type).toBe("plan");
    expect(state.specId).toBe("ENG-1268");
    expect(state.phase).toBe("setup");
  });

  test("state.json includes required timestamps", async () => {
    const { createPlanningWorkspace } = await import("../src/workspace");

    const deps = createTestDeps();
    const before = new Date().toISOString();
    await createPlanningWorkspace("ENG-1268", deps);
    const after = new Date().toISOString();

    const statePath = join(TEST_WORKSPACES_DIR, "ENG-1268", "state.json");
    const stateContent = await readFile(statePath, "utf-8");
    const state = JSON.parse(stateContent) as PlanningState;

    expect(state.createdAt).toBeDefined();
    expect(state.updatedAt).toBeDefined();
    expect(state.createdAt >= before).toBe(true);
    expect(state.createdAt <= after).toBe(true);
  });

  test("state.json initializes revisionCount to 0", async () => {
    const { createPlanningWorkspace } = await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    const statePath = join(TEST_WORKSPACES_DIR, "ENG-1268", "state.json");
    const stateContent = await readFile(statePath, "utf-8");
    const state = JSON.parse(stateContent) as PlanningState;

    expect(state.revisionCount).toBe(0);
  });

  test("creates events.jsonl with workspace_created event", async () => {
    const { createPlanningWorkspace } = await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    const eventsPath = join(TEST_WORKSPACES_DIR, "ENG-1268", "events.jsonl");
    const content = await readFile(eventsPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    expect(lines.length).toBeGreaterThanOrEqual(1);

    const firstEvent = JSON.parse(lines[0]);
    expect(firstEvent.event).toBe("workspace_created");
    expect(firstEvent.data.specId).toBe("ENG-1268");
    expect(firstEvent.timestamp).toBeDefined();
  });

  test("creates progress.md with header", async () => {
    const { createPlanningWorkspace } = await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    const progressPath = join(TEST_WORKSPACES_DIR, "ENG-1268", "progress.md");
    const content = await readFile(progressPath, "utf-8");

    expect(content).toContain("# Planning Progress");
    expect(content).toContain("Spec: ENG-1268");
  });

  test("progress.md includes phase section", async () => {
    const { createPlanningWorkspace } = await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    const progressPath = join(TEST_WORKSPACES_DIR, "ENG-1268", "progress.md");
    const content = await readFile(progressPath, "utf-8");

    expect(content).toContain("## Phases");
    expect(content).toContain("- [ ] Setup");
    expect(content).toContain("- [ ] Analyzing");
    expect(content).toContain("- [ ] Proposing");
    expect(content).toContain("- [ ] Reviewing");
    expect(content).toContain("- [ ] Approved");
    expect(content).toContain("- [ ] Creating Issues");
    expect(content).toContain("- [ ] Complete");
  });

  test("throws if workspace already exists", async () => {
    const { createPlanningWorkspace } = await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    // Second creation should throw
    await expect(createPlanningWorkspace("ENG-1268", deps)).rejects.toThrow(
      "already exists"
    );
  });
});

describe("workspaceExists", () => {
  test("returns false for non-existent workspace", async () => {
    const { workspaceExists } = await import("../src/workspace");

    const deps = createTestDeps();
    const exists = await workspaceExists("ENG-FAKE", deps);

    expect(exists).toBe(false);
  });

  test("returns true for existing workspace", async () => {
    const { createPlanningWorkspace, workspaceExists } = await import(
      "../src/workspace"
    );

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    const exists = await workspaceExists("ENG-1268", deps);
    expect(exists).toBe(true);
  });
});

describe("readPlanningState", () => {
  test("reads state from existing workspace", async () => {
    const { createPlanningWorkspace, readPlanningState } = await import(
      "../src/workspace"
    );

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    const state = await readPlanningState("ENG-1268", deps);

    expect(state.type).toBe("plan");
    expect(state.specId).toBe("ENG-1268");
    expect(state.phase).toBe("setup");
  });

  test("throws for non-existent workspace", async () => {
    const { readPlanningState } = await import("../src/workspace");

    const deps = createTestDeps();

    await expect(readPlanningState("ENG-FAKE", deps)).rejects.toThrow();
  });
});

describe("updatePlanningState", () => {
  test("updates phase in state", async () => {
    const { createPlanningWorkspace, updatePlanningState, readPlanningState } =
      await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    await updatePlanningState("ENG-1268", { phase: "analyzing" }, deps);

    const state = await readPlanningState("ENG-1268", deps);
    expect(state.phase).toBe("analyzing");
  });

  test("updates updatedAt timestamp", async () => {
    const { createPlanningWorkspace, updatePlanningState, readPlanningState } =
      await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    const beforeState = await readPlanningState("ENG-1268", deps);
    const beforeUpdatedAt = beforeState.updatedAt;

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    await updatePlanningState("ENG-1268", { phase: "analyzing" }, deps);

    const afterState = await readPlanningState("ENG-1268", deps);
    expect(afterState.updatedAt > beforeUpdatedAt).toBe(true);
  });

  test("preserves existing fields when updating", async () => {
    const { createPlanningWorkspace, updatePlanningState, readPlanningState } =
      await import("../src/workspace");

    const deps = createTestDeps();
    await createPlanningWorkspace("ENG-1268", deps);

    await updatePlanningState("ENG-1268", { phase: "analyzing" }, deps);

    const state = await readPlanningState("ENG-1268", deps);
    expect(state.type).toBe("plan");
    expect(state.specId).toBe("ENG-1268");
    expect(state.createdAt).toBeDefined();
  });
});
