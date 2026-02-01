import { test, expect, describe } from "bun:test";
import { parseEntries } from "./parser";
import { asSessionId, asEntryUuid, type Entry } from "./types";

describe("rewind detection", () => {
  test("detects linear conversation with no rewinds", () => {
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
        message: { role: "assistant", model: "claude", content: "Hi there" },
      },
      {
        type: "user",
        uuid: "u2",
        parentUuid: "a1",
        session_id: "s1",
        message: { role: "user", content: "How are you?" },
      },
      {
        type: "assistant",
        uuid: "a2",
        parentUuid: "u2",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "I'm good!" },
      },
    ];

    const result = parseEntries(entries);

    expect(result.rewinds).toEqual([]);
    expect(result.turns.every((t) => t.isOnCurrentBranch)).toBe(true);
  });

  test("detects rewind when parentUuid jumps back", () => {
    const entries: Entry[] = [
      // Initial conversation
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
        message: { role: "assistant", model: "claude", content: "Hi there" },
      },
      {
        type: "user",
        uuid: "u2",
        parentUuid: "a1",
        session_id: "s1",
        message: { role: "user", content: "What is 2+2?" },
      },
      {
        type: "assistant",
        uuid: "a2",
        parentUuid: "u2",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "4" },
      },
      // REWIND: new message points back to a1, not a2
      {
        type: "user",
        uuid: "u3",
        parentUuid: "a1", // <-- rewind point
        session_id: "s1",
        message: { role: "user", content: "What is 3+3?" },
      },
      {
        type: "assistant",
        uuid: "a3",
        parentUuid: "u3",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "6" },
      },
    ];

    const result = parseEntries(entries);

    // Should detect one rewind
    expect(result.rewinds).toHaveLength(1);
    expect(result.rewinds[0]).toEqual({
      fromUuid: asEntryUuid("a1"),
      abandonedBranchUuids: [asEntryUuid("u2"), asEntryUuid("a2")],
    });

    // Abandoned branch messages should be marked
    const u2Turn = result.turns.find((t) => t.uuid === "u2");
    const a2Turn = result.turns.find((t) => t.uuid === "a2");
    expect(u2Turn?.isOnCurrentBranch).toBe(false);
    expect(a2Turn?.isOnCurrentBranch).toBe(false);

    // Current branch messages should be marked
    const u3Turn = result.turns.find((t) => t.uuid === "u3");
    const a3Turn = result.turns.find((t) => t.uuid === "a3");
    expect(u3Turn?.isOnCurrentBranch).toBe(true);
    expect(a3Turn?.isOnCurrentBranch).toBe(true);
  });

  test("handles multiple rewinds", () => {
    const entries: Entry[] = [
      {
        type: "user",
        uuid: "u1",
        parentUuid: null,
        session_id: "s1",
        message: { role: "user", content: "Start" },
      },
      {
        type: "assistant",
        uuid: "a1",
        parentUuid: "u1",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Response 1" },
      },
      // First branch (abandoned)
      {
        type: "user",
        uuid: "u2",
        parentUuid: "a1",
        session_id: "s1",
        message: { role: "user", content: "Branch 1" },
      },
      {
        type: "assistant",
        uuid: "a2",
        parentUuid: "u2",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Branch 1 response" },
      },
      // First rewind
      {
        type: "user",
        uuid: "u3",
        parentUuid: "a1",
        session_id: "s1",
        message: { role: "user", content: "Branch 2" },
      },
      {
        type: "assistant",
        uuid: "a3",
        parentUuid: "u3",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Branch 2 response" },
      },
      // Second branch continued then abandoned
      {
        type: "user",
        uuid: "u4",
        parentUuid: "a3",
        session_id: "s1",
        message: { role: "user", content: "Continue branch 2" },
      },
      // Second rewind - back to a3
      {
        type: "user",
        uuid: "u5",
        parentUuid: "a3",
        session_id: "s1",
        message: { role: "user", content: "Branch 3" },
      },
      {
        type: "assistant",
        uuid: "a5",
        parentUuid: "u5",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Final response" },
      },
    ];

    const result = parseEntries(entries);

    expect(result.rewinds).toHaveLength(2);

    // First branch (u2, a2) should not be on current branch
    expect(result.turns.find((t) => t.uuid === "u2")?.isOnCurrentBranch).toBe(false);
    expect(result.turns.find((t) => t.uuid === "a2")?.isOnCurrentBranch).toBe(false);

    // u4 should not be on current branch (abandoned in second rewind)
    expect(result.turns.find((t) => t.uuid === "u4")?.isOnCurrentBranch).toBe(false);

    // Current branch: u1, a1, u3, a3, u5, a5
    expect(result.turns.find((t) => t.uuid === "u1")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "a1")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "u3")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "a3")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "u5")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "a5")?.isOnCurrentBranch).toBe(true);
  });

  test("handles entries without parentUuid (legacy format)", () => {
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

    // Should work without errors, assume linear
    expect(result.rewinds).toEqual([]);
    expect(result.turns.every((t) => t.isOnCurrentBranch)).toBe(true);
  });

  test("handles cycles in parent chain without hanging", () => {
    // This reproduces a bug found in Claude Code 2.1.27+ where new entry types
    // (progress, saved_hook_context) can form cycles in the parent chain.
    // The parser must detect cycles and break instead of looping forever.
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
      // Simulate a progress entry that creates a cycle: a1 -> hook1 -> a1
      {
        type: "system",
        subtype: "init",
        uuid: "hook1",
        parentUuid: "a1",
        session_id: "s1",
        cwd: "/test",
        tools: [],
        model: "claude",
      } as Entry,
      {
        type: "user",
        uuid: "u2",
        parentUuid: "hook1",
        session_id: "s1",
        message: { role: "user", content: "Continue" },
      },
      {
        type: "assistant",
        uuid: "a2",
        parentUuid: "u2",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Ok" },
      },
    ];

    // Add a cycle: make hook1's parent point to a2 (which descends from hook1)
    // This creates: a2 -> u2 -> hook1 -> a2 (cycle!)
    (entries[2] as any).parentUuid = "a2";

    // This should complete without hanging (timeout would indicate failure)
    const result = parseEntries(entries);

    // Basic sanity check - we parsed the turns
    expect(result.turns).toHaveLength(4);
    // The parser should handle the cycle gracefully
    expect(result.sessionId).toBe(asSessionId("s1"));
  });
});
