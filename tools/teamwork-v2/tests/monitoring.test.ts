import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

/**
 * Tests for monitoring commands in teamwork-v2 (ENG-1270).
 *
 * Commands to test:
 * 1. `teamwork-v2 list` - List all teams with status
 * 2. `teamwork-v2 status [id]` - Show detailed status
 * 3. `teamwork-v2 watch [id]` - Real-time progress display
 * 4. `teamwork-v2 events <id>` - Enhanced event querying
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-monitoring");
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

// ============================================================================
// teamwork-v2 list command (NEW)
// ============================================================================

describe("teamwork-v2 list command", () => {
  describe("basic listing", () => {
    test("lists all teams with their status", async () => {
      // Create multiple workspaces
      await createPlanWorkspace("ENG-100", { phase: "analyzing" });
      await createPlanWorkspace("ENG-101", { phase: "complete" });
      await createImplWorkspace("ENG-102-1", { phase: "implementing" });

      const result =
        await $`bun ${CLI_PATH} list --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-100");
      expect(result).toContain("ENG-101");
      expect(result).toContain("ENG-102-1");
    });

    test("shows ID, type, phase, and timestamps", async () => {
      await createPlanWorkspace("ENG-200", {
        phase: "reviewing",
        createdAt: "2025-01-15T10:00:00Z",
      });

      const result =
        await $`bun ${CLI_PATH} list --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-200");
      expect(result).toContain("plan");
      expect(result).toContain("reviewing");
      expect(result).toContain("2025-01-15");
    });

    test("shows impl type for implementation workspaces", async () => {
      await createImplWorkspace("ENG-201-1", { phase: "writing_tests" });

      const result =
        await $`bun ${CLI_PATH} list --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-201-1");
      expect(result).toContain("impl");
      expect(result).toContain("writing_tests");
    });

    test("returns empty message when no teams exist", async () => {
      const result =
        await $`bun ${CLI_PATH} list --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("No teams found");
    });
  });

  describe("filtering", () => {
    test("--active filters to only non-complete teams", async () => {
      await createPlanWorkspace("ENG-300", { phase: "analyzing" });
      await createPlanWorkspace("ENG-301", { phase: "complete" });
      await createImplWorkspace("ENG-302-1", { phase: "implementing" });
      await createImplWorkspace("ENG-303-1", { phase: "complete" });

      const result =
        await $`bun ${CLI_PATH} list --active --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-300");
      expect(result).toContain("ENG-302-1");
      expect(result).not.toContain("ENG-301");
      expect(result).not.toContain("ENG-303-1");
    });

    test("--completed filters to only complete teams", async () => {
      await createPlanWorkspace("ENG-400", { phase: "analyzing" });
      await createPlanWorkspace("ENG-401", { phase: "complete" });
      await createImplWorkspace("ENG-402-1", { phase: "implementing" });
      await createImplWorkspace("ENG-403-1", { phase: "complete" });

      const result =
        await $`bun ${CLI_PATH} list --completed --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-401");
      expect(result).toContain("ENG-403-1");
      expect(result).not.toContain("ENG-400");
      expect(result).not.toContain("ENG-402-1");
    });

    test("--active and --completed are mutually exclusive", async () => {
      const result =
        await $`bun ${CLI_PATH} list --active --completed --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("mutually exclusive");
    });
  });

  describe("output format", () => {
    test("--json outputs valid JSON array", async () => {
      await createPlanWorkspace("ENG-500", { phase: "analyzing" });
      await createImplWorkspace("ENG-501-1", { phase: "implementing" });

      const result =
        await $`bun ${CLI_PATH} list --json --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      const teams = JSON.parse(result);
      expect(Array.isArray(teams)).toBe(true);
      expect(teams.length).toBe(2);
      expect(teams[0]).toHaveProperty("id");
      expect(teams[0]).toHaveProperty("type");
      expect(teams[0]).toHaveProperty("phase");
      expect(teams[0]).toHaveProperty("createdAt");
    });

    test("shows count of total teams", async () => {
      await createPlanWorkspace("ENG-600");
      await createPlanWorkspace("ENG-601");
      await createPlanWorkspace("ENG-602");

      const result =
        await $`bun ${CLI_PATH} list --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("3 team");
    });
  });

  describe("help", () => {
    test("shows list command help with list --help", async () => {
      const result = await $`bun ${CLI_PATH} list --help`.text();

      expect(result).toContain("list");
      expect(result).toContain("--active");
      expect(result).toContain("--completed");
      expect(result).toContain("workspaces-dir");
    });
  });
});

// ============================================================================
// teamwork-v2 status [id] command (ENHANCED)
// ============================================================================

describe("teamwork-v2 status command (enhanced)", () => {
  describe("summary mode (no id)", () => {
    test("shows summary of all workspaces", async () => {
      await createPlanWorkspace("ENG-700", { phase: "analyzing" });
      await createImplWorkspace("ENG-701-1", { phase: "implementing" });

      const result =
        await $`bun ${CLI_PATH} status --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-700");
      expect(result).toContain("ENG-701-1");
    });

    test("shows count of active vs completed teams", async () => {
      await createPlanWorkspace("ENG-800", { phase: "analyzing" });
      await createPlanWorkspace("ENG-801", { phase: "complete" });
      await createImplWorkspace("ENG-802-1", { phase: "complete" });

      const result =
        await $`bun ${CLI_PATH} status --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toMatch(/1\s+active/i);
      expect(result).toMatch(/2\s+completed/i);
    });
  });

  describe("detailed mode (with id)", () => {
    test("shows detailed status including phase", async () => {
      await createPlanWorkspace("ENG-900", { phase: "reviewing" });

      const result =
        await $`bun ${CLI_PATH} status ENG-900 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("ENG-900");
      expect(result).toContain("reviewing");
      expect(result).toContain("plan");
    });

    test("shows progress metrics for impl workspace", async () => {
      await createImplWorkspace("ENG-901-1", {
        phase: "implementing",
        tests: [
          { name: "test1", status: "passing" },
          { name: "test2", status: "passing" },
          { name: "test3", status: "failing" },
          { name: "test4", status: "pending" },
        ],
        currentTestIndex: 2,
      });

      const result =
        await $`bun ${CLI_PATH} status ENG-901-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("Test Progress");
      expect(result).toContain("2 of 4");
      expect(result).toContain("50%");
    });

    test("shows recent events (last 5)", async () => {
      const events: PlanningEvent[] = [
        createEvent("phase_transition", { from: "setup", to: "analyzing" }),
        createEvent("worker_spawned", { workerId: "w1" }),
        createEvent("phase_transition", { from: "analyzing", to: "proposing" }),
        createEvent("slices_proposed", { totalCount: 3 }),
        createEvent("phase_transition", { from: "proposing", to: "reviewing" }),
        createEvent("slices_approved", { approvedCount: 3 }),
      ];
      await createPlanWorkspace("ENG-902", { phase: "approved" }, events);

      const result =
        await $`bun ${CLI_PATH} status ENG-902 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("Recent Events");
      expect(result).toContain("slices_approved");
      // Should show last 5, not the workspace_created event
      expect(result).toContain("phase_transition");
    });

    test("shows time elapsed since started", async () => {
      const startTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 mins ago
      await createPlanWorkspace("ENG-903", {
        phase: "analyzing",
        startedAt: startTime,
      });

      const result =
        await $`bun ${CLI_PATH} status ENG-903 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("Elapsed");
      expect(result).toMatch(/30\s*m|0h 30m|30 minutes/i);
    });

    test("shows 'not started' when startedAt is not set", async () => {
      await createPlanWorkspace("ENG-904", { phase: "setup" });

      const result =
        await $`bun ${CLI_PATH} status ENG-904 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toMatch(/not started|pending|waiting/i);
    });

    test("shows completion time for complete workspaces", async () => {
      await createPlanWorkspace("ENG-905", {
        phase: "complete",
        startedAt: "2025-01-15T10:00:00Z",
        completedAt: "2025-01-15T10:45:00Z",
      });

      const result =
        await $`bun ${CLI_PATH} status ENG-905 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("Completed");
      expect(result).toMatch(/45\s*m|0h 45m|45 minutes/i);
    });

    test("error for non-existent workspace", async () => {
      const result =
        await $`bun ${CLI_PATH} status ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("not found");
    });
  });
});

// ============================================================================
// teamwork-v2 watch [id] command (NEW)
// ============================================================================

describe("teamwork-v2 watch command", () => {
  describe("single workspace mode", () => {
    test("watch <id> shows progress for single workspace", async () => {
      await createPlanWorkspace("ENG-1000", { phase: "analyzing" });

      // Run with a short timeout since watch is meant to be long-running
      const result =
        await $`timeout 1 bun ${CLI_PATH} watch ENG-1000 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      // Should show initial display before timeout
      const output = result.stdout.toString();
      expect(output).toContain("ENG-1000");
      expect(output).toContain("analyzing");
    });

    test("shows phase information", async () => {
      await createPlanWorkspace("ENG-1001", { phase: "proposing" });

      const result =
        await $`timeout 1 bun ${CLI_PATH} watch ENG-1001 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const output = result.stdout.toString();
      expect(output).toContain("proposing");
    });

    test("shows progress bar/percentage for impl workspace", async () => {
      await createImplWorkspace("ENG-1002-1", {
        phase: "implementing",
        tests: [
          { name: "test1", status: "passing" },
          { name: "test2", status: "failing" },
          { name: "test3", status: "pending" },
        ],
        currentTestIndex: 1,
      });

      const result =
        await $`timeout 1 bun ${CLI_PATH} watch ENG-1002-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const output = result.stdout.toString();
      // Should show some form of progress indicator
      expect(output).toMatch(/33%|1\/3|progress/i);
    });

    test("shows recent activity", async () => {
      const events: PlanningEvent[] = [
        createEvent("phase_transition", { from: "setup", to: "analyzing" }),
        createEvent("worker_spawned", { workerId: "w1" }),
      ];
      await createPlanWorkspace("ENG-1003", { phase: "analyzing" }, events);

      const result =
        await $`timeout 1 bun ${CLI_PATH} watch ENG-1003 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const output = result.stdout.toString();
      expect(output).toContain("worker_spawned");
    });

    test("error for non-existent workspace", async () => {
      const result =
        await $`bun ${CLI_PATH} watch ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("not found");
    });
  });

  describe("all active mode (no id)", () => {
    test("watch (no id) shows all active teams", async () => {
      await createPlanWorkspace("ENG-1100", { phase: "analyzing" });
      await createImplWorkspace("ENG-1101-1", { phase: "implementing" });
      await createPlanWorkspace("ENG-1102", { phase: "complete" }); // Should not show

      const result =
        await $`timeout 1 bun ${CLI_PATH} watch --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const output = result.stdout.toString();
      expect(output).toContain("ENG-1100");
      expect(output).toContain("ENG-1101-1");
      expect(output).not.toContain("ENG-1102");
    });

    test("shows count of active teams", async () => {
      await createPlanWorkspace("ENG-1200", { phase: "analyzing" });
      await createPlanWorkspace("ENG-1201", { phase: "reviewing" });

      const result =
        await $`timeout 1 bun ${CLI_PATH} watch --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const output = result.stdout.toString();
      expect(output).toMatch(/2\s*(active|teams)/i);
    });

    test("shows message when no active teams", async () => {
      await createPlanWorkspace("ENG-1300", { phase: "complete" });

      const result =
        await $`timeout 1 bun ${CLI_PATH} watch --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const output = result.stdout.toString();
      expect(output).toMatch(/no active|all.*complete/i);
    });
  });

  describe("options", () => {
    test("--interval sets refresh rate", async () => {
      await createPlanWorkspace("ENG-1400", { phase: "analyzing" });

      // Just verify the option is accepted
      const result =
        await $`timeout 1 bun ${CLI_PATH} watch ENG-1400 --interval 2 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      // Exit code 124 is from timeout, which is expected
      expect(result.stdout.toString()).toContain("ENG-1400");
    });

    test("--no-clear keeps history visible", async () => {
      await createPlanWorkspace("ENG-1401", { phase: "analyzing" });

      // Just verify the option is accepted
      const result =
        await $`timeout 1 bun ${CLI_PATH} watch ENG-1401 --no-clear --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.stdout.toString()).toContain("ENG-1401");
    });
  });

  describe("help", () => {
    test("shows watch command help with watch --help", async () => {
      const result = await $`bun ${CLI_PATH} watch --help`.text();

      expect(result).toContain("watch");
      expect(result).toContain("interval");
      expect(result).toContain("workspaces-dir");
    });
  });
});

// ============================================================================
// teamwork-v2 events <id> command (ENHANCED)
// ============================================================================

describe("teamwork-v2 events command (enhanced)", () => {
  describe("--since filter", () => {
    test("--since filters events after given ISO timestamp", async () => {
      const oldTime = "2025-01-15T10:00:00Z";
      const newTime = "2025-01-15T11:00:00Z";

      const events: PlanningEvent[] = [
        createEvent("phase_transition", { from: "setup", to: "analyzing" }, oldTime),
        createEvent("phase_transition", { from: "analyzing", to: "proposing" }, newTime),
      ];
      await createPlanWorkspace("ENG-1500", { phase: "proposing" }, events);

      const result =
        await $`bun ${CLI_PATH} events ENG-1500 --since "2025-01-15T10:30:00Z" --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("proposing");
      expect(result).not.toContain("analyzing");
    });

    test("--since accepts relative time (e.g., 1h, 30m)", async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const events: PlanningEvent[] = [
        createEvent("old_event", { id: 1 }, twoHoursAgo),
        createEvent("recent_event", { id: 2 }, oneHourAgo),
      ];
      await createPlanWorkspace("ENG-1501", { phase: "analyzing" }, events);

      const result =
        await $`bun ${CLI_PATH} events ENG-1501 --since "90m" --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("recent_event");
      expect(result).not.toContain("old_event");
    });

    test("shows all events when --since is in the past", async () => {
      const events: PlanningEvent[] = [
        createEvent("event1", { id: 1 }),
        createEvent("event2", { id: 2 }),
      ];
      await createPlanWorkspace("ENG-1502", { phase: "analyzing" }, events);

      const result =
        await $`bun ${CLI_PATH} events ENG-1502 --since "2020-01-01T00:00:00Z" --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("event1");
      expect(result).toContain("event2");
      expect(result).toContain("workspace_created");
    });
  });

  describe("--follow mode", () => {
    test("--follow option is accepted", async () => {
      await createPlanWorkspace("ENG-1600", { phase: "analyzing" });

      // Just verify the option is accepted - actual follow behavior is hard to test
      const result =
        await $`timeout 1 bun ${CLI_PATH} events ENG-1600 --follow --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      // Should start outputting events before timeout
      const output = result.stdout.toString();
      expect(output).toContain("workspace_created");
    });

    test("--follow with -f shorthand", async () => {
      await createPlanWorkspace("ENG-1601", { phase: "analyzing" });

      const result =
        await $`timeout 1 bun ${CLI_PATH} events ENG-1601 -f --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      const output = result.stdout.toString();
      expect(output).toContain("workspace_created");
    });
  });

  describe("--limit filter", () => {
    test("--limit limits output to last N events", async () => {
      const events: PlanningEvent[] = [
        createEvent("event1", { id: 1 }),
        createEvent("event2", { id: 2 }),
        createEvent("event3", { id: 3 }),
        createEvent("event4", { id: 4 }),
        createEvent("event5", { id: 5 }),
      ];
      await createPlanWorkspace("ENG-1700", { phase: "analyzing" }, events);

      const result =
        await $`bun ${CLI_PATH} events ENG-1700 --limit 3 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("event5");
      expect(result).toContain("event4");
      expect(result).toContain("event3");
      expect(result).not.toContain("event2");
      expect(result).not.toContain("event1");
    });

    test("--limit with -n shorthand", async () => {
      const events: PlanningEvent[] = [
        createEvent("event1", { id: 1 }),
        createEvent("event2", { id: 2 }),
        createEvent("event3", { id: 3 }),
      ];
      await createPlanWorkspace("ENG-1701", { phase: "analyzing" }, events);

      const result =
        await $`bun ${CLI_PATH} events ENG-1701 -n 2 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("event3");
      expect(result).toContain("event2");
      expect(result).not.toContain("event1");
    });

    test("--limit returns all if N exceeds total events", async () => {
      const events: PlanningEvent[] = [
        createEvent("event1", { id: 1 }),
        createEvent("event2", { id: 2 }),
      ];
      await createPlanWorkspace("ENG-1702", { phase: "analyzing" }, events);

      const result =
        await $`bun ${CLI_PATH} events ENG-1702 --limit 100 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("workspace_created");
      expect(result).toContain("event1");
      expect(result).toContain("event2");
    });
  });

  describe("combined filters", () => {
    test("--since and --limit can be combined", async () => {
      const oldTime = "2025-01-15T10:00:00Z";
      const newTime1 = "2025-01-15T11:00:00Z";
      const newTime2 = "2025-01-15T11:30:00Z";
      const newTime3 = "2025-01-15T12:00:00Z";

      const events: PlanningEvent[] = [
        createEvent("old_event", { id: 0 }, oldTime),
        createEvent("new_event1", { id: 1 }, newTime1),
        createEvent("new_event2", { id: 2 }, newTime2),
        createEvent("new_event3", { id: 3 }, newTime3),
      ];
      await createPlanWorkspace("ENG-1800", { phase: "analyzing" }, events);

      const result =
        await $`bun ${CLI_PATH} events ENG-1800 --since "2025-01-15T10:30:00Z" --limit 2 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("new_event3");
      expect(result).toContain("new_event2");
      expect(result).not.toContain("new_event1");
      expect(result).not.toContain("old_event");
    });

    test("--type and --limit can be combined", async () => {
      const events: PlanningEvent[] = [
        createEvent("phase_transition", { to: "analyzing" }),
        createEvent("worker_spawned", { workerId: "w1" }),
        createEvent("phase_transition", { to: "proposing" }),
        createEvent("worker_spawned", { workerId: "w2" }),
        createEvent("phase_transition", { to: "reviewing" }),
      ];
      await createPlanWorkspace("ENG-1801", { phase: "reviewing" }, events);

      const result =
        await $`bun ${CLI_PATH} events ENG-1801 --type phase_transition --limit 2 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      expect(result).toContain("reviewing");
      expect(result).toContain("proposing");
      expect(result).not.toContain("analyzing");
      expect(result).not.toContain("worker_spawned");
    });
  });

  describe("output format", () => {
    test("shows timestamps in human-readable format by default", async () => {
      await createPlanWorkspace("ENG-1900", { phase: "analyzing" });

      const result =
        await $`bun ${CLI_PATH} events ENG-1900 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      // Should show some human-readable time format
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}/);
    });

    test("--json with --limit works correctly", async () => {
      const events: PlanningEvent[] = [
        createEvent("event1", { id: 1 }),
        createEvent("event2", { id: 2 }),
        createEvent("event3", { id: 3 }),
      ];
      await createPlanWorkspace("ENG-1901", { phase: "analyzing" }, events);

      const result =
        await $`bun ${CLI_PATH} events ENG-1901 --json --limit 2 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });
  });

  describe("help", () => {
    test("shows enhanced events command help", async () => {
      const result = await $`bun ${CLI_PATH} events --help`.text();

      expect(result).toContain("events");
      expect(result).toContain("--since");
      expect(result).toContain("--follow");
      expect(result).toContain("--limit");
      expect(result).toContain("--type");
      expect(result).toContain("--json");
    });
  });
});

// ============================================================================
// Integration tests
// ============================================================================

describe("monitoring commands integration", () => {
  test("list and status show consistent information", async () => {
    await createPlanWorkspace("ENG-2000", { phase: "analyzing" });

    const listResult =
      await $`bun ${CLI_PATH} list --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();
    const statusResult =
      await $`bun ${CLI_PATH} status ENG-2000 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    // Both should show the same phase
    expect(listResult).toContain("analyzing");
    expect(statusResult).toContain("analyzing");
  });

  test("watch shows same teams as list --active", async () => {
    await createPlanWorkspace("ENG-2100", { phase: "analyzing" });
    await createPlanWorkspace("ENG-2101", { phase: "complete" });

    const listResult =
      await $`bun ${CLI_PATH} list --active --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();
    const watchResult =
      await $`timeout 1 bun ${CLI_PATH} watch --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    const watchOutput = watchResult.stdout.toString();

    // Both should show ENG-2100 but not ENG-2101
    expect(listResult).toContain("ENG-2100");
    expect(listResult).not.toContain("ENG-2101");
    expect(watchOutput).toContain("ENG-2100");
    expect(watchOutput).not.toContain("ENG-2101");
  });

  test("events shown in status match events command output", async () => {
    const events: PlanningEvent[] = [
      createEvent("phase_transition", { from: "setup", to: "analyzing" }),
      createEvent("worker_spawned", { workerId: "w1" }),
    ];
    await createPlanWorkspace("ENG-2200", { phase: "analyzing" }, events);

    const statusResult =
      await $`bun ${CLI_PATH} status ENG-2200 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();
    const eventsResult =
      await $`bun ${CLI_PATH} events ENG-2200 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    // Both should mention the events
    expect(statusResult).toContain("worker_spawned");
    expect(eventsResult).toContain("worker_spawned");
  });
});
