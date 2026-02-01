/**
 * Tests for branded ID types.
 *
 * Branded types provide compile-time safety to prevent accidentally mixing
 * different ID types (e.g., using a SessionId where an EntryUuid is expected).
 *
 * ## How branded types work
 *
 * ```typescript
 * type SessionId = string & { readonly __brand: 'SessionId' };
 * ```
 *
 * At runtime, these are just strings. The `__brand` property exists only
 * in the type system. This gives us:
 * - Compile-time safety: can't mix SessionId with EntryUuid
 * - Runtime compatibility: can use anywhere a string is expected
 * - Zero overhead: no runtime wrapper objects
 *
 * ## What the compiler catches
 *
 * ```typescript
 * // These would be compile errors (if you try them):
 * const turn: Turn = { uuid: sessionId, ... };  // Error: SessionId not assignable to EntryUuid
 * const result: ToolResult = { toolUseId: entryUuid, ... };  // Error: EntryUuid not assignable to ToolUseId
 * ```
 *
 * ## What these tests verify
 *
 * Since we can't test compile errors at runtime, we test:
 * 1. Helper functions create properly branded values
 * 2. Branded values can be used as strings (runtime compatibility)
 * 3. Brand preservation through operations
 */

import { describe, it, expect } from "bun:test";
import {
  asSessionId,
  asEntryUuid,
  asAgentId,
  asToolUseId,
  type SessionId,
  type EntryUuid,
  type AgentId,
  type ToolUseId,
} from "./types";

describe("branded ID types", () => {
  describe("helper functions", () => {
    it("asSessionId creates a SessionId from a string", () => {
      const id = asSessionId("abc-123");
      // At runtime, it's just a string
      expect(typeof id).toBe("string");
      expect(id).toBe("abc-123");
    });

    it("asEntryUuid creates an EntryUuid from a string", () => {
      const uuid = asEntryUuid("uuid-001");
      expect(typeof uuid).toBe("string");
      expect(uuid).toBe("uuid-001");
    });

    it("asAgentId creates an AgentId from a string", () => {
      const agentId = asAgentId("agent-456");
      expect(typeof agentId).toBe("string");
      expect(agentId).toBe("agent-456");
    });

    it("asToolUseId creates a ToolUseId from a string", () => {
      const toolUseId = asToolUseId("tool-789");
      expect(typeof toolUseId).toBe("string");
      expect(toolUseId).toBe("tool-789");
    });
  });

  describe("runtime string compatibility", () => {
    it("branded SessionId can be used in string operations", () => {
      const id: SessionId = asSessionId("test-session-123");

      // String methods work
      expect(id.startsWith("test-")).toBe(true);
      expect(id.length).toBe(16);
      expect(id.toUpperCase()).toBe("TEST-SESSION-123");

      // Template literals work
      expect(`Session: ${id}`).toBe("Session: test-session-123");

      // String comparison works
      expect(id === "test-session-123").toBe(true);
    });

    it("branded EntryUuid can be used in string operations", () => {
      const uuid: EntryUuid = asEntryUuid("entry-uuid-abc");

      expect(uuid.includes("uuid")).toBe(true);
      expect(uuid.split("-")).toEqual(["entry", "uuid", "abc"]);
    });

    it("branded AgentId can be used in string operations", () => {
      const agentId: AgentId = asAgentId("subagent-007");

      expect(agentId.replace("subagent", "agent")).toBe("agent-007");
    });

    it("branded ToolUseId can be used in string operations", () => {
      const toolUseId: ToolUseId = asToolUseId("toolu_abc123");

      expect(toolUseId.startsWith("toolu_")).toBe(true);
    });
  });

  describe("use in data structures", () => {
    it("branded IDs can be used as object keys", () => {
      const id1: SessionId = asSessionId("session-1");
      const id2: SessionId = asSessionId("session-2");

      const map: Record<string, number> = {
        [id1]: 1,
        [id2]: 2,
      };

      expect(map[id1]).toBe(1);
      expect(map["session-1"]).toBe(1);
    });

    it("branded IDs work in Map and Set", () => {
      const uuid1: EntryUuid = asEntryUuid("uuid-a");
      const uuid2: EntryUuid = asEntryUuid("uuid-b");

      // Map with branded IDs as keys
      const map = new Map<EntryUuid, string>();
      map.set(uuid1, "first");
      map.set(uuid2, "second");

      expect(map.get(uuid1)).toBe("first");
      expect(map.size).toBe(2);

      // Set with branded IDs
      const set = new Set<EntryUuid>();
      set.add(uuid1);
      set.add(uuid2);
      set.add(uuid1); // duplicate

      expect(set.size).toBe(2);
      expect(set.has(uuid1)).toBe(true);
    });

    it("branded IDs work in arrays", () => {
      const uuids: EntryUuid[] = [
        asEntryUuid("a"),
        asEntryUuid("b"),
        asEntryUuid("c"),
      ];

      expect(uuids.includes(asEntryUuid("b"))).toBe(true);
      expect(uuids.filter((u) => u !== asEntryUuid("a"))).toHaveLength(2);
    });
  });

  describe("nullable and optional handling", () => {
    it("asEntryUuid with null-like values", () => {
      // Empty string is valid (some entries don't have UUIDs)
      const empty: EntryUuid = asEntryUuid("");
      expect(empty).toBe("");
    });

    it("branded IDs work with null/undefined in union types", () => {
      // Simulates parentUuid which can be null
      type ParentUuid = EntryUuid | null;

      const withParent: ParentUuid = asEntryUuid("parent-123");
      const withoutParent: ParentUuid = null;

      expect(withParent).toBe("parent-123");
      expect(withoutParent).toBeNull();
    });
  });
});

/**
 * Type-level tests (compile-time only)
 *
 * These demonstrate what the compiler catches. They're commented out
 * because they intentionally produce type errors.
 *
 * To verify, uncomment and run `bun run typecheck` - you should see errors.
 *
 * ```typescript
 * // ERROR: Type 'SessionId' is not assignable to type 'EntryUuid'
 * const sessionId: SessionId = asSessionId("sess-1");
 * const wrongUuid: EntryUuid = sessionId;
 *
 * // ERROR: Type 'ToolUseId' is not assignable to type 'AgentId'
 * const toolId: ToolUseId = asToolUseId("tool-1");
 * const wrongAgent: AgentId = toolId;
 *
 * // ERROR: Type 'string' is not assignable to type 'SessionId'
 * const rawString = "raw-string";
 * const notBranded: SessionId = rawString;  // Must use asSessionId()
 * ```
 */
