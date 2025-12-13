import { describe, expect, it, beforeAll } from "bun:test";
import { $ } from "bun";

const CLI_PATH = new URL("../../src/index.ts", import.meta.url).pathname;

/**
 * E2E tests that hit the real Linear API.
 * Requires LINEAR_API_KEY environment variable.
 *
 * Run with: bun test tests/e2e
 */
describe("E2E: plan list against real Linear", () => {
  beforeAll(() => {
    if (!process.env.LINEAR_API_KEY) {
      throw new Error("LINEAR_API_KEY required for E2E tests");
    }
  });

  it("lists issues from Linear", async () => {
    // This test requires at least one team in Linear
    // It will discover available teams dynamically
    const result = await $`bun ${CLI_PATH} list`.text();

    // Should output something (either issues or "no issues" message)
    expect(result.length).toBeGreaterThan(0);
  });

  it(
    "filters by team when --team is provided",
    async () => {
      // First list issues to ensure we have some
      const result = await $`bun ${CLI_PATH} list --team ENG`.text();

      // Should contain the header or "No issues found"
      expect(result.length).toBeGreaterThan(0);
      // If we have issues, they should show ENG identifiers
      if (!result.includes("No issues found")) {
        expect(result).toContain("ENG-");
      }
    },
    15000
  );

  it("shows sub-issues with depth flag", async () => {
    const result = await $`bun ${CLI_PATH} list --depth 1`.text();

    // Should output something
    expect(result.length).toBeGreaterThan(0);
    // With depth > 0, we might see tree characters if there are sub-issues
    // (not guaranteed, depends on data)
  });

  it("handles invalid status with helpful error", async () => {
    // Try to list with an invalid status
    const result = await $`bun ${CLI_PATH} list --status nonexistent_status 2>&1`.nothrow().text();

    // Should show a helpful error message with available statuses
    expect(result).toContain('Status "nonexistent_status" not found');
    expect(result).toContain("Available statuses:");
  });
});
