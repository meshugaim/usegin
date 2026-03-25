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
 * so watch/unwatch tests have something to work with.
 */
function setupCheckout(
  identifier: string,
  description: string,
  metaOverrides?: Partial<{
    id: string;
    fetchedAt: string;
    descriptionHash: string;
    watcherPid: number;
  }>
): { issueDir: string; descPath: string } {
  const issueDir = join(TEST_BASE_DIR, identifier);
  mkdirSync(issueDir, { recursive: true });

  const descPath = join(issueDir, "description.md");
  writeFileSync(descPath, description);

  const baseMeta = {
    identifier,
    id: metaOverrides?.id ?? `uuid-${identifier}`,
    fetchedAt: metaOverrides?.fetchedAt ?? new Date().toISOString(),
    descriptionHash:
      metaOverrides?.descriptionHash ?? hashDescription(description),
  };

  // Write base meta via the canonical helper
  writeCheckoutMeta(issueDir, baseMeta);

  // If watcherPid is provided, patch it into the meta file directly
  // (since CheckoutMeta type doesn't include watcherPid yet)
  if (metaOverrides?.watcherPid !== undefined) {
    const metaPath = join(issueDir, ".meta.json");
    const raw = JSON.parse(readFileSync(metaPath, "utf-8"));
    raw.watcherPid = metaOverrides.watcherPid;
    writeFileSync(metaPath, JSON.stringify(raw, null, 2) + "\n");
  }

  return { issueDir, descPath };
}

/**
 * Helper: read raw .meta.json including extended fields like watcherPid
 */
function readRawMeta(issueDir: string): Record<string, unknown> | null {
  const metaPath = join(issueDir, ".meta.json");
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
}

