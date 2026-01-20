import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

/**
 * Tests for the `teamwork-v2 plan` CLI command.
 *
 * The CLI should:
 * 1. Accept a spec-id argument
 * 2. Create a workspace with required files
 * 3. Support --dry-run mode
 * 4. Support --workspaces-dir option
 * 5. Handle missing/invalid arguments gracefully
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-cli");
const CLI_PATH = join(import.meta.dir, "../src/cli.ts");

beforeEach(async () => {
  await rm(TEST_WORKSPACES_DIR, { recursive: true, force: true });
  await mkdir(TEST_WORKSPACES_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_WORKSPACES_DIR, { recursive: true, force: true });
});

describe("teamwork-v2 plan command", () => {
  describe("workspace creation", () => {
    test("creates planning workspace for spec ID (dry-run)", async () => {
      const result =
        await $`bun ${CLI_PATH} plan ENG-1268 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).toBe(0);

      // Verify workspace was created
      const statePath = join(TEST_WORKSPACES_DIR, "ENG-1268", "state.json");
      const state = JSON.parse(await readFile(statePath, "utf-8"));

      expect(state.type).toBe("plan");
      expect(state.specId).toBe("ENG-1268");
      expect(state.phase).toBe("setup");
    });

    test("creates state.json with correct initial values (dry-run)", async () => {
      await $`bun ${CLI_PATH} plan ENG-100 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const statePath = join(TEST_WORKSPACES_DIR, "ENG-100", "state.json");
      const state = JSON.parse(await readFile(statePath, "utf-8"));

      expect(state).toHaveProperty("type", "plan");
      expect(state).toHaveProperty("specId", "ENG-100");
      expect(state).toHaveProperty("phase", "setup");
      expect(state).toHaveProperty("revisionCount", 0);
      expect(state).toHaveProperty("createdAt");
      expect(state).toHaveProperty("updatedAt");
    });

    test("creates events.jsonl with workspace_created event (dry-run)", async () => {
      await $`bun ${CLI_PATH} plan ENG-101 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const eventsPath = join(TEST_WORKSPACES_DIR, "ENG-101", "events.jsonl");
      const content = await readFile(eventsPath, "utf-8");
      const firstEvent = JSON.parse(content.trim().split("\n")[0]);

      expect(firstEvent.event).toBe("workspace_created");
      expect(firstEvent.data.specId).toBe("ENG-101");
      expect(firstEvent.timestamp).toBeDefined();
    });

    test("creates progress.md with planning phases (dry-run)", async () => {
      await $`bun ${CLI_PATH} plan ENG-102 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const progressPath = join(TEST_WORKSPACES_DIR, "ENG-102", "progress.md");
      const content = await readFile(progressPath, "utf-8");

      expect(content).toContain("# Planning Progress");
      expect(content).toContain("Spec: ENG-102");
      expect(content).toContain("## Phases");
    });

    test("creates sessions subdirectory (dry-run)", async () => {
      await $`bun ${CLI_PATH} plan ENG-103 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const sessionsPath = join(TEST_WORKSPACES_DIR, "ENG-103", "sessions");
      const stat = await Bun.file(sessionsPath).exists();
      // We need to check if it's a directory, not just if it exists
      expect(stat).toBe(false); // File doesn't exist at this path, but we can stat it
      // Actually let's check using fs/promises
      const { stat: fsStat } = await import("fs/promises");
      const statResult = await fsStat(sessionsPath);
      expect(statResult.isDirectory()).toBe(true);
    });
  });

  describe("output messages", () => {
    test("outputs success message (dry-run)", async () => {
      const result =
        await $`bun ${CLI_PATH} plan ENG-200 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain("Planning workspace created");
      expect(result).toContain("ENG-200");
    });

    test("outputs dry-run indicator (dry-run)", async () => {
      const result =
        await $`bun ${CLI_PATH} plan ENG-201 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain("Dry run");
    });

    test("outputs workspace location", async () => {
      const result =
        await $`bun ${CLI_PATH} plan ENG-202 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain(TEST_WORKSPACES_DIR);
      expect(result).toContain("ENG-202");
    });
  });

  describe("argument validation", () => {
    test("fails if spec-id is missing", async () => {
      const result =
        await $`bun ${CLI_PATH} plan --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("spec-id");
    });

    test("fails if spec-id format is invalid", async () => {
      const result =
        await $`bun ${CLI_PATH} plan invalid --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("Invalid spec ID");
    });

    test("accepts various valid spec-id formats", async () => {
      // ENG-XXX format
      const result1 =
        await $`bun ${CLI_PATH} plan ENG-123 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();
      expect(result1.exitCode).toBe(0);

      // SPEC-XXX format
      const result2 =
        await $`bun ${CLI_PATH} plan SPEC-456 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();
      expect(result2.exitCode).toBe(0);

      // Longer numbers
      const result3 =
        await $`bun ${CLI_PATH} plan ENG-12345 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();
      expect(result3.exitCode).toBe(0);
    });
  });

  describe("options", () => {
    test("uses default workspaces directory when not specified (dry-run)", async () => {
      const defaultDir = join(process.cwd(), ".claude", "teamwork-v2");

      // Clean up default location for test
      await rm(defaultDir, { recursive: true, force: true });

      const result = await $`bun ${CLI_PATH} plan ENG-300 --dry-run`.nothrow();

      expect(result.exitCode).toBe(0);

      // Verify workspace was created in default location
      const statePath = join(defaultDir, "ENG-300", "state.json");
      const state = JSON.parse(await readFile(statePath, "utf-8"));
      expect(state.specId).toBe("ENG-300");

      // Cleanup
      await rm(defaultDir, { recursive: true, force: true });
    });

    test("respects --workspaces-dir option", async () => {
      const customDir = join(tmpdir(), "custom-workspaces-dir");
      await rm(customDir, { recursive: true, force: true });
      await mkdir(customDir, { recursive: true });

      try {
        const result =
          await $`bun ${CLI_PATH} plan ENG-301 --workspaces-dir ${customDir} --dry-run`.nothrow();

        expect(result.exitCode).toBe(0);

        const statePath = join(customDir, "ENG-301", "state.json");
        const state = JSON.parse(await readFile(statePath, "utf-8"));
        expect(state.specId).toBe("ENG-301");
      } finally {
        await rm(customDir, { recursive: true, force: true });
      }
    });

    test("--timeout option sets custom timeout", async () => {
      const result =
        await $`bun ${CLI_PATH} plan ENG-302 --workspaces-dir ${TEST_WORKSPACES_DIR} --timeout 30 --dry-run`.nothrow();

      expect(result.exitCode).toBe(0);

      // Verify timeout is stored in state
      const statePath = join(TEST_WORKSPACES_DIR, "ENG-302", "state.json");
      const state = JSON.parse(await readFile(statePath, "utf-8"));
      expect(state.timeoutMinutes).toBe(30);
    });

    test("default timeout is 60 minutes", async () => {
      await $`bun ${CLI_PATH} plan ENG-303 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const statePath = join(TEST_WORKSPACES_DIR, "ENG-303", "state.json");
      const state = JSON.parse(await readFile(statePath, "utf-8"));
      expect(state.timeoutMinutes).toBe(60);
    });
  });

  describe("error handling", () => {
    test("fails gracefully if workspace already exists", async () => {
      // Create workspace first
      await $`bun ${CLI_PATH} plan ENG-400 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      // Try to create again
      const result =
        await $`bun ${CLI_PATH} plan ENG-400 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("already exists");
    });

    test("fails gracefully if workspaces-dir is not writable", async () => {
      const result =
        await $`bun ${CLI_PATH} plan ENG-401 --workspaces-dir /nonexistent/path --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
    });
  });

  describe("help and version", () => {
    test("shows help with --help", async () => {
      const result = await $`bun ${CLI_PATH} --help`.text();

      expect(result).toContain("teamwork-v2");
      expect(result).toContain("plan");
    });

    test("shows plan command help with plan --help", async () => {
      const result = await $`bun ${CLI_PATH} plan --help`.text();

      expect(result).toContain("spec-id");
      expect(result).toContain("workspaces-dir");
      expect(result).toContain("dry-run");
    });

    test("shows version with --version", async () => {
      const result = await $`bun ${CLI_PATH} --version`.text();

      expect(result).toMatch(/\d+\.\d+\.\d+/);
    });
  });
});

describe("teamwork-v2 status command", () => {
  test("shows status of specific workspace", async () => {
    // Create a workspace first
    await $`bun ${CLI_PATH} plan ENG-500 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const result =
      await $`bun ${CLI_PATH} status ENG-500 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("ENG-500");
    expect(result).toContain("setup");
  });

  test("shows error for non-existent workspace", async () => {
    const result =
      await $`bun ${CLI_PATH} status ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("not found");
  });

  test("lists all active workspaces when no spec-id given", async () => {
    // Create multiple workspaces
    await $`bun ${CLI_PATH} plan ENG-501 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;
    await $`bun ${CLI_PATH} plan ENG-502 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const result =
      await $`bun ${CLI_PATH} status --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("ENG-501");
    expect(result).toContain("ENG-502");
  });

  test("shows 'no active workspaces' when none exist", async () => {
    const result =
      await $`bun ${CLI_PATH} status --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("No active");
  });
});

describe("teamwork-v2 events command", () => {
  test("shows events for workspace", async () => {
    // Create a workspace first
    await $`bun ${CLI_PATH} plan ENG-600 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const result =
      await $`bun ${CLI_PATH} events ENG-600 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("workspace_created");
    expect(result).toContain("ENG-600");
  });

  test("shows error for non-existent workspace", async () => {
    const result =
      await $`bun ${CLI_PATH} events ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("not found");
  });

  test("supports --json output format", async () => {
    await $`bun ${CLI_PATH} plan ENG-601 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const result =
      await $`bun ${CLI_PATH} events ENG-601 --workspaces-dir ${TEST_WORKSPACES_DIR} --json`.text();

    // Should be valid JSON
    const events = JSON.parse(result);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  test("supports --type filter", async () => {
    await $`bun ${CLI_PATH} plan ENG-602 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const result =
      await $`bun ${CLI_PATH} events ENG-602 --workspaces-dir ${TEST_WORKSPACES_DIR} --type workspace_created`.text();

    expect(result).toContain("workspace_created");
  });
});

// ============================================================================
// Implementation Command Tests (ENG-1269)
// ============================================================================

describe("teamwork-v2 impl command", () => {
  describe("single slice implementation", () => {
    test("starts implementation workflow for a slice (dry-run)", async () => {
      const result =
        await $`bun ${CLI_PATH} impl ENG-1269-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).toBe(0);

      // Verify workspace was created
      const statePath = join(TEST_WORKSPACES_DIR, "ENG-1269-1", "state.json");
      const state = JSON.parse(await readFile(statePath, "utf-8"));

      expect(state.type).toBe("impl");
      expect(state.sliceId).toBe("ENG-1269-1");
      expect(state.phase).toBe("setup");
    });

    test("creates state.json with correct impl structure (dry-run)", async () => {
      await $`bun ${CLI_PATH} impl ENG-100-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const statePath = join(TEST_WORKSPACES_DIR, "ENG-100-1", "state.json");
      const state = JSON.parse(await readFile(statePath, "utf-8"));

      expect(state).toHaveProperty("type", "impl");
      expect(state).toHaveProperty("sliceId", "ENG-100-1");
      expect(state).toHaveProperty("phase", "setup");
      expect(state).toHaveProperty("tests");
      expect(state).toHaveProperty("currentTestIndex", 0);
      expect(state).toHaveProperty("commits");
      expect(state).toHaveProperty("createdAt");
      expect(state).toHaveProperty("updatedAt");
    });

    test("creates events.jsonl with impl_workspace_created event (dry-run)", async () => {
      await $`bun ${CLI_PATH} impl ENG-101-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const eventsPath = join(TEST_WORKSPACES_DIR, "ENG-101-1", "events.jsonl");
      const content = await readFile(eventsPath, "utf-8");
      const firstEvent = JSON.parse(content.trim().split("\n")[0]);

      expect(firstEvent.event).toBe("impl_workspace_created");
      expect(firstEvent.data.sliceId).toBe("ENG-101-1");
      expect(firstEvent.timestamp).toBeDefined();
    });

    test("outputs success message with slice ID (dry-run)", async () => {
      const result =
        await $`bun ${CLI_PATH} impl ENG-200-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain("Implementation workspace created");
      expect(result).toContain("ENG-200-1");
    });

    test("outputs dry-run indicator (dry-run)", async () => {
      const result =
        await $`bun ${CLI_PATH} impl ENG-201-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain("Dry run");
    });
  });

  describe("argument validation", () => {
    test("fails if slice-id is missing", async () => {
      const result =
        await $`bun ${CLI_PATH} impl --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("slice-id");
    });

    test("fails if slice-id format is invalid", async () => {
      const result =
        await $`bun ${CLI_PATH} impl invalid --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("Invalid slice ID");
    });

    test("accepts valid slice-id formats", async () => {
      // ENG-XXX-N format
      const result1 =
        await $`bun ${CLI_PATH} impl ENG-123-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();
      expect(result1.exitCode).toBe(0);

      // SPEC-XXX-N format
      const result2 =
        await $`bun ${CLI_PATH} impl SPEC-456-2 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();
      expect(result2.exitCode).toBe(0);

      // Longer numbers
      const result3 =
        await $`bun ${CLI_PATH} impl ENG-12345-10 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();
      expect(result3.exitCode).toBe(0);
    });
  });

  describe("options", () => {
    test("--timeout option sets custom timeout", async () => {
      const result =
        await $`bun ${CLI_PATH} impl ENG-300-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --timeout 15 --dry-run`.nothrow();

      expect(result.exitCode).toBe(0);

      const statePath = join(TEST_WORKSPACES_DIR, "ENG-300-1", "state.json");
      const state = JSON.parse(await readFile(statePath, "utf-8"));
      expect(state.timeoutMinutes).toBe(15);
    });

    test("default timeout is 30 minutes for impl", async () => {
      await $`bun ${CLI_PATH} impl ENG-301-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const statePath = join(TEST_WORKSPACES_DIR, "ENG-301-1", "state.json");
      const state = JSON.parse(await readFile(statePath, "utf-8"));
      expect(state.timeoutMinutes).toBe(30);
    });

    test("--spec-id option associates slice with parent spec", async () => {
      await $`bun ${CLI_PATH} impl ENG-302-1 --spec-id ENG-302 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const statePath = join(TEST_WORKSPACES_DIR, "ENG-302-1", "state.json");
      const state = JSON.parse(await readFile(statePath, "utf-8"));
      expect(state.specId).toBe("ENG-302");
    });
  });

  describe("error handling", () => {
    test("fails gracefully if workspace already exists", async () => {
      // Create workspace first
      await $`bun ${CLI_PATH} impl ENG-400-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      // Try to create again
      const result =
        await $`bun ${CLI_PATH} impl ENG-400-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("already exists");
    });

    test("fails gracefully if workspaces-dir is not writable", async () => {
      const result =
        await $`bun ${CLI_PATH} impl ENG-401-1 --workspaces-dir /nonexistent/path --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
    });
  });

  describe("help", () => {
    test("shows impl command help with impl --help", async () => {
      const result = await $`bun ${CLI_PATH} impl --help`.text();

      expect(result).toContain("slice-id");
      expect(result).toContain("workspaces-dir");
      expect(result).toContain("dry-run");
      expect(result).toContain("timeout");
    });
  });
});

describe("teamwork-v2 impl --all command", () => {
  describe("all slices implementation", () => {
    test("starts implementation for all slices in a spec (dry-run)", async () => {
      // First create a planning workspace with slices
      await $`bun ${CLI_PATH} plan ENG-500 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      // Write mock slices to the planning workspace
      const slicesPath = join(TEST_WORKSPACES_DIR, "ENG-500", "slices.json");
      const mockSlices = [
        { title: "Slice 1", description: "First", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
        { title: "Slice 2", description: "Second", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
      ];
      await Bun.write(slicesPath, JSON.stringify(mockSlices));

      const result =
        await $`bun ${CLI_PATH} impl --all ENG-500 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain("Starting implementation for 2 slices");
    });

    test("creates workspace for each slice", async () => {
      // First create a planning workspace with slices
      await $`bun ${CLI_PATH} plan ENG-501 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const slicesPath = join(TEST_WORKSPACES_DIR, "ENG-501", "slices.json");
      const mockSlices = [
        { title: "Auth", description: "Auth slice", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
        { title: "API", description: "API slice", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
      ];
      await Bun.write(slicesPath, JSON.stringify(mockSlices));

      await $`bun ${CLI_PATH} impl --all ENG-501 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      // Check that workspaces were created for each slice
      const slice1StatePath = join(TEST_WORKSPACES_DIR, "ENG-501-1", "state.json");
      const slice2StatePath = join(TEST_WORKSPACES_DIR, "ENG-501-2", "state.json");

      const slice1State = JSON.parse(await readFile(slice1StatePath, "utf-8"));
      const slice2State = JSON.parse(await readFile(slice2StatePath, "utf-8"));

      expect(slice1State.type).toBe("impl");
      expect(slice1State.specId).toBe("ENG-501");
      expect(slice2State.type).toBe("impl");
      expect(slice2State.specId).toBe("ENG-501");
    });

    test("implements slices sequentially", async () => {
      await $`bun ${CLI_PATH} plan ENG-502 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const slicesPath = join(TEST_WORKSPACES_DIR, "ENG-502", "slices.json");
      const mockSlices = [
        { title: "First", description: "First", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
        { title: "Second", description: "Second", acceptanceCriteria: [], testApproach: "", dependencies: ["First"], isIndependent: false },
      ];
      await Bun.write(slicesPath, JSON.stringify(mockSlices));

      const result =
        await $`bun ${CLI_PATH} impl --all ENG-502 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      // Output should indicate sequential processing
      expect(result).toContain("Implementing slice 1 of 2");
      expect(result).toContain("Implementing slice 2 of 2");
    });

    test("respects slice dependencies during --all implementation", async () => {
      await $`bun ${CLI_PATH} plan ENG-503 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const slicesPath = join(TEST_WORKSPACES_DIR, "ENG-503", "slices.json");
      const mockSlices = [
        { title: "Base", description: "Base", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
        { title: "Feature", description: "Feature", acceptanceCriteria: [], testApproach: "", dependencies: ["Base"], isIndependent: false },
      ];
      await Bun.write(slicesPath, JSON.stringify(mockSlices));

      const result =
        await $`bun ${CLI_PATH} impl --all ENG-503 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      // Should process Base before Feature due to dependency
      const baseIndex = result.indexOf("Base");
      const featureIndex = result.indexOf("Feature");

      expect(baseIndex).toBeLessThan(featureIndex);
    });
  });

  describe("argument validation", () => {
    test("fails if spec-id is missing with --all", async () => {
      const result =
        await $`bun ${CLI_PATH} impl --all --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("spec-id");
    });

    test("fails if planning workspace does not exist", async () => {
      const result =
        await $`bun ${CLI_PATH} impl --all ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("not found");
    });

    test("fails if no slices found in planning workspace", async () => {
      await $`bun ${CLI_PATH} plan ENG-504 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const result =
        await $`bun ${CLI_PATH} impl --all ENG-504 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("No slices found");
    });
  });

  describe("options", () => {
    test("--dry-run option prevents actual implementation", async () => {
      await $`bun ${CLI_PATH} plan ENG-505 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const slicesPath = join(TEST_WORKSPACES_DIR, "ENG-505", "slices.json");
      await Bun.write(slicesPath, JSON.stringify([
        { title: "Slice 1", description: "First", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
      ]));

      const result =
        await $`bun ${CLI_PATH} impl --all ENG-505 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain("Dry run");
      expect(result).toContain("workspace created");
    });
  });

  describe("status reporting", () => {
    test("shows progress during --all implementation", async () => {
      await $`bun ${CLI_PATH} plan ENG-506 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const slicesPath = join(TEST_WORKSPACES_DIR, "ENG-506", "slices.json");
      await Bun.write(slicesPath, JSON.stringify([
        { title: "Slice 1", description: "First", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
        { title: "Slice 2", description: "Second", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
      ]));

      const result =
        await $`bun ${CLI_PATH} impl --all ENG-506 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain("1 of 2");
      expect(result).toContain("2 of 2");
    });

    test("shows summary at completion", async () => {
      await $`bun ${CLI_PATH} plan ENG-507 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

      const slicesPath = join(TEST_WORKSPACES_DIR, "ENG-507", "slices.json");
      await Bun.write(slicesPath, JSON.stringify([
        { title: "Slice 1", description: "First", acceptanceCriteria: [], testApproach: "", dependencies: [], isIndependent: true },
      ]));

      const result =
        await $`bun ${CLI_PATH} impl --all ENG-507 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain("Implementation complete");
    });
  });
});

describe("teamwork-v2 impl status integration", () => {
  test("status command shows impl workspace details", async () => {
    await $`bun ${CLI_PATH} impl ENG-700-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const result =
      await $`bun ${CLI_PATH} status ENG-700-1 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("ENG-700-1");
    expect(result).toContain("impl");
    expect(result).toContain("setup");
  });

  test("status command lists both plan and impl workspaces", async () => {
    await $`bun ${CLI_PATH} plan ENG-701 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;
    await $`bun ${CLI_PATH} impl ENG-701-1 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`;

    const result =
      await $`bun ${CLI_PATH} status --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("ENG-701");
    expect(result).toContain("ENG-701-1");
  });
});
