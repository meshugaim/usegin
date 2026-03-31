import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import { LinearClient as LinearSDK } from "@linear/sdk";
import { existsSync, writeFileSync, rmSync } from "fs";
import { parseMeta } from "../../src/lib/plan-meta";

const CLI_PATH = new URL("../../src/index.ts", import.meta.url).pathname;

/**
 * E2E tests for the file-sync round-trip: checkout -> edit -> push.
 * Uses a real Linear issue (ENG-3494) and restores the original description after.
 */
describe("E2E: file-sync checkout -> edit -> push", () => {
  const TEST_ISSUE = "ENG-3494";
  let sdk: LinearSDK;
  let issueId: string;
  let originalDescription: string | undefined;
  const testCheckoutDir = `/tmp/linear-e2e-${Date.now()}`;

  beforeAll(async () => {
    if (!process.env.LINEAR_API_KEY) {
      throw new Error("LINEAR_API_KEY required for E2E tests");
    }
    sdk = new LinearSDK({ apiKey: process.env.LINEAR_API_KEY });

    // Save original description so we can restore it in afterAll
    const issue = await sdk.issue(TEST_ISSUE);
    issueId = issue.id;
    originalDescription = issue.description ?? undefined;
  });

  afterAll(async () => {
    // Restore original description on Linear
    try {
      await sdk.updateIssue(issueId, {
        description: originalDescription ?? "",
      });
      console.log(`Restored original description for ${TEST_ISSUE}`);
    } catch (e) {
      console.warn(
        `Failed to restore description for ${TEST_ISSUE}:`,
        e
      );
    }

    // Clean up temp checkout directory
    try {
      if (existsSync(testCheckoutDir)) {
        rmSync(testCheckoutDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn(`Failed to clean up ${testCheckoutDir}:`, e);
    }
  });

  it(
    "checks out an issue, edits the file, pushes, and verifies on Linear",
    async () => {
      // 1. Checkout the issue
      const checkoutResult = await $`bun ${CLI_PATH} checkout ${TEST_ISSUE} --force --json`
        .env({ ...process.env, PLAN_CHECKOUT_DIR: testCheckoutDir })
        .text();
      const checkout = JSON.parse(checkoutResult);
      expect(checkout.identifier).toBe(TEST_ISSUE);

      // 2. Verify the description file was created
      const descPath = checkout.path;
      expect(existsSync(descPath)).toBe(true);

      // 3. Edit the file with unique test content
      // Avoid markdown-special characters (brackets get escaped by Linear)
      const testContent = `E2E TEST - Updated at ${new Date().toISOString()}`;
      writeFileSync(descPath, testContent);

      // 4. Push the edited file back to Linear
      const pushResult = await $`bun ${CLI_PATH} push ${TEST_ISSUE} --json`
        .env({ ...process.env, PLAN_CHECKOUT_DIR: testCheckoutDir })
        .text();
      const push = JSON.parse(pushResult);
      expect(push.identifier).toBe(TEST_ISSUE);
      expect(push.bytes).toBeGreaterThan(0);

      // 5. Verify the description was updated on Linear
      const issue = await sdk.issue(TEST_ISSUE);
      const { description: cleanDescription } = parseMeta(issue.description ?? "");
      expect(cleanDescription).toBe(testContent);
    },
    15_000
  );

  it(
    "status shows the checked-out issue",
    async () => {
      const statusResult = await $`bun ${CLI_PATH} status --json`
        .env({ ...process.env, PLAN_CHECKOUT_DIR: testCheckoutDir })
        .text();
      const status = JSON.parse(statusResult);
      expect(Array.isArray(status.checkouts)).toBe(true);
      expect(status.checkouts.length).toBeGreaterThanOrEqual(1);

      const found = status.checkouts.find(
        (c: { identifier: string }) => c.identifier === TEST_ISSUE
      );
      expect(found).toBeDefined();
      expect(found.modified).toBe(false); // file was pushed, so hash should match
    },
    10_000
  );
});
