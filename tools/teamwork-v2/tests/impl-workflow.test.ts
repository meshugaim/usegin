import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Tests for the implementation team orchestration workflow (ENG-1269).
 *
 * The implementation workflow follows TDD principles:
 * setup -> writing_tests -> reviewing_tests -> tests_approved -> implementing -> reviewing_impl -> verifying -> complete
 *
 * Key features:
 * - TDD enforcement: tests must fail before implementation
 * - Per-test implementation cycle
 * - Commit tracking after each passing test
 * - Linear issue status updates
 * - Timeout and escalation (30 min per test phase)
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-impl-workflow");

interface WorkspaceDeps {
  workspacesDir: string;
}

// Implementation workflow phases
type ImplPhase =
  | "setup"
  | "writing_tests"
  | "reviewing_tests"
  | "tests_approved"
  | "implementing"
  | "reviewing_impl"
  | "verifying"
  | "complete";

// Test status for individual tests in the slice
interface TestStatus {
  name: string;
  status: "pending" | "failing" | "passing";
  commitHash?: string;
}

// Implementation state stored in state.json
interface ImplState {
  type: "impl";
  sliceId: string;
  specId: string;
  phase: ImplPhase;
  startedAt?: string;
  completedAt?: string;
  escalated?: boolean;
  escalatedAt?: string;
  tests: TestStatus[];
  currentTestIndex: number;
  commits: string[];
  timeoutMinutes: number;
  phaseStartedAt?: string;
  linearIssueStatus?: string;
  createdAt: string;
  updatedAt: string;
}

// Configuration for implementation workflow
interface ImplWorkflowConfig {
  sliceId: string;
  specId: string;
  timeoutMinutes: number;
}

// Options for running the workflow
interface ImplWorkflowOptions {
  dryRun?: boolean;
  stopAfter?: ImplPhase;
  mockTests?: TestStatus[];
  mockTestReviewResult?: "approved" | "revise";
  mockImplReviewResult?: "approved" | "revise";
  mockTestResults?: ("pass" | "fail")[];
  mockCommitHashes?: string[];
  mockStartedAt?: string;
  mockPhaseStartedAt?: string;
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

// Helper to create workspace with implementation state
async function createImplWorkspaceWithState(
  sliceId: string,
  phase: ImplPhase,
  extras: Partial<ImplState> = {}
): Promise<string> {
  const workspacePath = join(TEST_WORKSPACES_DIR, sliceId);
  await mkdir(workspacePath, { recursive: true });
  await mkdir(join(workspacePath, "sessions"), { recursive: true });

  const now = new Date().toISOString();
  const state: ImplState = {
    type: "impl",
    sliceId,
    specId: "ENG-1269",
    phase,
    tests: [],
    currentTestIndex: 0,
    commits: [],
    timeoutMinutes: 30,
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

// ============================================================================
// Implementation State Machine Tests
// ============================================================================

describe("Implementation State Machine", () => {
  describe("isValidImplTransition", () => {
    test("setup -> writing_tests is valid", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("setup", "writing_tests")).toBe(true);
    });

    test("writing_tests -> reviewing_tests is valid", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("writing_tests", "reviewing_tests")).toBe(true);
    });

    test("reviewing_tests -> tests_approved is valid", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("reviewing_tests", "tests_approved")).toBe(true);
    });

