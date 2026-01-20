/**
 * End-to-end tests for agent spawning.
 *
 * These tests actually spawn Claude agents using crun.
 * They are slow and consume API tokens, so they are skipped by default.
 *
 * To run these tests:
 *   TEAMWORK_E2E=true bun test tests/e2e-agent-spawning.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

const SKIP_E2E = process.env.TEAMWORK_E2E !== "true";
const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-e2e-test");
const CLI_PATH = join(import.meta.dir, "../src/cli.ts");
const PROJECT_ROOT = "/workspaces/test-mvp";

// Helper to conditionally skip tests
const e2eTest = SKIP_E2E ? test.skip : test;

describe("e2e: agent spawning", () => {
  beforeAll(async () => {
    if (!SKIP_E2E) {
      await rm(TEST_WORKSPACES_DIR, { recursive: true, force: true });
      await mkdir(TEST_WORKSPACES_DIR, { recursive: true });
    }
  });

  afterAll(async () => {
    if (!SKIP_E2E) {
      await rm(TEST_WORKSPACES_DIR, { recursive: true, force: true });
    }
  });

  test("skips e2e tests by default", () => {
    if (SKIP_E2E) {
      console.log("E2E tests skipped. Set TEAMWORK_E2E=true to run.");
    }
    expect(true).toBe(true);
  });

  e2eTest("crun is available", async () => {
    const result = await $`which crun`.nothrow();
    expect(result.exitCode).toBe(0);
  });

  e2eTest("isCrunAvailable returns true", async () => {
    const { isCrunAvailable } = await import("../src/agent-spawning");
    const available = await isCrunAvailable();
    expect(available).toBe(true);
  });

  e2eTest("buildPlanningReviewerPrompt generates valid prompt", async () => {
    const { buildPlanningReviewerPrompt } = await import("../src/agent-spawning");
    const prompt = buildPlanningReviewerPrompt("ENG-TEST");

    expect(prompt).toContain("ENG-TEST");
    expect(prompt).toContain("Planning Team");
    expect(prompt).toContain("vertical slices");
    expect(prompt).toContain("reviewer.md");
  });

  e2eTest("buildImplReviewerPrompt generates valid prompt", async () => {
    const { buildImplReviewerPrompt } = await import("../src/agent-spawning");
    const prompt = buildImplReviewerPrompt("ENG-TEST-1", "ENG-TEST");

    expect(prompt).toContain("ENG-TEST-1");
    expect(prompt).toContain("Implementation Team");
    expect(prompt).toContain("TDD");
    expect(prompt).toContain("reviewer.md");
  });

  // This test actually spawns an agent - very slow and uses tokens
  e2eTest(
    "plan command with dry-run creates workspace",
    async () => {
      const specId = "ENG-99901";

      const result = await $`bun ${CLI_PATH} plan ${specId} --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain("Planning workspace created");
      expect(result).toContain("Dry run");
    },
    { timeout: 30000 }
  );

  e2eTest(
    "impl command with dry-run creates workspace",
    async () => {
      const sliceId = "ENG-99902-1";

      const result = await $`bun ${CLI_PATH} impl ${sliceId} --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

      expect(result).toContain("Implementation workspace created");
      expect(result).toContain("Dry run");
    },
    { timeout: 30000 }
  );

  // Uncomment to run actual agent spawning test (VERY SLOW, uses tokens)
  // e2eTest(
  //   "spawns real planning agent",
  //   async () => {
  //     const specId = "ENG-E2E-REAL";
  //
  //     // This will actually spawn an agent and wait for it to complete
  //     const result = await $`bun ${CLI_PATH} plan ${specId} --workspaces-dir ${TEST_WORKSPACES_DIR} --project-root ${PROJECT_ROOT} --model haiku`.nothrow();
  //
  //     // The agent may succeed or fail, but it should spawn
  //     expect(result.stdout.toString()).toContain("Spawning planning reviewer agent");
  //   },
  //   { timeout: 600000 } // 10 minute timeout for real agent
  // );
});

describe("e2e: CLI help and options", () => {
  test("plan command shows --project-root option", async () => {
    const result = await $`bun ${CLI_PATH} plan --help`.text();
    expect(result).toContain("--project-root");
    expect(result).toContain("--model");
  });

  test("impl command shows --project-root option", async () => {
    const result = await $`bun ${CLI_PATH} impl --help`.text();
    expect(result).toContain("--project-root");
    expect(result).toContain("--model");
  });
});
