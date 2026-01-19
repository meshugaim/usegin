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
  test("creates planning team workspace", async () => {
    const result =
      await $`bun ${CLI_PATH} plan ENG-123 --teams-dir ${TEST_TEAMS_DIR}`.nothrow();

    expect(result.exitCode).toBe(0);

    // Verify workspace was created
    const statePath = join(TEST_TEAMS_DIR, "ENG-123", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));

    expect(state.type).toBe("plan");
    expect(state.issueId).toBe("ENG-123");
    expect(state.phase).toBe("planning");
  });

  test("outputs success message", async () => {
    const result =
      await $`bun ${CLI_PATH} plan ENG-456 --teams-dir ${TEST_TEAMS_DIR}`.text();

    expect(result).toContain("Planning team workspace created");
    expect(result).toContain("ENG-456");
  });

  test("fails if issue ID is missing", async () => {
    const result = await $`bun ${CLI_PATH} plan --teams-dir ${TEST_TEAMS_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("issue-id");
  });

  test("uses default teams directory when not specified", async () => {
    // This test verifies the CLI has a sensible default
    const defaultDir = join(process.cwd(), ".claude", "teams");

    // Clean up default location for test
    await rm(defaultDir, { recursive: true, force: true });

    const result = await $`bun ${CLI_PATH} plan ENG-789`.nothrow();

    expect(result.exitCode).toBe(0);

    // Verify workspace was created in default location
    const statePath = join(defaultDir, "ENG-789", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    expect(state.issueId).toBe("ENG-789");

    // Cleanup
    await rm(defaultDir, { recursive: true, force: true });
  });
});