    test("reviewing_tests -> writing_tests is valid (revision loop)", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("reviewing_tests", "writing_tests")).toBe(true);
    });

    test("tests_approved -> implementing is valid", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("tests_approved", "implementing")).toBe(true);
    });

    test("implementing -> reviewing_impl is valid", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("implementing", "reviewing_impl")).toBe(true);
    });

    test("reviewing_impl -> verifying is valid", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("reviewing_impl", "verifying")).toBe(true);
    });

    test("reviewing_impl -> implementing is valid (revision loop)", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("reviewing_impl", "implementing")).toBe(true);
    });

    test("verifying -> complete is valid", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("verifying", "complete")).toBe(true);
    });

    test("verifying -> implementing is valid (regression found)", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("verifying", "implementing")).toBe(true);
    });

    test("complete -> any is invalid (terminal state)", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("complete", "setup")).toBe(false);
      expect(isValidImplTransition("complete", "writing_tests")).toBe(false);
      expect(isValidImplTransition("complete", "implementing")).toBe(false);
    });

    test("setup -> implementing is invalid (skipping test writing)", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("setup", "implementing")).toBe(false);
    });

    test("tests_approved -> verifying is invalid (skipping implementation)", async () => {
      const { isValidImplTransition } = await import("../src/impl-state-machine");

      expect(isValidImplTransition("tests_approved", "verifying")).toBe(false);
    });
  });

  describe("transitionImplTo", () => {
    test("transitions from setup to writing_tests", async () => {
      const { transitionImplTo, readImplState } = await import(
        "../src/impl-state-machine"
      );

      const deps = createTestDeps();
      await createImplWorkspaceWithState("SLICE-100", "setup");

      await transitionImplTo("SLICE-100", "writing_tests", deps);

      const state = await readImplState("SLICE-100", deps);
      expect(state.phase).toBe("writing_tests");
    });

    test("transitions through full happy path", async () => {
      const { transitionImplTo, readImplState } = await import(
        "../src/impl-state-machine"
      );

      const deps = createTestDeps();
      await createImplWorkspaceWithState("SLICE-101", "setup");

      await transitionImplTo("SLICE-101", "writing_tests", deps);
      await transitionImplTo("SLICE-101", "reviewing_tests", deps);
      await transitionImplTo("SLICE-101", "tests_approved", deps);
      await transitionImplTo("SLICE-101", "implementing", deps);
      await transitionImplTo("SLICE-101", "reviewing_impl", deps);
      await transitionImplTo("SLICE-101", "verifying", deps);
      await transitionImplTo("SLICE-101", "complete", deps);

      const state = await readImplState("SLICE-101", deps);
      expect(state.phase).toBe("complete");
    });

    test("throws on invalid transition", async () => {
      const { transitionImplTo } = await import("../src/impl-state-machine");

      const deps = createTestDeps();
      await createImplWorkspaceWithState("SLICE-102", "setup");

      await expect(
        transitionImplTo("SLICE-102", "implementing", deps)
      ).rejects.toThrow("Invalid transition");
    });

    test("throws when transitioning from complete state", async () => {
      const { transitionImplTo } = await import("../src/impl-state-machine");

      const deps = createTestDeps();
      await createImplWorkspaceWithState("SLICE-103", "complete");

      await expect(
        transitionImplTo("SLICE-103", "setup", deps)
      ).rejects.toThrow("terminal state");
    });

    test("updates phaseStartedAt on each transition", async () => {
      const { transitionImplTo, readImplState } = await import(
        "../src/impl-state-machine"
      );

      const deps = createTestDeps();
      await createImplWorkspaceWithState("SLICE-104", "setup");

      const before = new Date().toISOString();
      await transitionImplTo("SLICE-104", "writing_tests", deps);
      const after = new Date().toISOString();

      const state = await readImplState("SLICE-104", deps);
      expect(state.phaseStartedAt).toBeDefined();
      expect(state.phaseStartedAt! >= before).toBe(true);
      expect(state.phaseStartedAt! <= after).toBe(true);
    });

    test("sets startedAt on first transition from setup", async () => {
      const { transitionImplTo, readImplState } = await import(
        "../src/impl-state-machine"
      );

      const deps = createTestDeps();
      await createImplWorkspaceWithState("SLICE-105", "setup");

      const before = new Date().toISOString();
      await transitionImplTo("SLICE-105", "writing_tests", deps);
      const after = new Date().toISOString();

      const state = await readImplState("SLICE-105", deps);
      expect(state.startedAt).toBeDefined();
      expect(state.startedAt! >= before).toBe(true);
      expect(state.startedAt! <= after).toBe(true);
    });

    test("sets completedAt on transition to complete", async () => {
      const { transitionImplTo, readImplState } = await import(
        "../src/impl-state-machine"
      );

      const deps = createTestDeps();
      await createImplWorkspaceWithState("SLICE-106", "verifying");

      const before = new Date().toISOString();
      await transitionImplTo("SLICE-106", "complete", deps);
      const after = new Date().toISOString();

      const state = await readImplState("SLICE-106", deps);
      expect(state.completedAt).toBeDefined();
      expect(state.completedAt! >= before).toBe(true);
      expect(state.completedAt! <= after).toBe(true);
    });
  });

  describe("getNextValidImplPhases", () => {
    test("returns valid next phases for setup", async () => {
      const { getNextValidImplPhases } = await import("../src/impl-state-machine");

      const next = getNextValidImplPhases("setup");
      expect(next).toEqual(["writing_tests"]);
    });

    test("returns valid next phases for reviewing_tests (can approve or revise)", async () => {
      const { getNextValidImplPhases } = await import("../src/impl-state-machine");

      const next = getNextValidImplPhases("reviewing_tests");
      expect(next).toContain("tests_approved");
      expect(next).toContain("writing_tests");
      expect(next).toHaveLength(2);
    });

    test("returns valid next phases for verifying (can complete or fix regression)", async () => {
      const { getNextValidImplPhases } = await import("../src/impl-state-machine");

      const next = getNextValidImplPhases("verifying");
      expect(next).toContain("complete");
      expect(next).toContain("implementing");
      expect(next).toHaveLength(2);
    });

    test("returns empty array for complete (terminal state)", async () => {
      const { getNextValidImplPhases } = await import("../src/impl-state-machine");

      const next = getNextValidImplPhases("complete");
      expect(next).toEqual([]);
    });
  });

  describe("isImplTerminalPhase", () => {
    test("complete is terminal", async () => {
      const { isImplTerminalPhase } = await import("../src/impl-state-machine");

      expect(isImplTerminalPhase("complete")).toBe(true);
    });

    test("setup is not terminal", async () => {
      const { isImplTerminalPhase } = await import("../src/impl-state-machine");

      expect(isImplTerminalPhase("setup")).toBe(false);
    });

    test("implementing is not terminal", async () => {
      const { isImplTerminalPhase } = await import("../src/impl-state-machine");

      expect(isImplTerminalPhase("implementing")).toBe(false);
    });
  });
});

