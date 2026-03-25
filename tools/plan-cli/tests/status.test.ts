import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  writeCheckoutMeta,
  hashDescription,
} from "../src/lib/checkout-meta";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

// Use unique temp dirs per test run to avoid conflicts with parallel agents
const TEST_BASE_DIR = `/tmp/linear-test-${Date.now()}`;

afterEach(() => {
  // Clean up any temp dirs created during tests
  if (existsSync(TEST_BASE_DIR)) {
    rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
});

/**
 * Helper: set up a fake checkout directory with description.md and .meta.json
 * so status tests have something to scan.
 */
function setupCheckout(
  identifier: string,
  description: string,
  metaOverrides?: Partial<{
    id: string;
    fetchedAt: string;
    descriptionHash: string;
  }>
): { issueDir: string; descPath: string } {
  const issueDir = join(TEST_BASE_DIR, identifier);
  mkdirSync(issueDir, { recursive: true });

  const descPath = join(issueDir, "description.md");
  writeFileSync(descPath, description);

  writeCheckoutMeta(issueDir, {
    identifier,
    id: metaOverrides?.id ?? `uuid-${identifier}`,
    fetchedAt: metaOverrides?.fetchedAt ?? new Date().toISOString(),
    descriptionHash:
      metaOverrides?.descriptionHash ?? hashDescription(description),
  });

  return { issueDir, descPath };
}

describe("plan status command", () => {
  describe("CLI parsing", () => {
    test("ENG-3492: shows help with --help flag", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "status", "--help"], {
        env: process.env,
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(stdout).toContain("status");
      expect(stdout).toContain("--json");
      expect(stdout).toContain("--quiet");
    });

    test(
      "ENG-3492: takes no arguments (no <id> required)",
      async () => {
        // status with no arguments should succeed (unlike checkout/push which require an id)
        mkdirSync(TEST_BASE_DIR, { recursive: true });

        const proc = Bun.spawn(["bun", CLI_PATH, "status"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
      }
    );
  });

  describe("core behavior", () => {
    test(
      "ENG-3492: shows 'No issues checked out' when PLAN_CHECKOUT_DIR is empty",
      async () => {
        mkdirSync(TEST_BASE_DIR, { recursive: true });

        const proc = Bun.spawn(["bun", CLI_PATH, "status"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toMatch(/no issues checked out/i);
      }
    );

    test(
      "ENG-3492: lists a single checked-out issue with correct identifier and path",
      async () => {
        const { issueDir } = setupCheckout(
          "ENG-100",
          "Some description content"
        );

        const proc = Bun.spawn(["bun", CLI_PATH, "status"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toContain("ENG-100");
        expect(stdout).toContain(issueDir);
      }
    );

    test(
      "ENG-3492: shows 'modified' for an issue where file hash differs from meta",
      async () => {
        const { descPath } = setupCheckout(
          "ENG-200",
          "Original description"
        );

        // Modify the description so its hash no longer matches .meta.json
        writeFileSync(descPath, "Modified description with local edits");

        const proc = Bun.spawn(["bun", CLI_PATH, "status"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toMatch(/modified/i);
      }
    );

    test(
      "ENG-3492: shows 'clean' for an issue where file hash matches meta",
      async () => {
        // Description content matches the hash in .meta.json (no local edits)
        setupCheckout("ENG-300", "Unchanged description");

        const proc = Bun.spawn(["bun", CLI_PATH, "status"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toMatch(/clean/i);
      }
    );

    test(
      "ENG-3492: lists multiple checked-out issues",
      async () => {
        setupCheckout("ENG-400", "First issue description");
        setupCheckout("ENG-401", "Second issue description");
        setupCheckout("ENG-402", "Third issue description");

        const proc = Bun.spawn(["bun", CLI_PATH, "status"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toContain("ENG-400");
        expect(stdout).toContain("ENG-401");
        expect(stdout).toContain("ENG-402");
      }
    );
  });

  describe("output", () => {
    test(
      "ENG-3492: JSON output contains checkouts array with correct fields",
      async () => {
        const fetchedAt = "2026-03-20T12:00:00.000Z";
        const description = "Description for JSON test";
        const { descPath } = setupCheckout("ENG-500", description, {
          fetchedAt,
        });

        // Modify description to make it "modified"
        writeFileSync(descPath, "Modified description for JSON test");

        const proc = Bun.spawn(
          ["bun", CLI_PATH, "status", "--json"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stdout: "pipe",
            stderr: "pipe",
          }
        );

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);

        const parsed = JSON.parse(stdout);
        expect(Array.isArray(parsed.checkouts)).toBe(true);
        expect(parsed.checkouts).toHaveLength(1);

        const checkout = parsed.checkouts[0];
        expect(checkout.identifier).toBe("ENG-500");
        expect(typeof checkout.path).toBe("string");
        expect(checkout.path).toContain("ENG-500");
        expect(checkout.modified).toBe(true);
        expect(checkout.fetchedAt).toBe(fetchedAt);
      }
    );

    test(
      "ENG-3492: human output contains identifier and modification state",
      async () => {
        const description = "Description for human output test";
        const { descPath } = setupCheckout("ENG-600", description);

        // Modify to make it "modified"
        writeFileSync(descPath, "Edited description");

        // Also set up a clean checkout
        setupCheckout("ENG-601", "Clean description");

        const proc = Bun.spawn(["bun", CLI_PATH, "status"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            PLAN_OUTPUT: "human",
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toContain("ENG-600");
        expect(stdout).toContain("ENG-601");
        // Should indicate modification state for each
        expect(stdout).toMatch(/modified/i);
        expect(stdout).toMatch(/clean/i);
      }
    );

    test(
      "ENG-3492: --quiet flag suppresses all output",
      async () => {
        setupCheckout("ENG-700", "Some description");

        const proc = Bun.spawn(
          ["bun", CLI_PATH, "status", "--quiet"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stdout: "pipe",
            stderr: "pipe",
          }
        );

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toBe("");
      }
    );
  });

  describe("edge cases", () => {
    test(
      "ENG-3492: gracefully handles corrupted .meta.json (skips entry, does not crash)",
      async () => {
        // Set up a valid checkout
        setupCheckout("ENG-800", "Valid checkout description");

        // Set up a corrupted checkout (invalid JSON in .meta.json)
        const corruptedDir = join(TEST_BASE_DIR, "ENG-801");
        mkdirSync(corruptedDir, { recursive: true });
        writeFileSync(join(corruptedDir, "description.md"), "Some content");
        writeFileSync(join(corruptedDir, ".meta.json"), "{ this is not valid JSON !!!");

        const proc = Bun.spawn(["bun", CLI_PATH, "status", "--json"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);

        const parsed = JSON.parse(stdout);
        // Should only contain the valid checkout, corrupted one is skipped
        expect(parsed.checkouts).toHaveLength(1);
        expect(parsed.checkouts[0].identifier).toBe("ENG-800");
      }
    );

    test(
      "ENG-3492: handles directory with no .meta.json (skips, does not crash)",
      async () => {
        // Set up a valid checkout
        setupCheckout("ENG-900", "Valid checkout description");

        // Set up a directory with no .meta.json (just a bare directory)
        const bareDir = join(TEST_BASE_DIR, "ENG-901");
        mkdirSync(bareDir, { recursive: true });
        writeFileSync(join(bareDir, "description.md"), "Orphaned file");
        // No .meta.json written

        const proc = Bun.spawn(["bun", CLI_PATH, "status", "--json"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);

        const parsed = JSON.parse(stdout);
        // Should only contain the valid checkout, the one without .meta.json is skipped
        expect(parsed.checkouts).toHaveLength(1);
        expect(parsed.checkouts[0].identifier).toBe("ENG-900");
      }
    );
  });
});
