import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  writeCheckoutMeta,
  readCheckoutMeta,
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
 * so push tests have something to work with.
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

describe("plan push command", () => {
  describe("CLI parsing", () => {
    test.failing("ENG-3491: shows help with --help flag", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "push", "--help"], {
        env: process.env,
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(stdout).toContain("push");
      expect(stdout).toContain("--json");
      expect(stdout).toContain("--quiet");
    });

    test.failing(
      "ENG-3491: requires an issue identifier argument",
      async () => {
        const proc = Bun.spawn(["bun", CLI_PATH, "push"], {
          env: process.env,
          stderr: "pipe",
          stdout: "pipe",
        });

        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        expect(exitCode).not.toBe(0);
        // Should mention the missing argument in the error
        expect(stderr).toMatch(/missing|required|argument/i);
      }
    );
  });

  describe("core behavior", () => {
    test.failing(
      "ENG-3491: pushes updated description and reports success",
      async () => {
        // Set up a checkout with one description, then modify the file
        const original = "Original description from Linear";
        const { issueDir, descPath } = setupCheckout(
          "ENG-3490",
          original
        );

        // Modify the description file to simulate a local edit
        const updated = "Updated description with local edits";
        writeFileSync(descPath, updated);

        const proc = Bun.spawn(["bun", CLI_PATH, "push", "ENG-3490"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stderr: "pipe",
          stdout: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        // Human output should confirm the push
        expect(stdout).toMatch(/pushed/i);
        expect(stdout).toContain("ENG-3490");
      }
    );

    test.failing(
      "ENG-3491: skips push when file hash matches .meta.json descriptionHash (no-op)",
      async () => {
        // Set up a checkout where the file content matches the hash — no changes
        const description = "This description has not been edited locally";
        setupCheckout("ENG-3490", description);
        // The hash in .meta.json already matches description.md content

        const proc = Bun.spawn(["bun", CLI_PATH, "push", "ENG-3490"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stderr: "pipe",
          stdout: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        // Should indicate no changes were pushed
        const combined = stdout + stderr;
        expect(combined).toMatch(/no changes/i);
      }
    );

    test.failing(
      "ENG-3491: updates .meta.json with new descriptionHash and pushedAt after push",
      async () => {
        const original = "Original content before edit";
        const { issueDir, descPath } = setupCheckout(
          "ENG-3490",
          original
        );

        // Modify the description to create a diff
        const updated = "New description content after edit";
        writeFileSync(descPath, updated);

        const beforePush = new Date().toISOString();

        const proc = Bun.spawn(["bun", CLI_PATH, "push", "ENG-3490"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stderr: "pipe",
          stdout: "pipe",
        });

        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);

        // Read the updated .meta.json
        const meta = readCheckoutMeta(issueDir);
        expect(meta).not.toBeNull();
        expect(meta!.descriptionHash).toBe(hashDescription(updated));
        // pushedAt should be a recent timestamp
        const metaRaw = JSON.parse(
          readFileSync(join(issueDir, ".meta.json"), "utf-8")
        );
        expect(metaRaw.pushedAt).toBeTruthy();
        expect(new Date(metaRaw.pushedAt).getTime()).toBeGreaterThanOrEqual(
          new Date(beforePush).getTime()
        );
      }
    );

    test.failing(
      "ENG-3491: errors when no checkout exists for the issue",
      async () => {
        // No setup — directory doesn't exist
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "push", "ENG-99999"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stderr: "pipe",
            stdout: "pipe",
          }
        );

        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(1);
        expect(stderr).toMatch(/no checkout|not checked out|not found/i);
      }
    );
  });

  describe("staleness warning", () => {
    test.failing(
      "ENG-3491: warns on stderr when issue was updated after checkout",
      async () => {
        // Set up a checkout with a very old fetchedAt to trigger the staleness warning
        const description = "Description that will be pushed";
        const { descPath } = setupCheckout("ENG-3490", description, {
          fetchedAt: "2020-01-01T00:00:00.000Z",
        });

        // Modify description so there's something to push
        writeFileSync(descPath, "Updated description");

        const proc = Bun.spawn(["bun", CLI_PATH, "push", "ENG-3490"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stderr: "pipe",
          stdout: "pipe",
        });

        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        // Should still push successfully (exit 0) but warn on stderr
        expect(exitCode).toBe(0);
        expect(stderr).toMatch(/stale|outdated|updated.*since|warning/i);
      }
    );
  });

  describe("error handling", () => {
    test.failing(
      "ENG-3491: exits with code 2 on missing LINEAR_API_KEY",
      async () => {
        // Set up a checkout so we get past the "no checkout" check
        const description = "Some description";
        const { descPath } = setupCheckout("ENG-123", description);
        writeFileSync(descPath, "Modified description");

        const proc = Bun.spawn(["bun", CLI_PATH, "push", "ENG-123"], {
          env: {
            ...process.env,
            LINEAR_API_KEY: undefined,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stderr: "pipe",
          stdout: "pipe",
        });

        const exitCode = await proc.exited;
        expect(exitCode).toBe(2);
      }
    );

    test.failing(
      "ENG-3491: exits with code 1 when no checkout directory exists",
      async () => {
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "push", "ENG-77777"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stderr: "pipe",
            stdout: "pipe",
          }
        );

        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(1);
        // Must be a push-specific error about the missing checkout, not a generic CLI error
        expect(stderr).toMatch(/no checkout|not checked out|not found/i);
      }
    );
  });

  describe("output", () => {
    test.failing(
      "ENG-3491: JSON output contains identifier, bytes, stale, and pushedAt",
      async () => {
        const description = "Original for JSON output test";
        const { descPath } = setupCheckout("ENG-3490", description);

        const updated = "Updated content for JSON output test";
        writeFileSync(descPath, updated);

        const proc = Bun.spawn(
          ["bun", CLI_PATH, "push", "ENG-3490", "--json"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stderr: "pipe",
            stdout: "pipe",
          }
        );

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);

        const parsed = JSON.parse(stdout);
        expect(parsed.identifier).toBe("ENG-3490");
        expect(parsed.bytes).toBe(Buffer.byteLength(updated, "utf-8"));
        expect(typeof parsed.stale).toBe("boolean");
        expect(parsed.pushedAt).toBeTruthy();
        // pushedAt should be a valid ISO timestamp
        expect(new Date(parsed.pushedAt).toISOString()).toBe(parsed.pushedAt);
      }
    );

    test.failing(
      "ENG-3491: human output contains 'Pushed' and byte count",
      async () => {
        const description = "Original for human output test";
        const { descPath } = setupCheckout("ENG-3490", description);

        const updated = "Updated content for human output test";
        writeFileSync(descPath, updated);

        const proc = Bun.spawn(["bun", CLI_PATH, "push", "ENG-3490"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            PLAN_OUTPUT: "human",
          },
          stderr: "pipe",
          stdout: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toMatch(/pushed/i);
        expect(stdout).toContain("ENG-3490");
        // Should mention byte count
        const byteCount = Buffer.byteLength(updated, "utf-8");
        expect(stdout).toContain(`${byteCount}`);
      }
    );

    test.failing(
      "ENG-3491: --quiet flag suppresses stdout output",
      async () => {
        const description = "Original for quiet test";
        const { descPath } = setupCheckout("ENG-3490", description);

        writeFileSync(descPath, "Updated content for quiet test");

        const proc = Bun.spawn(
          ["bun", CLI_PATH, "push", "ENG-3490", "--quiet"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stderr: "pipe",
            stdout: "pipe",
          }
        );

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toBe("");
      }
    );
  });
});
