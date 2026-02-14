/**
 * Tests for auto-compaction detection in the session parser.
 *
 * Auto-compaction creates two entries in the JSONL:
 * 1. A system/compact_boundary entry with metadata (trigger, preTokens, etc.)
 * 2. A user message immediately after with the compaction summary
 *
 * The parser should:
 * - Detect compact_boundary entries and extract CompactionEvent data
 * - Tag the following user message with isCompactionSummary: true
 * - Preserve backwards compatibility (sessions without compactions work identically)
 */

import { test, expect, describe } from "bun:test";
import { parseEntries } from "./parser";
import type { Entry } from "./types";
import {
  systemEntry,
  userEntry,
  assistantEntry,
  resultEntry,
  compactBoundaryEntry,
} from "./testing";

// ============================================================================
// COMPACTION SUMMARY HELPER
// ============================================================================

const COMPACTION_SUMMARY_TEXT =
  "This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier discussion...";

/**
 * Creates a compaction summary user entry — the user message that
 * immediately follows a compact_boundary and contains the AI-generated
 * recap of the pre-compaction context.
 */
function compactionSummaryEntry(
  uuid: string,
  parentBoundaryUuid: string,
  options: { sessionId?: string; timestamp?: string } = {}
): Entry {
  return userEntry(uuid, COMPACTION_SUMMARY_TEXT, {
    parentUuid: parentBoundaryUuid,
    sessionId: options.sessionId ?? "test-session",
    timestamp: options.timestamp,
  });
}

// ============================================================================
// BASIC DETECTION
// ============================================================================

describe("compaction detection", () => {
  test("detects a single compact_boundary entry", () => {
    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Hi there!", { parentUuid: "u1" }),
      compactBoundaryEntry("cb1", { logicalParentUuid: "a1" }),
      compactionSummaryEntry("u2", "cb1"),
      assistantEntry("a2", "Continuing after compaction", { parentUuid: "u2" }),
    ];

    const result = parseEntries(entries);

    expect(result.compactions).toHaveLength(1);
    expect(result.compactions[0]!.boundaryUuid).toBe("cb1");
  });

  test("detects multiple compact_boundary entries", () => {
    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Response 1", { parentUuid: "u1" }),
      // First compaction
      compactBoundaryEntry("cb1", {
        logicalParentUuid: "a1",
        timestamp: "2026-02-13T14:00:00.000Z",
      }),
      compactionSummaryEntry("u2", "cb1"),
      assistantEntry("a2", "After first compaction", { parentUuid: "u2" }),
      // Second compaction
      compactBoundaryEntry("cb2", {
        logicalParentUuid: "a2",
        timestamp: "2026-02-13T16:00:00.000Z",
      }),
      compactionSummaryEntry("u3", "cb2"),
      assistantEntry("a3", "After second compaction", { parentUuid: "u3" }),
    ];

    const result = parseEntries(entries);

    expect(result.compactions).toHaveLength(2);
    expect(result.compactions[0]!.boundaryUuid).toBe("cb1");
    expect(result.compactions[1]!.boundaryUuid).toBe("cb2");
  });

  test("returns empty compactions array when none exist", () => {
    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Hi there!", { parentUuid: "u1" }),
    ];

    const result = parseEntries(entries);

    expect(result.compactions).toEqual([]);
  });
});

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

