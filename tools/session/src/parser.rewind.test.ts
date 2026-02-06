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

  test("detects rewind through intermediate progress entry", () => {
    // This test demonstrates a bug (ENG-1412): detectRewinds() only looks at
    // turn-to-turn parent relationships, missing branches through progress entries.
    //
    // Scenario:
    //   u1 → a1 → p1 (progress, parent=a1) → u2 → a2 [abandoned branch]
    //        ↘ u3 (parent=a1) → a3 [current branch]
    //
    // The abandoned branch goes through a progress entry (u2's parent is p1),
    // while the current branch goes directly from a1 (u3's parent is a1).
    //
    // detectRewinds() builds childrenMap from turns only:
    //   - a1's turn children: [u3] (u2's parent is p1, not a1)
    //   - p1's turn children: [u2]
    //
    // Since a1 has only one turn child (u3), no rewind is detected.
    // But conceptually, both branches diverge from a1 - the path a1→p1→u2
    // and the path a1→u3 both branch from a1.
    //
    // findCurrentBranch() correctly uses allEntryParents (which includes p1)
    // to walk back from a3 and mark u2/a2 as not on current branch.

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
      // Progress entry (e.g., from a hook) - part of the abandoned branch
      {
        type: "progress",
        uuid: "p1",
        parentUuid: "a1", // Links to assistant
        sessionId: "s1",
        message: { role: "assistant", content: "Hook progress..." },
      } as Entry,
      // First branch through progress entry (will be abandoned)
      {
        type: "user",
        uuid: "u2",
        parentUuid: "p1", // Parent is progress entry, not a turn!
        session_id: "s1",
        message: { role: "user", content: "Continue from hook" },
      },
      {
        type: "assistant",
        uuid: "a2",
        parentUuid: "u2",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Response on first branch" },
      },
      // REWIND: new message branches directly from a1, bypassing the progress entry
      {
        type: "user",
        uuid: "u3",
        parentUuid: "a1", // Direct parent to assistant, not through progress
        session_id: "s1",
        message: { role: "user", content: "Actually, let me try something else" },
      },
      {
        type: "assistant",
        uuid: "a3",
        parentUuid: "u3",
        session_id: "s1",
        message: { role: "assistant", model: "claude", content: "Response on current branch" },
      },
    ];

    const result = parseEntries(entries);

    // Verify isOnCurrentBranch is correctly set (findCurrentBranch works)
    // This proves the current branch detection is correct
    expect(result.turns.find((t) => t.uuid === "u1")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "a1")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "u3")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "a3")?.isOnCurrentBranch).toBe(true);
    // Abandoned branch should be marked correctly
    expect(result.turns.find((t) => t.uuid === "u2")?.isOnCurrentBranch).toBe(false);
    expect(result.turns.find((t) => t.uuid === "a2")?.isOnCurrentBranch).toBe(false);

    // BUG: detectRewinds() should find the branch point
    // Both branches ultimately diverge from a1 (one through p1, one direct)
    // It should report that u2, a2 are on an abandoned branch
    // Currently this FAILS because detectRewinds only sees a1 → u3, not a1 → p1 → u2
    expect(result.rewinds).toHaveLength(1);
    expect(result.rewinds[0]?.abandonedBranchUuids).toContain(asEntryUuid("u2"));
    expect(result.rewinds[0]?.abandonedBranchUuids).toContain(asEntryUuid("a2"));
  });

  test("does not flag hook-injected assistant between tool dispatch and result as rewind", () => {
    // When a hook fires between an assistant's tool dispatch and the tool result
    // coming back, a progress entry and a hook-injected assistant appear in the
    // parent chain. This is normal linear flow, not a rewind.
    //
    // The entry tree looks like:
    //
    //   u0 → a1 (tool_use T1)
    //           ├─ p1 (progress, hook_progress, parent=a1)
    //           │    └─ a2 (hook-injected assistant, tool_use T2, parent=p1)
    //           │         └─ u2 (tool_result for T2, parent=a2)
    //           └─ u1 (tool_result for T1, parent=a1)
    //                └─ a3 (next real assistant turn, parent=u1)
    //
    // The algorithm resolves nearest turn ancestors:
    //   - a2's ancestor: p1 (non-turn) → a1 (turn) = a1
    //   - u1's ancestor: a1 (turn) = a1
    //
    // So a1 gets two turn children (a2 and u1), which looks like a rewind
    // but is actually normal hook-injected flow.

    const entries: Entry[] = [
      // Initial user message
      {
        type: "user",
        uuid: "u0",
        parentUuid: null,
        session_id: "s1",
        message: { role: "user", content: "Read a file for me" },
      },
      // Assistant dispatches a tool call
      {
        type: "assistant",
        uuid: "a1",
        parentUuid: "u0",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            { type: "text", text: "Let me read that file" },
            {
              type: "tool_use",
              id: "t1",
              name: "Read",
              input: { file_path: "/src/main.ts" },
            },
          ],
        },
      },
      // Hook fires, producing a progress entry
      {
        type: "progress",
        uuid: "p1",
        parentUuid: "a1",
        sessionId: "s1",
        data: { type: "hook_progress" },
        message: { role: "assistant", content: "Hook running..." },
      } as Entry,
      // Hook-injected assistant entry (e.g., a pre-tool hook running its own tool)
      {
        type: "assistant",
        uuid: "a2",
        parentUuid: "p1",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: [
            {
              type: "tool_use",
              id: "t2",
              name: "Bash",
              input: { command: "echo hook" },
            },
          ],
        },
      },
      // Tool result for the hook-injected assistant's tool
      {
        type: "user",
        uuid: "u2",
        parentUuid: "a2",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "t2",
              content: "hook",
              is_error: false,
            },
          ],
        },
      },
      // Real tool result for the original assistant's tool (parent is a1, not a2)
      {
        type: "user",
        uuid: "u1",
        parentUuid: "a1",
        session_id: "s1",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "t1",
              content: "file contents here",
              is_error: false,
            },
          ],
        },
      },
      // Conversation continues normally from the real tool result
      {
        type: "assistant",
        uuid: "a3",
        parentUuid: "u1",
        session_id: "s1",
        message: {
          role: "assistant",
          model: "claude",
          content: "Here is what I found in the file.",
        },
      },
    ];

    const result = parseEntries(entries);

    // This is NOT a rewind - it's normal hook-injected flow.
    // The algorithm should recognize that the hook subtree (p1 → a2 → u2)
    // is not an abandoned branch, just a hook insertion.
    expect(result.rewinds).toHaveLength(0);

    // All turns on the main conversation path should be on the current branch
    expect(result.turns.find((t) => t.uuid === "u0")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "a1")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "u1")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "a3")?.isOnCurrentBranch).toBe(true);

    // Hook-injected turns should also be on the current branch (they're part
    // of normal flow, not an abandoned rewind branch)
    expect(result.turns.find((t) => t.uuid === "a2")?.isOnCurrentBranch).toBe(true);
    expect(result.turns.find((t) => t.uuid === "u2")?.isOnCurrentBranch).toBe(true);
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
