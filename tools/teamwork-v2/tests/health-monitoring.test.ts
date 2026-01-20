import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

/**
 * Tests for Health Monitoring & Automatic Handoffs in teamwork-v2 (ENG-1272).
 *
 * Features to test:
 * 1. Health command - shows agent health and context utilization
 * 2. Context monitoring - warnings at 75%, auto-handoff at 80%
 * 3. Handoff files - session transcripts, checkpoints, handoff context
 * 4. Handoff command - manual and automatic handoff triggering
 * 5. State extensions - contextUtilization, lastHealthCheck, handoffCount
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-health");
const CLI_PATH = join(import.meta.dir, "../src/cli.ts");

interface WorkspaceDeps {
  workspacesDir: string;
}

interface PlanningState {
  type: "plan";
  specId: string;
  phase: string;
  revisionCount: number;
  timeoutMinutes: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  // Retry & recovery fields
  attemptCount?: number;
  failedAt?: string;
  failureReason?: string;
  abortedAt?: string;
  abortReason?: string;
  // Health monitoring fields (NEW for ENG-1272)
  contextUtilization?: number;
  lastHealthCheck?: string;
  handoffCount?: number;
  lastHandoffAt?: string;
}

interface ImplState {
  type: "impl";
  sliceId: string;
  specId: string;
  phase: string;
  tests: Array<{ name: string; status: string }>;
  currentTestIndex: number;
  commits: string[];
  timeoutMinutes: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  // Retry & recovery fields
  attemptCount?: number;
  failedAt?: string;
  failureReason?: string;
  abortedAt?: string;
  abortReason?: string;
  // Health monitoring fields (NEW for ENG-1272)
  contextUtilization?: number;
  lastHealthCheck?: string;
  handoffCount?: number;
  lastHandoffAt?: string;
}

interface PlanningEvent {
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
}

interface HandoffContext {
  workspaceId: string;
  agentRole: string;
  phase: string;
  testIndex?: number;
  pendingWork: string[];
  contextSnapshot: string;
  timestamp: string;
}

interface Checkpoint {
  workspaceId: string;
  phase: string;
  testIndex?: number;
  pendingWork: string[];
  timestamp: string;
}

beforeEach(async () => {
  await rm(TEST_WORKSPACES_DIR, { recursive: true, force: true });
  await mkdir(TEST_WORKSPACES_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_WORKSPACES_DIR, { recursive: true, force: true });
});

// Helper to create a planning workspace with specified state and events
async function createPlanWorkspace(
  specId: string,
  stateOverrides: Partial<PlanningState> = {},
  events: PlanningEvent[] = []
): Promise<string> {
  const workspacePath = join(TEST_WORKSPACES_DIR, specId);
  await mkdir(workspacePath, { recursive: true });
  await mkdir(join(workspacePath, "sessions"), { recursive: true });
  await mkdir(join(workspacePath, "checkpoints"), { recursive: true });

  const now = new Date().toISOString();
  const state: PlanningState = {
    type: "plan",
    specId,
    phase: "setup",
    revisionCount: 0,
    timeoutMinutes: 60,
    createdAt: now,
    updatedAt: now,
    attemptCount: 0,
    ...stateOverrides,
  };

  await writeFile(
    join(workspacePath, "state.json"),
    JSON.stringify(state, null, 2)
  );

  // Always include a workspace_created event
  const defaultEvent: PlanningEvent = {
    timestamp: now,
    event: "workspace_created",
    data: { specId },
  };
  const allEvents = [defaultEvent, ...events];

  const eventsContent = allEvents.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(join(workspacePath, "events.jsonl"), eventsContent);

  await writeFile(
    join(workspacePath, "progress.md"),
    `# Planning Progress\n\nSpec: ${specId}\n`
  );

  return workspacePath;
}

// Helper to create an impl workspace with specified state and events
async function createImplWorkspace(
  sliceId: string,
  stateOverrides: Partial<ImplState> = {},
  events: PlanningEvent[] = []
): Promise<string> {
  const workspacePath = join(TEST_WORKSPACES_DIR, sliceId);
  await mkdir(workspacePath, { recursive: true });
  await mkdir(join(workspacePath, "sessions"), { recursive: true });
  await mkdir(join(workspacePath, "checkpoints"), { recursive: true });

  const now = new Date().toISOString();
  const specId = sliceId.replace(/-\d+$/, ""); // ENG-123-1 -> ENG-123
  const state: ImplState = {
    type: "impl",
    sliceId,
    specId,
    phase: "setup",
    tests: [],
    currentTestIndex: 0,
    commits: [],
    timeoutMinutes: 30,
    createdAt: now,
    updatedAt: now,
    attemptCount: 0,
    ...stateOverrides,
  };

  await writeFile(
    join(workspacePath, "state.json"),
    JSON.stringify(state, null, 2)
  );

  // Always include an impl_workspace_created event
  const defaultEvent: PlanningEvent = {
    timestamp: now,
    event: "impl_workspace_created",
    data: { sliceId, specId },
  };
  const allEvents = [defaultEvent, ...events];

  const eventsContent = allEvents.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(join(workspacePath, "events.jsonl"), eventsContent);

  return workspacePath;
}

// Helper to create events with specific timestamps
function createEvent(
  event: string,
  data: Record<string, unknown>,
  timestamp?: string
): PlanningEvent {
  return {
    timestamp: timestamp || new Date().toISOString(),
    event,
    data,
  };
}

// Helper to read state from workspace
async function readState<T>(workspaceId: string): Promise<T> {
  const statePath = join(TEST_WORKSPACES_DIR, workspaceId, "state.json");
  const content = await readFile(statePath, "utf-8");
  return JSON.parse(content);
}

// Helper to read events from workspace
async function readEvents(workspaceId: string): Promise<PlanningEvent[]> {
  const eventsPath = join(TEST_WORKSPACES_DIR, workspaceId, "events.jsonl");
  const content = await readFile(eventsPath, "utf-8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// ============================================================================
// teamwork-v2 health command (NEW for ENG-1272)
// ============================================================================

describe("teamwork-v2 health command", () => {
  describe("all agents mode (no id)", () => {
    test("health shows all active agents with context percentages", async () => {
      await createPlanWorkspace("ENG-100", {
        phase: "analyzing",
        contextUtilization: 45,
        lastHealthCheck: new Date().toISOString(),
      });
      await createImplWorkspace("ENG-101-1", {
        phase: "implementing",
        contextUtilization: 72,
        lastHealthCheck: new Date().toISOString(),
      });

      const result =
        await $`bun ${CLI_PATH} health --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-100");
      expect(result).toContain("ENG-101-1");
      expect(result).toContain("45%");
      expect(result).toContain("72%");
    });

    test("health shows workspace id, agent role, context %, status", async () => {
      await createPlanWorkspace("ENG-200", {
        phase: "reviewing",
        contextUtilization: 65,
      });

      const result =
        await $`bun ${CLI_PATH} health --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-200");
      expect(result).toContain("planner"); // agent role for plan type
      expect(result).toContain("65%");
      expect(result).toContain("healthy"); // or similar status indicator
    });

    test("health shows worker role for impl workspaces", async () => {
      await createImplWorkspace("ENG-201-1", {
        phase: "implementing",
        contextUtilization: 55,
      });

      const result =
        await $`bun ${CLI_PATH} health --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-201-1");
      expect(result).toContain("worker"); // agent role for impl type
    });

    test("health shows warning status at 75%+ utilization", async () => {
      await createImplWorkspace("ENG-202-1", {
        phase: "implementing",
        contextUtilization: 76,
      });

      const result =
        await $`bun ${CLI_PATH} health --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-202-1");
      expect(result).toMatch(/warning|caution|high/i);
    });

    test("health shows critical status at 80%+ utilization", async () => {
      await createImplWorkspace("ENG-203-1", {
        phase: "implementing",
        contextUtilization: 82,
      });

      const result =
        await $`bun ${CLI_PATH} health --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-203-1");
      expect(result).toMatch(/critical|handoff/i);
    });

    test("health returns empty message when no active agents", async () => {
      const result =
        await $`bun ${CLI_PATH} health --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toMatch(/no.*agents|no.*workspaces/i);
    });

    test("health excludes completed workspaces", async () => {
      await createPlanWorkspace("ENG-300", {
        phase: "complete",
        completedAt: new Date().toISOString(),
        contextUtilization: 90,
      });
      await createPlanWorkspace("ENG-301", {
        phase: "analyzing",
        contextUtilization: 40,
      });

      const result =
        await $`bun ${CLI_PATH} health --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-301");
      expect(result).not.toContain("ENG-300");
    });
  });

  describe("specific workspace mode (with id)", () => {
    test("health <id> shows detailed health for specific workspace", async () => {
      await createPlanWorkspace("ENG-400", {
        phase: "reviewing",
        contextUtilization: 68,
        lastHealthCheck: "2025-01-15T10:00:00Z",
        handoffCount: 1,
        lastHandoffAt: "2025-01-15T09:00:00Z",
      });

      const result =
        await $`bun ${CLI_PATH} health ENG-400 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-400");
      expect(result).toContain("68%");
      expect(result).toContain("reviewing");
      expect(result).toContain("Last check");
    });

    test("health <id> shows handoff history", async () => {
      await createPlanWorkspace("ENG-401", {
        phase: "analyzing",
        handoffCount: 2,
        lastHandoffAt: "2025-01-15T08:00:00Z",
      });

      const result =
        await $`bun ${CLI_PATH} health ENG-401 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("Handoffs: 2");
      expect(result).toContain("2025-01-15");
    });

    test("health <id> shows 0 when context utilization not tracked", async () => {
      await createPlanWorkspace("ENG-402", {
        phase: "setup",
        // No contextUtilization set
      });

      const result =
        await $`bun ${CLI_PATH} health ENG-402 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-402");
      expect(result).toMatch(/0%|unknown|not tracked/i);
    });

    test("health <id> fails for non-existent workspace", async () => {
      const result =
        await $`bun ${CLI_PATH} health ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("not found");
    });
  });

  describe("output format", () => {
    test("--json outputs valid JSON with health data", async () => {
      await createPlanWorkspace("ENG-500", {
        phase: "analyzing",
        contextUtilization: 50,
      });
      await createImplWorkspace("ENG-501-1", {
        phase: "implementing",
        contextUtilization: 75,
      });

      const result =
        await $`bun ${CLI_PATH} health --json --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      const data = JSON.parse(result);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("contextUtilization");
      expect(data[0]).toHaveProperty("agentRole");
      expect(data[0]).toHaveProperty("status");
    });
  });

  describe("help", () => {
    test("shows health command help with health --help", async () => {
      const result = await $`bun ${CLI_PATH} health --help`.text();

      expect(result).toContain("health");
      expect(result).toContain("workspaces-dir");
      expect(result).toContain("--json");
    });
  });
});

// ============================================================================
// Context Monitoring (NEW for ENG-1272)
// ============================================================================

describe("context monitoring", () => {
  describe("context warning at 75% utilization", () => {
    test("emits context_warning event when utilization reaches 75%", async () => {
      await createPlanWorkspace("ENG-600", {
        phase: "analyzing",
        contextUtilization: 74,
      });

      // Simulate context update that crosses 75% threshold
      await $`bun ${CLI_PATH} update-context ENG-600 --utilization 76 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-600");
      const warningEvent = events.find((e) => e.event === "context_warning");

      expect(warningEvent).toBeDefined();
      expect(warningEvent?.data.utilization).toBe(76);
      expect(warningEvent?.data.threshold).toBe(75);
    });

    test("does not emit warning if already above 75%", async () => {
      await createPlanWorkspace("ENG-601", {
        phase: "analyzing",
        contextUtilization: 76,
      });

      // Update from 76% to 78% - should not emit another warning
      await $`bun ${CLI_PATH} update-context ENG-601 --utilization 78 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-601");
      const warningEvents = events.filter((e) => e.event === "context_warning");

      // Should only have at most one warning event (none if state didn't have one)
      expect(warningEvents.length).toBeLessThanOrEqual(1);
    });

    test("warning includes workspace and agent info", async () => {
      await createImplWorkspace("ENG-602-1", {
        phase: "implementing",
        contextUtilization: 74,
      });

      await $`bun ${CLI_PATH} update-context ENG-602-1 --utilization 75 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-602-1");
      const warningEvent = events.find((e) => e.event === "context_warning");

      expect(warningEvent).toBeDefined();
      expect(warningEvent?.data.workspaceId).toBe("ENG-602-1");
      expect(warningEvent?.data.agentRole).toBe("worker");
    });
  });

  describe("auto-handoff at 80% utilization", () => {
    test("triggers auto-handoff when utilization reaches 80%", async () => {
      await createImplWorkspace("ENG-700-1", {
        phase: "implementing",
        contextUtilization: 79,
      });

      await $`bun ${CLI_PATH} update-context ENG-700-1 --utilization 80 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-700-1");
      const handoffEvent = events.find((e) => e.event === "handoff_triggered");

      expect(handoffEvent).toBeDefined();
      expect(handoffEvent?.data.trigger).toBe("auto");
      expect(handoffEvent?.data.utilization).toBe(80);
    });

    test("auto-handoff creates checkpoint", async () => {
      await createImplWorkspace("ENG-701-1", {
        phase: "implementing",
        contextUtilization: 79,
        tests: [
          { name: "test1", status: "passing" },
          { name: "test2", status: "failing" },
        ],
        currentTestIndex: 1,
      });

      await $`bun ${CLI_PATH} update-context ENG-701-1 --utilization 81 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const checkpointPath = join(TEST_WORKSPACES_DIR, "ENG-701-1", "checkpoints");
      const checkpoints = await readFile(join(checkpointPath, "latest.json"), "utf-8");
      const checkpoint: Checkpoint = JSON.parse(checkpoints);

      expect(checkpoint.workspaceId).toBe("ENG-701-1");
      expect(checkpoint.phase).toBe("implementing");
      expect(checkpoint.testIndex).toBe(1);
    });

    test("auto-handoff increments handoffCount", async () => {
      await createImplWorkspace("ENG-702-1", {
        phase: "implementing",
        contextUtilization: 79,
        handoffCount: 0,
      });

      await $`bun ${CLI_PATH} update-context ENG-702-1 --utilization 82 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const state = await readState<ImplState>("ENG-702-1");
      expect(state.handoffCount).toBe(1);
    });

    test("auto-handoff updates lastHandoffAt", async () => {
      const beforeHandoff = new Date().toISOString();
      await createImplWorkspace("ENG-703-1", {
        phase: "implementing",
        contextUtilization: 79,
      });

      await $`bun ${CLI_PATH} update-context ENG-703-1 --utilization 85 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const state = await readState<ImplState>("ENG-703-1");
      expect(state.lastHandoffAt).toBeDefined();
      expect(new Date(state.lastHandoffAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeHandoff).getTime()
      );
    });
  });

  describe("context state tracking", () => {
    test("update-context updates contextUtilization in state", async () => {
      await createPlanWorkspace("ENG-800", {
        phase: "analyzing",
        contextUtilization: 30,
      });

      await $`bun ${CLI_PATH} update-context ENG-800 --utilization 45 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const state = await readState<PlanningState>("ENG-800");
      expect(state.contextUtilization).toBe(45);
    });

    test("update-context updates lastHealthCheck timestamp", async () => {
      const beforeUpdate = new Date().toISOString();
      await createPlanWorkspace("ENG-801", {
        phase: "analyzing",
      });

      await $`bun ${CLI_PATH} update-context ENG-801 --utilization 50 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const state = await readState<PlanningState>("ENG-801");
      expect(state.lastHealthCheck).toBeDefined();
      expect(new Date(state.lastHealthCheck!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeUpdate).getTime()
      );
    });

    test("update-context emits health_check event", async () => {
      await createPlanWorkspace("ENG-802", {
        phase: "analyzing",
      });

      await $`bun ${CLI_PATH} update-context ENG-802 --utilization 60 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-802");
      const healthCheckEvent = events.find((e) => e.event === "health_check");

      expect(healthCheckEvent).toBeDefined();
      expect(healthCheckEvent?.data.contextUtilization).toBe(60);
    });
  });
});

// ============================================================================
// Handoff Files (NEW for ENG-1272)
// ============================================================================

describe("handoff files", () => {
  describe("session transcript export", () => {
    test("handoff exports session transcript to sessions/ directory", async () => {
      await createImplWorkspace("ENG-900-1", {
        phase: "implementing",
      });

      await $`bun ${CLI_PATH} handoff ENG-900-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const sessionsPath = join(TEST_WORKSPACES_DIR, "ENG-900-1", "sessions");
      // Should create a timestamped session file
      const files = await $`ls ${sessionsPath}`.text();
      expect(files).toMatch(/session.*\.md|transcript.*\.md/i);
    });

    test("session transcript contains conversation context", async () => {
      const events: PlanningEvent[] = [
        createEvent("phase_transition", { from: "setup", to: "implementing" }),
        createEvent("worker_spawned", { workerId: "w1", role: "implementer" }),
      ];
      await createImplWorkspace("ENG-901-1", { phase: "implementing" }, events);

      await $`bun ${CLI_PATH} handoff ENG-901-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const sessionsPath = join(TEST_WORKSPACES_DIR, "ENG-901-1", "sessions");
      const files = await $`ls ${sessionsPath}`.text();
      const sessionFiles = files.trim().split("\n").filter(f => f.endsWith(".md"));

      if (sessionFiles.length > 0) {
        const latestSession = await readFile(join(sessionsPath, sessionFiles[0]), "utf-8");
        expect(latestSession).toContain("implementing");
      }
    });
  });

  describe("checkpoint saving", () => {
    test("handoff saves checkpoint to checkpoints/ directory", async () => {
      await createImplWorkspace("ENG-1000-1", {
        phase: "implementing",
        tests: [
          { name: "test1", status: "passing" },
          { name: "test2", status: "pending" },
        ],
        currentTestIndex: 1,
      });

      await $`bun ${CLI_PATH} handoff ENG-1000-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const checkpointPath = join(TEST_WORKSPACES_DIR, "ENG-1000-1", "checkpoints", "latest.json");
      const checkpointContent = await readFile(checkpointPath, "utf-8");
      const checkpoint: Checkpoint = JSON.parse(checkpointContent);

      expect(checkpoint).toBeDefined();
      expect(checkpoint.workspaceId).toBe("ENG-1000-1");
    });

    test("checkpoint includes current phase", async () => {
      await createImplWorkspace("ENG-1001-1", {
        phase: "reviewing_impl",
      });

      await $`bun ${CLI_PATH} handoff ENG-1001-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const checkpointPath = join(TEST_WORKSPACES_DIR, "ENG-1001-1", "checkpoints", "latest.json");
      const checkpoint: Checkpoint = JSON.parse(await readFile(checkpointPath, "utf-8"));

      expect(checkpoint.phase).toBe("reviewing_impl");
    });

    test("checkpoint includes test index for impl workspaces", async () => {
      await createImplWorkspace("ENG-1002-1", {
        phase: "implementing",
        tests: [
          { name: "test1", status: "passing" },
          { name: "test2", status: "passing" },
          { name: "test3", status: "failing" },
        ],
        currentTestIndex: 2,
      });

      await $`bun ${CLI_PATH} handoff ENG-1002-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const checkpointPath = join(TEST_WORKSPACES_DIR, "ENG-1002-1", "checkpoints", "latest.json");
      const checkpoint: Checkpoint = JSON.parse(await readFile(checkpointPath, "utf-8"));

      expect(checkpoint.testIndex).toBe(2);
    });

    test("checkpoint includes pending work", async () => {
      await createImplWorkspace("ENG-1003-1", {
        phase: "implementing",
        tests: [
          { name: "test1", status: "passing" },
          { name: "test2", status: "failing" },
          { name: "test3", status: "pending" },
        ],
        currentTestIndex: 1,
      });

      await $`bun ${CLI_PATH} handoff ENG-1003-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const checkpointPath = join(TEST_WORKSPACES_DIR, "ENG-1003-1", "checkpoints", "latest.json");
      const checkpoint: Checkpoint = JSON.parse(await readFile(checkpointPath, "utf-8"));

      expect(checkpoint.pendingWork).toBeDefined();
      expect(Array.isArray(checkpoint.pendingWork)).toBe(true);
      expect(checkpoint.pendingWork.length).toBeGreaterThan(0);
      // Should include remaining tests
      expect(checkpoint.pendingWork.some((w) => w.includes("test2") || w.includes("test3"))).toBe(true);
    });

    test("checkpoint timestamp is recorded", async () => {
      const beforeHandoff = new Date().toISOString();
      await createImplWorkspace("ENG-1004-1", {
        phase: "implementing",
      });

      await $`bun ${CLI_PATH} handoff ENG-1004-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const checkpointPath = join(TEST_WORKSPACES_DIR, "ENG-1004-1", "checkpoints", "latest.json");
      const checkpoint: Checkpoint = JSON.parse(await readFile(checkpointPath, "utf-8"));

      expect(checkpoint.timestamp).toBeDefined();
      expect(new Date(checkpoint.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeHandoff).getTime()
      );
    });
  });

  describe("handoff context file", () => {
    test("handoff creates handoff_context.json", async () => {
      await createImplWorkspace("ENG-1100-1", {
        phase: "implementing",
      });

      await $`bun ${CLI_PATH} handoff ENG-1100-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const contextPath = join(TEST_WORKSPACES_DIR, "ENG-1100-1", "handoff_context.json");
      const contextContent = await readFile(contextPath, "utf-8");
      const context: HandoffContext = JSON.parse(contextContent);

      expect(context).toBeDefined();
      expect(context.workspaceId).toBe("ENG-1100-1");
    });

    test("handoff_context.json includes agent role", async () => {
      await createImplWorkspace("ENG-1101-1", {
        phase: "implementing",
      });

      await $`bun ${CLI_PATH} handoff ENG-1101-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const contextPath = join(TEST_WORKSPACES_DIR, "ENG-1101-1", "handoff_context.json");
      const context: HandoffContext = JSON.parse(await readFile(contextPath, "utf-8"));

      expect(context.agentRole).toBe("worker");
    });

    test("handoff_context.json includes continuation info", async () => {
      await createImplWorkspace("ENG-1102-1", {
        phase: "implementing",
        tests: [
          { name: "test1", status: "passing" },
          { name: "test2", status: "failing" },
        ],
        currentTestIndex: 1,
      });

      await $`bun ${CLI_PATH} handoff ENG-1102-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const contextPath = join(TEST_WORKSPACES_DIR, "ENG-1102-1", "handoff_context.json");
      const context: HandoffContext = JSON.parse(await readFile(contextPath, "utf-8"));

      expect(context.phase).toBe("implementing");
      expect(context.testIndex).toBe(1);
      expect(context.pendingWork).toBeDefined();
    });
  });
});

// ============================================================================
// teamwork-v2 handoff command (NEW for ENG-1272)
// ============================================================================

describe("teamwork-v2 handoff command", () => {
  describe("basic handoff", () => {
    test("handoff <id> triggers handoff for workspace", async () => {
      await createImplWorkspace("ENG-1200-1", {
        phase: "implementing",
      });

      const result =
        await $`bun ${CLI_PATH} handoff ENG-1200-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("Handoff triggered");
      expect(result).toContain("ENG-1200-1");
    });

    test("handoff emits handoff_triggered event", async () => {
      await createImplWorkspace("ENG-1201-1", {
        phase: "implementing",
      });

      await $`bun ${CLI_PATH} handoff ENG-1201-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-1201-1");
      const handoffEvent = events.find((e) => e.event === "handoff_triggered");

      expect(handoffEvent).toBeDefined();
      expect(handoffEvent?.data.trigger).toBe("manual");
    });

    test("handoff increments handoffCount", async () => {
      await createImplWorkspace("ENG-1202-1", {
        phase: "implementing",
        handoffCount: 1,
      });

      await $`bun ${CLI_PATH} handoff ENG-1202-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const state = await readState<ImplState>("ENG-1202-1");
      expect(state.handoffCount).toBe(2);
    });

    test("handoff updates lastHandoffAt", async () => {
      const beforeHandoff = new Date().toISOString();
      await createImplWorkspace("ENG-1203-1", {
        phase: "implementing",
      });

      await $`bun ${CLI_PATH} handoff ENG-1203-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const state = await readState<ImplState>("ENG-1203-1");
      expect(state.lastHandoffAt).toBeDefined();
      expect(new Date(state.lastHandoffAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeHandoff).getTime()
      );
    });

    test("handoff fails for non-existent workspace", async () => {
      const result =
        await $`bun ${CLI_PATH} handoff ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("not found");
    });

    test("handoff fails for completed workspace", async () => {
      await createImplWorkspace("ENG-1204-1", {
        phase: "complete",
        completedAt: new Date().toISOString(),
      });

      const result =
        await $`bun ${CLI_PATH} handoff ENG-1204-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("already complete");
    });
  });

  describe("--agent option", () => {
    test("handoff --agent worker specifies worker role", async () => {
      await createImplWorkspace("ENG-1300-1", {
        phase: "implementing",
      });

      await $`bun ${CLI_PATH} handoff ENG-1300-1 --agent worker --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-1300-1");
      const handoffEvent = events.find((e) => e.event === "handoff_triggered");

      expect(handoffEvent?.data.agentRole).toBe("worker");
    });

    test("handoff --agent reviewer specifies reviewer role", async () => {
      await createPlanWorkspace("ENG-1301", {
        phase: "reviewing",
      });

      await $`bun ${CLI_PATH} handoff ENG-1301 --agent reviewer --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-1301");
      const handoffEvent = events.find((e) => e.event === "handoff_triggered");

      expect(handoffEvent?.data.agentRole).toBe("reviewer");
    });

    test("handoff --agent planner specifies planner role", async () => {
      await createPlanWorkspace("ENG-1302", {
        phase: "analyzing",
      });

      await $`bun ${CLI_PATH} handoff ENG-1302 --agent planner --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-1302");
      const handoffEvent = events.find((e) => e.event === "handoff_triggered");

      expect(handoffEvent?.data.agentRole).toBe("planner");
    });

    test("handoff without --agent defaults to workspace type", async () => {
      await createImplWorkspace("ENG-1303-1", {
        phase: "implementing",
      });

      await $`bun ${CLI_PATH} handoff ENG-1303-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-1303-1");
      const handoffEvent = events.find((e) => e.event === "handoff_triggered");

      // impl workspaces default to worker
      expect(handoffEvent?.data.agentRole).toBe("worker");
    });

    test("handoff plan workspace defaults to planner role", async () => {
      await createPlanWorkspace("ENG-1304", {
        phase: "analyzing",
      });

      await $`bun ${CLI_PATH} handoff ENG-1304 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const events = await readEvents("ENG-1304");
      const handoffEvent = events.find((e) => e.event === "handoff_triggered");

      expect(handoffEvent?.data.agentRole).toBe("planner");
    });
  });

  describe("handoff output", () => {
    test("handoff shows checkpoint path", async () => {
      await createImplWorkspace("ENG-1400-1", {
        phase: "implementing",
      });

      const result =
        await $`bun ${CLI_PATH} handoff ENG-1400-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("checkpoint");
      expect(result).toContain("latest.json");
    });

    test("handoff shows continuation instructions", async () => {
      await createImplWorkspace("ENG-1401-1", {
        phase: "implementing",
        tests: [
          { name: "test1", status: "passing" },
          { name: "test2", status: "failing" },
        ],
        currentTestIndex: 1,
      });

      const result =
        await $`bun ${CLI_PATH} handoff ENG-1401-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("Continue");
      expect(result).toMatch(/resume|continue/i);
    });
  });

  describe("help", () => {
    test("shows handoff command help with handoff --help", async () => {
      const result = await $`bun ${CLI_PATH} handoff --help`.text();

      expect(result).toContain("handoff");
      expect(result).toContain("--agent");
      expect(result).toContain("workspaces-dir");
    });
  });
});

// ============================================================================
// State Extensions (NEW for ENG-1272)
// ============================================================================

describe("state extensions", () => {
  test("contextUtilization field is preserved in state", async () => {
    await createImplWorkspace("ENG-1500-1", {
      phase: "implementing",
      contextUtilization: 42,
    });

    const state = await readState<ImplState>("ENG-1500-1");
    expect(state.contextUtilization).toBe(42);
  });

  test("lastHealthCheck field is preserved in state", async () => {
    const timestamp = "2025-01-15T10:00:00Z";
    await createImplWorkspace("ENG-1501-1", {
      phase: "implementing",
      lastHealthCheck: timestamp,
    });

    const state = await readState<ImplState>("ENG-1501-1");
    expect(state.lastHealthCheck).toBe(timestamp);
  });

  test("handoffCount field is preserved in state", async () => {
    await createImplWorkspace("ENG-1502-1", {
      phase: "implementing",
      handoffCount: 3,
    });

    const state = await readState<ImplState>("ENG-1502-1");
    expect(state.handoffCount).toBe(3);
  });

  test("lastHandoffAt field is preserved in state", async () => {
    const timestamp = "2025-01-15T09:00:00Z";
    await createImplWorkspace("ENG-1503-1", {
      phase: "implementing",
      lastHandoffAt: timestamp,
    });

    const state = await readState<ImplState>("ENG-1503-1");
    expect(state.lastHandoffAt).toBe(timestamp);
  });

  test("state fields work for planning workspaces too", async () => {
    await createPlanWorkspace("ENG-1504", {
      phase: "analyzing",
      contextUtilization: 55,
      lastHealthCheck: "2025-01-15T10:00:00Z",
      handoffCount: 1,
      lastHandoffAt: "2025-01-15T09:00:00Z",
    });

    const state = await readState<PlanningState>("ENG-1504");
    expect(state.contextUtilization).toBe(55);
    expect(state.lastHealthCheck).toBe("2025-01-15T10:00:00Z");
    expect(state.handoffCount).toBe(1);
    expect(state.lastHandoffAt).toBe("2025-01-15T09:00:00Z");
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("health monitoring integration", () => {
  test("health and handoff commands are consistent", async () => {
    await createImplWorkspace("ENG-1600-1", {
      phase: "implementing",
      contextUtilization: 50,
      handoffCount: 0,
    });

    // Check initial health
    const healthResult1 =
      await $`bun ${CLI_PATH} health ENG-1600-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();
    expect(healthResult1).toContain("50%");

    // Trigger handoff
    await $`bun ${CLI_PATH} handoff ENG-1600-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    // Check health shows updated handoff count
    const state = await readState<ImplState>("ENG-1600-1");
    expect(state.handoffCount).toBe(1);
  });

  test("context update triggers warning then handoff at thresholds", async () => {
    await createImplWorkspace("ENG-1601-1", {
      phase: "implementing",
      contextUtilization: 70,
    });

    // Update to 76% - should trigger warning
    await $`bun ${CLI_PATH} update-context ENG-1601-1 --utilization 76 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const events1 = await readEvents("ENG-1601-1");
    const warningEvent = events1.find((e) => e.event === "context_warning");
    expect(warningEvent).toBeDefined();

    // Update to 81% - should trigger handoff
    await $`bun ${CLI_PATH} update-context ENG-1601-1 --utilization 81 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const events2 = await readEvents("ENG-1601-1");
    const handoffEvent = events2.find((e) => e.event === "handoff_triggered");
    expect(handoffEvent).toBeDefined();
  });

  test("list --active excludes completed workspaces from health view", async () => {
    await createImplWorkspace("ENG-1602-1", {
      phase: "implementing",
      contextUtilization: 60,
    });
    await createImplWorkspace("ENG-1603-1", {
      phase: "complete",
      completedAt: new Date().toISOString(),
      contextUtilization: 90,
    });

    const result =
      await $`bun ${CLI_PATH} health --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("ENG-1602-1");
    expect(result).not.toContain("ENG-1603-1");
  });

  test("checkpoint can be used with resume command", async () => {
    await createImplWorkspace("ENG-1604-1", {
      phase: "implementing",
      tests: [
        { name: "test1", status: "passing" },
        { name: "test2", status: "failing" },
      ],
      currentTestIndex: 1,
    });

    // Trigger handoff to create checkpoint
    await $`bun ${CLI_PATH} handoff ENG-1604-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    // Verify checkpoint exists
    const checkpointPath = join(TEST_WORKSPACES_DIR, "ENG-1604-1", "checkpoints", "latest.json");
    const checkpoint: Checkpoint = JSON.parse(await readFile(checkpointPath, "utf-8"));
    expect(checkpoint.testIndex).toBe(1);

    // Resume should be able to use the checkpoint
    const resumeResult =
      await $`bun ${CLI_PATH} resume ENG-1604-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();
    expect(resumeResult).toContain("Resuming");
  });

  test("events command shows health and handoff events", async () => {
    const events: PlanningEvent[] = [
      createEvent("health_check", { contextUtilization: 50 }),
      createEvent("context_warning", { utilization: 76, threshold: 75 }),
      createEvent("handoff_triggered", { trigger: "auto", utilization: 80 }),
    ];
    await createImplWorkspace("ENG-1605-1", { phase: "implementing" }, events);

    const result =
      await $`bun ${CLI_PATH} events ENG-1605-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("health_check");
    expect(result).toContain("context_warning");
    expect(result).toContain("handoff_triggered");
  });

  test("status command shows context utilization", async () => {
    await createImplWorkspace("ENG-1606-1", {
      phase: "implementing",
      contextUtilization: 72,
    });

    const result =
      await $`bun ${CLI_PATH} status ENG-1606-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    // Status should show context info
    expect(result).toContain("72%") || expect(result).toContain("context");
  });
});