describe("compaction metadata extraction", () => {
  test("extracts trigger type", () => {
    const entries: Entry[] = [
      compactBoundaryEntry("cb1", { trigger: "auto" }),
      compactionSummaryEntry("u1", "cb1"),
    ];

    const result = parseEntries(entries);

    expect(result.compactions[0]!.trigger).toBe("auto");
  });

  test("extracts preTokens count", () => {
    const entries: Entry[] = [
      compactBoundaryEntry("cb1", { preTokens: 172646 }),
      compactionSummaryEntry("u1", "cb1"),
    ];

    const result = parseEntries(entries);

    expect(result.compactions[0]!.preTokens).toBe(172646);
  });

  test("extracts timestamp", () => {
    const entries: Entry[] = [
      compactBoundaryEntry("cb1", {
        timestamp: "2026-02-13T14:55:14.557Z",
      }),
      compactionSummaryEntry("u1", "cb1"),
    ];

    const result = parseEntries(entries);

    expect(result.compactions[0]!.timestamp).toBe("2026-02-13T14:55:14.557Z");
  });

  test("extracts logicalParentUuid", () => {
    const entries: Entry[] = [
      compactBoundaryEntry("cb1", {
        logicalParentUuid: "last-pre-compact",
      }),
      compactionSummaryEntry("u1", "cb1"),
    ];

    const result = parseEntries(entries);

    expect(result.compactions[0]!.logicalParentUuid).toBe("last-pre-compact");
  });

  test("extracts boundaryUuid from the compact_boundary entry uuid", () => {
    const entries: Entry[] = [
      compactBoundaryEntry("50de44cf-e6b1-4fb3-80be-55468ec261b3"),
      compactionSummaryEntry("u1", "50de44cf-e6b1-4fb3-80be-55468ec261b3"),
    ];

    const result = parseEntries(entries);

    expect(result.compactions[0]!.boundaryUuid).toBe(
      "50de44cf-e6b1-4fb3-80be-55468ec261b3"
    );
  });

  test("captures summaryMessageUuid from the following user message", () => {
    const entries: Entry[] = [
      compactBoundaryEntry("cb1"),
      compactionSummaryEntry("summary-msg-001", "cb1"),
    ];

    const result = parseEntries(entries);

    expect(result.compactions[0]!.summaryMessageUuid).toBe("summary-msg-001");
  });
});

// ============================================================================
// COMPACTION SUMMARY TAGGING
// ============================================================================

describe("compaction summary tagging", () => {
  test("tags the user message after compact_boundary as compaction summary", () => {
    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Response", { parentUuid: "u1" }),
      compactBoundaryEntry("cb1", { logicalParentUuid: "a1" }),
      compactionSummaryEntry("u2", "cb1"),
      assistantEntry("a2", "Continuing", { parentUuid: "u2" }),
    ];

    const result = parseEntries(entries);

    // u1 is a normal user message
    const u1Turn = result.turns.find((t) => t.uuid === "u1");
    expect(u1Turn?.isCompactionSummary).toBeUndefined();

    // u2 is the compaction summary
    const u2Turn = result.turns.find((t) => t.uuid === "u2");
    expect(u2Turn?.isCompactionSummary).toBe(true);
  });

  test("tags multiple compaction summaries correctly", () => {
    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Response 1", { parentUuid: "u1" }),
      compactBoundaryEntry("cb1", { logicalParentUuid: "a1" }),
      compactionSummaryEntry("u2", "cb1"),
      assistantEntry("a2", "After first compaction", { parentUuid: "u2" }),
      userEntry("u3", "Another question", { parentUuid: "a2" }),
      assistantEntry("a3", "Another answer", { parentUuid: "u3" }),
      compactBoundaryEntry("cb2", { logicalParentUuid: "a3" }),
      compactionSummaryEntry("u4", "cb2"),
      assistantEntry("a4", "After second compaction", { parentUuid: "u4" }),
    ];

    const result = parseEntries(entries);

    // Regular user messages
    expect(result.turns.find((t) => t.uuid === "u1")?.isCompactionSummary).toBeUndefined();
    expect(result.turns.find((t) => t.uuid === "u3")?.isCompactionSummary).toBeUndefined();

    // Compaction summaries
    expect(result.turns.find((t) => t.uuid === "u2")?.isCompactionSummary).toBe(true);
    expect(result.turns.find((t) => t.uuid === "u4")?.isCompactionSummary).toBe(true);
  });

  test("does not tag user messages that are not compaction summaries", () => {
    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Hi!", { parentUuid: "u1" }),
      userEntry("u2", "Follow-up question", { parentUuid: "a1" }),
      assistantEntry("a2", "Answer", { parentUuid: "u2" }),
    ];

    const result = parseEntries(entries);

    for (const turn of result.turns) {
      if (turn.role === "user") {
        expect(turn.isCompactionSummary).toBeUndefined();
      }
    }
  });
});

// ============================================================================
// BACKWARDS COMPATIBILITY
// ============================================================================

