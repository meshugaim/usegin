import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { $ } from "bun";
import { getMaxUpdatedAt, createListCommand, shouldDefaultToJson } from "../src/commands/list";
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

    it("has --json option in help output", async () => {
      const result = await $`bun ${CLI_PATH} list --help`.text();

      expect(result).toContain("--json");
      expect(result).toContain("Output as JSON");
    });

    it("shows version with --version on main command", async () => {
      const result = await $`bun ${CLI_PATH} --version`.text();
      expect(result).toContain("0.1.0");
    });
  });

  // Note: Tests that require actual Linear API are in tests/e2e/
});

describe("createListCommand --json option", () => {
  it("has --json defined as a boolean option", () => {
    const cmd = createListCommand();
    const jsonOption = cmd.options.find(
      (opt) => opt.long === "--json"
    );
    expect(jsonOption).toBeDefined();
    expect(jsonOption!.description).toBe("Output as JSON");
  });

  it("parses --json flag without errors", () => {
    const cmd = createListCommand();
    // Override action to capture opts without running the actual command
    let capturedOpts: Record<string, unknown> = {};
    cmd.action((opts: Record<string, unknown>) => {
      capturedOpts = opts;
    });

    cmd.parse(["node", "plan", "--json"], { from: "user" });
    expect(capturedOpts.json).toBe(true);
  });

  it("defaults json to undefined when not passed", () => {
    const cmd = createListCommand();
    let capturedOpts: Record<string, unknown> = {};
    cmd.action((opts: Record<string, unknown>) => {
      capturedOpts = opts;
    });

    cmd.parse(["node", "plan"], { from: "user" });
    expect(capturedOpts.json).toBeUndefined();
  });

  it("parses --json together with --group-by", () => {
    const cmd = createListCommand();
    let capturedOpts: Record<string, unknown> = {};
    cmd.action((opts: Record<string, unknown>) => {
      capturedOpts = opts;
    });

    cmd.parse(["node", "plan", "--json", "--group-by", "status"], { from: "user" });
    expect(capturedOpts.json).toBe(true);
    expect(capturedOpts.groupBy).toBe("status");
  });
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

describe("shouldDefaultToJson", () => {
  it("returns true when PLAN_OUTPUT=json", () => {
    expect(shouldDefaultToJson({ env: { PLAN_OUTPUT: "json" }, isTTY: true })).toBe(true);
  });

  it("returns true when PLAN_OUTPUT=JSON (case-insensitive)", () => {
    expect(shouldDefaultToJson({ env: { PLAN_OUTPUT: "JSON" }, isTTY: true })).toBe(true);
  });

  it("returns false when PLAN_OUTPUT=Human (case-insensitive)", () => {
    expect(shouldDefaultToJson({ env: { PLAN_OUTPUT: "Human" }, isTTY: false })).toBe(false);
  });

  it("returns false when PLAN_OUTPUT=human", () => {
    expect(shouldDefaultToJson({ env: { PLAN_OUTPUT: "human" }, isTTY: false })).toBe(false);
  });

  it("returns false when PLAN_OUTPUT=human even if CLAUDECODE=1", () => {
    expect(shouldDefaultToJson({
      env: { PLAN_OUTPUT: "human", CLAUDECODE: "1" },
      isTTY: false,
    })).toBe(false);
  });

  it("returns true when CLAUDECODE=1", () => {
    expect(shouldDefaultToJson({ env: { CLAUDECODE: "1" }, isTTY: true })).toBe(true);
  });

  it("returns false when CLAUDECODE=0 (only '1' triggers auto-detect)", () => {
    expect(shouldDefaultToJson({ env: { CLAUDECODE: "0" }, isTTY: true })).toBe(false);
  });

  it("returns false when CLAUDECODE=true (only '1' triggers auto-detect)", () => {
    expect(shouldDefaultToJson({ env: { CLAUDECODE: "true" }, isTTY: true })).toBe(false);
  });

  it("returns false when CLAUDECODE is empty string (only '1' triggers auto-detect)", () => {
    expect(shouldDefaultToJson({ env: { CLAUDECODE: "" }, isTTY: true })).toBe(false);
  });

  it("returns true when no TTY and no fzf", () => {
    expect(shouldDefaultToJson({ env: {}, isTTY: false })).toBe(true);
  });

  it("returns false when no TTY but fzf is set", () => {
    expect(shouldDefaultToJson({ env: {}, isTTY: false, fzf: true })).toBe(false);
  });

  it("returns false with TTY and no env vars (default)", () => {
    expect(shouldDefaultToJson({ env: {}, isTTY: true })).toBe(false);
  });

  it("returns true when explicit --json flag is set regardless of other conditions", () => {
    expect(shouldDefaultToJson({ json: true, env: {}, isTTY: true })).toBe(true);
  });

  it("returns true when explicit --json flag overrides PLAN_OUTPUT=human", () => {
    expect(shouldDefaultToJson({
      json: true,
      env: { PLAN_OUTPUT: "human" },
      isTTY: true,
    })).toBe(true);
  });

  it("treats isTTY undefined as no TTY", () => {
    expect(shouldDefaultToJson({ env: {} })).toBe(true);
  });

  it("treats missing env as empty", () => {
    expect(shouldDefaultToJson({ isTTY: true })).toBe(false);
  });
});
