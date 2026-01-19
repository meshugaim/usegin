import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

const TEST_TEAMS_DIR = join(tmpdir(), "team-test-status-workspaces");
const CLI_PATH = join(import.meta.dir, "../src/cli.ts");

beforeEach(async () => {
  await rm(TEST_TEAMS_DIR, { recursive: true, force: true });
  await mkdir(TEST_TEAMS_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_TEAMS_DIR, { recursive: true, force: true });
});

/**
 * Helper to create a team workspace with specific state
 */
async function createTeamWorkspace(
  issueId: string,
  state: Record<string, unknown>
) {
  const workspacePath = join(TEST_TEAMS_DIR, issueId);
  await mkdir(workspacePath, { recursive: true });
  await mkdir(join(workspacePath, "sessions"), { recursive: true });
  await mkdir(join(workspacePath, "checkpoints"), { recursive: true });

  await writeFile(
    join(workspacePath, "state.json"),
    JSON.stringify(state, null, 2)
  );

  await writeFile(join(workspacePath, "progress.md"), `# Progress\n`);
  await writeFile(join(workspacePath, "events.jsonl"), "");
}

describe("team status command", () => {
  test("shows status for a specific team", async () => {
    await createTeamWorkspace("ENG-200", {
      type: "impl",
      issueId: "ENG-200",
      phase: "implementing",
      testsApproved: true,
      subtasksTotal: 5,
      subtasksComplete: 2,
      createdAt: "2026-01-15T10:00:00Z",
      updatedAt: "2026-01-15T12:00:00Z",
    });

    const result =
      await $`bun ${CLI_PATH} status ENG-200 --teams-dir ${TEST_TEAMS_DIR}`.text();

    expect(result).toContain("ENG-200");
    expect(result).toContain("impl");
    expect(result).toContain("implementing");
  });

  test("shows all active teams when no id provided", async () => {
    await createTeamWorkspace("ENG-201", {
      type: "plan",
      issueId: "ENG-201",
      phase: "reviewing",
      createdAt: "2026-01-15T10:00:00Z",
      updatedAt: "2026-01-15T11:00:00Z",
    });

    await createTeamWorkspace("ENG-202", {
      type: "impl",
      issueId: "ENG-202",
      phase: "writing_tests",
      createdAt: "2026-01-15T09:00:00Z",
      updatedAt: "2026-01-15T10:00:00Z",
    });

    const result =
      await $`bun ${CLI_PATH} status --teams-dir ${TEST_TEAMS_DIR}`.text();

    expect(result).toContain("ENG-201");
    expect(result).toContain("ENG-202");
  });

  test("shows message when no teams exist", async () => {
    const result =
      await $`bun ${CLI_PATH} status --teams-dir ${TEST_TEAMS_DIR}`.text();

    expect(result).toContain("No teams found");
  });

  test("fails gracefully for non-existent team", async () => {
    const result =
      await $`bun ${CLI_PATH} status ENG-999 --teams-dir ${TEST_TEAMS_DIR}`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("not found");
  });

  test("shows progress info (subtasks) for impl teams", async () => {
    await createTeamWorkspace("ENG-203", {
      type: "impl",
      issueId: "ENG-203",
      phase: "implementing",
      testsApproved: true,
      subtasksTotal: 8,
      subtasksComplete: 3,
      createdAt: "2026-01-15T10:00:00Z",
      updatedAt: "2026-01-15T12:00:00Z",
    });

    const result =
      await $`bun ${CLI_PATH} status ENG-203 --teams-dir ${TEST_TEAMS_DIR}`.text();

    expect(result).toContain("3");
    expect(result).toContain("8");
  });
});

describe("team list command", () => {
  test("lists all teams (active + completed)", async () => {
    await createTeamWorkspace("ENG-300", {
      type: "plan",
      issueId: "ENG-300",
      phase: "complete",
      createdAt: "2026-01-14T10:00:00Z",
      updatedAt: "2026-01-14T12:00:00Z",
    });

    await createTeamWorkspace("ENG-301", {
      type: "impl",
      issueId: "ENG-301",
      phase: "writing_tests",
      createdAt: "2026-01-15T10:00:00Z",
      updatedAt: "2026-01-15T11:00:00Z",
    });

    const result =
      await $`bun ${CLI_PATH} list --teams-dir ${TEST_TEAMS_DIR}`.text();

    expect(result).toContain("ENG-300");
    expect(result).toContain("ENG-301");
  });

  test("shows team type and phase", async () => {
    await createTeamWorkspace("ENG-302", {
      type: "impl",
      issueId: "ENG-302",
      phase: "implementing",
      createdAt: "2026-01-15T10:00:00Z",
      updatedAt: "2026-01-15T11:00:00Z",
    });

    const result =
      await $`bun ${CLI_PATH} list --teams-dir ${TEST_TEAMS_DIR}`.text();

    expect(result).toContain("impl");
    expect(result).toContain("implementing");
  });

  test("shows message when no teams exist", async () => {
    const result =
      await $`bun ${CLI_PATH} list --teams-dir ${TEST_TEAMS_DIR}`.text();

    expect(result).toContain("No teams found");
  });

  test("sorts teams by updated time (most recent first)", async () => {
    await createTeamWorkspace("ENG-303", {
      type: "plan",
      issueId: "ENG-303",
      phase: "complete",
      createdAt: "2026-01-14T10:00:00Z",
      updatedAt: "2026-01-14T12:00:00Z",
    });

    await createTeamWorkspace("ENG-304", {
      type: "impl",
      issueId: "ENG-304",
      phase: "writing_tests",
      createdAt: "2026-01-15T10:00:00Z",
      updatedAt: "2026-01-15T14:00:00Z", // More recent
    });

    const result =
      await $`bun ${CLI_PATH} list --teams-dir ${TEST_TEAMS_DIR}`.text();

    // ENG-304 should appear before ENG-303 (more recently updated)
    const idx304 = result.indexOf("ENG-304");
    const idx303 = result.indexOf("ENG-303");
    expect(idx304).toBeLessThan(idx303);
  });
});