describe("plan watch command", () => {
  describe("CLI parsing", () => {
    test(
      "ENG-3493: shows watch help with --timeout flag",
      async () => {
        const proc = Bun.spawn(["bun", CLI_PATH, "watch", "--help"], {
          env: process.env,
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toContain("watch");
        expect(stdout).toContain("--timeout");
      }
    );

    test(
      "ENG-3493: requires an identifier argument",
      async () => {
        const proc = Bun.spawn(["bun", CLI_PATH, "watch"], {
          env: process.env,
          stderr: "pipe",
          stdout: "pipe",
        });

        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        expect(exitCode).not.toBe(0);
        expect(stderr).toMatch(/missing|required|argument/i);
      }
    );

    test(
      "ENG-3493: shows unwatch help",
      async () => {
        const proc = Bun.spawn(["bun", CLI_PATH, "unwatch", "--help"], {
          env: process.env,
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        expect(exitCode).toBe(0);
        expect(stdout).toContain("unwatch");
      }
    );
  });

  describe("duration parsing", () => {
    async function getDurationParser() {
      const mod = await import("../src/lib/duration");
      return mod.parseDuration;
    }

    test(
      "ENG-3493: parses '10m' to 600000ms",
      async () => {
        const parseDuration = await getDurationParser();
        expect(parseDuration("10m")).toBe(600_000);
      }
    );

    test(
      "ENG-3493: parses '1h' to 3600000ms",
      async () => {
        const parseDuration = await getDurationParser();
        expect(parseDuration("1h")).toBe(3_600_000);
      }
    );

    test(
      "ENG-3493: parses '30m' to 1800000ms (default timeout)",
      async () => {
        const parseDuration = await getDurationParser();
        expect(parseDuration("30m")).toBe(1_800_000);
      }
    );

    test(
      "ENG-3493: parses 'none' to null or Infinity",
      async () => {
        const parseDuration = await getDurationParser();
        const result = parseDuration("none");
        // Accept either null or Infinity as "no timeout"
        expect(result === null || result === Infinity).toBe(true);
      }
    );
  });

  describe("watch behavior", () => {
    test(
      "ENG-3493: spawns a process and writes PID to .meta.json",
      async () => {
        const description = "Description for watch test";
        setupCheckout("ENG-3493", description);

        const proc = Bun.spawn(["bun", CLI_PATH, "watch", "ENG-3493"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stderr: "pipe",
          stdout: "pipe",
        });

        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);

        // .meta.json should now contain a watcherPid
        const meta = readRawMeta(join(TEST_BASE_DIR, "ENG-3493"));
        expect(meta).not.toBeNull();
        expect(typeof meta!.watcherPid).toBe("number");
        expect(meta!.watcherPid).toBeGreaterThan(0);
      }
    );

    test(
      "ENG-3493: watch with --timeout flag passes timeout to watcher",
      async () => {
        const description = "Description for timeout test";
        setupCheckout("ENG-3493", description);

        const proc = Bun.spawn(
          ["bun", CLI_PATH, "watch", "ENG-3493", "--timeout", "10m"],
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
        // Human output should mention the timeout duration
        expect(stdout).toMatch(/10m|10 min/i);
      }
    );

    test(
      "ENG-3493: exits with code 2 on missing LINEAR_API_KEY",
      async () => {
        const description = "Description for api key test";
        setupCheckout("ENG-3493", description);

        const proc = Bun.spawn(["bun", CLI_PATH, "watch", "ENG-3493"], {
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

    test(
      "ENG-3493: implicitly checks out if not already checked out",
      async () => {
        // No setupCheckout — directory doesn't exist yet
        mkdirSync(TEST_BASE_DIR, { recursive: true });

        const proc = Bun.spawn(["bun", CLI_PATH, "watch", "ENG-3493"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stderr: "pipe",
          stdout: "pipe",
        });

        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);

        // Should have created the checkout directory and description.md
        const issueDir = join(TEST_BASE_DIR, "ENG-3493");
        expect(existsSync(join(issueDir, "description.md"))).toBe(true);
        expect(existsSync(join(issueDir, ".meta.json"))).toBe(true);

        // Should also have a watcherPid
        const meta = readRawMeta(issueDir);
        expect(meta).not.toBeNull();
        expect(typeof meta!.watcherPid).toBe("number");
      }
    );
  });

  describe("watch output", () => {
    test(
      "ENG-3493: human output contains 'Watching' and default timeout",
      async () => {
        const description = "Description for output test";
        setupCheckout("ENG-3493", description);

        const proc = Bun.spawn(["bun", CLI_PATH, "watch", "ENG-3493"], {
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
        expect(stdout).toMatch(/watching/i);
        expect(stdout).toContain("ENG-3493");
        // Default timeout is 30 minutes
        expect(stdout).toMatch(/30m|30 min/i);
      }
    );

    test(
      "ENG-3493: JSON output contains identifier, pid, and timeout",
      async () => {
        const description = "Description for JSON output test";
        setupCheckout("ENG-3493", description);

        const proc = Bun.spawn(
          ["bun", CLI_PATH, "watch", "ENG-3493", "--json"],
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
        expect(parsed.identifier).toBe("ENG-3493");
        expect(typeof parsed.pid).toBe("number");
        expect(parsed.pid).toBeGreaterThan(0);
        expect(parsed.timeout).toBeTruthy();
      }
    );
  });
});

describe("plan unwatch command", () => {
  describe("unwatch behavior", () => {
    test(
      "ENG-3493: clears watcherPid from .meta.json",
      async () => {
        // Set up a checkout with a fake watcherPid
        const description = "Description for unwatch test";
        setupCheckout("ENG-3493", description, { watcherPid: 99999 });

        // Verify the PID is there before unwatch
        const metaBefore = readRawMeta(join(TEST_BASE_DIR, "ENG-3493"));
        expect(metaBefore!.watcherPid).toBe(99999);

        const proc = Bun.spawn(["bun", CLI_PATH, "unwatch", "ENG-3493"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stderr: "pipe",
          stdout: "pipe",
        });

        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);

        // watcherPid should be cleared from .meta.json
        const metaAfter = readRawMeta(join(TEST_BASE_DIR, "ENG-3493"));
        expect(metaAfter).not.toBeNull();
        expect(metaAfter!.watcherPid).toBeUndefined();
      }
    );

    test(
      "ENG-3493: exits 0 with message when not watching",
      async () => {
        // Set up a checkout without a watcherPid
        const description = "Description for not-watching test";
        setupCheckout("ENG-3493", description);

        const proc = Bun.spawn(["bun", CLI_PATH, "unwatch", "ENG-3493"], {
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
        // Should print an informational message (on stdout or stderr)
        const combined = stdout + stderr;
        expect(combined).toMatch(/not watching|no watcher|not being watched/i);
      }
    );

    test(
      "ENG-3493: --all clears all watcher PIDs",
      async () => {
        // Set up multiple checkouts with fake watcherPids
        setupCheckout("ENG-100", "First issue", { watcherPid: 10001 });
        setupCheckout("ENG-200", "Second issue", { watcherPid: 10002 });
        setupCheckout("ENG-300", "Third issue (no watcher)");

        const proc = Bun.spawn(["bun", CLI_PATH, "unwatch", "--all"], {
          env: {
            ...process.env,
            PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          },
          stderr: "pipe",
          stdout: "pipe",
        });

        const exitCode = await proc.exited;
        expect(exitCode).toBe(0);

        // All watcherPids should be cleared
        const meta100 = readRawMeta(join(TEST_BASE_DIR, "ENG-100"));
        const meta200 = readRawMeta(join(TEST_BASE_DIR, "ENG-200"));
        const meta300 = readRawMeta(join(TEST_BASE_DIR, "ENG-300"));

        expect(meta100!.watcherPid).toBeUndefined();
        expect(meta200!.watcherPid).toBeUndefined();
        // ENG-300 had no watcherPid and should still have no watcherPid
        expect(meta300!.watcherPid).toBeUndefined();
      }
    );

    test(
      "ENG-3493: JSON output contains identifier and stopped flag",
      async () => {
        setupCheckout("ENG-3493", "Description for JSON unwatch", {
          watcherPid: 99999,
        });

        const proc = Bun.spawn(
          ["bun", CLI_PATH, "unwatch", "ENG-3493", "--json"],
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
        expect(parsed.identifier).toBe("ENG-3493");
        expect(parsed.stopped).toBe(true);
      }
    );
  });

  describe("unwatch output", () => {
    test(
      "ENG-3493: human output contains 'Stopped watching'",
      async () => {
        setupCheckout("ENG-3493", "Description for human unwatch output", {
          watcherPid: 99999,
        });

        const proc = Bun.spawn(["bun", CLI_PATH, "unwatch", "ENG-3493"], {
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
        expect(stdout).toMatch(/stopped watching/i);
        expect(stdout).toContain("ENG-3493");
      }
    );
  });
});