describe("backwards compatibility", () => {
  test("sessions without compactions produce identical results", () => {
    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Hi there!", { parentUuid: "u1" }),
      resultEntry("r1", "Done", { durationMs: 5000 }),
    ];

    const result = parseEntries(entries);

    expect(result.compactions).toEqual([]);
    expect(result.turns).toHaveLength(2);
    expect(result.turns[0]?.role).toBe("user");
    expect(result.turns[0]?.text).toBe("Hello");
    expect(result.turns[1]?.role).toBe("assistant");
    expect(result.turns[1]?.text).toBe("Hi there!");
    expect(result.result?.success).toBe(true);
  });

  test("existing session fields are preserved when compactions exist", () => {
    const entries: Entry[] = [
      systemEntry("sys", { tools: ["Read", "Write"], model: "claude-sonnet" }),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Response", { parentUuid: "u1" }),
      compactBoundaryEntry("cb1", { logicalParentUuid: "a1" }),
      compactionSummaryEntry("u2", "cb1"),
      assistantEntry("a2", "After compaction", {
        parentUuid: "u2",
        toolCalls: [{ id: "t1", name: "Skill", input: { skill: "writing-specs" } }],
      }),
      resultEntry("r1", "Done", { durationMs: 10000, costUsd: 0.50 }),
    ];

    const result = parseEntries(entries);

    // Session metadata preserved
    expect(result.model).toBe("claude-sonnet");
    expect(result.tools).toEqual(["Read", "Write"]);

    // Turns preserved (user messages + assistant messages)
    expect(result.turns).toHaveLength(4); // u1, a1, u2, a2

    // Skills still detected
    expect(result.triggeredSkills).toContain("writing-specs");

    // Result preserved
    expect(result.result?.success).toBe(true);
    expect(result.result?.costUsd).toBe(0.50);

    // Compactions also tracked
    expect(result.compactions).toHaveLength(1);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("compaction edge cases", () => {
  test("handles compact_boundary at the very end of entries (no following user message)", () => {
    // Unlikely but defensive: compact_boundary with no following user message
    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Response", { parentUuid: "u1" }),
      compactBoundaryEntry("cb1", { logicalParentUuid: "a1" }),
    ];

    const result = parseEntries(entries);

    // Compaction should still be detected
    expect(result.compactions).toHaveLength(1);
    expect(result.compactions[0]!.boundaryUuid).toBe("cb1");
    // But no summary message uuid since there's no following user message
    expect(result.compactions[0]!.summaryMessageUuid).toBeUndefined();
  });

  test("compact_boundary uuid tracked in allEntryParents for rewind detection", () => {
    // Compact boundary entries have parentUuid: null, which starts a new root.
    // This should be tracked correctly in the parent chain.
    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello", { parentUuid: null }),
      assistantEntry("a1", "Response", { parentUuid: "u1" }),
      compactBoundaryEntry("cb1", { logicalParentUuid: "a1" }),
      compactionSummaryEntry("u2", "cb1"),
      assistantEntry("a2", "After compaction", { parentUuid: "u2" }),
    ];

    const result = parseEntries(entries);

    // Should not produce false rewinds from the null parentUuid on compact_boundary
    expect(result.rewinds).toEqual([]);
  });

  test("timestamps from compact_boundary contribute to session time range", () => {
    const entries: Entry[] = [
      systemEntry("sys", { sessionId: "s1" }),
      userEntry("u1", "Hello", { timestamp: "2026-02-13T10:00:00.000Z" }),
      assistantEntry("a1", "Hi", { timestamp: "2026-02-13T10:01:00.000Z" }),
      compactBoundaryEntry("cb1", {
        timestamp: "2026-02-13T14:55:14.557Z",
      }),
      compactionSummaryEntry("u2", "cb1", {
        timestamp: "2026-02-13T14:55:15.000Z",
      }),
      assistantEntry("a2", "Continuing", { timestamp: "2026-02-13T14:56:00.000Z" }),
    ];

    const result = parseEntries(entries);

    expect(result.startTimestamp).toBe("2026-02-13T10:00:00.000Z");
    expect(result.endTimestamp).toBe("2026-02-13T14:56:00.000Z");
  });

  test("handles compact_boundary with malformed compactMetadata gracefully", () => {
    // compactMetadata has missing trigger and a non-number preTokens.
    // The parser should not crash — trigger falls back to "unknown" via ??,
    // and the non-number preTokens passes through (it's not undefined, so ?? doesn't fire).
    const malformedBoundary = {
      type: "system",
      subtype: "compact_boundary",
      uuid: "cb-malformed",
      parentUuid: null,
      session_id: "test-session",
      timestamp: "2026-02-13T14:55:00.000Z",
      logicalParentUuid: "a1",
      compactMetadata: {
        // trigger missing entirely — should fall back to "unknown"
        preTokens: "not-a-number", // wrong type, but parser doesn't validate
      },
      content: "Conversation compacted",
      level: "info",
    } as unknown as Entry;

    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Response", { parentUuid: "u1" }),
      malformedBoundary,
      compactionSummaryEntry("u2", "cb-malformed"),
    ];

    const result = parseEntries(entries);

    // Compaction should still be detected (doesn't crash on malformed data)
    expect(result.compactions).toHaveLength(1);
    expect(result.compactions[0]!.trigger).toBe("unknown");
    // The summary message should still be linked
    expect(result.compactions[0]!.summaryMessageUuid).toBe("u2");
  });

  test("handles compact_boundary with undefined preTokens and trigger", () => {
    // When metadata fields are undefined, the ?? fallback should fire.
    const sparseMetaBoundary = {
      type: "system",
      subtype: "compact_boundary",
      uuid: "cb-sparse",
      parentUuid: null,
      session_id: "test-session",
      timestamp: "2026-02-13T14:55:00.000Z",
      logicalParentUuid: "a1",
      compactMetadata: {}, // both trigger and preTokens missing
      content: "Conversation compacted",
      level: "info",
    } as unknown as Entry;

    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Response", { parentUuid: "u1" }),
      sparseMetaBoundary,
      compactionSummaryEntry("u2", "cb-sparse"),
    ];

    const result = parseEntries(entries);

    expect(result.compactions).toHaveLength(1);
    expect(result.compactions[0]!.trigger).toBe("unknown");
    expect(result.compactions[0]!.preTokens).toBe(0);
  });

  test("handles compact_boundary with no uuid gracefully", () => {
    // A compact_boundary entry without a uuid should be silently skipped
    // (the parser requires boundaryUuid to be truthy).
    const noUuidBoundary = {
      type: "system",
      subtype: "compact_boundary",
      // uuid intentionally omitted
      parentUuid: null,
      session_id: "test-session",
      timestamp: "2026-02-13T14:55:00.000Z",
      logicalParentUuid: "a1",
      compactMetadata: { trigger: "auto", preTokens: 170000 },
    } as unknown as Entry;

    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Response", { parentUuid: "u1" }),
      noUuidBoundary,
      userEntry("u2", "Continue", { parentUuid: "a1" }),
    ];

    const result = parseEntries(entries);

    // No compaction detected since the boundary had no uuid
    expect(result.compactions).toEqual([]);
    // The user message after should NOT be tagged as a compaction summary
    const u2 = result.turns.find((t) => t.uuid === "u2");
    expect(u2?.isCompactionSummary).toBeUndefined();
  });

  test("handles compact_boundary with missing compactMetadata entirely", () => {
    // compactMetadata is undefined — parser should still create a compaction
    // event with fallback defaults.
    const nometaBoundary = {
      type: "system",
      subtype: "compact_boundary",
      uuid: "cb-nometa",
      parentUuid: null,
      session_id: "test-session",
      timestamp: "2026-02-13T14:55:00.000Z",
      logicalParentUuid: "a1",
      // compactMetadata intentionally omitted
    } as unknown as Entry;

    const entries: Entry[] = [
      systemEntry(),
      userEntry("u1", "Hello"),
      assistantEntry("a1", "Response", { parentUuid: "u1" }),
      nometaBoundary,
      compactionSummaryEntry("u2", "cb-nometa"),
    ];

    const result = parseEntries(entries);

    expect(result.compactions).toHaveLength(1);
    expect(result.compactions[0]!.trigger).toBe("unknown");
    expect(result.compactions[0]!.preTokens).toBe(0);
    expect(result.compactions[0]!.boundaryUuid).toBe("cb-nometa");
  });
});
