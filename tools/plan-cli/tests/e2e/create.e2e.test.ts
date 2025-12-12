import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import { LinearClient as LinearSDK } from "@linear/sdk";

const CLI_PATH = new URL("../../src/index.ts", import.meta.url).pathname;

/**
 * E2E tests for plan create command.
 * Creates real issues in Linear and cleans them up after.
 */
// Skip E2E tests to avoid Linear API rate limits during development
describe.skip("E2E: plan create against real Linear", () => {
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
    for (const id of createdIssueIds) {
      try {
        await sdk.deleteIssue(id);
        console.log(`Cleaned up test issue: ${id}`);
      } catch (e) {
        console.warn(`Failed to clean up issue ${id}:`, e);
      }
    }
  });

  it("creates an issue and returns its identifier", async () => {
    const testTitle = `[TEST] E2E create test ${Date.now()}`;

    const result = await $`bun ${CLI_PATH} create ${testTitle} --quiet`.text();
    const identifier = result.trim();

    // Should return something like "ENG-123"
    expect(identifier).toMatch(/^[A-Z]+-\d+$/);

    // Verify issue exists in Linear
    const issue = await sdk.issue(identifier);
    expect(issue).toBeDefined();
    expect(issue.title).toBe(testTitle);

    // Track for cleanup
    createdIssueIds.push(issue.id);
  });

  it("creates issue with full output by default", async () => {
    const testTitle = `[TEST] E2E create verbose ${Date.now()}`;

    const result = await $`bun ${CLI_PATH} create ${testTitle}`.text();

    // Should contain "Created:" and the identifier
    expect(result).toContain("Created:");
    expect(result).toMatch(/[A-Z]+-\d+/);

    // Extract identifier for cleanup
    const match = result.match(/([A-Z]+-\d+)/);
    if (match) {
      const issue = await sdk.issue(match[1]);
      createdIssueIds.push(issue.id);
    }
  });

  it("creates issue with JSON output", async () => {
    const testTitle = `[TEST] E2E create json ${Date.now()}`;

    const result = await $`bun ${CLI_PATH} create ${testTitle} --json`.text();
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty("id");
    expect(parsed).toHaveProperty("identifier");
    expect(parsed).toHaveProperty("title");
    expect(parsed.title).toBe(testTitle);

    // Track for cleanup
    createdIssueIds.push(parsed.id);
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
