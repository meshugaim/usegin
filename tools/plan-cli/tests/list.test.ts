import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { $ } from "bun";
import { getMaxUpdatedAt, createListCommand, shouldDefaultToJson } from "../src/commands/list";
import { paginateIssues } from "../src/lib/output";
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

describe("pagination", () => {
  describe("CLI parsing", () => {
    it("parses --page flag", () => {
      const cmd = createListCommand();
      let capturedOpts: Record<string, unknown> = {};
      cmd.action((opts: Record<string, unknown>) => {
        capturedOpts = opts;
      });

      cmd.parse(["node", "plan", "--page", "3"], { from: "user" });
      expect(capturedOpts.page).toBe("3");
    });

    it("parses --page-size flag", () => {
      const cmd = createListCommand();
      let capturedOpts: Record<string, unknown> = {};
      cmd.action((opts: Record<string, unknown>) => {
        capturedOpts = opts;
      });

      cmd.parse(["node", "plan", "--page-size", "10"], { from: "user" });
      expect(capturedOpts.pageSize).toBe("10");
    });

    it("parses --page and --page-size together", () => {
      const cmd = createListCommand();
      let capturedOpts: Record<string, unknown> = {};
      cmd.action((opts: Record<string, unknown>) => {
        capturedOpts = opts;
      });

      cmd.parse(["node", "plan", "--page", "2", "--page-size", "5"], { from: "user" });
      expect(capturedOpts.page).toBe("2");
      expect(capturedOpts.pageSize).toBe("5");
    });
  });

  describe("--page validation", () => {
    it("errors when --page is 0", async () => {
      const proc = Bun.spawn(
        ["bun", CLI_PATH, "list", "--page", "0"],
        {
          env: { ...process.env, LINEAR_API_KEY: "fake-key" },
          stderr: "pipe",
        }
      );
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('--page must be a positive integer, got "0"');
    });

    it("errors when --page is negative", async () => {
      const proc = Bun.spawn(
        ["bun", CLI_PATH, "list", "--page", "-1"],
        {
          env: { ...process.env, LINEAR_API_KEY: "fake-key" },
          stderr: "pipe",
        }
      );
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('--page must be a positive integer, got "-1"');
    });

    it("errors when --page is not a number", async () => {
      const proc = Bun.spawn(
        ["bun", CLI_PATH, "list", "--page", "foo"],
        {
          env: { ...process.env, LINEAR_API_KEY: "fake-key" },
          stderr: "pipe",
        }
      );
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('--page must be a positive integer, got "foo"');
    });
  });

  describe("--page-size validation", () => {
    it("errors when --page-size is 0", async () => {
      const proc = Bun.spawn(
        ["bun", CLI_PATH, "list", "--page-size", "0"],
        {
          env: { ...process.env, LINEAR_API_KEY: "fake-key" },
          stderr: "pipe",
        }
      );
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('--page-size must be a positive integer, got "0"');
    });

    it("errors when --page-size is negative", async () => {
      const proc = Bun.spawn(
        ["bun", CLI_PATH, "list", "--page-size", "-5"],
        {
          env: { ...process.env, LINEAR_API_KEY: "fake-key" },
          stderr: "pipe",
        }
      );
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('--page-size must be a positive integer, got "-5"');
    });

    it("errors when --page-size is not a number", async () => {
      const proc = Bun.spawn(
        ["bun", CLI_PATH, "list", "--page-size", "abc"],
        {
          env: { ...process.env, LINEAR_API_KEY: "fake-key" },
          stderr: "pipe",
        }
      );
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('--page-size must be a positive integer, got "abc"');
    });
  });

  describe("--page warnings", () => {
    it("warns when --page is used in human mode", async () => {
      const proc = Bun.spawn(
        ["bun", CLI_PATH, "list", "--page", "1"],
        {
          env: { ...process.env, LINEAR_API_KEY: "fake-key", PLAN_OUTPUT: "human" },
          stderr: "pipe",
        }
      );
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr).toContain("--page is only supported in JSON mode");
    });

    it("warns when --page is used with --group-by in JSON mode", async () => {
      const proc = Bun.spawn(
        ["bun", CLI_PATH, "list", "--page", "1", "--group-by", "status", "--json"],
        {
          env: { ...process.env, LINEAR_API_KEY: "fake-key" },
          stderr: "pipe",
        }
      );
      const stderr = await new Response(proc.stderr).text();
      await proc.exited;

      expect(stderr).toContain("--page is ignored when --group-by is used");
    });
  });

  describe("--page and --limit conflict", () => {
    it("errors when both --page and --limit are provided", async () => {
      const proc = Bun.spawn(
        ["bun", CLI_PATH, "list", "--page", "1", "--limit", "5"],
        {
          env: { ...process.env, LINEAR_API_KEY: "fake-key" },
          stderr: "pipe",
        }
      );
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("--page and --limit cannot be used together");
    });
  });

  describe("paginateIssues", () => {
    function makeIssues(count: number): PlanIssue[] {
      return Array.from({ length: count }, (_, i) =>
        createIssue({
          id: `issue-${i}`,
          identifier: `ENG-${i + 1}`,
          title: `Issue ${i + 1}`,
        })
      );
    }

    it("wraps issues with default pagination metadata", () => {
      const issues = makeIssues(5);
      const result = paginateIssues(issues, 1, 25);

      expect(result).toHaveProperty("issues");
      expect(result).toHaveProperty("pagination");
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(25);
      expect(result.pagination.totalCount).toBe(5);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.issues).toHaveLength(5);
    });

    it("returns correct slice for page 2 with page-size 2", () => {
      const issues = makeIssues(5);
      const result = paginateIssues(issues, 2, 2);

      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].identifier).toBe("ENG-3");
      expect(result.issues[1].identifier).toBe("ENG-4");
    });

    it("hasNextPage is true when more items exist", () => {
      const issues = makeIssues(10);
      const result = paginateIssues(issues, 1, 3);

      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.totalCount).toBe(10);
      expect(result.pagination.totalPages).toBe(4);
    });

    it("hasNextPage is false on last page", () => {
      const issues = makeIssues(6);
      const result = paginateIssues(issues, 3, 2);

      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].identifier).toBe("ENG-5");
      expect(result.issues[1].identifier).toBe("ENG-6");
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.totalPages).toBe(3);
    });

    it("returns empty issues with hasNextPage false for page beyond total", () => {
      const issues = makeIssues(3);
      const result = paginateIssues(issues, 10, 25);

      expect(result.issues).toHaveLength(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.totalCount).toBe(3);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.page).toBe(10);
    });

    it("handles partial last page correctly", () => {
      const issues = makeIssues(5);
      const result = paginateIssues(issues, 2, 3);

      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].identifier).toBe("ENG-4");
      expect(result.issues[1].identifier).toBe("ENG-5");
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.totalPages).toBe(2);
    });

    it("returns totalPages 0 for empty input", () => {
      const result = paginateIssues([], 1, 25);

      expect(result.issues).toHaveLength(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.totalCount).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
    });
  });
});