// ============================================================================
// TDD Enforcement Tests
// ============================================================================

describe("TDD Enforcement", () => {
  test("tests must fail before implementation starts", async () => {
    const { runImplWorkflow, readImplState } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-200",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "tests_approved",
      mockTests: [
        { name: "test_user_login", status: "pending" },
        { name: "test_password_validation", status: "pending" },
      ],
      mockTestReviewResult: "approved",
    });

    const state = await readImplState("SLICE-200", deps);

    // All tests should be in "failing" status before implementation
    expect(state.tests.every((t) => t.status === "failing")).toBe(true);
  });

  test("cannot start implementation if tests pass before implementation", async () => {
    const { runImplWorkflow } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-201",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    // If tests pass before implementation, workflow should error
    await expect(
      runImplWorkflow(config, deps, {
        dryRun: true,
        mockTests: [
          { name: "test_already_passing", status: "passing" },
        ],
        mockTestReviewResult: "approved",
      })
    ).rejects.toThrow("TDD violation");
  });

  test("verifies tests fail after writing and before implementation", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-202",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "tests_approved",
      mockTests: [{ name: "test_feature", status: "pending" }],
      mockTestReviewResult: "approved",
    });

    const events = await readEvents("SLICE-202", deps);
    const verifyEvent = events.find(
      (e: { event: string }) => e.event === "tests_verified_failing"
    );

    expect(verifyEvent).toBeDefined();
  });

  test("emits tdd_verification_passed event when tests properly fail", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-203",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "implementing",
      mockTests: [{ name: "test_feature", status: "pending" }],
      mockTestReviewResult: "approved",
    });

    const events = await readEvents("SLICE-203", deps);
    const tddEvent = events.find(
      (e: { event: string }) => e.event === "tdd_verification_passed"
    );

    expect(tddEvent).toBeDefined();
    expect(tddEvent?.data.failingTestCount).toBe(1);
  });
});

// ============================================================================
// Per-Test Implementation Cycle Tests
// ============================================================================

