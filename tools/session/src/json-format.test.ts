import { test, expect, describe } from "bun:test";
import { buildJsonOutput } from "./json-format";
import {
  makeSession,
  userTurn,
  assistantTurn,
  toolCall,
  toolResult,
} from "./testing";
import { TEST_SESSION_ID, TEST_MODEL, TEST_CWD } from "./testing";

describe("buildJsonOutput", () => {
  test("includes turns array with correct length", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi there!"),
        userTurn("u2", "How are you?"),
      ],
    });

    const json = buildJsonOutput(session, 500);

    expect(json.turns).toBeArray();
    expect(json.turns).toHaveLength(3);
  });

  test("each turn has expected fields", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello", { timestamp: "2025-01-15T10:00:00Z" }),
        assistantTurn("a1", "Hi!", {
          timestamp: "2025-01-15T10:01:00Z",
          toolCalls: [toolCall("t1", "Read", { file_path: "/src/index.ts" })],
        }),
      ],
    });

    const json = buildJsonOutput(session, 500);

    const turn0 = json.turns[0];
    expect(turn0.role).toBe("user");
    expect(turn0.text).toBe("Hello");
    expect(turn0.timestamp).toBe("2025-01-15T10:00:00Z");
    expect(turn0.index).toBe(0);
    expect(turn0.toolCalls).toBeArray();
    expect(turn0.toolResults).toBeArray();
    expect(turn0.isOnCurrentBranch).toBe(true);

    const turn1 = json.turns[1];
    expect(turn1.role).toBe("assistant");
    expect(turn1.text).toBe("Hi!");
    expect(turn1.index).toBe(1);
    expect(turn1.toolCalls).toHaveLength(1);
  });

  test("tool calls include input", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "Let me read that", {
          toolCalls: [
            toolCall("t1", "Read", { file_path: "/src/app.ts", offset: 10 }),
          ],
        }),
      ],
    });

    const json = buildJsonOutput(session, 500);

    const tc = json.turns[0].toolCalls[0];
    expect(tc.id).toBe("t1");
    expect(tc.name).toBe("Read");
    expect(tc.input).toEqual({ file_path: "/src/app.ts", offset: 10 });
  });

  test("tool results include content and isError", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "", {
          toolResults: [
            toolResult("t1", "file contents here"),
            toolResult("t2", "File not found", true),
          ],
        }),
      ],
    });

    const json = buildJsonOutput(session, 500);

    const tr0 = json.turns[0].toolResults[0];
    expect(tr0.toolUseId).toBe("t1");
    expect(tr0.content).toBe("file contents here");
    expect(tr0.isError).toBe(false);

    const tr1 = json.turns[0].toolResults[1];
    expect(tr1.toolUseId).toBe("t2");
    expect(tr1.content).toBe("File not found");
    expect(tr1.isError).toBe(true);
  });

  test("--truncate limits tool result content", () => {
    const longContent = "A".repeat(200);
    const session = makeSession({
      turns: [
        userTurn("u1", "", {
          toolResults: [toolResult("t1", longContent)],
        }),
      ],
    });

    const json = buildJsonOutput(session, 50);

    const tr = json.turns[0].toolResults[0];
    expect(tr.content.length).toBeLessThanOrEqual(50);
    expect(tr.content).toEndWith("...");
  });

  test("--truncate 0 gives unlimited content", () => {
    const longContent = "B".repeat(5000);
    const session = makeSession({
      turns: [
        userTurn("u1", "", {
          toolResults: [toolResult("t1", longContent)],
        }),
      ],
    });

    const json = buildJsonOutput(session, 0);

    const tr = json.turns[0].toolResults[0];
    expect(tr.content).toBe(longContent);
    expect(tr.content.length).toBe(5000);
  });

  test("existing stats fields are preserved", () => {
    const session = makeSession({
      sessionId: TEST_SESSION_ID,
      model: TEST_MODEL,
      cwd: TEST_CWD,
      slug: "test-slug",
      summary: "A summary",
      startTimestamp: "2025-01-15T10:00:00Z",
      endTimestamp: "2025-01-15T11:00:00Z",
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
      ],
    });

    const json = buildJsonOutput(session, 500);

    expect(json.sessionId).toBe(TEST_SESSION_ID);
    expect(json.model).toBe(TEST_MODEL);
    expect(json.cwd).toBe(TEST_CWD);
    expect(json.slug).toBe("test-slug");
    expect(json.summary).toBe("A summary");
    expect(json.startTimestamp).toBe("2025-01-15T10:00:00Z");
    expect(json.endTimestamp).toBe("2025-01-15T11:00:00Z");
    // Stats from computeStats should be spread in
    expect(json.turnCount).toBeDefined();
    expect(json.turnCount.total).toBe(2);
  });

  test("turn index field matches position", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "First"),
        assistantTurn("a1", "Second"),
        userTurn("u2", "Third"),
        assistantTurn("a2", "Fourth"),
      ],
    });

    const json = buildJsonOutput(session, 500);

    expect(json.turns[0].index).toBe(0);
    expect(json.turns[1].index).toBe(1);
    expect(json.turns[2].index).toBe(2);
    expect(json.turns[3].index).toBe(3);
  });

  test("rewind turns marked with isOnCurrentBranch false", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello", { isOnCurrentBranch: true }),
        assistantTurn("a1", "Abandoned response", { isOnCurrentBranch: false }),
        userTurn("u2", "Rewound message", { isOnCurrentBranch: false }),
        assistantTurn("a2", "New response", { isOnCurrentBranch: true }),
      ],
    });

    const json = buildJsonOutput(session, 500);

    expect(json.turns[0].isOnCurrentBranch).toBe(true);
    expect(json.turns[1].isOnCurrentBranch).toBe(false);
    expect(json.turns[2].isOnCurrentBranch).toBe(false);
    expect(json.turns[3].isOnCurrentBranch).toBe(true);
  });
});
