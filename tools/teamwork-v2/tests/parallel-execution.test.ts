import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

/**
 * Tests for Parallel Slice Implementation (ENG-1274).
 *
 * Features tested:
 * 1. Parallel implementation command (`teamwork-v2 impl --parallel <spec-id>`)
 * 2. Dependency ordering (independent slices in parallel, dependent slices wait)
 * 3. Concurrency control (--max-concurrent flag, default 3)
 * 4. Partial failure handling (failed slices reported, others continue)
 * 5. Watch integration for parallel progress
 * 6. Final report (success/failure per slice, total time, skipped slices)
 * 7. Parallel workspace structure
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-parallel");
const CLI_PATH = join(import.meta.dir, "../src/cli.ts");

interface WorkspaceDeps {
  workspacesDir: string;
}

// Slice definition with dependencies
interface SliceDefinition {
  title: string;
  description?: string;
  acceptanceCriteria?: string[];
  testApproach?: string;
  dependencies: string[];
  isIndependent: boolean;
}

// Parallel execution state stored in execution-plan.json
interface ParallelExecutionState {
  specId: string;
  status: "pending" | "running" | "complete" | "failed";
  sliceStatuses: Record<string, SliceStatus>;
  startedAt?: string;
  completedAt?: string;
  maxConcurrent: number;
  totalSlices: number;
  completedSlices: number;
  failedSlices: number;
  skippedSlices: number;
}

// Per-slice status in parallel execution
interface SliceStatus {
  sliceId: string;
  title: string;
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  dependencies: string[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// Results summary stored in results.json
interface ParallelResults {
  specId: string;
  success: boolean;
  totalTime: number;
  sliceResults: SliceResult[];
  summary: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  };
}

interface SliceResult {
  sliceId: string;
  title: string;
  status: "complete" | "failed" | "skipped";
  duration?: number;
  error?: string;
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

// Helper to create a planning workspace with slices
async function createPlanWorkspaceWithSlices(
  specId: string,
  slices: SliceDefinition[]
): Promise<string> {
  const workspacePath = join(TEST_WORKSPACES_DIR, specId);
  await mkdir(workspacePath, { recursive: true });
  await mkdir(join(workspacePath, "sessions"), { recursive: true });

  const now = new Date().toISOString();
  const state = {
    type: "plan",
    specId,
    phase: "approved",
    revisionCount: 0,
    timeoutMinutes: 60,
    createdAt: now,
    updatedAt: now,
  };

  await writeFile(
    join(workspacePath, "state.json"),
    JSON.stringify(state, null, 2)
  );

  await writeFile(
    join(workspacePath, "slices.json"),
    JSON.stringify(slices, null, 2)
  );

  const event = {
    timestamp: now,
    event: "workspace_created",
    data: { specId },
  };
  await writeFile(join(workspacePath, "events.jsonl"), JSON.stringify(event) + "\n");

  return workspacePath;
}

// Standard test slices with dependencies
const TEST_SLICES: SliceDefinition[] = [
  { title: "Slice 1", description: "Independent slice 1", dependencies: [], isIndependent: true },
  { title: "Slice 2", description: "Independent slice 2", dependencies: [], isIndependent: true },
  { title: "Slice 3", description: "Depends on Slice 1", dependencies: ["Slice 1"], isIndependent: false },
  { title: "Slice 4", description: "Depends on Slice 1 and 2", dependencies: ["Slice 1", "Slice 2"], isIndependent: false },
];

// ============================================================================
// 1. Parallel Implementation Command Tests
// ============================================================================

describe("teamwork-v2 impl --parallel command", () => {
  describe("basic parallel execution", () => {
    test("starts parallel implementation with --parallel flag", async () => {
      await createPlanWorkspaceWithSlices("ENG-100", TEST_SLICES);

      const result =
        await $`bun ${CLI_PATH} impl --parallel ENG-100 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain("Starting parallel implementation");
      expect(result.stdout.toString()).toContain("4 slices");
    });

    test("creates parallel workspace directory", async () => {
      await createPlanWorkspaceWithSlices("ENG-101", TEST_SLICES);

      await $`bun ${CLI_PATH} impl --parallel ENG-101 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const parallelPath = join(TEST_WORKSPACES_DIR, "ENG-101", "parallel");
      const { stat } = await import("fs/promises");
      const statResult = await stat(parallelPath);
      expect(statResult.isDirectory()).toBe(true);
    });

    test("creates execution-plan.json in parallel workspace", async () => {
      await createPlanWorkspaceWithSlices("ENG-102", TEST_SLICES);

      await $`bun ${CLI_PATH} impl --parallel ENG-102 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const planPath = join(TEST_WORKSPACES_DIR, "ENG-102", "parallel", "execution-plan.json");
      const content = await readFile(planPath, "utf-8");
      const plan: ParallelExecutionState = JSON.parse(content);

      expect(plan.specId).toBe("ENG-102");
      expect(plan.totalSlices).toBe(4);
      expect(plan.maxConcurrent).toBe(3);
    });

    test("identifies independent slices correctly", async () => {
      await createPlanWorkspaceWithSlices("ENG-103", TEST_SLICES);

      await $`bun ${CLI_PATH} impl --parallel ENG-103 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const planPath = join(TEST_WORKSPACES_DIR, "ENG-103", "parallel", "execution-plan.json");
      const plan: ParallelExecutionState = JSON.parse(await readFile(planPath, "utf-8"));

      // Slice 1 and 2 should be marked as pending (ready to start)
      expect(plan.sliceStatuses["ENG-103-1"].status).toBe("pending");
      expect(plan.sliceStatuses["ENG-103-2"].status).toBe("pending");
    });

    test("output shows which slices will run in parallel", async () => {
      await createPlanWorkspaceWithSlices("ENG-104", TEST_SLICES);

      const result =
        await $`bun ${CLI_PATH} impl --parallel ENG-104 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain("Slice 1");
      expect(result).toContain("Slice 2");
      expect(result).toMatch(/parallel|concurrent/i);
    });
  });

  describe("argument validation", () => {
    test("fails if spec-id is missing with --parallel", async () => {
      const result =
        await $`bun ${CLI_PATH} impl --parallel --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("spec-id");
    });

    test("fails if planning workspace does not exist", async () => {
      const result =
        await $`bun ${CLI_PATH} impl --parallel ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("not found");
    });

    test("fails if no slices found in planning workspace", async () => {
      // Create workspace without slices
      const workspacePath = join(TEST_WORKSPACES_DIR, "ENG-105");
      await mkdir(workspacePath, { recursive: true });
      const state = { type: "plan", specId: "ENG-105", phase: "approved" };
      await writeFile(join(workspacePath, "state.json"), JSON.stringify(state));

      const result =
        await $`bun ${CLI_PATH} impl --parallel ENG-105 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("No slices found");
    });

    test("fails if planning workspace is not in approved phase", async () => {
      const workspacePath = join(TEST_WORKSPACES_DIR, "ENG-106");
      await mkdir(workspacePath, { recursive: true });
      const state = { type: "plan", specId: "ENG-106", phase: "analyzing" };
      await writeFile(join(workspacePath, "state.json"), JSON.stringify(state));
      await writeFile(join(workspacePath, "slices.json"), JSON.stringify(TEST_SLICES));

      const result =
        await $`bun ${CLI_PATH} impl --parallel ENG-106 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toMatch(/not approved|must be approved/i);
    });
  });
});

// ============================================================================
// 2. Dependency Ordering Tests
// ============================================================================

describe("Dependency Ordering", () => {
  test("independent slices (no deps) can run in parallel", async () => {
    const { parseSliceDependencies, getReadySlices } = await import("../src/parallel-execution");

    const slices = [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: [], isIndependent: true },
      { title: "C", dependencies: ["A"], isIndependent: false },
    ];

    const graph = parseSliceDependencies(slices);
    const ready = getReadySlices(graph, new Set());

    expect(ready).toContain("A");
    expect(ready).toContain("B");
    expect(ready).not.toContain("C");
  });

  test("dependent slices wait for their dependencies to complete", async () => {
    const { parseSliceDependencies, getReadySlices } = await import("../src/parallel-execution");

    const slices = [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: ["A"], isIndependent: false },
    ];

    const graph = parseSliceDependencies(slices);

    // Nothing completed yet - only A is ready
    const readyBefore = getReadySlices(graph, new Set());
    expect(readyBefore).toEqual(["A"]);

    // A is complete - now B is ready
    const readyAfter = getReadySlices(graph, new Set(["A"]));
    expect(readyAfter).toContain("B");
  });

  test("slice with multiple dependencies waits for all", async () => {
    const { parseSliceDependencies, getReadySlices } = await import("../src/parallel-execution");

    const slices = [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: [], isIndependent: true },
      { title: "C", dependencies: ["A", "B"], isIndependent: false },
    ];

    const graph = parseSliceDependencies(slices);

    // Only A complete - C not ready
    expect(getReadySlices(graph, new Set(["A"]))).not.toContain("C");

    // Both A and B complete - C is ready
    expect(getReadySlices(graph, new Set(["A", "B"]))).toContain("C");
  });

  test("dependency graph correctly parses slice definitions", async () => {
    const { parseSliceDependencies } = await import("../src/parallel-execution");

    const graph = parseSliceDependencies(TEST_SLICES);

    expect(graph.get("Slice 1")?.dependencies).toEqual([]);
    expect(graph.get("Slice 2")?.dependencies).toEqual([]);
    expect(graph.get("Slice 3")?.dependencies).toEqual(["Slice 1"]);
    expect(graph.get("Slice 4")?.dependencies).toEqual(["Slice 1", "Slice 2"]);
  });

  test("detects circular dependencies", async () => {
    const { parseSliceDependencies } = await import("../src/parallel-execution");

    const slices = [
      { title: "A", dependencies: ["B"], isIndependent: false },
      { title: "B", dependencies: ["A"], isIndependent: false },
    ];

    expect(() => parseSliceDependencies(slices)).toThrow("circular dependency");
  });

  test("execution order respects dependencies in CLI output", async () => {
    await createPlanWorkspaceWithSlices("ENG-200", TEST_SLICES);

    const result =
      await $`bun ${CLI_PATH} impl --parallel ENG-200 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

    // Slice 3 should appear after Slice 1, Slice 4 should appear after both 1 and 2
    const slice1Index = result.indexOf("Slice 1");
    const slice3Index = result.indexOf("Slice 3");
    const slice4Index = result.indexOf("Slice 4");

    expect(slice1Index).toBeLessThan(slice3Index);
    expect(slice1Index).toBeLessThan(slice4Index);
  });
});

// ============================================================================
// 3. Concurrency Control Tests
// ============================================================================

describe("Concurrency Control", () => {
  test("--max-concurrent limits concurrent teams (default 3)", async () => {
    await createPlanWorkspaceWithSlices("ENG-300", TEST_SLICES);

    await $`bun ${CLI_PATH} impl --parallel ENG-300 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const planPath = join(TEST_WORKSPACES_DIR, "ENG-300", "parallel", "execution-plan.json");
    const plan: ParallelExecutionState = JSON.parse(await readFile(planPath, "utf-8"));

    expect(plan.maxConcurrent).toBe(3);
  });

  test("--max-concurrent option overrides default", async () => {
    await createPlanWorkspaceWithSlices("ENG-301", TEST_SLICES);

    await $`bun ${CLI_PATH} impl --parallel ENG-301 --max-concurrent 2 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const planPath = join(TEST_WORKSPACES_DIR, "ENG-301", "parallel", "execution-plan.json");
    const plan: ParallelExecutionState = JSON.parse(await readFile(planPath, "utf-8"));

    expect(plan.maxConcurrent).toBe(2);
  });

  test("--max-concurrent 1 runs slices sequentially", async () => {
    await createPlanWorkspaceWithSlices("ENG-302", TEST_SLICES);

    const result =
      await $`bun ${CLI_PATH} impl --parallel ENG-302 --max-concurrent 1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

    expect(result).toMatch(/sequential|one at a time|max.*1/i);
  });

  test("queues excess slices until slots free up", async () => {
    const { createParallelExecutor } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    const executor = await createParallelExecutor("ENG-303", deps, { maxConcurrent: 2 });

    // With 2 independent slices and max 2, both should start
    // Slice 3 (depends on 1) and Slice 4 (depends on 1 & 2) should wait
    expect(executor.getRunningCount()).toBeLessThanOrEqual(2);
    expect(executor.getQueuedCount()).toBeGreaterThanOrEqual(0);
  });

  test("respects max-concurrent during execution", async () => {
    const { runParallelExecution, readParallelState } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-304", [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: [], isIndependent: true },
      { title: "C", dependencies: [], isIndependent: true },
      { title: "D", dependencies: [], isIndependent: true },
    ]);

    // Start with max 2, snapshot during execution
    const execution = runParallelExecution("ENG-304", deps, { maxConcurrent: 2, dryRun: true });

    // At any point, no more than 2 should be running
    const state = await readParallelState("ENG-304", deps);
    const runningCount = Object.values(state.sliceStatuses).filter(
      (s) => s.status === "running"
    ).length;

    expect(runningCount).toBeLessThanOrEqual(2);
  });

  test("shows concurrency in output", async () => {
    await createPlanWorkspaceWithSlices("ENG-305", TEST_SLICES);

    const result =
      await $`bun ${CLI_PATH} impl --parallel ENG-305 --max-concurrent 5 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

    expect(result).toMatch(/concurrent.*5|max.*5/i);
  });
});

// ============================================================================
// 4. Partial Failure Handling Tests
// ============================================================================

describe("Partial Failure Handling", () => {
  test("successful slices complete normally", async () => {
    const { runParallelExecution, readParallelResults } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-400", [
      { title: "Success 1", dependencies: [], isIndependent: true },
      { title: "Success 2", dependencies: [], isIndependent: true },
    ]);

    await runParallelExecution("ENG-400", deps, { dryRun: true, mockResults: ["success", "success"] });

    const results = await readParallelResults("ENG-400", deps);
    expect(results.summary.completed).toBe(2);
    expect(results.summary.failed).toBe(0);
  });

  test("failed slices are reported in results", async () => {
    const { runParallelExecution, readParallelResults } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-401", [
      { title: "Will Fail", dependencies: [], isIndependent: true },
      { title: "Will Pass", dependencies: [], isIndependent: true },
    ]);

    await runParallelExecution("ENG-401", deps, { dryRun: true, mockResults: ["fail", "success"] });

    const results = await readParallelResults("ENG-401", deps);
    expect(results.summary.failed).toBe(1);
    expect(results.summary.completed).toBe(1);
    expect(results.sliceResults.find((s) => s.title === "Will Fail")?.status).toBe("failed");
  });

  test("other independent slices continue after failure", async () => {
    const { runParallelExecution, readParallelResults } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-402", [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: [], isIndependent: true },
      { title: "C", dependencies: [], isIndependent: true },
    ]);

    // A fails, but B and C should continue
    await runParallelExecution("ENG-402", deps, { dryRun: true, mockResults: ["fail", "success", "success"] });

    const results = await readParallelResults("ENG-402", deps);
    expect(results.sliceResults.find((s) => s.title === "B")?.status).toBe("complete");
    expect(results.sliceResults.find((s) => s.title === "C")?.status).toBe("complete");
  });

  test("dependent slices are skipped if deps fail", async () => {
    const { runParallelExecution, readParallelResults } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-403", [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: ["A"], isIndependent: false },
    ]);

    // A fails, B should be skipped
    await runParallelExecution("ENG-403", deps, { dryRun: true, mockResults: ["fail"] });

    const results = await readParallelResults("ENG-403", deps);
    expect(results.sliceResults.find((s) => s.title === "B")?.status).toBe("skipped");
    expect(results.summary.skipped).toBe(1);
  });

  test("transitive dependencies are skipped on failure", async () => {
    const { runParallelExecution, readParallelResults } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-404", [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: ["A"], isIndependent: false },
      { title: "C", dependencies: ["B"], isIndependent: false },
    ]);

    // A fails, B and C should both be skipped
    await runParallelExecution("ENG-404", deps, { dryRun: true, mockResults: ["fail"] });

    const results = await readParallelResults("ENG-404", deps);
    expect(results.sliceResults.find((s) => s.title === "B")?.status).toBe("skipped");
    expect(results.sliceResults.find((s) => s.title === "C")?.status).toBe("skipped");
    expect(results.summary.skipped).toBe(2);
  });

  test("partial failure sets overall status to failed", async () => {
    const { runParallelExecution, readParallelState } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-405", [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: [], isIndependent: true },
    ]);

    await runParallelExecution("ENG-405", deps, { dryRun: true, mockResults: ["fail", "success"] });

    const state = await readParallelState("ENG-405", deps);
    expect(state.status).toBe("failed");
  });

  test("all success sets overall status to complete", async () => {
    const { runParallelExecution, readParallelState } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-406", [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: [], isIndependent: true },
    ]);

    await runParallelExecution("ENG-406", deps, { dryRun: true, mockResults: ["success", "success"] });

    const state = await readParallelState("ENG-406", deps);
    expect(state.status).toBe("complete");
  });

  test("error details are captured in slice status", async () => {
    const { runParallelExecution, readParallelState } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-407", [
      { title: "A", dependencies: [], isIndependent: true },
    ]);

    await runParallelExecution("ENG-407", deps, {
      dryRun: true,
      mockResults: ["fail"],
      mockErrors: ["Test timeout exceeded"],
    });

    const state = await readParallelState("ENG-407", deps);
    expect(state.sliceStatuses["ENG-407-1"].error).toContain("timeout");
  });
});

// ============================================================================
// 5. Watch Integration Tests
// ============================================================================

describe("Watch Integration for Parallel Execution", () => {
  test("watch --parallel shows all parallel team progress", async () => {
    await createPlanWorkspaceWithSlices("ENG-500", TEST_SLICES);
    await $`bun ${CLI_PATH} impl --parallel ENG-500 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const result =
      await $`timeout 1 bun ${CLI_PATH} watch --parallel ENG-500 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const output = result.stdout.toString();
    expect(output).toContain("Parallel Execution");
    expect(output).toContain("ENG-500");
  });

  test("watch shows which slices are running", async () => {
    await createPlanWorkspaceWithSlices("ENG-501", TEST_SLICES);
    await $`bun ${CLI_PATH} impl --parallel ENG-501 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    // Update state to simulate running
    const planPath = join(TEST_WORKSPACES_DIR, "ENG-501", "parallel", "execution-plan.json");
    const plan: ParallelExecutionState = JSON.parse(await readFile(planPath, "utf-8"));
    plan.sliceStatuses["ENG-501-1"].status = "running";
    plan.status = "running";
    await writeFile(planPath, JSON.stringify(plan, null, 2));

    const result =
      await $`timeout 1 bun ${CLI_PATH} watch --parallel ENG-501 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const output = result.stdout.toString();
    expect(output).toMatch(/running|in progress/i);
    expect(output).toContain("Slice 1");
  });

  test("watch shows waiting slices with dependencies", async () => {
    await createPlanWorkspaceWithSlices("ENG-502", TEST_SLICES);
    await $`bun ${CLI_PATH} impl --parallel ENG-502 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const result =
      await $`timeout 1 bun ${CLI_PATH} watch --parallel ENG-502 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const output = result.stdout.toString();
    expect(output).toMatch(/waiting|pending|queued/i);
  });

  test("watch shows completed slices", async () => {
    await createPlanWorkspaceWithSlices("ENG-503", TEST_SLICES);
    await $`bun ${CLI_PATH} impl --parallel ENG-503 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    // Update state to simulate completion
    const planPath = join(TEST_WORKSPACES_DIR, "ENG-503", "parallel", "execution-plan.json");
    const plan: ParallelExecutionState = JSON.parse(await readFile(planPath, "utf-8"));
    plan.sliceStatuses["ENG-503-1"].status = "complete";
    plan.completedSlices = 1;
    await writeFile(planPath, JSON.stringify(plan, null, 2));

    const result =
      await $`timeout 1 bun ${CLI_PATH} watch --parallel ENG-503 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const output = result.stdout.toString();
    expect(output).toMatch(/complete|done|finished/i);
  });

  test("watch shows failed slices", async () => {
    await createPlanWorkspaceWithSlices("ENG-504", TEST_SLICES);
    await $`bun ${CLI_PATH} impl --parallel ENG-504 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    // Update state to simulate failure
    const planPath = join(TEST_WORKSPACES_DIR, "ENG-504", "parallel", "execution-plan.json");
    const plan: ParallelExecutionState = JSON.parse(await readFile(planPath, "utf-8"));
    plan.sliceStatuses["ENG-504-1"].status = "failed";
    plan.sliceStatuses["ENG-504-1"].error = "Test failed";
    plan.failedSlices = 1;
    await writeFile(planPath, JSON.stringify(plan, null, 2));

    const result =
      await $`timeout 1 bun ${CLI_PATH} watch --parallel ENG-504 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const output = result.stdout.toString();
    expect(output).toMatch(/failed|error/i);
  });

  test("watch shows progress percentage", async () => {
    await createPlanWorkspaceWithSlices("ENG-505", TEST_SLICES);
    await $`bun ${CLI_PATH} impl --parallel ENG-505 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    // Update state to show partial progress
    const planPath = join(TEST_WORKSPACES_DIR, "ENG-505", "parallel", "execution-plan.json");
    const plan: ParallelExecutionState = JSON.parse(await readFile(planPath, "utf-8"));
    plan.sliceStatuses["ENG-505-1"].status = "complete";
    plan.sliceStatuses["ENG-505-2"].status = "complete";
    plan.completedSlices = 2;
    await writeFile(planPath, JSON.stringify(plan, null, 2));

    const result =
      await $`timeout 1 bun ${CLI_PATH} watch --parallel ENG-505 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const output = result.stdout.toString();
    expect(output).toMatch(/50%|2\/4|2 of 4/);
  });
});

// ============================================================================
// 6. Final Report Tests
// ============================================================================

describe("Final Report", () => {
  test("shows success/failure per slice", async () => {
    const { runParallelExecution, readParallelResults } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-600", [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: [], isIndependent: true },
    ]);

    await runParallelExecution("ENG-600", deps, { dryRun: true, mockResults: ["success", "fail"] });

    const results = await readParallelResults("ENG-600", deps);

    expect(results.sliceResults).toHaveLength(2);
    expect(results.sliceResults.find((s) => s.title === "A")?.status).toBe("complete");
    expect(results.sliceResults.find((s) => s.title === "B")?.status).toBe("failed");
  });

  test("shows total time", async () => {
    const { runParallelExecution, readParallelResults } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-601", [
      { title: "A", dependencies: [], isIndependent: true },
    ]);

    await runParallelExecution("ENG-601", deps, { dryRun: true, mockResults: ["success"] });

    const results = await readParallelResults("ENG-601", deps);

    expect(results.totalTime).toBeDefined();
    expect(typeof results.totalTime).toBe("number");
    expect(results.totalTime).toBeGreaterThanOrEqual(0);
  });

  test("shows skipped slices due to dep failures", async () => {
    const { runParallelExecution, readParallelResults } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-602", [
      { title: "A", dependencies: [], isIndependent: true },
      { title: "B", dependencies: ["A"], isIndependent: false },
      { title: "C", dependencies: ["A"], isIndependent: false },
    ]);

    await runParallelExecution("ENG-602", deps, { dryRun: true, mockResults: ["fail"] });

    const results = await readParallelResults("ENG-602", deps);

    expect(results.summary.skipped).toBe(2);
    expect(results.sliceResults.filter((s) => s.status === "skipped")).toHaveLength(2);
  });

  test("CLI outputs final report", async () => {
    await createPlanWorkspaceWithSlices("ENG-603", TEST_SLICES);

    const result =
      await $`bun ${CLI_PATH} impl --parallel ENG-603 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

    expect(result).toContain("Summary");
    expect(result).toMatch(/completed|success/i);
    expect(result).toMatch(/total.*time|duration/i);
  });

  test("creates results.json with summary", async () => {
    await createPlanWorkspaceWithSlices("ENG-604", TEST_SLICES);

    await $`bun ${CLI_PATH} impl --parallel ENG-604 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const resultsPath = join(TEST_WORKSPACES_DIR, "ENG-604", "parallel", "results.json");
    const results: ParallelResults = JSON.parse(await readFile(resultsPath, "utf-8"));

    expect(results.specId).toBe("ENG-604");
    expect(results.summary).toBeDefined();
    expect(results.summary.total).toBe(4);
  });

  test("report includes per-slice duration", async () => {
    const { runParallelExecution, readParallelResults } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-605", [
      { title: "A", dependencies: [], isIndependent: true },
    ]);

    await runParallelExecution("ENG-605", deps, { dryRun: true, mockResults: ["success"] });

    const results = await readParallelResults("ENG-605", deps);

    expect(results.sliceResults[0].duration).toBeDefined();
    expect(typeof results.sliceResults[0].duration).toBe("number");
  });
});

// ============================================================================
// 7. Parallel Workspace Tests
// ============================================================================

describe("Parallel Workspace", () => {
  test("creates .claude/teamwork-v2/<spec-id>/parallel/ directory", async () => {
    await createPlanWorkspaceWithSlices("ENG-700", TEST_SLICES);

    await $`bun ${CLI_PATH} impl --parallel ENG-700 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const parallelPath = join(TEST_WORKSPACES_DIR, "ENG-700", "parallel");
    const { stat } = await import("fs/promises");
    const statResult = await stat(parallelPath);
    expect(statResult.isDirectory()).toBe(true);
  });

  test("contains execution-plan.json", async () => {
    await createPlanWorkspaceWithSlices("ENG-701", TEST_SLICES);

    await $`bun ${CLI_PATH} impl --parallel ENG-701 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const planPath = join(TEST_WORKSPACES_DIR, "ENG-701", "parallel", "execution-plan.json");
    const content = await readFile(planPath, "utf-8");
    const plan = JSON.parse(content);

    expect(plan).toHaveProperty("specId");
    expect(plan).toHaveProperty("status");
    expect(plan).toHaveProperty("sliceStatuses");
    expect(plan).toHaveProperty("maxConcurrent");
  });

  test("contains results.json after completion", async () => {
    await createPlanWorkspaceWithSlices("ENG-702", TEST_SLICES);

    await $`bun ${CLI_PATH} impl --parallel ENG-702 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const resultsPath = join(TEST_WORKSPACES_DIR, "ENG-702", "parallel", "results.json");
    const content = await readFile(resultsPath, "utf-8");
    const results = JSON.parse(content);

    expect(results).toHaveProperty("specId");
    expect(results).toHaveProperty("success");
    expect(results).toHaveProperty("sliceResults");
    expect(results).toHaveProperty("summary");
  });

  test("links to individual slice workspaces", async () => {
    await createPlanWorkspaceWithSlices("ENG-703", TEST_SLICES);

    await $`bun ${CLI_PATH} impl --parallel ENG-703 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const planPath = join(TEST_WORKSPACES_DIR, "ENG-703", "parallel", "execution-plan.json");
    const plan: ParallelExecutionState = JSON.parse(await readFile(planPath, "utf-8"));

    // Each slice should have a reference to its workspace
    for (const sliceId of Object.keys(plan.sliceStatuses)) {
      const sliceWorkspacePath = join(TEST_WORKSPACES_DIR, sliceId);
      const { stat } = await import("fs/promises");
      const statResult = await stat(sliceWorkspacePath).catch(() => null);
      expect(statResult?.isDirectory()).toBe(true);
    }
  });

  test("execution-plan.json has correct initial state", async () => {
    await createPlanWorkspaceWithSlices("ENG-704", TEST_SLICES);

    await $`bun ${CLI_PATH} impl --parallel ENG-704 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const planPath = join(TEST_WORKSPACES_DIR, "ENG-704", "parallel", "execution-plan.json");
    const plan: ParallelExecutionState = JSON.parse(await readFile(planPath, "utf-8"));

    expect(plan.status).toBe("pending");
    expect(plan.completedSlices).toBe(0);
    expect(plan.failedSlices).toBe(0);
    expect(plan.skippedSlices).toBe(0);
    expect(plan.totalSlices).toBe(4);
  });

  test("updates execution-plan.json during execution", async () => {
    const { runParallelExecution, readParallelState } = await import("../src/parallel-execution");

    const deps = createTestDeps();
    await createPlanWorkspaceWithSlices("ENG-705", [
      { title: "A", dependencies: [], isIndependent: true },
    ]);

    await runParallelExecution("ENG-705", deps, { dryRun: true, mockResults: ["success"] });

    const state = await readParallelState("ENG-705", deps);

    expect(state.status).toBe("complete");
    expect(state.completedSlices).toBe(1);
    expect(state.completedAt).toBeDefined();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Parallel Execution Integration", () => {
  test("full parallel execution workflow", async () => {
    await createPlanWorkspaceWithSlices("ENG-800", TEST_SLICES);

    const result =
      await $`bun ${CLI_PATH} impl --parallel ENG-800 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    expect(result.exitCode).toBe(0);

    // Verify all expected files exist
    const { stat } = await import("fs/promises");
    const parallelPath = join(TEST_WORKSPACES_DIR, "ENG-800", "parallel");
    expect((await stat(parallelPath)).isDirectory()).toBe(true);
    expect((await stat(join(parallelPath, "execution-plan.json"))).isFile()).toBe(true);
    expect((await stat(join(parallelPath, "results.json"))).isFile()).toBe(true);

    // Verify output contains expected information
    const output = result.stdout.toString();
    expect(output).toContain("ENG-800");
    expect(output).toContain("4 slices");
  });

  test("parallel execution with mixed dependencies", async () => {
    const complexSlices: SliceDefinition[] = [
      { title: "Database Setup", dependencies: [], isIndependent: true },
      { title: "Auth Service", dependencies: [], isIndependent: true },
      { title: "User API", dependencies: ["Database Setup", "Auth Service"], isIndependent: false },
      { title: "Admin API", dependencies: ["Database Setup", "Auth Service"], isIndependent: false },
      { title: "Frontend", dependencies: ["User API"], isIndependent: false },
    ];

    await createPlanWorkspaceWithSlices("ENG-801", complexSlices);

    const result =
      await $`bun ${CLI_PATH} impl --parallel ENG-801 --max-concurrent 2 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    expect(result.exitCode).toBe(0);

    const planPath = join(TEST_WORKSPACES_DIR, "ENG-801", "parallel", "execution-plan.json");
    const plan: ParallelExecutionState = JSON.parse(await readFile(planPath, "utf-8"));

    expect(plan.totalSlices).toBe(5);
    expect(plan.maxConcurrent).toBe(2);
  });

  test("help shows parallel options", async () => {
    const result = await $`bun ${CLI_PATH} impl --help`.text();

    expect(result).toContain("--parallel");
    expect(result).toContain("--max-concurrent");
  });
});