describe("Per-Test Implementation Cycle", () => {
  test("implements one test at a time", async () => {
    const { runImplWorkflow, readImplState } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-300",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    // Start implementation, should focus on first test
    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "implementing",
      mockTests: [
        { name: "test_one", status: "pending" },
        { name: "test_two", status: "pending" },
        { name: "test_three", status: "pending" },
      ],
      mockTestReviewResult: "approved",
    });

    const state = await readImplState("SLICE-300", deps);

    expect(state.currentTestIndex).toBe(0);
  });

  test("advances to next test after current test passes", async () => {
    const { advanceToNextTest, readImplState } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    await createImplWorkspaceWithState("SLICE-301", "implementing", {
      tests: [
        { name: "test_one", status: "failing" },
        { name: "test_two", status: "failing" },
      ],
      currentTestIndex: 0,
    });

    // First test passes
    await advanceToNextTest("SLICE-301", deps, {
      testPassed: true,
      commitHash: "abc123",
    });

    const state = await readImplState("SLICE-301", deps);

    expect(state.tests[0].status).toBe("passing");
    expect(state.tests[0].commitHash).toBe("abc123");
    expect(state.currentTestIndex).toBe(1);
  });

  test("tracks commit hash after each passing test", async () => {
    const { runImplWorkflow, readImplState } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-302",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [
        { name: "test_one", status: "pending" },
        { name: "test_two", status: "pending" },
      ],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass", "pass"],
      mockCommitHashes: ["commit1", "commit2"],
    });

    const state = await readImplState("SLICE-302", deps);

    expect(state.commits).toContain("commit1");
    expect(state.commits).toContain("commit2");
    expect(state.tests[0].commitHash).toBe("commit1");
    expect(state.tests[1].commitHash).toBe("commit2");
  });

  test("emits test_passed event when test passes", async () => {
    const { advanceToNextTest, readEvents } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    await createImplWorkspaceWithState("SLICE-303", "implementing", {
      tests: [{ name: "test_one", status: "failing" }],
      currentTestIndex: 0,
    });

    await advanceToNextTest("SLICE-303", deps, {
      testPassed: true,
      commitHash: "abc123",
    });

    const events = await readEvents("SLICE-303", deps);
    const passEvent = events.find(
      (e: { event: string }) => e.event === "test_passed"
    );

    expect(passEvent).toBeDefined();
    expect(passEvent?.data.testName).toBe("test_one");
    expect(passEvent?.data.commitHash).toBe("abc123");
  });

  test("emits commit_created event after each passing test", async () => {
    const { advanceToNextTest, readEvents } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    await createImplWorkspaceWithState("SLICE-304", "implementing", {
      tests: [{ name: "test_one", status: "failing" }],
      currentTestIndex: 0,
    });

    await advanceToNextTest("SLICE-304", deps, {
      testPassed: true,
      commitHash: "abc123",
    });

    const events = await readEvents("SLICE-304", deps);
    const commitEvent = events.find(
      (e: { event: string }) => e.event === "commit_created"
    );

    expect(commitEvent).toBeDefined();
    expect(commitEvent?.data.commitHash).toBe("abc123");
    expect(commitEvent?.data.testName).toBe("test_one");
  });

  test("all tests must pass before verification", async () => {
    const { runImplWorkflow, readImplState } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-305",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "verifying",
      mockTests: [
        { name: "test_one", status: "pending" },
        { name: "test_two", status: "pending" },
      ],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass", "pass"],
      mockCommitHashes: ["commit1", "commit2"],
    });

    const state = await readImplState("SLICE-305", deps);

    expect(state.tests.every((t) => t.status === "passing")).toBe(true);
  });
});

// ============================================================================
// Verification Tests
// ============================================================================

