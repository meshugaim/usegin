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
});
