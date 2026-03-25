import { afterEach, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

/**
 * Lazy import for the checkout module.
 * The module doesn't exist yet — tests use test.failing() so import errors
 * are expected and won't break CI.
 */
async function getCheckoutModule() {
  const mod = await import("../src/commands/checkout");
  return mod;
}

// Use unique temp dirs per test run to avoid conflicts with parallel agents
const TEST_BASE_DIR = `/tmp/linear-test-${Date.now()}`;

afterEach(() => {
  // Clean up any temp dirs created during tests
  if (existsSync(TEST_BASE_DIR)) {
    rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
});

describe("plan checkout command", () => {
  describe("CLI parsing", () => {
    test.failing("ENG-3490: shows help with --help flag", async () => {
      const result = await $`bun ${CLI_PATH} checkout --help`.text();

      expect(result).toContain("checkout");
      expect(result).toContain("--force");
      expect(result).toContain("--json");
    });

    test.failing("ENG-3490: requires an issue identifier argument", async () => {
      const proc = Bun.spawn(["bun", CLI_PATH, "checkout"], {
        env: process.env,
        stderr: "pipe",
        stdout: "pipe",
      });

      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).not.toBe(0);
      // Should specifically mention the missing argument in the error,
      // not just be a generic "unknown command" error
      expect(stderr).toContain("checkout");
      expect(stderr).toMatch(/missing|required|argument/i);
    });
  });

  describe("core behavior", () => {
    test.failing(
      "ENG-3490: creates description.md at correct path with issue description content",
      async () => {
        const { createCheckoutCommand } = await getCheckoutModule();

        // The checkout command should fetch the issue from Linear and write
        // its description to /tmp/linear/ENG-XXX/description.md.
        // We test via CLI invocation to verify the full flow.
        // This will need a mock Linear API or test API key —
        // for now, verifying the module exports and command structure.
        const cmd = createCheckoutCommand();
        expect(cmd.name()).toBe("checkout");

        // Verify the command accepts an <id> argument
        const args = cmd.registeredArguments;
        expect(args.length).toBeGreaterThanOrEqual(1);
      }
    );

    test.failing(
      "ENG-3490: creates .meta.json sidecar with correct fields",
      async () => {
        const { createCheckoutCommand } = await getCheckoutModule();

        // The .meta.json sidecar should contain:
        // - identifier: the issue identifier (e.g., "ENG-123")
        // - id: the Linear issue UUID
        // - fetchedAt: ISO timestamp of when description was fetched
        // - descriptionHash: hash of the description content for change detection
        const cmd = createCheckoutCommand();
        expect(cmd.name()).toBe("checkout");

        // When implementation exists, we'd invoke the command with a mock client
        // and verify the sidecar file contents. For now, assert the command exists.
        expect(cmd.description()).toBeTruthy();
      }
    );

    test.failing(
      "ENG-3490: creates empty description.md when issue has no description",
      async () => {
        const { createCheckoutCommand } = await getCheckoutModule();

        // Issues with null or empty description should still produce a
        // description.md file — it should just be empty.
        const cmd = createCheckoutCommand();
        expect(cmd.name()).toBe("checkout");
      }
    );

    test.failing(
      "ENG-3490: aborts when already checked out without --force",
      async () => {
        // Simulate an existing checkout by creating the directory and files
        const issueDir = join(TEST_BASE_DIR, "ENG-100");
        mkdirSync(issueDir, { recursive: true });
        writeFileSync(join(issueDir, "description.md"), "existing content");
        writeFileSync(
          join(issueDir, ".meta.json"),
          JSON.stringify({
            identifier: "ENG-100",
            id: "uuid-100",
            fetchedAt: new Date().toISOString(),
            descriptionHash: "abc123",
          })
        );

        // Running checkout without --force when files exist should abort
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "checkout", "ENG-100"],
          {
            env: {
              ...process.env,
              LINEAR_API_KEY: "test-key",
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stderr: "pipe",
            stdout: "pipe",
          }
        );

        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        expect(exitCode).not.toBe(0);
        expect(stderr).toContain("already checked out");

        // The original file should be unchanged
        const content = await Bun.file(join(issueDir, "description.md")).text();
        expect(content).toBe("existing content");
      }
    );

    test.failing(
      "ENG-3490: overwrites when --force is used on existing checkout",
      async () => {
        const { createCheckoutCommand } = await getCheckoutModule();

        // With --force, the command should overwrite existing files
        const cmd = createCheckoutCommand();

        // Verify --force option exists
        const forceOpt = cmd.options.find(
          (o) => o.long === "--force"
        );
        expect(forceOpt).toBeDefined();
      }
    );
  });

  describe("error handling", () => {
    test.failing(
      "ENG-3490: exits with code 2 on missing LINEAR_API_KEY",
      async () => {
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "checkout", "ENG-123"],
          {
            env: { ...process.env, LINEAR_API_KEY: undefined },
            stderr: "pipe",
          }
        );

        const exitCode = await proc.exited;
        expect(exitCode).toBe(2);
      }
    );
  });

  describe("output", () => {
    test.failing(
      "ENG-3490: JSON output contains identifier, path, and fetchedAt",
      async () => {
        const { createCheckoutCommand } = await getCheckoutModule();

        // When --json is used, the output should be:
        // { "identifier": "ENG-XXX", "path": "/tmp/linear/ENG-XXX/description.md", "fetchedAt": "..." }
        const cmd = createCheckoutCommand();

        // Verify the --json option exists on the command
        const jsonOpt = cmd.options.find(
          (o) => o.long === "--json"
        );
        expect(jsonOpt).toBeDefined();
      }
    );

    test.failing(
      "ENG-3490: human output contains 'Checked out' and file path",
      async () => {
        const { createCheckoutCommand } = await getCheckoutModule();

        // Human-readable output should say something like:
        // "Checked out ENG-XXX description -> /tmp/linear/ENG-XXX/description.md"
        const cmd = createCheckoutCommand();
        expect(cmd.name()).toBe("checkout");
      }
    );
  });

  describe("integration with existing commands", () => {
    test.failing(
      "ENG-3490: plan update --description-file still works with checked-out file path",
      async () => {
        // This test verifies that the checkout path is compatible with
        // the existing --description-file flag on plan update.
        // The checked-out description.md should be readable by plan update.
        const { createCheckoutCommand } = await getCheckoutModule();

        const cmd = createCheckoutCommand();
        expect(cmd.name()).toBe("checkout");

        // The path format /tmp/linear/ENG-XXX/description.md should be
        // a valid path for: plan update ENG-XXX --description-file <path>
        // This is a design constraint, not a runtime test.
      }
    );
  });
});