describe("Verification Phase", () => {
  test("runs full test suite in verification phase", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-400",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "complete",
      mockTests: [{ name: "test_one", status: "pending" }],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass"],
      mockCommitHashes: ["commit1"],
    });

    const events = await readEvents("SLICE-400", deps);
    const verifyEvent = events.find(
      (e: { event: string }) => e.event === "verification_started"
    );

    expect(verifyEvent).toBeDefined();
  });

  test("detects regressions and returns to implementing", async () => {
    const { runImplWorkflow, readImplState, readEvents } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-401",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    // Simulate a regression during verification
    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [{ name: "test_one", status: "pending" }],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass", "fail"], // Passes first time, fails in verification
      mockCommitHashes: ["commit1"],
    });

    const events = await readEvents("SLICE-401", deps);
    const regressionEvent = events.find(
      (e: { event: string }) => e.event === "regression_detected"
    );

    expect(regressionEvent).toBeDefined();
  });

  test("completes successfully when no regressions found", async () => {
    const { runImplWorkflow, readImplState } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-402",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [{ name: "test_one", status: "pending" }],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass"],
      mockCommitHashes: ["commit1"],
    });

    const state = await readImplState("SLICE-402", deps);

    expect(state.phase).toBe("complete");
    expect(state.completedAt).toBeDefined();
  });

  test("emits verification_passed event on success", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-403",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [{ name: "test_one", status: "pending" }],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass"],
      mockCommitHashes: ["commit1"],
    });

    const events = await readEvents("SLICE-403", deps);
    const passEvent = events.find(
      (e: { event: string }) => e.event === "verification_passed"
    );

    expect(passEvent).toBeDefined();
  });
});

// ============================================================================
// Linear Issue Status Update Tests
// ============================================================================

describe("Linear Issue Status Updates", () => {
  test("updates Linear issue to 'In Progress' when implementation starts", async () => {
    const { runImplWorkflow, readImplState } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-500",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "writing_tests",
      mockTests: [{ name: "test_one", status: "pending" }],
    });

    const state = await readImplState("SLICE-500", deps);

    expect(state.linearIssueStatus).toBe("In Progress");
  });

  test("emits linear_status_updated event when status changes", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-501",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "writing_tests",
      mockTests: [{ name: "test_one", status: "pending" }],
    });

    const events = await readEvents("SLICE-501", deps);
    const statusEvent = events.find(
      (e: { event: string }) => e.event === "linear_status_updated"
    );

    expect(statusEvent).toBeDefined();
    expect(statusEvent?.data.status).toBe("In Progress");
    expect(statusEvent?.data.sliceId).toBe("SLICE-501");
  });

  test("updates Linear issue to 'Done' when implementation completes", async () => {
    const { runImplWorkflow, readImplState } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-502",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [{ name: "test_one", status: "pending" }],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass"],
      mockCommitHashes: ["commit1"],
    });

    const state = await readImplState("SLICE-502", deps);

    expect(state.linearIssueStatus).toBe("Done");
  });

  test("closes Linear issue on completion", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-503",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [{ name: "test_one", status: "pending" }],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass"],
      mockCommitHashes: ["commit1"],
    });

    const events = await readEvents("SLICE-503", deps);
    const closeEvent = events.find(
      (e: { event: string }) => e.event === "linear_issue_closed"
    );

    expect(closeEvent).toBeDefined();
    expect(closeEvent?.data.sliceId).toBe("SLICE-503");
  });
});

// ============================================================================
// Timeout and Escalation Tests
// ============================================================================

describe("Timeout and Escalation", () => {
  test("escalates after 30 minute timeout in test writing phase", async () => {
    const { runImplWorkflow, readImplState, readEvents } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-600",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    // Simulate timeout by setting phaseStartedAt to past
    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockPhaseStartedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(), // 31 minutes ago
    });

    const state = await readImplState("SLICE-600", deps);
    expect(state.escalated).toBe(true);
    expect(state.escalatedAt).toBeDefined();

    const events = await readEvents("SLICE-600", deps);
    const escalationEvent = events.find(
      (e: { event: string }) => e.event === "escalation"
    );
    expect(escalationEvent).toBeDefined();
    expect(escalationEvent?.data.reason).toContain("timeout");
  });

  test("emits timeout_warning at 25 minutes", async () => {
    const { checkPhaseTimeout, readEvents } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    await createImplWorkspaceWithState("SLICE-601", "writing_tests", {
      phaseStartedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      timeoutMinutes: 30,
    });

    await checkPhaseTimeout("SLICE-601", deps);

    const events = await readEvents("SLICE-601", deps);
    const warningEvent = events.find(
      (e: { event: string }) => e.event === "timeout_warning"
    );

    expect(warningEvent).toBeDefined();
    expect(warningEvent?.data.elapsedMinutes).toBeGreaterThanOrEqual(25);
  });

  test("timeout is per-phase, not total workflow", async () => {
    const { runImplWorkflow, readImplState } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-602",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    // Total workflow time might exceed 30 min, but each phase should reset
    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [{ name: "test_one", status: "pending" }],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass"],
      mockCommitHashes: ["commit1"],
      // Simulate each phase taking 20 minutes (total 140 minutes)
      // But no single phase exceeds 30 minutes, so no escalation
    });

    const state = await readImplState("SLICE-602", deps);

    expect(state.escalated).toBeUndefined();
    expect(state.phase).toBe("complete");
  });

  test("escalation reason includes current phase", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-603",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await createImplWorkspaceWithState("SLICE-603", "implementing", {
      phaseStartedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
      timeoutMinutes: 30,
    });

    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockPhaseStartedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    });

    const events = await readEvents("SLICE-603", deps);
    const escalationEvent = events.find(
      (e: { event: string }) => e.event === "escalation"
    );

    expect(escalationEvent?.data.currentPhase).toBeDefined();
  });
});

