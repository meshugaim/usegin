import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { writeCheckoutMeta } from "../src/commands/checkout";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

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
    test("ENG-3490: shows help with --help flag", async () => {
      const result = await Bun.spawn(["bun", CLI_PATH, "checkout", "--help"], {
        env: process.env,
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(result.stdout).text();
      const exitCode = await result.exited;

      expect(exitCode).toBe(0);
      expect(stdout).toContain("checkout");
      expect(stdout).toContain("--force");
      expect(stdout).toContain("--json");
    });

    test("ENG-3490: requires an issue identifier argument", async () => {
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
    test(
      "ENG-3490: creates description.md at correct path with issue description content",
      async () => {
        // Spawn the real CLI against the real Linear API.
        // ENG-3490 is the issue for this feature and has a description.
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "checkout", "ENG-3490"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stderr: "pipe",
            stdout: "pipe",
          }
        );

        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);

        const descPath = join(TEST_BASE_DIR, "ENG-3490", "description.md");
        expect(existsSync(descPath)).toBe(true);

        const content = readFileSync(descPath, "utf-8");
        // description.md should contain the issue description (non-empty for a real issue)
        expect(content.length).toBeGreaterThan(0);
      }
    );

    test(
      "ENG-3490: creates .meta.json sidecar with correct fields",
      async () => {
        // writeCheckoutMeta should write a .meta.json sidecar with the expected shape.

        const issueDir = join(TEST_BASE_DIR, "ENG-200");
        mkdirSync(issueDir, { recursive: true });

        const now = new Date().toISOString();
        await writeCheckoutMeta(issueDir, {
          identifier: "ENG-200",
          id: "uuid-200",
          fetchedAt: now,
          descriptionHash: "sha256-abc123",
        });

        const metaPath = join(issueDir, ".meta.json");
        expect(existsSync(metaPath)).toBe(true);

        const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
        expect(meta.identifier).toBe("ENG-200");
        expect(meta.id).toBe("uuid-200");
        expect(meta.fetchedAt).toBe(now);
        expect(meta.descriptionHash).toBe("sha256-abc123");
      }
    );

    test(
      "ENG-3490: creates empty description.md when issue has no description",
      async () => {
        // Spawn CLI for an issue that has a null/empty description.
        // ENG-3524 is a real issue with no description.
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "checkout", "ENG-3524"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stderr: "pipe",
            stdout: "pipe",
          }
        );

        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);

        const descPath = join(TEST_BASE_DIR, "ENG-3524", "description.md");
        expect(existsSync(descPath)).toBe(true);

        // File should exist but may be empty (null description case).
        // We verify the file was created regardless of content.
        const content = readFileSync(descPath, "utf-8");
        expect(typeof content).toBe("string");
      }
    );

    test(
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

    test(
      "ENG-3490: overwrites when --force is used on existing checkout",
      async () => {
        // Set up existing checkout with known content
        const issueDir = join(TEST_BASE_DIR, "ENG-3490");
        mkdirSync(issueDir, { recursive: true });
        writeFileSync(join(issueDir, "description.md"), "stale content");
        writeFileSync(
          join(issueDir, ".meta.json"),
          JSON.stringify({
            identifier: "ENG-3490",
            id: "uuid-100",
            fetchedAt: "2020-01-01T00:00:00.000Z",
            descriptionHash: "old-hash",
          })
        );

        // With --force, the command should overwrite existing files
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "checkout", "ENG-3490", "--force"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stderr: "pipe",
            stdout: "pipe",
          }
        );

        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);

        // description.md should have been overwritten (content differs from "stale content")
        const content = readFileSync(join(issueDir, "description.md"), "utf-8");
        expect(content).not.toBe("stale content");

        // .meta.json should have a newer fetchedAt timestamp
        const meta = JSON.parse(readFileSync(join(issueDir, ".meta.json"), "utf-8"));
        expect(meta.fetchedAt).not.toBe("2020-01-01T00:00:00.000Z");
        expect(meta.identifier).toBe("ENG-3490");
      }
    );
  });

  describe("error handling", () => {
    test(
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

    test(
      "ENG-3490: exits with code 3 when issue is not found",
      async () => {
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "checkout", "ENG-99999"],
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

        expect(exitCode).toBe(3);
        expect(stderr).toMatch(/not found|does not exist/i);
      }
    );
  });

  describe("identifier normalization", () => {
    test(
      "ENG-3490: numeric ID '3490' produces directory named ENG-3490",
      async () => {
        // `plan checkout 3490` should normalize to ENG-3490 and create
        // PLAN_CHECKOUT_DIR/ENG-3490/, not PLAN_CHECKOUT_DIR/3490/
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "checkout", "3490"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
            },
            stderr: "pipe",
            stdout: "pipe",
          }
        );

        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);

        // Should use normalized identifier ENG-3490, not raw "3490"
        const normalizedDir = join(TEST_BASE_DIR, "ENG-3490");
        const rawDir = join(TEST_BASE_DIR, "3490");

        expect(existsSync(normalizedDir)).toBe(true);
        expect(existsSync(rawDir)).toBe(false);
      }
    );
  });

  describe("output", () => {
    test(
      "ENG-3490: JSON output contains identifier, path, and fetchedAt",
      async () => {
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "checkout", "ENG-3490", "--json"],
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
        expect(parsed.path).toContain("ENG-3490");
        expect(parsed.path).toContain("description.md");
        expect(parsed.fetchedAt).toBeTruthy();
        // fetchedAt should be a valid ISO timestamp
        expect(new Date(parsed.fetchedAt).toISOString()).toBe(parsed.fetchedAt);
      }
    );

    test(
      "ENG-3490: human output contains 'Checked out' and file path",
      async () => {
        const proc = Bun.spawn(
          ["bun", CLI_PATH, "checkout", "ENG-3490"],
          {
            env: {
              ...process.env,
              PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
              PLAN_OUTPUT: "human",
            },
            stderr: "pipe",
            stdout: "pipe",
          }
        );

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toMatch(/checked out/i);
        expect(stdout).toContain("ENG-3490");
        expect(stdout).toContain("description.md");
      }
    );
  });
});
