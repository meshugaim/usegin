import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { $ } from "bun";
import { getMaxUpdatedAt } from "../src/commands/list";
import type { PlanIssue } from "../src/types";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

function createIssue(overrides: Partial<PlanIssue> = {}): PlanIssue {
  return {
    id: "test-id",
    identifier: "ENG-1",
    title: "Test Issue",
    status: "Todo",
    sortOrder: 1,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    children: [],
    ...overrides,
  };
}

describe("plan list command", () => {
  describe("error handling", () => {
    it("exits with code 2 on missing API key", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "list"], {
        env: { ...process.env, LINEAR_API_KEY: undefined },
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      expect(exitCode).toBe(2);
    });

    it("shows helpful error message on missing API key", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "list"], {
        env: { ...process.env, LINEAR_API_KEY: undefined },
        stderr: "pipe",
      });

      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr.toLowerCase()).toContain("linear_api_key");
    });
  });

  describe("CLI parsing", () => {
    it("shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} list --help`.text();

      expect(result).toContain("list");
      expect(result).toContain("--team");
      expect(result).toContain("--depth");
    });

    it("shows version with --version on main command", async () => {
      const result = await $`bun ${CLI_PATH} --version`.text();
      expect(result).toContain("0.1.0");
    });
  });

  // Note: Tests that require actual Linear API are in tests/e2e/
});

describe("getMaxUpdatedAt", () => {
  it("returns issue updatedAt when no children", () => {
    const issue = createIssue({ updatedAt: "2024-06-15T10:00:00Z" });
    const result = getMaxUpdatedAt(issue);
    expect(result).toBe(new Date("2024-06-15T10:00:00Z").getTime());
  });

  it("returns issue updatedAt when it is more recent than children", () => {
    const issue = createIssue({
      updatedAt: "2024-06-15T12:00:00Z",
      children: [
        createIssue({ updatedAt: "2024-06-15T08:00:00Z" }),
        createIssue({ updatedAt: "2024-06-15T09:00:00Z" }),
      ],
    });
    const result = getMaxUpdatedAt(issue);
    expect(result).toBe(new Date("2024-06-15T12:00:00Z").getTime());
  });

  it("returns child updatedAt when child is more recent than parent", () => {
    const issue = createIssue({
      updatedAt: "2024-06-15T08:00:00Z",
      children: [
        createIssue({ updatedAt: "2024-06-15T10:00:00Z" }),
        createIssue({ updatedAt: "2024-06-15T09:00:00Z" }),
      ],
    });
    const result = getMaxUpdatedAt(issue);
    expect(result).toBe(new Date("2024-06-15T10:00:00Z").getTime());
  });

  it("recursively finds max in deeply nested children", () => {
    const issue = createIssue({
      updatedAt: "2024-06-15T08:00:00Z",
      children: [
        createIssue({
          updatedAt: "2024-06-15T09:00:00Z",
          children: [
            createIssue({
              updatedAt: "2024-06-15T14:00:00Z", // deepest, most recent
              children: [],
            }),
          ],
        }),
        createIssue({ updatedAt: "2024-06-15T10:00:00Z" }),
      ],
    });
    const result = getMaxUpdatedAt(issue);
    expect(result).toBe(new Date("2024-06-15T14:00:00Z").getTime());
  });

  it("handles multiple children at different depths correctly", () => {
    // Build a complex tree where the most recent update is 3 levels deep
    const issue = createIssue({
      updatedAt: "2024-01-01T00:00:00Z",
      children: [
        createIssue({
          updatedAt: "2024-02-01T00:00:00Z",
          children: [
            createIssue({ updatedAt: "2024-03-01T00:00:00Z" }),
          ],
        }),
        createIssue({
          updatedAt: "2024-04-01T00:00:00Z",
          children: [
            createIssue({
              updatedAt: "2024-05-01T00:00:00Z",
              children: [
                createIssue({ updatedAt: "2024-12-01T00:00:00Z" }), // Most recent
              ],
            }),
          ],
        }),
      ],
    });
    const result = getMaxUpdatedAt(issue);
    expect(result).toBe(new Date("2024-12-01T00:00:00Z").getTime());
  });
});
