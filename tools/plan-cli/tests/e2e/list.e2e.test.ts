import { describe, expect, it, beforeAll } from "bun:test";
import { $ } from "bun";

const CLI_PATH = new URL("../../src/index.ts", import.meta.url).pathname;

/**
 * E2E tests that hit the real Linear API.
 * Requires LINEAR_API_KEY environment variable.
 *
 * Run with: bun test tests/e2e
 */
// Skip E2E tests to avoid Linear API rate limits during development
describe.skip("E2E: plan list against real Linear", () => {
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
    "returns valid JSON with --json flag",
    async () => {
      const result = await $`bun ${CLI_PATH} list --json`.text();

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("items");
      expect(Array.isArray(parsed.items)).toBe(true);
    },
    15000
  );

  it(
    "filters by team when --team is provided",
    async () => {
      // First, get all issues to find a valid team
      const allResult = await $`bun ${CLI_PATH} list --json`.text();
      const all = JSON.parse(allResult);

      if (all.items.length === 0) {
        console.log("Skipping team filter test - no issues found");
        return;
      }

      // Extract team from first issue identifier (e.g., "ENG-12" -> "ENG")
      const firstIssue = all.items[0];
      const teamKey = firstIssue.identifier.split("-")[0];

      // Now filter by that team
      const teamResult = await $`bun ${CLI_PATH} list --team ${teamKey} --json`.text();
      const teamIssues = JSON.parse(teamResult);

      // All issues should be from that team
      for (const issue of teamIssues.items) {
        expect(issue.identifier.startsWith(teamKey + "-")).toBe(true);
      }
    },
    15000 // Increased timeout for two API calls
  );

  it("returns issues sorted by sortOrder", async () => {
    const result = await $`bun ${CLI_PATH} list --json`.text();
    const parsed = JSON.parse(result);

    if (parsed.items.length < 2) {
      console.log("Skipping sort test - fewer than 2 issues");
      return;
    }

    // Position numbers should be sequential
    for (let i = 0; i < parsed.items.length; i++) {
      expect(parsed.items[i].position).toBe(i + 1);
    }
  });

  it("handles empty results gracefully", async () => {
    // Try to list with a status that likely has no issues
    const result = await $`bun ${CLI_PATH} list --status nonexistent_status --json 2>&1`.text();

    // Should either return empty items or an error, not crash
    try {
      const parsed = JSON.parse(result);
      expect(parsed.items).toEqual([]);
    } catch {
      // If it's an error message, that's also acceptable
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
