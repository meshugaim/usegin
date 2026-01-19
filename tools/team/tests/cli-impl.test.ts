import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readFile, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

const TEST_TEAMS_DIR = join(tmpdir(), "team-test-impl-workspaces");
const CLI_PATH = join(import.meta.dir, "../src/cli.ts");

beforeEach(async () => {
  await rm(TEST_TEAMS_DIR, { recursive: true, force: true });
  await mkdir(TEST_TEAMS_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_TEAMS_DIR, { recursive: true, force: true });
});

describe("team impl command", () => {
  test("creates implementation team workspace (dry-run)", async () => {
    const result =
      await $`bun ${CLI_PATH} impl ENG-100 --teams-dir ${TEST_TEAMS_DIR} --dry-run`.nothrow();

    expect(result.exitCode).toBe(0);

    // Verify workspace was created
    const statePath = join(TEST_TEAMS_DIR, "ENG-100", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));

    expect(state.type).toBe("impl");
    expect(state.issueId).toBe("ENG-100");
    expect(state.phase).toBe("writing_tests");
  });

  test("outputs success message (dry-run)", async () => {
    const result =
      await $`bun ${CLI_PATH} impl ENG-101 --teams-dir ${TEST_TEAMS_DIR} --dry-run`.text();

    expect(result).toContain("Implementation team workspace created");
    expect(result).toContain("ENG-101");
    expect(result).toContain("Dry run");
  });

  test("fails if issue ID is missing", async () => {
    const result =
      await $`bun ${CLI_PATH} impl --teams-dir ${TEST_TEAMS_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("issue-id");
  });

  test("creates progress.md in workspace (dry-run)", async () => {
    await $`bun ${CLI_PATH} impl ENG-102 --teams-dir ${TEST_TEAMS_DIR} --dry-run`;

    const progressPath = join(TEST_TEAMS_DIR, "ENG-102", "progress.md");
    const content = await readFile(progressPath, "utf-8");

    expect(content).toContain("# Implementation Team Progress");
    expect(content).toContain("ENG-102");
  });

  test("state.json includes all required impl fields (dry-run)", async () => {
    await $`bun ${CLI_PATH} impl ENG-103 --teams-dir ${TEST_TEAMS_DIR} --dry-run`;

    const statePath = join(TEST_TEAMS_DIR, "ENG-103", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));

    expect(state).toHaveProperty("type", "impl");
    expect(state).toHaveProperty("issueId", "ENG-103");
    expect(state).toHaveProperty("phase", "writing_tests");
    expect(state).toHaveProperty("testsApproved", false);
    expect(state).toHaveProperty("subtasksTotal", 0);
    expect(state).toHaveProperty("subtasksComplete", 0);
    expect(state).toHaveProperty("blockers");
    expect(state).toHaveProperty("createdAt");
    expect(state).toHaveProperty("updatedAt");
  });

  test("does not create slice.md for impl teams (dry-run)", async () => {
    await $`bun ${CLI_PATH} impl ENG-104 --teams-dir ${TEST_TEAMS_DIR} --dry-run`;

    const slicePath = join(TEST_TEAMS_DIR, "ENG-104", "slice.md");
    const exists = await Bun.file(slicePath).exists();

    // slice.md is only for planning teams - impl teams get requirements from Linear
    expect(exists).toBe(false);
  });

  test("creates sessions directory (dry-run)", async () => {
    await $`bun ${CLI_PATH} impl ENG-105 --teams-dir ${TEST_TEAMS_DIR} --dry-run`;

    const sessionsDir = join(TEST_TEAMS_DIR, "ENG-105", "sessions");
    const dirStat = await stat(sessionsDir);

    expect(dirStat.isDirectory()).toBe(true);
  });

  test("creates checkpoints directory (dry-run)", async () => {
    await $`bun ${CLI_PATH} impl ENG-106 --teams-dir ${TEST_TEAMS_DIR} --dry-run`;

    const checkpointsDir = join(TEST_TEAMS_DIR, "ENG-106", "checkpoints");
    const dirStat = await stat(checkpointsDir);

    expect(dirStat.isDirectory()).toBe(true);
  });

  test("creates events.jsonl with team_spawn event (dry-run)", async () => {
    await $`bun ${CLI_PATH} impl ENG-107 --teams-dir ${TEST_TEAMS_DIR} --dry-run`;

    const eventsPath = join(TEST_TEAMS_DIR, "ENG-107", "events.jsonl");
    const content = await readFile(eventsPath, "utf-8");
    const event = JSON.parse(content.trim());

    expect(event.event).toBe("team_spawn");
    expect(event.data.type).toBe("impl");
    expect(event.data.issueId).toBe("ENG-107");
  });
});
