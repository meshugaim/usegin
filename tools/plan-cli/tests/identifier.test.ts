import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { normalizeIssueId } from "../src/lib/identifier";

describe("normalizeIssueId", () => {
  const originalEnv = process.env.PLAN_TEAM;

  beforeEach(() => {
    // Reset env before each test
    delete process.env.PLAN_TEAM;
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.PLAN_TEAM = originalEnv;
    } else {
      delete process.env.PLAN_TEAM;
    }
  });

  describe("with default team key (ENG)", () => {
    it("prefixes numeric-only IDs with ENG-", () => {
      expect(normalizeIssueId("331")).toBe("ENG-331");
    });

    it("prefixes single-digit numeric IDs", () => {
      expect(normalizeIssueId("1")).toBe("ENG-1");
    });

    it("prefixes large numeric IDs", () => {
      expect(normalizeIssueId("12345")).toBe("ENG-12345");
    });

    it("preserves already-prefixed identifiers", () => {
      expect(normalizeIssueId("ENG-331")).toBe("ENG-331");
    });

    it("preserves identifiers with different team prefixes", () => {
      expect(normalizeIssueId("ABC-123")).toBe("ABC-123");
    });

    it("preserves identifiers with lowercase prefixes", () => {
      expect(normalizeIssueId("eng-331")).toBe("eng-331");
    });
  });

  describe("with custom PLAN_TEAM env var", () => {
    it("uses PLAN_TEAM for prefixing numeric IDs", () => {
      process.env.PLAN_TEAM = "CUSTOM";
      expect(normalizeIssueId("42")).toBe("CUSTOM-42");
    });

    it("still preserves already-prefixed identifiers", () => {
      process.env.PLAN_TEAM = "CUSTOM";
      expect(normalizeIssueId("ENG-331")).toBe("ENG-331");
    });
  });

  describe("edge cases", () => {
    it("handles IDs with leading zeros", () => {
      expect(normalizeIssueId("007")).toBe("ENG-007");
    });

    it("does not prefix strings that start with numbers but contain letters", () => {
      // "123abc" is not purely numeric, so it stays as-is
      expect(normalizeIssueId("123abc")).toBe("123abc");
    });

    it("does not prefix strings that contain special characters", () => {
      expect(normalizeIssueId("123-456")).toBe("123-456");
    });

    it("does not prefix empty strings", () => {
      expect(normalizeIssueId("")).toBe("");
    });
  });
});
