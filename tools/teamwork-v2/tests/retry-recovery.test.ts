import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

/**
 * Tests for retry & recovery in teamwork-v2 (ENG-1271).
 *
 * Features to test:
 * 1. Failure detection (exit code, timeout, stuck patterns)
 * 2. Failure summary generation
 * 3. Retry mechanism with attempt tracking
 * 4. Commands: resume, retry, abort
 * 5. Escalation after max retries
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-retry");
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
}

interface PlanningEvent {
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
}

interface FailureSummary {
  attemptedWork: string;
  failureDetails: string;
  suggestions: string[];
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
// Failure Detection Functions
// ============================================================================

describe("failure detection", () => {
  describe("exit code failure detection", () => {
    test("detects worker exit code 1 as failure", async () => {
      const events: PlanningEvent[] = [
        createEvent("worker_spawned", { workerId: "w1", role: "analyzer" }),
        createEvent("worker_failed", { workerId: "w1", exitCode: 1, error: "Process crashed" }),
      ];
      await createPlanWorkspace("ENG-100", { phase: "analyzing" }, events);

      const result =
        await $`bun ${CLI_PATH} status ENG-100 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("failed");
      expect(result).toContain("exit code");
    });

    test("detects non-zero exit codes as failure", async () => {
      const events: PlanningEvent[] = [
        createEvent("worker_spawned", { workerId: "w1", role: "analyzer" }),
        createEvent("worker_failed", { workerId: "w1", exitCode: 137, error: "OOM killed" }),
      ];
      await createPlanWorkspace("ENG-101", { phase: "analyzing" }, events);

      const result =
        await $`bun ${CLI_PATH} status ENG-101 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("failed");
    });

    test("does not report failure for exit code 0", async () => {
      const events: PlanningEvent[] = [
        createEvent("worker_spawned", { workerId: "w1", role: "analyzer" }),
        createEvent("worker_completed", { workerId: "w1", exitCode: 0, duration: 300 }),
      ];
      await createPlanWorkspace("ENG-102", { phase: "proposing" }, events);

      const result =
        await $`bun ${CLI_PATH} status ENG-102 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).not.toContain("failed");
    });
  });

  describe("phase timeout detection", () => {
    test("detects timeout when phase exceeds 30 minutes (default)", async () => {
      const thirtyFiveMinutesAgo = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      await createImplWorkspace("ENG-200-1", {
        phase: "implementing",
        startedAt: thirtyFiveMinutesAgo,
        timeoutMinutes: 30,
      });

      const result =
        await $`bun ${CLI_PATH} status ENG-200-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("timed out");
    });

    test("respects custom timeout from state.timeoutMinutes", async () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      await createImplWorkspace("ENG-201-1", {
        phase: "implementing",
        startedAt: fifteenMinutesAgo,
        timeoutMinutes: 10,
      });

      const result =
        await $`bun ${CLI_PATH} status ENG-201-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("timed out");
    });

    test("does not report timeout when within limit", async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      await createImplWorkspace("ENG-202-1", {
        phase: "implementing",
        startedAt: fiveMinutesAgo,
        timeoutMinutes: 30,
      });

      const result =
        await $`bun ${CLI_PATH} status ENG-202-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).not.toContain("timed out");
    });

    test("uses 60 minutes default timeout for planning workspaces", async () => {
      const fiftyMinutesAgo = new Date(Date.now() - 50 * 60 * 1000).toISOString();
      await createPlanWorkspace("ENG-203", {
        phase: "analyzing",
        startedAt: fiftyMinutesAgo,
        timeoutMinutes: 60,
      });

      const result =
        await $`bun ${CLI_PATH} status ENG-203 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      // Should not be timed out at 50 minutes with 60 minute timeout
      expect(result).not.toContain("timed out");
    });
  });

  describe("stuck pattern detection", () => {
    test("detects stuck when same error occurs 3x in 5 minutes", async () => {
      const now = Date.now();
      const events: PlanningEvent[] = [
        createEvent(
          "worker_failed",
          { workerId: "w1", exitCode: 1, error: "TypeScript compilation failed" },
          new Date(now - 4 * 60 * 1000).toISOString()
        ),
        createEvent(
          "worker_failed",
          { workerId: "w2", exitCode: 1, error: "TypeScript compilation failed" },
          new Date(now - 2 * 60 * 1000).toISOString()
        ),
        createEvent(
          "worker_failed",
          { workerId: "w3", exitCode: 1, error: "TypeScript compilation failed" },
          new Date(now - 1 * 60 * 1000).toISOString()
        ),
      ];
      await createImplWorkspace("ENG-300-1", { phase: "implementing" }, events);

      const result =
        await $`bun ${CLI_PATH} status ENG-300-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("stuck");
    });

    test("does not flag as stuck with only 2 repeated errors", async () => {
      const now = Date.now();
      const events: PlanningEvent[] = [
        createEvent(
          "worker_failed",
          { workerId: "w1", exitCode: 1, error: "TypeScript compilation failed" },
          new Date(now - 2 * 60 * 1000).toISOString()
        ),
        createEvent(
          "worker_failed",
          { workerId: "w2", exitCode: 1, error: "TypeScript compilation failed" },
          new Date(now - 1 * 60 * 1000).toISOString()
        ),
      ];
      await createImplWorkspace("ENG-301-1", { phase: "implementing" }, events);

      const result =
        await $`bun ${CLI_PATH} status ENG-301-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).not.toContain("stuck");
    });

    test("does not flag as stuck if errors are spread over more than 5 minutes", async () => {
      const now = Date.now();
      const events: PlanningEvent[] = [
        createEvent(
          "worker_failed",
          { workerId: "w1", exitCode: 1, error: "TypeScript compilation failed" },
          new Date(now - 10 * 60 * 1000).toISOString()
        ),
        createEvent(
          "worker_failed",
          { workerId: "w2", exitCode: 1, error: "TypeScript compilation failed" },
          new Date(now - 8 * 60 * 1000).toISOString()
        ),
        createEvent(
          "worker_failed",
          { workerId: "w3", exitCode: 1, error: "TypeScript compilation failed" },
          new Date(now - 1 * 60 * 1000).toISOString()
        ),
      ];
      await createImplWorkspace("ENG-302-1", { phase: "implementing" }, events);

      const result =
        await $`bun ${CLI_PATH} status ENG-302-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).not.toContain("stuck");
    });

    test("does not flag as stuck with 3 different errors", async () => {
      const now = Date.now();
      const events: PlanningEvent[] = [
        createEvent(
          "worker_failed",
          { workerId: "w1", exitCode: 1, error: "TypeScript compilation failed" },
          new Date(now - 3 * 60 * 1000).toISOString()
        ),
        createEvent(
          "worker_failed",
          { workerId: "w2", exitCode: 1, error: "Network timeout" },
          new Date(now - 2 * 60 * 1000).toISOString()
        ),
        createEvent(
          "worker_failed",
          { workerId: "w3", exitCode: 1, error: "Out of memory" },
          new Date(now - 1 * 60 * 1000).toISOString()
        ),
      ];
      await createImplWorkspace("ENG-303-1", { phase: "implementing" }, events);

      const result =
        await $`bun ${CLI_PATH} status ENG-303-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).not.toContain("stuck");
    });
  });
});

// ============================================================================
// Failure Summary Generation
// ============================================================================

describe("failure summary generation", () => {
  test("generates failure-summary.json when failure is detected", async () => {
    const events: PlanningEvent[] = [
      createEvent("worker_spawned", { workerId: "w1", role: "analyzer" }),
      createEvent("worker_failed", { workerId: "w1", exitCode: 1, error: "Process crashed" }),
    ];
    await createImplWorkspace("ENG-400-1", {
      phase: "implementing",
      failedAt: new Date().toISOString(),
      failureReason: "Worker exited with code 1",
    }, events);

    // Trigger failure summary generation via retry command
    await $`bun ${CLI_PATH} retry ENG-400-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    const summaryPath = join(TEST_WORKSPACES_DIR, "ENG-400-1", "failure-summary.json");
    const summaryContent = await readFile(summaryPath, "utf-8");
    const summary: FailureSummary = JSON.parse(summaryContent);

    expect(summary).toHaveProperty("attemptedWork");
    expect(summary).toHaveProperty("failureDetails");
    expect(summary).toHaveProperty("suggestions");
    expect(summary).toHaveProperty("timestamp");
  });

  test("failure summary contains attempted work description", async () => {
    const events: PlanningEvent[] = [
      createEvent("phase_transition", { from: "setup", to: "implementing" }),
      createEvent("test_started", { testName: "auth.test.ts", testIndex: 0 }),
      createEvent("worker_failed", { workerId: "w1", exitCode: 1, error: "Test failed" }),
    ];
    await createImplWorkspace("ENG-401-1", {
      phase: "implementing",
      tests: [{ name: "auth.test.ts", status: "failing" }],
      currentTestIndex: 0,
      failedAt: new Date().toISOString(),
    }, events);

    await $`bun ${CLI_PATH} retry ENG-401-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    const summaryPath = join(TEST_WORKSPACES_DIR, "ENG-401-1", "failure-summary.json");
    const summary: FailureSummary = JSON.parse(await readFile(summaryPath, "utf-8"));

    expect(summary.attemptedWork).toContain("auth.test.ts");
  });

  test("failure summary contains failure details", async () => {
    const events: PlanningEvent[] = [
      createEvent("worker_failed", { workerId: "w1", exitCode: 137, error: "OOM killed - container exceeded memory limit" }),
    ];
    await createImplWorkspace("ENG-402-1", {
      phase: "implementing",
      failedAt: new Date().toISOString(),
      failureReason: "OOM killed - container exceeded memory limit",
    }, events);

    await $`bun ${CLI_PATH} retry ENG-402-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    const summaryPath = join(TEST_WORKSPACES_DIR, "ENG-402-1", "failure-summary.json");
    const summary: FailureSummary = JSON.parse(await readFile(summaryPath, "utf-8"));

    expect(summary.failureDetails).toContain("OOM");
  });

  test("failure summary includes suggestions array", async () => {
    const events: PlanningEvent[] = [
      createEvent("worker_failed", { workerId: "w1", exitCode: 1, error: "TypeScript compilation failed" }),
    ];
    await createImplWorkspace("ENG-403-1", {
      phase: "implementing",
      failedAt: new Date().toISOString(),
      failureReason: "TypeScript compilation failed",
    }, events);

    await $`bun ${CLI_PATH} retry ENG-403-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    const summaryPath = join(TEST_WORKSPACES_DIR, "ENG-403-1", "failure-summary.json");
    const summary: FailureSummary = JSON.parse(await readFile(summaryPath, "utf-8"));

    expect(Array.isArray(summary.suggestions)).toBe(true);
    expect(summary.suggestions.length).toBeGreaterThan(0);
  });

  test("failure summary is updated on each retry attempt", async () => {
    await createImplWorkspace("ENG-404-1", {
      phase: "implementing",
      attemptCount: 1,
      failedAt: new Date().toISOString(),
      failureReason: "First failure",
    });

    // First retry
    await $`bun ${CLI_PATH} retry ENG-404-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    const summaryPath = join(TEST_WORKSPACES_DIR, "ENG-404-1", "failure-summary.json");
    const summary1: FailureSummary = JSON.parse(await readFile(summaryPath, "utf-8"));
    const timestamp1 = summary1.timestamp;

    // Wait a bit and trigger another failure/retry
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update state to simulate another failure
    const statePath = join(TEST_WORKSPACES_DIR, "ENG-404-1", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    state.failureReason = "Second failure";
    await writeFile(statePath, JSON.stringify(state, null, 2));

    await $`bun ${CLI_PATH} retry ENG-404-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    const summary2: FailureSummary = JSON.parse(await readFile(summaryPath, "utf-8"));

    expect(summary2.timestamp).not.toBe(timestamp1);
    expect(summary2.failureDetails).toContain("Second failure");
  });
});

// ============================================================================
// Retry Logic
// ============================================================================

describe("retry mechanism", () => {
  describe("attempt tracking", () => {
    test("state.attemptCount starts at 0", async () => {
      await $`bun ${CLI_PATH} impl ENG-500-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      const state = await readState<ImplState>("ENG-500-1");
      expect(state.attemptCount).toBe(0);
    });

    test("retry increments attemptCount", async () => {
      await createImplWorkspace("ENG-501-1", {
        phase: "implementing",
        attemptCount: 0,
        failedAt: new Date().toISOString(),
        failureReason: "Test failure",
      });

      await $`bun ${CLI_PATH} retry ENG-501-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      const state = await readState<ImplState>("ENG-501-1");
      expect(state.attemptCount).toBe(1);
    });

    test("multiple retries increment attemptCount correctly", async () => {
      await createImplWorkspace("ENG-502-1", {
        phase: "implementing",
        attemptCount: 1,
        failedAt: new Date().toISOString(),
        failureReason: "Test failure",
      });

      await $`bun ${CLI_PATH} retry ENG-502-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      const state = await readState<ImplState>("ENG-502-1");
      expect(state.attemptCount).toBe(2);
    });
  });

  describe("maximum retry limit", () => {
    test("allows retry when attemptCount < 3", async () => {
      await createImplWorkspace("ENG-600-1", {
        phase: "implementing",
        attemptCount: 2,
        failedAt: new Date().toISOString(),
        failureReason: "Test failure",
      });

      const result =
        await $`bun ${CLI_PATH} retry ENG-600-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).toBe(0);
    });

    test("blocks retry when attemptCount >= 3", async () => {
      await createImplWorkspace("ENG-601-1", {
        phase: "implementing",
        attemptCount: 3,
        failedAt: new Date().toISOString(),
        failureReason: "Test failure",
      });

      const result =
        await $`bun ${CLI_PATH} retry ENG-601-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("maximum retries");
    });

    test("escalates automatically after max retries reached", async () => {
      await createImplWorkspace("ENG-602-1", {
        phase: "implementing",
        attemptCount: 3,
        failedAt: new Date().toISOString(),
        failureReason: "Test failure",
      });

      await $`bun ${CLI_PATH} retry ENG-602-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const state = await readState<ImplState>("ENG-602-1");
      const events = await readEvents("ENG-602-1");

      // Should have escalation event
      const escalationEvent = events.find((e) => e.event === "escalation");
      expect(escalationEvent).toBeDefined();
      expect(escalationEvent?.data.reason).toContain("maximum retries");
    });
  });

  describe("retry with failure context", () => {
    test("retry emits retry_started event with failure context", async () => {
      await createImplWorkspace("ENG-700-1", {
        phase: "implementing",
        attemptCount: 0,
        failedAt: new Date().toISOString(),
        failureReason: "TypeScript compilation failed",
      });

      await $`bun ${CLI_PATH} retry ENG-700-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      const events = await readEvents("ENG-700-1");
      const retryEvent = events.find((e) => e.event === "retry_started");

      expect(retryEvent).toBeDefined();
      expect(retryEvent?.data.previousFailure).toContain("TypeScript");
      expect(retryEvent?.data.attemptNumber).toBe(1);
    });

    test("clears failedAt on successful retry start", async () => {
      await createImplWorkspace("ENG-701-1", {
        phase: "implementing",
        attemptCount: 1,
        failedAt: new Date().toISOString(),
        failureReason: "Previous failure",
      });

      await $`bun ${CLI_PATH} retry ENG-701-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      const state = await readState<ImplState>("ENG-701-1");
      expect(state.failedAt).toBeUndefined();
    });
  });
});

// ============================================================================
// Resume Command
// ============================================================================

describe("teamwork-v2 resume command", () => {
  test("resume continues from checkpoint", async () => {
    await createImplWorkspace("ENG-800-1", {
      phase: "implementing",
      tests: [
        { name: "test1", status: "passing" },
        { name: "test2", status: "passing" },
        { name: "test3", status: "pending" },
      ],
      currentTestIndex: 2,
    });

    const result =
      await $`bun ${CLI_PATH} resume ENG-800-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

    expect(result).toContain("Resuming");
    expect(result).toContain("test3");
  });

  test("resume without failure does not increment attemptCount", async () => {
    await createImplWorkspace("ENG-801-1", {
      phase: "implementing",
      attemptCount: 1,
    });

    await $`bun ${CLI_PATH} resume ENG-801-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    const state = await readState<ImplState>("ENG-801-1");
    expect(state.attemptCount).toBe(1);
  });

  test("resume emits resume_started event", async () => {
    await createImplWorkspace("ENG-802-1", {
      phase: "implementing",
      currentTestIndex: 1,
    });

    await $`bun ${CLI_PATH} resume ENG-802-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    const events = await readEvents("ENG-802-1");
    const resumeEvent = events.find((e) => e.event === "resume_started");

    expect(resumeEvent).toBeDefined();
    expect(resumeEvent?.data.fromPhase).toBe("implementing");
  });

  test("resume fails if workspace does not exist", async () => {
    const result =
      await $`bun ${CLI_PATH} resume ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("not found");
  });

  test("resume fails if workspace is already complete", async () => {
    await createImplWorkspace("ENG-803-1", {
      phase: "complete",
      completedAt: new Date().toISOString(),
    });

    const result =
      await $`bun ${CLI_PATH} resume ENG-803-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("already complete");
  });

  test("resume fails if workspace is aborted", async () => {
    await createImplWorkspace("ENG-804-1", {
      phase: "implementing",
      abortedAt: new Date().toISOString(),
      abortReason: "User requested abort",
    });

    const result =
      await $`bun ${CLI_PATH} resume ENG-804-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("aborted");
  });

  test("shows resume command help with resume --help", async () => {
    const result = await $`bun ${CLI_PATH} resume --help`.text();

    expect(result).toContain("resume");
    expect(result).toContain("id");
    expect(result).toContain("workspaces-dir");
  });
});

// ============================================================================
// Retry Command
// ============================================================================

describe("teamwork-v2 retry command", () => {
  test("retry manually triggers retry with failure context", async () => {
    await createImplWorkspace("ENG-900-1", {
      phase: "implementing",
      attemptCount: 0,
      failedAt: new Date().toISOString(),
      failureReason: "Test failure",
    });

    const result =
      await $`bun ${CLI_PATH} retry ENG-900-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

    expect(result).toContain("Retrying");
    expect(result).toContain("attempt 1");
  });

  test("retry shows failure context in output", async () => {
    await createImplWorkspace("ENG-901-1", {
      phase: "implementing",
      failedAt: new Date().toISOString(),
      failureReason: "TypeScript compilation error: missing semicolon",
    });

    const result =
      await $`bun ${CLI_PATH} retry ENG-901-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

    expect(result).toContain("TypeScript compilation error");
  });

  test("retry fails if workspace does not exist", async () => {
    const result =
      await $`bun ${CLI_PATH} retry ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("not found");
  });

  test("retry fails if workspace is already complete", async () => {
    await createImplWorkspace("ENG-902-1", {
      phase: "complete",
      completedAt: new Date().toISOString(),
    });

    const result =
      await $`bun ${CLI_PATH} retry ENG-902-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("already complete");
  });

  test("retry fails if workspace is not in failed state", async () => {
    await createImplWorkspace("ENG-903-1", {
      phase: "implementing",
      // No failedAt set
    });

    const result =
      await $`bun ${CLI_PATH} retry ENG-903-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("not in failed state");
  });

  test("shows retry command help with retry --help", async () => {
    const result = await $`bun ${CLI_PATH} retry --help`.text();

    expect(result).toContain("retry");
    expect(result).toContain("id");
    expect(result).toContain("workspaces-dir");
  });
});

// ============================================================================
// Abort Command
// ============================================================================

describe("teamwork-v2 abort command", () => {
  test("abort stops team execution", async () => {
    await createImplWorkspace("ENG-1000-1", {
      phase: "implementing",
    });

    const result =
      await $`bun ${CLI_PATH} abort ENG-1000-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("Aborted");

    const state = await readState<ImplState>("ENG-1000-1");
    expect(state.abortedAt).toBeDefined();
  });

  test("abort sets abortedAt timestamp", async () => {
    await createImplWorkspace("ENG-1001-1", {
      phase: "implementing",
    });

    const beforeAbort = new Date().toISOString();
    await $`bun ${CLI_PATH} abort ENG-1001-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();
    const afterAbort = new Date().toISOString();

    const state = await readState<ImplState>("ENG-1001-1");
    expect(state.abortedAt).toBeDefined();
    expect(new Date(state.abortedAt!).getTime()).toBeGreaterThanOrEqual(new Date(beforeAbort).getTime());
    expect(new Date(state.abortedAt!).getTime()).toBeLessThanOrEqual(new Date(afterAbort).getTime());
  });

  test("abort with --reason records abort reason", async () => {
    await createImplWorkspace("ENG-1002-1", {
      phase: "implementing",
    });

    await $`bun ${CLI_PATH} abort ENG-1002-1 --reason "Blocking issue discovered" --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const state = await readState<ImplState>("ENG-1002-1");
    expect(state.abortReason).toBe("Blocking issue discovered");
  });

  test("abort without reason sets default reason", async () => {
    await createImplWorkspace("ENG-1003-1", {
      phase: "implementing",
    });

    await $`bun ${CLI_PATH} abort ENG-1003-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const state = await readState<ImplState>("ENG-1003-1");
    expect(state.abortReason).toContain("Manual abort");
  });

  test("abort emits aborted event", async () => {
    await createImplWorkspace("ENG-1004-1", {
      phase: "implementing",
    });

    await $`bun ${CLI_PATH} abort ENG-1004-1 --reason "User requested" --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const events = await readEvents("ENG-1004-1");
    const abortEvent = events.find((e) => e.event === "aborted");

    expect(abortEvent).toBeDefined();
    expect(abortEvent?.data.reason).toBe("User requested");
  });

  test("abort fails if workspace does not exist", async () => {
    const result =
      await $`bun ${CLI_PATH} abort ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("not found");
  });

  test("abort fails if workspace is already complete", async () => {
    await createImplWorkspace("ENG-1005-1", {
      phase: "complete",
      completedAt: new Date().toISOString(),
    });

    const result =
      await $`bun ${CLI_PATH} abort ENG-1005-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("already complete");
  });

  test("abort fails if workspace is already aborted", async () => {
    await createImplWorkspace("ENG-1006-1", {
      phase: "implementing",
      abortedAt: new Date().toISOString(),
      abortReason: "Previously aborted",
    });

    const result =
      await $`bun ${CLI_PATH} abort ENG-1006-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("already aborted");
  });

  test("shows abort command help with abort --help", async () => {
    const result = await $`bun ${CLI_PATH} abort --help`.text();

    expect(result).toContain("abort");
    expect(result).toContain("id");
    expect(result).toContain("--reason");
    expect(result).toContain("workspaces-dir");
  });
});

// ============================================================================
// Escalation
// ============================================================================

describe("escalation", () => {
  test("escalation flag set after max retries", async () => {
    await createImplWorkspace("ENG-1100-1", {
      phase: "implementing",
      attemptCount: 2,
      failedAt: new Date().toISOString(),
      failureReason: "Persistent failure",
    });

    // This should be the 3rd attempt, which triggers escalation
    await $`bun ${CLI_PATH} retry ENG-1100-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    // After this fails, should escalate
    const state = await readState<PlanningState>("ENG-1100-1");
    // Note: escalated might not be set until the attempt fails
    // We need to check that the escalation flow is triggered
    const events = await readEvents("ENG-1100-1");
    const escalationEvent = events.find((e) => e.event === "escalation");

    expect(state.attemptCount).toBe(3);
    // If retry was blocked due to max retries
    if (escalationEvent) {
      expect(escalationEvent.data.reason).toContain("maximum retries");
    }
  });

  test("escalation event written when max retries exceeded", async () => {
    await createImplWorkspace("ENG-1101-1", {
      phase: "implementing",
      attemptCount: 3,
      failedAt: new Date().toISOString(),
      failureReason: "Persistent failure",
    });

    await $`bun ${CLI_PATH} retry ENG-1101-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const events = await readEvents("ENG-1101-1");
    const escalationEvent = events.find((e) => e.event === "escalation");

    expect(escalationEvent).toBeDefined();
    expect(escalationEvent?.data.reason).toContain("maximum retries");
    expect(escalationEvent?.data.attemptCount).toBe(3);
    expect(escalationEvent?.data.phase).toBe("implementing");
  });

  test("escalation event contains Linear update data", async () => {
    await createImplWorkspace("ENG-1102-1", {
      phase: "implementing",
      attemptCount: 3,
      failedAt: new Date().toISOString(),
      failureReason: "TypeScript compilation failed",
    });

    await $`bun ${CLI_PATH} retry ENG-1102-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const events = await readEvents("ENG-1102-1");
    const escalationEvent = events.find((e) => e.event === "escalation");

    expect(escalationEvent).toBeDefined();
    expect(escalationEvent?.data.linearUpdate).toBeDefined();
    expect(escalationEvent?.data.linearUpdate).toHaveProperty("issueId");
    expect(escalationEvent?.data.linearUpdate).toHaveProperty("comment");
  });

  test("escalation records failure summary path", async () => {
    await createImplWorkspace("ENG-1103-1", {
      phase: "implementing",
      attemptCount: 3,
      failedAt: new Date().toISOString(),
      failureReason: "Test failure",
    });

    await $`bun ${CLI_PATH} retry ENG-1103-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const events = await readEvents("ENG-1103-1");
    const escalationEvent = events.find((e) => e.event === "escalation");

    expect(escalationEvent?.data.failureSummaryPath).toContain("failure-summary.json");
  });

  test("status shows escalated state", async () => {
    const events: PlanningEvent[] = [
      createEvent("escalation", {
        reason: "Maximum retries exceeded",
        attemptCount: 3,
      }),
    ];
    await createPlanWorkspace("ENG-1104", {
      phase: "analyzing",
      escalated: true,
      escalatedAt: new Date().toISOString(),
    }, events);

    const result =
      await $`bun ${CLI_PATH} status ENG-1104 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("escalated");
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("retry-recovery integration", () => {
  test("full failure-retry-success cycle", async () => {
    // Create workspace that has failed
    await createImplWorkspace("ENG-1200-1", {
      phase: "implementing",
      attemptCount: 0,
      failedAt: new Date().toISOString(),
      failureReason: "Initial failure",
    });

    // First retry
    await $`bun ${CLI_PATH} retry ENG-1200-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    const state = await readState<ImplState>("ENG-1200-1");
    expect(state.attemptCount).toBe(1);
    expect(state.failedAt).toBeUndefined();

    const events = await readEvents("ENG-1200-1");
    const retryEvent = events.find((e) => e.event === "retry_started");
    expect(retryEvent).toBeDefined();
  });

  test("resume after retry preserves attempt count", async () => {
    await createImplWorkspace("ENG-1201-1", {
      phase: "implementing",
      attemptCount: 2,
      tests: [{ name: "test1", status: "passing" }, { name: "test2", status: "pending" }],
      currentTestIndex: 1,
    });

    await $`bun ${CLI_PATH} resume ENG-1201-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    const state = await readState<ImplState>("ENG-1201-1");
    expect(state.attemptCount).toBe(2); // Should not change on resume
  });

  test("abort prevents further retries", async () => {
    await createImplWorkspace("ENG-1202-1", {
      phase: "implementing",
      attemptCount: 1,
      failedAt: new Date().toISOString(),
      failureReason: "Some failure",
    });

    // Abort the workspace
    await $`bun ${CLI_PATH} abort ENG-1202-1 --reason "Giving up" --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    // Try to retry - should fail
    const retryResult =
      await $`bun ${CLI_PATH} retry ENG-1202-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(retryResult.exitCode).not.toBe(0);
    expect(retryResult.stderr.toString()).toContain("aborted");
  });

  test("list shows failed workspaces distinctly", async () => {
    await createImplWorkspace("ENG-1203-1", {
      phase: "implementing",
      failedAt: new Date().toISOString(),
      failureReason: "Test failure",
    });
    await createImplWorkspace("ENG-1204-1", {
      phase: "implementing",
    });

    const result =
      await $`bun ${CLI_PATH} list --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("ENG-1203-1");
    expect(result).toContain("failed");
    expect(result).toContain("ENG-1204-1");
  });

  test("events shows failure and retry history", async () => {
    const events: PlanningEvent[] = [
      createEvent("worker_failed", { workerId: "w1", exitCode: 1, error: "First failure" }),
      createEvent("retry_started", { attemptNumber: 1, previousFailure: "First failure" }),
      createEvent("worker_failed", { workerId: "w2", exitCode: 1, error: "Second failure" }),
      createEvent("retry_started", { attemptNumber: 2, previousFailure: "Second failure" }),
    ];
    await createImplWorkspace("ENG-1205-1", {
      phase: "implementing",
      attemptCount: 2,
    }, events);

    const result =
      await $`bun ${CLI_PATH} events ENG-1205-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("worker_failed");
    expect(result).toContain("retry_started");
  });
});
