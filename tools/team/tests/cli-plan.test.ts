import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

const TEST_TEAMS_DIR = join(tmpdir(), "team-test-cli-workspaces");
const CLI_PATH = join(import.meta.dir, "../src/cli.ts");

beforeEach(async () => {
  await rm(TEST_TEAMS_DIR, { recursive: true, force: true });
  await mkdir(TEST_TEAMS_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_TEAMS_DIR, { recursive: true, force: true });
});

describe("team plan command", () => {
  test("creates planning team workspace (dry-run)", async () => {
    const result =
      await $`bun ${CLI_PATH} plan ENG-123 --teams-dir ${TEST_TEAMS_DIR} --dry-run`.nothrow();

    expect(result.exitCode).toBe(0);

    // Verify workspace was created
    const statePath = join(TEST_TEAMS_DIR, "ENG-123", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));

    expect(state.type).toBe("plan");
    expect(state.issueId).toBe("ENG-123");
    expect(state.phase).toBe("analysis");
  });

  test("outputs success message (dry-run)", async () => {
    const result =
      await $`bun ${CLI_PATH} plan ENG-456 --teams-dir ${TEST_TEAMS_DIR} --dry-run`.text();

    expect(result).toContain("Planning team workspace created");
    expect(result).toContain("ENG-456");
    expect(result).toContain("Dry run");
  });

  test("fails if issue ID is missing", async () => {
    const result = await $`bun ${CLI_PATH} plan --teams-dir ${TEST_TEAMS_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("issue-id");
  });

  test("uses default teams directory when not specified (dry-run)", async () => {
    // This test verifies the CLI has a sensible default
    const defaultDir = join(process.cwd(), ".claude", "teams");

    // Clean up default location for test
    await rm(defaultDir, { recursive: true, force: true });

    const result = await $`bun ${CLI_PATH} plan ENG-789 --dry-run`.nothrow();

    expect(result.exitCode).toBe(0);

    // Verify workspace was created in default location
    const statePath = join(defaultDir, "ENG-789", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    expect(state.issueId).toBe("ENG-789");

    // Cleanup
    await rm(defaultDir, { recursive: true, force: true });
  });

  test("creates progress.md in workspace (dry-run)", async () => {
    await $`bun ${CLI_PATH} plan ENG-222 --teams-dir ${TEST_TEAMS_DIR} --dry-run`;

    const progressPath = join(TEST_TEAMS_DIR, "ENG-222", "progress.md");
    const content = await readFile(progressPath, "utf-8");

    expect(content).toContain("# Planning Team Progress");
    expect(content).toContain("ENG-222");
  });

  test("creates slice.md with spec content placeholder (dry-run)", async () => {
    await $`bun ${CLI_PATH} plan ENG-333 --teams-dir ${TEST_TEAMS_DIR} --dry-run`;

    const slicePath = join(TEST_TEAMS_DIR, "ENG-333", "slice.md");
    const content = await readFile(slicePath, "utf-8");

    expect(content).toContain("Spec Issue: ENG-333");
  });

  test("state.json includes all required fields (dry-run)", async () => {
    await $`bun ${CLI_PATH} plan ENG-444 --teams-dir ${TEST_TEAMS_DIR} --dry-run`;

    const statePath = join(TEST_TEAMS_DIR, "ENG-444", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));

    expect(state).toHaveProperty("type", "plan");
    expect(state).toHaveProperty("issueId", "ENG-444");
    expect(state).toHaveProperty("phase", "analysis");
    expect(state).toHaveProperty("createdAt");
    expect(state).toHaveProperty("updatedAt");
  });
});