// ============================================================================
// Event Emission Tests
// ============================================================================

describe("Event Emission", () => {
  test("emits impl_phase_transition for all phase changes", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-700",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [{ name: "test_one", status: "pending" }],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass"],
      mockCommitHashes: ["commit1"],
    });

    const events = await readEvents("SLICE-700", deps);
    const transitionEvents = events.filter(
      (e: { event: string }) => e.event === "impl_phase_transition"
    );

    // Should have transitions through all phases
    const phases = transitionEvents.map(
      (e: { data: { to: string } }) => e.data.to
    );
    expect(phases).toContain("writing_tests");
    expect(phases).toContain("reviewing_tests");
    expect(phases).toContain("tests_approved");
    expect(phases).toContain("implementing");
    expect(phases).toContain("reviewing_impl");
    expect(phases).toContain("verifying");
    expect(phases).toContain("complete");
  });

  test("emits test_review_requested event", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-701",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "reviewing_tests",
      mockTests: [{ name: "test_one", status: "pending" }],
    });

    const events = await readEvents("SLICE-701", deps);
    const reviewEvent = events.find(
      (e: { event: string }) => e.event === "test_review_requested"
    );

    expect(reviewEvent).toBeDefined();
  });

  test("emits impl_review_requested event", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-702",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "reviewing_impl",
      mockTests: [{ name: "test_one", status: "pending" }],
      mockTestReviewResult: "approved",
      mockTestResults: ["pass"],
      mockCommitHashes: ["commit1"],
    });

    const events = await readEvents("SLICE-702", deps);
    const reviewEvent = events.find(
      (e: { event: string }) => e.event === "impl_review_requested"
    );

    expect(reviewEvent).toBeDefined();
  });

  test("emits impl_completed event on successful completion", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-703",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [{ name: "test_one", status: "pending" }],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass"],
      mockCommitHashes: ["commit1"],
    });

    const events = await readEvents("SLICE-703", deps);
    const completedEvent = events.find(
      (e: { event: string }) => e.event === "impl_completed"
    );

    expect(completedEvent).toBeDefined();
    expect(completedEvent?.data.sliceId).toBe("SLICE-703");
    expect(completedEvent?.data.totalCommits).toBe(1);
  });
});

// ============================================================================
// Complete Workflow Tests
// ============================================================================

