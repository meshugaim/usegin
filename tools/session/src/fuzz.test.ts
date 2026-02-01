/**
 * Property-based and fuzz tests for parseEntries
 *
 * These tests verify that parseEntries:
 * 1. Always terminates (no infinite loops from cycles or deep chains)
 * 2. Handles malformed inputs without crashing
 * 3. Maintains basic correctness invariants
 *
 * Written using TDD: tests define expected behavior first.
 */

import { test, expect, describe } from "bun:test";
import * as fc from "fast-check";
import { parseEntries } from "./parser";
import { asSessionId, type Entry, type UserEntry, type AssistantEntry, type SystemEntry } from "./types";

// =============================================================================
// PROPERTY 1: TERMINATION
// parseEntries must always complete in bounded time, regardless of malformed input
// =============================================================================

describe("parseEntries termination properties", () => {
  test("terminates with self-referential entry (A -> A)", () => {
    // A turn that points to itself as parent - should not cause infinite loop
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "self-ref",
        parentUuid: "self-ref", // Points to itself!
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
    ];

    // This should complete without hanging
    const start = Date.now();
    const result = parseEntries(entries);
    const elapsed = Date.now() - start;

    // Should complete in reasonable time (< 100ms for a single entry)
    expect(elapsed).toBeLessThan(100);
    expect(result.turns).toHaveLength(1);
  });

  test("terminates with cyclic parent chain (A -> B -> A)", () => {
    // Two entries that form a cycle
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "A",
        parentUuid: "B", // Points to B
        session_id: "s1",
        message: { role: "user", content: "Entry A" },
      },
      {
        type: "assistant",
        uuid: "B",
        parentUuid: "A", // Points back to A - cycle!
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Entry B" },
      },
    ];

    const start = Date.now();
    const result = parseEntries(entries);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result.turns).toHaveLength(2);
  });

  test("terminates with three-way cycle (A -> B -> C -> A)", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "A",
        parentUuid: "C", // A's parent is C
        session_id: "s1",
        message: { role: "user", content: "Entry A" },
      },
      {
        type: "assistant",
        uuid: "B",
        parentUuid: "A", // B's parent is A
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Entry B" },
      },
      {
        type: "user",
        uuid: "C",
        parentUuid: "B", // C's parent is B -> forms cycle A->C->B->A
        session_id: "s1",
        message: { role: "user", content: "Entry C" },
      },
    ];

    const start = Date.now();
    const result = parseEntries(entries);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result.turns).toHaveLength(3);
  });

  test("terminates with very deep parent chain (1000+ levels)", () => {
    // Generate a deep chain: e0 <- e1 <- e2 <- ... <- e999
    const entries: Entry[] = [];
    const depth = 1000;

    for (let i = 0; i < depth; i++) {
      entries.push({
        type: i % 2 === 0 ? "user" : "assistant",
        uuid: `e${i}`,
        parentUuid: i === 0 ? null : `e${i - 1}`,
        session_id: "s1",
        message:
          i % 2 === 0
            ? { role: "user" as const, content: `Message ${i}` }
            : { role: "assistant" as const, model: "claude", content: `Response ${i}` },
      } as Entry);
    }

    const start = Date.now();
    const result = parseEntries(entries);
    const elapsed = Date.now() - start;

    // Should complete in reasonable time (< 5s for 1000 entries)
    expect(elapsed).toBeLessThan(5000);
    expect(result.turns).toHaveLength(depth);
  });

  test("terminates with null parentUuid", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        parentUuid: null,
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
    ];

    const result = parseEntries(entries);
    expect(result.turns).toHaveLength(1);
  });

  test("terminates with undefined parentUuid", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        // parentUuid is undefined
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
    ];

    const result = parseEntries(entries);
    expect(result.turns).toHaveLength(1);
  });

  test("terminates with missing uuid", () => {
    const entries: Entry[] = [
      {
        type: "user",
        // uuid is missing
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      } as Entry,
    ];

    const result = parseEntries(entries);
    expect(result.turns).toHaveLength(1);
  });

  test("terminates with orphan entries (parentUuid points to non-existent entry)", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        parentUuid: "non-existent-parent",
        session_id: "s1",
        message: { role: "user", content: "Orphan" },
      },
      {
        type: "assistant",
        uuid: "a1",
        parentUuid: "another-non-existent",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Also orphan" },
      },
    ];

    const result = parseEntries(entries);
    expect(result.turns).toHaveLength(2);
  });

  // Property-based test: any generated parent chain structure should terminate
  test("property: random cyclic parent chains always terminate", () => {
    fc.assert(
      fc.property(
        // Generate random entries with potentially cyclic parent relationships
        fc.array(
          fc.record({
            uuid: fc.string({ minLength: 1, maxLength: 10 }),
            parentUuid: fc.oneof(
              fc.constant(null),
              fc.string({ minLength: 1, maxLength: 10 })
            ),
            isUser: fc.boolean(),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (randomEntries) => {
          const entries: Entry[] = randomEntries.map((e, i) => ({
            type: e.isUser ? "user" : "assistant",
            uuid: e.uuid,
            parentUuid: e.parentUuid,
            session_id: "s1",
            message: e.isUser
              ? { role: "user" as const, content: `User ${i}` }
              : { role: "assistant" as const, model: "claude", content: `Assistant ${i}` },
          })) as Entry[];

          const start = Date.now();
          const result = parseEntries(entries);
          const elapsed = Date.now() - start;

          // Must complete within reasonable time
          expect(elapsed).toBeLessThan(1000);
          // Must return a valid result
          expect(result).toBeDefined();
          expect(Array.isArray(result.turns)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// PROPERTY 2: ROBUSTNESS
// parseEntries must handle malformed inputs without crashing
// =============================================================================

describe("parseEntries robustness properties", () => {
  test("handles entries with missing type field", () => {
    const entries = [
      {
        // type is missing
        uuid: "u1",
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
    ] as Entry[];

    // Should not throw
    const result = parseEntries(entries);
    expect(result).toBeDefined();
  });

  test("handles entries with unknown type values", () => {
    const entries = [
      {
        type: "unknown_type_xyz",
        uuid: "u1",
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
      {
        type: "another_unknown",
        uuid: "u2",
        session_id: "s1",
      },
    ] as unknown as Entry[];

    const result = parseEntries(entries);
    expect(result).toBeDefined();
    // Unknown types should be skipped, not crash
    expect(result.turns).toHaveLength(0);
  });

  test("handles entries with missing message field", () => {
    const entries = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        // message is missing
      },
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        // message is missing
      },
    ] as Entry[];

    const result = parseEntries(entries);
    expect(result).toBeDefined();
    // Entries without message should be skipped
    expect(result.turns).toHaveLength(0);
  });

  test("handles entries with null message", () => {
    const entries = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: null,
      },
    ] as unknown as Entry[];

    const result = parseEntries(entries);
    expect(result).toBeDefined();
    expect(result.turns).toHaveLength(0);
  });

  test("handles entries with malformed message.content", () => {
    const entries = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: { invalid: "object" }, // Should be string or array
        },
      },
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: 12345, // Number instead of string/array
        },
      },
    ] as unknown as Entry[];

    const result = parseEntries(entries);
    expect(result).toBeDefined();
    // Should handle gracefully (may produce empty text)
    expect(result.turns.length).toBeGreaterThanOrEqual(0);
  });

  test("handles content array with unknown item types", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            { type: "unknown_content_type", data: "whatever" },
            { type: "another_unknown" },
          ],
        },
      } as unknown as Entry,
    ];

    const result = parseEntries(entries);
    expect(result).toBeDefined();
    expect(result.turns).toHaveLength(1);
    // Should extract the valid text content
    expect(result.turns[0]?.text).toBe("Hello");
  });

  test("handles empty entries array", () => {
    const result = parseEntries([]);
    expect(result).toBeDefined();
    expect(result.turns).toEqual([]);
    expect(result.sessionId).toBe(asSessionId(""));
    expect(result.subagents).toEqual([]);
  });

  test("handles entries with unusual field values", () => {
    const entries = [
      {
        type: "user",
        uuid: "",
        parentUuid: "",
        session_id: "",
        sessionId: "",
        message: {
          role: "user",
          content: "",
        },
      },
    ] as Entry[];

    const result = parseEntries(entries);
    expect(result).toBeDefined();
  });

  // Property-based test: any entry shape should not crash
  test("property: random entry shapes never crash", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            // Valid user entry shape
            fc.record({
              type: fc.constant("user"),
              uuid: fc.option(fc.string(), { nil: undefined }),
              parentUuid: fc.option(fc.string(), { nil: undefined }),
              session_id: fc.option(fc.string(), { nil: undefined }),
              message: fc.option(
                fc.record({
                  role: fc.constant("user"),
                  content: fc.oneof(
                    fc.string(),
                    fc.array(
                      fc.oneof(
                        fc.record({ type: fc.constant("text"), text: fc.string() }),
                        fc.record({
                          type: fc.constant("tool_result"),
                          tool_use_id: fc.string(),
                          content: fc.string(),
                        })
                      )
                    )
                  ),
                }),
                { nil: undefined }
              ),
            }),
            // Valid assistant entry shape
            fc.record({
              type: fc.constant("assistant"),
              uuid: fc.option(fc.string(), { nil: undefined }),
              parentUuid: fc.option(fc.string(), { nil: undefined }),
              session_id: fc.option(fc.string(), { nil: undefined }),
              message: fc.option(
                fc.record({
                  role: fc.constant("assistant"),
                  model: fc.string(),
                  content: fc.oneof(
                    fc.string(),
                    fc.array(
                      fc.oneof(
                        fc.record({ type: fc.constant("text"), text: fc.string() }),
                        fc.record({
                          type: fc.constant("tool_use"),
                          id: fc.string(),
                          name: fc.string(),
                          input: fc.object(),
                        })
                      )
                    )
                  ),
                }),
                { nil: undefined }
              ),
            }),
            // Completely random object (fuzz)
            fc.object()
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (randomEntries) => {
          // Should never throw
          expect(() => parseEntries(randomEntries as Entry[])).not.toThrow();
        }
      ),
      { numRuns: 200 }
    );
  });
});

