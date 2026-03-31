import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { LinearClient as LinearSDK } from "@linear/sdk";
import { parseMeta } from "../src/lib/plan-meta";

const CLI_PATH = new URL("../src/index.ts", import.meta.url).pathname;

// Use unique temp dirs per test run to avoid conflicts with parallel agents
const TEST_BASE_DIR = `/tmp/linear-test-meta-lifecycle-${Date.now()}`;

// Track created issue identifiers for cleanup after all tests
const createdIdentifiers: string[] = [];

/**
 * Helper: spawn the plan CLI with given args and env overrides.
 * Returns { stdout, stderr, exitCode }.
 */
async function runPlan(
  args: string[],
  envOverrides: Record<string, string | undefined> = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI_PATH, ...args], {
    env: { ...process.env, ...envOverrides },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}

/**
 * Helper: fetch an issue's raw description directly via the Linear SDK.
 * Returns the full description string including any plan:meta block.
 */
async function fetchIssueDescription(identifier: string): Promise<string> {
  const sdk = new LinearSDK({ apiKey: process.env.LINEAR_API_KEY! });
  const issue = await sdk.issue(identifier);
  return issue.description ?? "";
}

afterAll(async () => {
  // Clean up temp directories
  if (existsSync(TEST_BASE_DIR)) {
    rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }

  // Clean up created Linear issues
  if (createdIdentifiers.length > 0 && process.env.LINEAR_API_KEY) {
    const sdk = new LinearSDK({ apiKey: process.env.LINEAR_API_KEY });
    console.log(`Cleaning up ${createdIdentifiers.length} lifecycle test issues...`);
    for (const identifier of createdIdentifiers) {
      try {
        const issue = await sdk.issue(identifier);
        if (issue.id) {
          await sdk.deleteIssue(issue.id);
          console.log(`  Cleaned up ${identifier}`);
        }
      } catch (e) {
        console.warn(`  Failed to clean up ${identifier}:`, e);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// create tests (AC-5, AC-6)
// ---------------------------------------------------------------------------

describe("plan-meta lifecycle: create", () => {
  test(
    "AC-5: create with CLAUDE_SESSION_ID attaches meta block to description",
    async () => {
      // Create a real issue with CLAUDE_SESSION_ID set
      const { stdout, stderr, exitCode } = await runPlan(
        ["create", "test: plan-meta lifecycle test", "--parent", "ENG-3758", "--quiet"],
        { CLAUDE_SESSION_ID: "test-session-abc" }
      );

      expect(exitCode).toBe(0);

      // --quiet outputs just the identifier
      const identifier = stdout.trim();
      expect(identifier).toMatch(/^ENG-\d+$/);
      createdIdentifiers.push(identifier);

      // Fetch the issue description from Linear
      const description = await fetchIssueDescription(identifier);

      // Description should contain a plan:meta block
      expect(description).toContain("<!-- plan:meta");

      // Parse the meta and verify fields
      const { meta } = parseMeta(description);
      expect(meta).not.toBeNull();
      expect(meta!.created_by_session).toBe("test-session-abc");
      expect(meta!.last_session).toBe("test-session-abc");
      expect(meta!.sessions).toContain("test-session-abc");

      // Timestamps should be valid ISO strings
      expect(meta!.created_at).toBeTruthy();
      expect(new Date(meta!.created_at!).toISOString()).toBe(meta!.created_at);
      expect(meta!.updated_at).toBeTruthy();
      expect(new Date(meta!.updated_at!).toISOString()).toBe(meta!.updated_at);
    },
    { timeout: 30_000 }
  );

  test(
    "AC-6: create without CLAUDE_SESSION_ID produces no meta block",
    async () => {
      // Create a real issue WITHOUT CLAUDE_SESSION_ID
      const { stdout, exitCode } = await runPlan(
        ["create", "test: plan-meta no-session test", "--parent", "ENG-3758", "--quiet"],
        { CLAUDE_SESSION_ID: undefined }
      );

      expect(exitCode).toBe(0);

      const identifier = stdout.trim();
      expect(identifier).toMatch(/^ENG-\d+$/);
      createdIdentifiers.push(identifier);

      // Fetch the issue description from Linear
      const description = await fetchIssueDescription(identifier);

      // Description should NOT contain a plan:meta block
      expect(description).not.toContain("<!-- plan:meta");

      // parseMeta should return null meta
      const { meta } = parseMeta(description);
      expect(meta).toBeNull();
    },
    { timeout: 30_000 }
  );
});

// ---------------------------------------------------------------------------
// checkout test (AC-10)
// ---------------------------------------------------------------------------

describe("plan-meta lifecycle: checkout", () => {
  // Create a fresh issue with meta in beforeAll so this test group is self-contained
  let checkoutIssueId: string;

  beforeAll(async () => {
    // NOTE: This beforeAll depends on AC-5 (create attaches meta).
    // Until create is implemented, the test will fail at the first meta
    // assertion in the test body, not at the checkout-specific assertion.

    // Create an issue with meta for checkout testing.
    // This uses the same pattern as AC-5 but is independent.
    const { stdout, exitCode } = await runPlan(
      ["create", "test: plan-meta checkout strip test", "--parent", "ENG-3758", "--quiet"],
      { CLAUDE_SESSION_ID: "checkout-session-1" }
    );
    if (exitCode !== 0) {
      throw new Error("Failed to create issue for checkout test");
    }
    checkoutIssueId = stdout.trim();
    createdIdentifiers.push(checkoutIssueId);
  }, { timeout: 30_000 });

  test(
    "AC-10: checkout strips meta block from local description.md",
    async () => {
      // First confirm the issue has a meta block on Linear
      const remoteDescription = await fetchIssueDescription(checkoutIssueId);
      expect(remoteDescription).toContain("<!-- plan:meta");

      // Checkout the issue
      const { exitCode } = await runPlan(
        ["checkout", checkoutIssueId],
        { PLAN_CHECKOUT_DIR: TEST_BASE_DIR }
      );
      expect(exitCode).toBe(0);

      // Read the local description.md
      const descPath = join(TEST_BASE_DIR, checkoutIssueId, "description.md");
      expect(existsSync(descPath)).toBe(true);

      const localContent = readFileSync(descPath, "utf-8");

      // Local file should NOT contain the meta block
      expect(localContent).not.toContain("<!-- plan:meta");

      // But should still contain the clean description content
      const { description: cleanDescription } = parseMeta(remoteDescription);
      if (cleanDescription.length > 0) {
        expect(localContent).toContain(cleanDescription);
      }
    },
    { timeout: 30_000 }
  );
});

// ---------------------------------------------------------------------------
// push test (AC-11)
// ---------------------------------------------------------------------------

describe("plan-meta lifecycle: push", () => {
  let pushIssueId: string;

  beforeAll(async () => {
    // Create an issue with meta from session-1
    const { stdout, exitCode } = await runPlan(
      ["create", "test: plan-meta push reattach test", "--parent", "ENG-3758", "--quiet"],
      { CLAUDE_SESSION_ID: "session-1" }
    );
    if (exitCode !== 0) {
      throw new Error("Failed to create issue for push test");
    }
    pushIssueId = stdout.trim();
    createdIdentifiers.push(pushIssueId);
  }, { timeout: 30_000 });

  test(
    "AC-11: push reattaches meta with updated session after local edit",
    async () => {
      // Verify the issue has meta with session-1
      const remoteDescBefore = await fetchIssueDescription(pushIssueId);
      expect(remoteDescBefore).toContain("<!-- plan:meta");
      const { meta: metaBefore } = parseMeta(remoteDescBefore);
      expect(metaBefore).not.toBeNull();
      expect(metaBefore!.created_by_session).toBe("session-1");

      // Checkout the issue (meta stripped from local file)
      // --force in case a previous test run left a checkout for this issue
      const { exitCode: checkoutExit } = await runPlan(
        ["checkout", pushIssueId, "--force"],
        { PLAN_CHECKOUT_DIR: TEST_BASE_DIR }
      );
      expect(checkoutExit).toBe(0);

      // Read local description.md and verify meta is stripped
      const descPath = join(TEST_BASE_DIR, pushIssueId, "description.md");
      const localContent = readFileSync(descPath, "utf-8");
      expect(localContent).not.toContain("<!-- plan:meta");

      // Edit the local description.md — append some text
      const appendedText = "\n\nAppended by push test";
      writeFileSync(descPath, localContent + appendedText);

      // Push with a DIFFERENT CLAUDE_SESSION_ID
      const { exitCode: pushExit } = await runPlan(
        ["push", pushIssueId],
        {
          PLAN_CHECKOUT_DIR: TEST_BASE_DIR,
          CLAUDE_SESSION_ID: "session-2",
        }
      );
      expect(pushExit).toBe(0);

      // Fetch the issue from Linear and parse meta
      const remoteDescAfter = await fetchIssueDescription(pushIssueId);
      const { description: cleanDescAfter, meta: metaAfter } = parseMeta(remoteDescAfter);

      // Meta should exist
      expect(metaAfter).not.toBeNull();

      // created_by_session should be preserved from creation
      expect(metaAfter!.created_by_session).toBe("session-1");

      // last_session should be updated to the push session
      expect(metaAfter!.last_session).toBe("session-2");

      // sessions should include both session-1 and session-2
      expect(metaAfter!.sessions).toContain("session-1");
      expect(metaAfter!.sessions).toContain("session-2");

      // Description content should include the appended text
      expect(cleanDescAfter).toContain("Appended by push test");
    },
    { timeout: 30_000 }
  );
});
