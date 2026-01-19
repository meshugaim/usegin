import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, access, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  createTeamWorkspace,
  getTeamWorkspacePath,
  type TeamWorkspaceDeps,
} from "../src/workspace";

const TEST_TEAMS_DIR = join(tmpdir(), "team-test-workspaces");

function createTestDeps(): TeamWorkspaceDeps {
  return {
    teamsDir: TEST_TEAMS_DIR,
  };
}

beforeEach(async () => {
  await rm(TEST_TEAMS_DIR, { recursive: true, force: true });
  await mkdir(TEST_TEAMS_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_TEAMS_DIR, { recursive: true, force: true });
});

describe("getTeamWorkspacePath", () => {
  test("returns correct path for issue ID", () => {
    const deps = createTestDeps();
    const path = getTeamWorkspacePath("ENG-123", deps);
    expect(path).toBe(join(TEST_TEAMS_DIR, "ENG-123"));
  });
});

describe("createTeamWorkspace", () => {
  test("creates workspace directory", async () => {
    const deps = createTestDeps();
    await createTeamWorkspace("ENG-123", "plan", deps);

    const workspacePath = join(TEST_TEAMS_DIR, "ENG-123");
    // access() resolves successfully if directory exists, throws otherwise
    await access(workspacePath);
    expect(true).toBe(true); // If we got here, access succeeded
  });

  test("creates subdirectories", async () => {
    const deps = createTestDeps();
    await createTeamWorkspace("ENG-123", "plan", deps);

    const workspacePath = join(TEST_TEAMS_DIR, "ENG-123");
    const sessionsPath = join(workspacePath, "sessions");
    const checkpointsPath = join(workspacePath, "checkpoints");

    // access() throws if directory doesn't exist
    await access(sessionsPath);
    await access(checkpointsPath);
  });

  test("creates state.json with correct initial state for planning team", async () => {
    const deps = createTestDeps();
    await createTeamWorkspace("ENG-123", "plan", deps);

    const statePath = join(TEST_TEAMS_DIR, "ENG-123", "state.json");
    const stateContent = await readFile(statePath, "utf-8");
    const state = JSON.parse(stateContent);

    expect(state.type).toBe("plan");
    expect(state.issueId).toBe("ENG-123");
    expect(state.phase).toBe("analysis");
    expect(state.createdAt).toBeDefined();
    expect(state.updatedAt).toBeDefined();
    expect(new Date(state.createdAt).getTime()).toBeGreaterThan(0);
    expect(new Date(state.updatedAt).getTime()).toBeGreaterThan(0);
  });

  test("creates state.json with correct initial state for implementation team", async () => {
    const deps = createTestDeps();
    await createTeamWorkspace("ENG-456", "impl", deps);

    const statePath = join(TEST_TEAMS_DIR, "ENG-456", "state.json");
    const stateContent = await readFile(statePath, "utf-8");
    const state = JSON.parse(stateContent);

    expect(state.type).toBe("impl");
    expect(state.issueId).toBe("ENG-456");
    expect(state.phase).toBe("writing_tests");
    expect(state.testsApproved).toBe(false);
    expect(state.subtasksTotal).toBe(0);
    expect(state.subtasksComplete).toBe(0);
    expect(state.blockers).toEqual([]);
    expect(state.createdAt).toBeDefined();
    expect(state.updatedAt).toBeDefined();
  });

  test("creates progress.md file", async () => {
    const deps = createTestDeps();
    await createTeamWorkspace("ENG-123", "plan", deps);

    const progressPath = join(TEST_TEAMS_DIR, "ENG-123", "progress.md");
    const content = await readFile(progressPath, "utf-8");
    expect(content).toContain("# Planning Team Progress");
    expect(content).toContain("Issue: ENG-123");
  });

  test("creates events.jsonl file", async () => {
    const deps = createTestDeps();
    await createTeamWorkspace("ENG-123", "plan", deps);

    const eventsPath = join(TEST_TEAMS_DIR, "ENG-123", "events.jsonl");
    const content = await readFile(eventsPath, "utf-8");
    const firstLine = JSON.parse(content.trim().split("\n")[0]);

    expect(firstLine.event).toBe("team_spawn");
    expect(firstLine.data.teamId).toBe("ENG-123");
    expect(firstLine.data.type).toBe("plan");
    expect(firstLine.timestamp).toBeDefined();
  });
});