describe("Complete Implementation Workflow", () => {
  test("runs complete TDD happy path", async () => {
    const { runImplWorkflow, readImplState, readEvents } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-800",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [
        { name: "test_login_form_renders", status: "pending" },
        { name: "test_login_validates_email", status: "pending" },
        { name: "test_login_submits_correctly", status: "pending" },
      ],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "approved",
      mockTestResults: ["pass", "pass", "pass"],
      mockCommitHashes: ["commit1", "commit2", "commit3"],
    });

    const state = await readImplState("SLICE-800", deps);

    // Final state assertions
    expect(state.phase).toBe("complete");
    expect(state.completedAt).toBeDefined();
    expect(state.tests.every((t) => t.status === "passing")).toBe(true);
    expect(state.commits).toHaveLength(3);
    expect(state.linearIssueStatus).toBe("Done");

    // Event assertions
    const events = await readEvents("SLICE-800", deps);

    // Should have all expected events
    const eventTypes = events.map((e: { event: string }) => e.event);
    expect(eventTypes).toContain("impl_phase_transition");
    expect(eventTypes).toContain("tdd_verification_passed");
    expect(eventTypes).toContain("test_passed");
    expect(eventTypes).toContain("commit_created");
    expect(eventTypes).toContain("verification_passed");
    expect(eventTypes).toContain("linear_status_updated");
    expect(eventTypes).toContain("impl_completed");
  });

  test("handles test revision loop correctly", async () => {
    const { runImplWorkflow, readImplState, readEvents } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-801",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    // First review requests revision, second approves
    await runImplWorkflow(config, deps, {
      dryRun: true,
      stopAfter: "tests_approved",
      mockTests: [{ name: "test_feature", status: "pending" }],
      mockTestReviewResult: "revise",
    });

    // Note: In a real scenario, this would loop back to writing_tests
    // For the test, we check that revision is handled
    const events = await readEvents("SLICE-801", deps);
    const revisionEvent = events.find(
      (e: { event: string }) => e.event === "test_revision_requested"
    );

    expect(revisionEvent).toBeDefined();
  });

  test("handles implementation revision loop correctly", async () => {
    const { runImplWorkflow, readEvents } = await import("../src/impl-workflow");

    const deps = createTestDeps();
    const config: ImplWorkflowConfig = {
      sliceId: "SLICE-802",
      specId: "ENG-1269",
      timeoutMinutes: 30,
    };

    await runImplWorkflow(config, deps, {
      dryRun: true,
      mockTests: [{ name: "test_feature", status: "pending" }],
      mockTestReviewResult: "approved",
      mockImplReviewResult: "revise",
      mockTestResults: ["pass"],
      mockCommitHashes: ["commit1"],
    });

    const events = await readEvents("SLICE-802", deps);
    const revisionEvent = events.find(
      (e: { event: string }) => e.event === "impl_revision_requested"
    );

    expect(revisionEvent).toBeDefined();
  });
});

// ============================================================================
// Workspace Creation Tests
// ============================================================================

describe("Implementation Workspace Creation", () => {
  test("creates impl workspace with correct structure", async () => {
    const { createImplWorkspace } = await import("../src/impl-workflow");
    const { stat } = await import("fs/promises");

    const deps = createTestDeps();
    await createImplWorkspace("SLICE-900", "ENG-1269", deps);

    const workspacePath = join(TEST_WORKSPACES_DIR, "SLICE-900");

    // Check files exist
    const statePath = join(workspacePath, "state.json");
    const eventsPath = join(workspacePath, "events.jsonl");
    const sessionsPath = join(workspacePath, "sessions");

    expect((await stat(statePath)).isFile()).toBe(true);
    expect((await stat(eventsPath)).isFile()).toBe(true);
    expect((await stat(sessionsPath)).isDirectory()).toBe(true);
  });

  test("creates state.json with impl type", async () => {
    const { createImplWorkspace, readImplState } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    await createImplWorkspace("SLICE-901", "ENG-1269", deps);

    const state = await readImplState("SLICE-901", deps);

    expect(state.type).toBe("impl");
    expect(state.sliceId).toBe("SLICE-901");
    expect(state.specId).toBe("ENG-1269");
    expect(state.phase).toBe("setup");
    expect(state.tests).toEqual([]);
    expect(state.currentTestIndex).toBe(0);
    expect(state.commits).toEqual([]);
  });

  test("emits workspace_created event", async () => {
    const { createImplWorkspace, readEvents } = await import(
      "../src/impl-workflow"
    );

    const deps = createTestDeps();
    await createImplWorkspace("SLICE-902", "ENG-1269", deps);

    const events = await readEvents("SLICE-902", deps);
    const createEvent = events.find(
      (e: { event: string }) => e.event === "impl_workspace_created"
    );

    expect(createEvent).toBeDefined();
    expect(createEvent?.data.sliceId).toBe("SLICE-902");
    expect(createEvent?.data.specId).toBe("ENG-1269");
  });
});
