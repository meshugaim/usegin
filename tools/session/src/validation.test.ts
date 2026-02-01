/**
 * Tests for the validation layer
 */

import { test, expect, describe } from "bun:test";
import { isEntry, hasSessionId, getSessionId, hasAgentId } from "./validation";
import type { Entry } from "./types";

describe("isEntry", () => {
  test("returns true for valid user entry", () => {
    const entry = {
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "Hello" },
    };
    expect(isEntry(entry)).toBe(true);
  });

  test("returns true for valid assistant entry", () => {
    const entry = {
      type: "assistant",
      uuid: "a1",
      session_id: "s1",
      message: { role: "assistant", model: "claude", content: "Hi" },
    };
    expect(isEntry(entry)).toBe(true);
  });

  test("returns true for valid system entry", () => {
    const entry = {
      type: "system",
      subtype: "init",
      uuid: "sys1",
      session_id: "s1",
      cwd: "/test",
      tools: ["Read"],
      model: "claude",
    };
    expect(isEntry(entry)).toBe(true);
  });

  test("returns true for valid summary entry", () => {
    const entry = {
      type: "summary",
      summary: "A test session",
      timestamp: "2025-01-01T00:00:00Z",
    };
    expect(isEntry(entry)).toBe(true);
  });

  test("returns true for all known entry types", () => {
    const knownTypes = [
      "system",
      "user",
      "assistant",
      "result",
      "file-history-snapshot",
      "queue-operation",
      "progress",
      "saved_hook_context",
      "summary",
    ];

    for (const type of knownTypes) {
      expect(isEntry({ type })).toBe(true);
    }
  });

  test("returns false for missing type field", () => {
    const entry = {
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "Hello" },
    };
    expect(isEntry(entry)).toBe(false);
  });

  test("returns false for unknown type value", () => {
    const entry = {
      type: "unknown_type",
      uuid: "u1",
    };
    expect(isEntry(entry)).toBe(false);
  });

  test("returns false for non-string type field", () => {
    expect(isEntry({ type: 123 })).toBe(false);
    expect(isEntry({ type: null })).toBe(false);
    expect(isEntry({ type: undefined })).toBe(false);
    expect(isEntry({ type: {} })).toBe(false);
    expect(isEntry({ type: [] })).toBe(false);
  });

  test("returns false for null", () => {
    expect(isEntry(null)).toBe(false);
  });

  test("returns false for undefined", () => {
    expect(isEntry(undefined)).toBe(false);
  });

  test("returns false for primitives", () => {
    expect(isEntry("string")).toBe(false);
    expect(isEntry(123)).toBe(false);
    expect(isEntry(true)).toBe(false);
  });

  test("returns false for arrays", () => {
    expect(isEntry([])).toBe(false);
    expect(isEntry([{ type: "user" }])).toBe(false);
  });
});

describe("hasSessionId", () => {
  test("returns true when session_id is present", () => {
    const entry = { type: "user", session_id: "s1" } as Entry;
    expect(hasSessionId(entry)).toBe(true);
  });

  test("returns true when sessionId is present", () => {
    const entry = { type: "user", sessionId: "s1" } as Entry;
    expect(hasSessionId(entry)).toBe(true);
  });

  test("returns false when neither is present", () => {
    const entry = { type: "user" } as Entry;
    expect(hasSessionId(entry)).toBe(false);
  });

  test("returns false for empty session_id", () => {
    const entry = { type: "user", session_id: "" } as Entry;
    expect(hasSessionId(entry)).toBe(false);
  });
});

describe("getSessionId", () => {
  test("returns session_id when present", () => {
    const entry = { type: "user", session_id: "s1" } as Entry;
    expect(getSessionId(entry)).toBe("s1");
  });

  test("returns sessionId when session_id is missing", () => {
    const entry = { type: "user", sessionId: "s2" } as Entry;
    expect(getSessionId(entry)).toBe("s2");
  });

  test("prefers session_id over sessionId", () => {
    const entry = { type: "user", session_id: "s1", sessionId: "s2" } as Entry;
    expect(getSessionId(entry)).toBe("s1");
  });

  test("returns empty string when neither is present", () => {
    const entry = { type: "user" } as Entry;
    expect(getSessionId(entry)).toBe("");
  });
});

describe("hasAgentId", () => {
  test("returns true when agentId is present", () => {
    const entry = { type: "user", agentId: "agent-123" } as Entry;
    expect(hasAgentId(entry)).toBe(true);
  });

  test("returns false when agentId is missing", () => {
    const entry = { type: "user" } as Entry;
    expect(hasAgentId(entry)).toBe(false);
  });

  test("returns false for empty agentId", () => {
    const entry = { type: "user", agentId: "" } as Entry;
    expect(hasAgentId(entry)).toBe(false);
  });
});

describe("JSON.parse integration", () => {
  test("validates parsed JSON correctly", () => {
    const validJson = '{"type":"user","uuid":"u1","message":{"role":"user","content":"Hello"}}';
    const parsed = JSON.parse(validJson);
    expect(isEntry(parsed)).toBe(true);
  });

  test("rejects JSON with missing type", () => {
    const invalidJson = '{"uuid":"u1","message":{"role":"user","content":"Hello"}}';
    const parsed = JSON.parse(invalidJson);
    expect(isEntry(parsed)).toBe(false);
  });

  test("rejects JSON with unknown type", () => {
    const invalidJson = '{"type":"not_a_real_type","uuid":"u1"}';
    const parsed = JSON.parse(invalidJson);
    expect(isEntry(parsed)).toBe(false);
  });

  test("handles malformed JSON gracefully in parsing flow", () => {
    const lines = [
      '{"type":"user","uuid":"u1","message":{"role":"user","content":"Hello"}}',
      '{"invalid json',
      '{"type":"unknown_type"}',
      '{"type":"assistant","uuid":"a1","message":{"role":"assistant","content":"Hi"}}',
    ];

    const validEntries: Entry[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (isEntry(parsed)) {
          validEntries.push(parsed);
        }
      } catch {
        // Skip malformed JSON
      }
    }

    // Should have 2 valid entries (user and assistant)
    expect(validEntries).toHaveLength(2);
    expect(validEntries[0]?.type).toBe("user");
    expect(validEntries[1]?.type).toBe("assistant");
  });
});
