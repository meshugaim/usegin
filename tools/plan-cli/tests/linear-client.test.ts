import { describe, expect, it, mock, beforeEach } from "bun:test";
import { LinearClient } from "../src/lib/linear-client";

// These are unit tests - they test the LinearClient wrapper logic
// without hitting the real API. For real API tests, see tests/e2e/

describe("LinearClient", () => {
  describe("constructor", () => {
    it("throws on missing API key", () => {
      expect(() => new LinearClient({ apiKey: "" })).toThrow("LINEAR_API_KEY is required");
    });

    it("throws on undefined API key", () => {
      expect(() => new LinearClient({ apiKey: undefined as any })).toThrow();
    });

    it("accepts valid API key", () => {
      // This just tests construction, not API calls
      expect(() => new LinearClient({ apiKey: "lin_api_test123" })).not.toThrow();
    });
  });

  // Note: Most LinearClient methods require API calls.
  // Those are tested in E2E tests (tests/e2e/list.e2e.test.ts)
  // Here we only test pure logic that doesn't require API calls.

  describe("buildIssueFields (depth nesting)", () => {
    // Access private method for testing
    const client = new LinearClient({ apiKey: "test_key" });
    const buildIssueFields = (client as any).buildIssueFields.bind(client);

    it("returns base fields with children count query at depth 0", () => {
      const fields = buildIssueFields(0);
      expect(fields).toContain("id");
      expect(fields).toContain("identifier");
      expect(fields).toContain("title");
      expect(fields).toContain("parent { id identifier }");
      // At depth 0, we still fetch children IDs for counting
      expect(fields).toContain("children {");
      expect(fields).toContain("nodes { id }");
    });

    it("includes children with count query at depth 1", () => {
      const fields = buildIssueFields(1);
      expect(fields).toContain("children {");
      // Count occurrences of "children {" - 1 for full data + 1 for counting
      const matches = fields.match(/children \{/g) || [];
      expect(matches.length).toBe(2);
    });

    it("includes nested children at depth 2", () => {
      const fields = buildIssueFields(2);
      // Count occurrences of "children {" - 2 for full data + 1 for counting
      const matches = fields.match(/children \{/g) || [];
      expect(matches.length).toBe(3);
    });

    it("includes 3 levels of nested children at depth 3", () => {
      const fields = buildIssueFields(3);
      // 3 for full data + 1 for counting
      const matches = fields.match(/children \{/g) || [];
      expect(matches.length).toBe(4);
    });

    it("only includes parent field at top level", () => {
      const fields = buildIssueFields(2);
      // parent should only appear once (at top level)
      const parentMatches = fields.match(/parent \{/g) || [];
      expect(parentMatches.length).toBe(1);
    });
  });
});