// =============================================================================
// PROPERTY 3: CORRECTNESS INVARIANTS
// Basic properties that must always hold
// =============================================================================

describe("parseEntries correctness invariants", () => {
  test("invariant: number of turns <= number of entries", () => {
    const entries: Entry[] = [
      {
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: "s1",
        cwd: "/test",
        tools: [],
        model: "claude",
      },
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Hi" },
      },
      {
        type: "result",
        subtype: "success",
        uuid: "r1",
        session_id: "s1",
        result: "Done",
        duration_ms: 1000,
      },
    ];

    const result = parseEntries(entries);

    // Turns should only count user/assistant messages, not system/result
    expect(result.turns.length).toBeLessThanOrEqual(entries.length);
    expect(result.turns.length).toBe(2); // Only user and assistant
  });

  test("invariant: all turns have a valid role", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Hi" },
      },
    ];

    const result = parseEntries(entries);

    for (const turn of result.turns) {
      expect(["user", "assistant"]).toContain(turn.role);
    }
  });

  test("invariant: sessionId is extracted if present", () => {
    const entries: Entry[] = [
      {
        type: "system",
        subtype: "init",
        uuid: "sys1",
        session_id: "test-session-123",
        cwd: "/test",
        tools: [],
        model: "claude",
      },
    ];

    const result = parseEntries(entries);
    expect(result.sessionId).toBe(asSessionId("test-session-123"));
  });

  test("invariant: sessionId extracted from sessionId field (alternate format)", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        sessionId: "alt-session-456",
        message: { role: "user", content: "Hello" },
      } as Entry,
    ];

    const result = parseEntries(entries);
    expect(result.sessionId).toBe(asSessionId("alt-session-456"));
  });

  // Property-based test: turns count never exceeds entry count
  test("property: turns.length <= entries.length", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            // User entries
            fc.record({
              type: fc.constant("user"),
              uuid: fc.string(),
              session_id: fc.string(),
              message: fc.record({
                role: fc.constant("user"),
                content: fc.string(),
              }),
            }),
            // Assistant entries
            fc.record({
              type: fc.constant("assistant"),
              uuid: fc.string(),
              session_id: fc.string(),
              message: fc.record({
                role: fc.constant("assistant"),
                model: fc.string(),
                content: fc.string(),
              }),
            }),
            // System entries (should not become turns)
            fc.record({
              type: fc.constant("system"),
              subtype: fc.constant("init"),
              uuid: fc.string(),
              session_id: fc.string(),
              cwd: fc.string(),
              tools: fc.array(fc.string()),
              model: fc.string(),
            }),
            // Result entries (should not become turns)
            fc.record({
              type: fc.constant("result"),
              subtype: fc.constant("success"),
              uuid: fc.string(),
              session_id: fc.string(),
              result: fc.string(),
              duration_ms: fc.nat(),
            })
          ),
          { minLength: 0, maxLength: 50 }
        ),
        (entries) => {
          const result = parseEntries(entries as Entry[]);
          expect(result.turns.length).toBeLessThanOrEqual(entries.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property-based test: all turns have valid roles
  test("property: all turns have role 'user' or 'assistant'", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({
              type: fc.constant("user"),
              uuid: fc.string(),
              session_id: fc.string(),
              message: fc.record({
                role: fc.constant("user"),
                content: fc.string(),
              }),
            }),
            fc.record({
              type: fc.constant("assistant"),
              uuid: fc.string(),
              session_id: fc.string(),
              message: fc.record({
                role: fc.constant("assistant"),
                model: fc.string(),
                content: fc.string(),
              }),
            })
          ),
          { minLength: 0, maxLength: 30 }
        ),
        (entries) => {
          const result = parseEntries(entries as Entry[]);
          for (const turn of result.turns) {
            expect(["user", "assistant"]).toContain(turn.role);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// REGRESSION TESTS
// Specific cases that previously caused issues
// =============================================================================

describe("parseEntries regression tests", () => {
  test("regression: Claude Code 2.1.27+ hook entries can form cycles", () => {
    // This is the actual bug scenario: progress/saved_hook_context entries
    // can create cycles in the parent chain that caused infinite loops
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        parentUuid: null,
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
      {
        type: "assistant",
        uuid: "a1",
        parentUuid: "u1",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Hi" },
      },
      // System entry that creates a cycle
      {
        type: "system",
        subtype: "init",
        uuid: "hook1",
        parentUuid: "u2", // Points forward to u2 (which doesn't exist yet)
        session_id: "s1",
        cwd: "/test",
        tools: [],
        model: "claude",
      },
      {
        type: "user",
        uuid: "u2",
        parentUuid: "hook1", // Points back to hook1 - cycle!
        session_id: "s1",
        message: { role: "user", content: "Continue" },
      },
    ];

    const start = Date.now();
    const result = parseEntries(entries);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result.turns.length).toBeGreaterThanOrEqual(2);
  });

  test("regression: multiple disconnected cycles", () => {
    // Multiple independent cycles in the same session
    const entries: Entry[] = [
      // Cycle 1: A <-> B
      {
        type: "user",
        uuid: "A",
        parentUuid: "B",
        session_id: "s1",
        message: { role: "user", content: "A" },
      },
      {
        type: "assistant",
        uuid: "B",
        parentUuid: "A",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "B" },
      },
      // Cycle 2: C <-> D
      {
        type: "user",
        uuid: "C",
        parentUuid: "D",
        session_id: "s1",
        message: { role: "user", content: "C" },
      },
      {
        type: "assistant",
        uuid: "D",
        parentUuid: "C",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "D" },
      },
    ];

    const start = Date.now();
    const result = parseEntries(entries);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result.turns).toHaveLength(4);
  });

  test("regression: cycle at the end of a long chain", () => {
    // Long chain followed by a cycle at the end
    const entries: Entry[] = [];

    // Build a long linear chain
    for (let i = 0; i < 100; i++) {
      entries.push({
        type: i % 2 === 0 ? "user" : "assistant",
        uuid: `e${i}`,
        parentUuid: i === 0 ? null : `e${i - 1}`,
        session_id: "s1",
        message:
          i % 2 === 0
            ? { role: "user" as const, content: `User ${i}` }
            : { role: "assistant" as const, model: "claude", content: `Assistant ${i}` },
      } as Entry);
    }

    // Add a cycle at the end
    entries.push({
      type: "user",
      uuid: "cycle1",
      parentUuid: "cycle2", // Forward reference
      session_id: "s1",
      message: { role: "user", content: "Cycle start" },
    });
    entries.push({
      type: "assistant",
      uuid: "cycle2",
      parentUuid: "cycle1", // Back reference - cycle!
      session_id: "s1",
      message: { role: "assistant", model: "claude", content: "Cycle end" },
    });

    const start = Date.now();
    const result = parseEntries(entries);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(result.turns).toHaveLength(102);
  });
});

