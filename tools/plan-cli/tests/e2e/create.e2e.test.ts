import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import { LinearClient as LinearSDK } from "@linear/sdk";

const CLI_PATH = new URL("../../src/index.ts", import.meta.url).pathname;

/**
 * E2E tests for plan create command.
 * Creates real issues in Linear and cleans them up after.
 */
describe("E2E: plan create against real Linear", () => {
  let sdk: LinearSDK;
  const createdIssueIds: string[] = [];

  beforeAll(() => {
    if (!process.env.LINEAR_API_KEY) {
      throw new Error("LINEAR_API_KEY required for E2E tests");
    }
    sdk = new LinearSDK({ apiKey: process.env.LINEAR_API_KEY });
  });

  afterAll(async () => {
    // Clean up: delete all created test issues
    console.log(`Cleaning up ${createdIssueIds.length} test issues...`);
    for (const id of createdIssueIds) {
      try {
        await sdk.deleteIssue(id);
        console.log(`✓ Cleaned up test issue: ${id}`);
      } catch (e) {
        console.warn(`✗ Failed to clean up issue ${id}:`, e);
      }
    }

    // Also search for any orphaned [TEST] issues and clean them up
    // This is a safety net in case tracking failed
    try {
      const issues = await sdk.issues({
        filter: {
          title: { contains: "[TEST]" },
        },
      });

      let orphanedCount = 0;
      for await (const issue of issues.nodes) {
        // Skip issues we already cleaned up
        if (!createdIssueIds.includes(issue.id)) {
          try {
            await sdk.deleteIssue(issue.id);
            console.log(`✓ Cleaned up orphaned test issue: ${issue.identifier} - ${issue.title}`);
            orphanedCount++;
          } catch (e) {
            console.warn(`✗ Failed to clean up orphaned issue ${issue.identifier}:`, e);
          }
        }
      }

      if (orphanedCount > 0) {
        console.log(`Cleaned up ${orphanedCount} orphaned [TEST] issues`);
      }
    } catch (e) {
      console.warn("Failed to search for orphaned test issues:", e);
    }
  });

  it("creates an issue and returns its identifier", async () => {
    const testTitle = `[TEST] E2E create test ${Date.now()}`;

    const result = await $`bun ${CLI_PATH} create ${testTitle} --quiet`.text();
    const identifier = result.trim();

    // Track for cleanup BEFORE assertions (fetch issue to get ID)
    if (identifier.match(/^[A-Z]+-\d+$/)) {
      const issue = await sdk.issue(identifier);
      if (issue.id) {
        createdIssueIds.push(issue.id);
      }
    }

    // Now perform assertions
    expect(identifier).toMatch(/^[A-Z]+-\d+$/);

    // Verify issue exists in Linear
    const issue = await sdk.issue(identifier);
    expect(issue).toBeDefined();
    expect(issue.title).toBe(testTitle);
  });

  it("creates issue with full output by default", async () => {
    const testTitle = `[TEST] E2E create verbose ${Date.now()}`;

    const result = await $`bun ${CLI_PATH} create ${testTitle}`.text();

    // Extract identifier for cleanup BEFORE assertions
    const match = result.match(/([A-Z]+-\d+)/);
    if (match) {
      const issue = await sdk.issue(match[1]);
      createdIssueIds.push(issue.id);
    }

    // Now perform assertions
    // Strip ANSI codes for consistent testing
    const cleanResult = result.replace(/\u001B\[\d+m/g, "");
    expect(cleanResult).toContain("Created:");
    expect(cleanResult).toMatch(/[A-Z]+-\d+/);
  });

  it("creates issue with JSON output", async () => {
    const testTitle = `[TEST] E2E create json ${Date.now()}`;

    const result = await $`bun ${CLI_PATH} create ${testTitle} --json`.text();
    const parsed = JSON.parse(result);

    // Track for cleanup BEFORE assertions
    if (parsed.id) {
      createdIssueIds.push(parsed.id);
    }

    // Now perform assertions
    expect(parsed).toHaveProperty("id");
    expect(parsed).toHaveProperty("identifier");
    expect(parsed).toHaveProperty("title");
    expect(parsed.title).toBe(testTitle);
  });

  it("creates sub-issue with --parent flag", async () => {
    // First create a parent issue
    const parentTitle = `[TEST] Parent issue ${Date.now()}`;
    const parentResult = await $`bun ${CLI_PATH} create ${parentTitle} --json`.text();
    const parent = JSON.parse(parentResult);
    createdIssueIds.push(parent.id);

    // Create child issue
    const childTitle = `[TEST] Child issue ${Date.now()}`;
    const childResult = await $`bun ${CLI_PATH} create ${childTitle} --parent ${parent.identifier} --json`.text();
    const child = JSON.parse(childResult);
    createdIssueIds.push(child.id);

    // Verify parent-child relationship
    const childIssue = await sdk.issue(child.identifier);
    const childParent = await childIssue.parent;
    expect(childParent?.id).toBe(parent.id);
  });
});