// =============================================================================
// EDGE CASES
// Boundary conditions and unusual inputs
// =============================================================================

describe("parseEntries edge cases", () => {
  test("handles very long text content", () => {
    const longText = "x".repeat(1_000_000); // 1MB of text
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: { role: "user", content: longText },
      },
    ];

    const start = Date.now();
    const result = parseEntries(entries);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(result.turns).toHaveLength(1);
    expect(result.turns[0]?.text).toBe(longText);
  });

  test("handles entries with very long UUIDs", () => {
    const longUuid = "u".repeat(10000);
    const entries: Entry[] = [
      {
        type: "user",
        uuid: longUuid,
        parentUuid: longUuid, // Self-reference with long UUID
        session_id: "s1",
        message: { role: "user", content: "Hello" },
      },
    ];

    const result = parseEntries(entries);
    expect(result.turns).toHaveLength(1);
  });

  test("handles unicode in UUIDs and content", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "uuid-\u{1F600}-emoji", // Emoji in UUID
        parentUuid: null,
        session_id: "session-\u4E2D\u6587", // Chinese characters
        message: { role: "user", content: "Hello \u{1F44B} World \u{1F30D}" },
      },
    ];

    const result = parseEntries(entries);
    expect(result.turns).toHaveLength(1);
    expect(result.turns[0]?.text).toContain("\u{1F44B}");
  });

  test("handles mixed valid and invalid entries", () => {
    const entries = [
      // Valid entry
      {
        type: "user",
        uuid: "u1",
        session_id: "s1",
        message: { role: "user", content: "Valid" },
      },
      // Invalid - no message
      {
        type: "user",
        uuid: "u2",
        session_id: "s1",
      },
      // Invalid - unknown type
      {
        type: "garbage",
        uuid: "u3",
      },
      // Valid entry
      {
        type: "assistant",
        uuid: "a1",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Also valid" },
      },
      // Invalid - null message
      {
        type: "user",
        uuid: "u4",
        session_id: "s1",
        message: null,
      },
    ] as Entry[];

    const result = parseEntries(entries);
    // Should only parse the 2 valid entries
    expect(result.turns).toHaveLength(2);
    expect(result.turns[0]?.text).toBe("Valid");
    expect(result.turns[1]?.text).toBe("Also valid");
  });

  test("handles entries array with duplicate UUIDs", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "duplicate",
        parentUuid: null,
        session_id: "s1",
        message: { role: "user", content: "First" },
      },
      {
        type: "assistant",
        uuid: "duplicate", // Same UUID!
        parentUuid: "duplicate",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Second" },
      },
      {
        type: "user",
        uuid: "duplicate", // Same UUID again!
        parentUuid: "duplicate",
        session_id: "s1",
        message: { role: "user", content: "Third" },
      },
    ];

    // Should not crash, even with duplicates
    const result = parseEntries(entries);
    expect(result.turns).toHaveLength(3);
  });
});
