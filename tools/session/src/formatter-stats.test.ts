import { test, expect, describe } from "bun:test";
import { formatStats, formatDuration, formatCost } from "./formatter-stats";
import {
  makeSession,
  makeSubagent,
  makeCommit,
  makeRewind,
  userTurn,
  assistantTurn,
  toolCall,
  toolResult,
} from "./testing";
import { asAgentId, asSessionId } from "./types";

// ============================================================================
// DURATION FORMATTING
// ============================================================================

describe("formatDuration", () => {
  test("formats sub-minute durations", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(1000)).toBe("1s");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(59_000)).toBe("59s");
  });

  test("formats minute-range durations", () => {
    expect(formatDuration(60_000)).toBe("1m 00s");
    expect(formatDuration(90_000)).toBe("1m 30s");
    expect(formatDuration(872_000)).toBe("14m 32s");
    expect(formatDuration(3_599_000)).toBe("59m 59s");
  });

  test("formats hour-range durations", () => {
    expect(formatDuration(3_600_000)).toBe("1h 00m");
    expect(formatDuration(7_500_000)).toBe("2h 05m");
    expect(formatDuration(36_000_000)).toBe("10h 00m");
  });

  test("rounds to nearest second", () => {
    expect(formatDuration(1499)).toBe("1s");
    expect(formatDuration(1500)).toBe("2s");
    expect(formatDuration(61_400)).toBe("1m 01s");
  });
});

// ============================================================================
// COST FORMATTING
// ============================================================================

describe("formatCost", () => {
  test("formats standard costs with 2 decimal places", () => {
    expect(formatCost(1.24)).toBe("1.24");
    expect(formatCost(0.35)).toBe("0.35");
    expect(formatCost(10.0)).toBe("10.00");
  });

  test("formats sub-cent costs with 4 decimal places", () => {
    expect(formatCost(0.0012)).toBe("0.0012");
    expect(formatCost(0.005)).toBe("0.0050");
  });

  test("formats zero cost", () => {
    expect(formatCost(0)).toBe("0.00");
  });
});

// ============================================================================
// MINIMAL SESSION (turns only, no tools)
// ============================================================================

describe("formatStats with minimal session", () => {
  test("renders session ID (first 8 chars) in header", () => {
    const session = makeSession({
      sessionId: asSessionId("4a7ffc84-abcd-1234-ef56-789012345678"),
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Session   4a7ffc84");
  });

  test("renders duration and cost when present", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello"), assistantTurn("a1", "Hi!")],
      result: {
        success: true,
        durationMs: 872_000,
        costUsd: 1.24,
      },
    });

    const output = formatStats(session);

    expect(output).toContain("Duration  14m 32s");
    expect(output).toContain("Cost  $1.24");
  });

  test("omits duration and cost when result is absent", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatStats(session);

    expect(output).not.toContain("Duration");
    expect(output).not.toContain("Cost");
  });

  test("shows Conversation section with turn counts", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", "How?"),
        assistantTurn("a2", "Like this"),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Conversation");
    expect(output).toContain("4 turns (2 user, 2 assistant)");
  });

  test("omits Conversation section for empty session", () => {
    const session = makeSession();
    const output = formatStats(session);

    expect(output).not.toContain("Conversation");
    expect(output).not.toContain("turns");
  });

  test("omits Tools section when no tools used", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "No tools needed!"),
      ],
    });

    const output = formatStats(session);

    expect(output).not.toContain("Tools");
  });
});

// ============================================================================
// TOOL COUNT FORMATTING (3-column layout)
// ============================================================================

describe("formatStats tool count layout", () => {
  test("renders tools in 3-column rows sorted by frequency", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [
            // 18x Edit
            ...Array.from({ length: 18 }, (_, i) =>
              toolCall(`e${i}`, "Edit", {
                file_path: "/f",
                old_string: "a",
                new_string: "b",
              })
            ),
            // 14x Read
            ...Array.from({ length: 14 }, (_, i) =>
              toolCall(`r${i}`, "Read", { file_path: `/f${i}` })
            ),
            // 8x Bash
            ...Array.from({ length: 8 }, (_, i) =>
              toolCall(`b${i}`, "Bash", { command: `cmd${i}` })
            ),
            // 7x Grep
            ...Array.from({ length: 7 }, (_, i) =>
              toolCall(`g${i}`, "Grep", { pattern: `p${i}` })
            ),
            // 4x Glob
            ...Array.from({ length: 4 }, (_, i) =>
              toolCall(`gl${i}`, "Glob", { pattern: `*.ts` })
            ),
            // 3x Write
            ...Array.from({ length: 3 }, (_, i) =>
              toolCall(`w${i}`, "Write", { file_path: `/f${i}`, content: "x" })
            ),
            // 2x Task
            toolCall("tk1", "Task", { prompt: "do x", description: "x" }),
            toolCall("tk2", "Task", { prompt: "do y", description: "y" }),
          ],
        }),
      ],
    });

    const output = formatStats(session);

    // Should contain the Tools section
    expect(output).toContain("Tools");

    // First row should have the top 3 tools
    expect(output).toContain("18x Edit");
    expect(output).toContain("14x Read");
    expect(output).toContain("8x Bash");

    // Second row
    expect(output).toContain("7x Grep");
    expect(output).toContain("4x Glob");
    expect(output).toContain("3x Write");

    // Third row (partial)
    expect(output).toContain("2x Task");
  });

  test("renders single tool on one row", () => {
    const session = makeSession({
      turns: [
        assistantTurn("a1", "", {
          toolCalls: [
            toolCall("t1", "Read", { file_path: "/a" }),
            toolCall("t2", "Read", { file_path: "/b" }),
          ],
        }),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("2x Read");
  });
});

// ============================================================================
// SUBAGENT SUMMARIES
// ============================================================================

describe("formatStats subagent summaries", () => {
  test("renders subagent section with summaries", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      subagents: [
        makeSubagent(
          asAgentId("agent-d4e2"),
          [
            assistantTurn("sa1", "Update test fixtures", {
              toolCalls: Array.from({ length: 8 }, (_, i) =>
                toolCall(`st${i}`, "Edit", {
                  file_path: `/f${i}`,
                  old_string: "a",
                  new_string: "b",
                })
              ),
            }),
            ...Array.from({ length: 11 }, (_, i) =>
              userTurn(`su${i}`, `turn ${i}`)
            ),
          ]
        ),
        makeSubagent(
          asAgentId("agent-f891"),
          [
            assistantTurn("sa2", "Update app code", {
              toolCalls: Array.from({ length: 11 }, (_, i) =>
                toolCall(`st2${i}`, "Read", { file_path: `/f${i}` })
              ),
            }),
            ...Array.from({ length: 17 }, (_, i) =>
              userTurn(`su2${i}`, `turn ${i}`)
            ),
          ]
        ),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Subagents (2)");
    expect(output).toContain("agent-d4e");
    expect(output).toContain("agent-f89");
    expect(output).toContain("Update test fixtures");
    expect(output).toContain("Update app code");
  });

  test("omits Subagents section when no subagents", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      subagents: [],
    });

    const output = formatStats(session);

    expect(output).not.toContain("Subagents");
  });
});

// ============================================================================
// EMPTY SECTIONS ARE OMITTED
// ============================================================================

describe("formatStats empty section omission", () => {
  test("omits Rewinds section when rewindCount is 0", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      rewinds: [],
    });

    const output = formatStats(session);

    expect(output).not.toContain("Rewinds");
    expect(output).not.toContain("rewind detected");
  });

  test("shows Rewinds section when rewinds present", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        userTurn("u2", "Abandoned", { isOnCurrentBranch: false }),
        userTurn("u3", "Current"),
      ],
      rewinds: [makeRewind("u1", ["u2"])],
    });

    const output = formatStats(session);

    expect(output).toContain("Rewinds (1)");
    expect(output).toContain("1 rewind detected");
  });

  test("pluralizes rewinds correctly", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      rewinds: [
        makeRewind("u1", ["u2"]),
        makeRewind("u3", ["u4"]),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Rewinds (2)");
    expect(output).toContain("2 rewinds detected");
  });

  test("omits Git section when no commits", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      commits: [],
    });

    const output = formatStats(session);

    expect(output).not.toContain("Git");
    expect(output).not.toContain("commit");
  });

  test("shows Git section with commit count", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      commits: [
        makeCommit("abc1234", "fix: login bug"),
        makeCommit("def5678", "feat: add search"),
        makeCommit("ghi9012", "chore: update deps"),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Git");
    expect(output).toContain("3 commits");
  });

  test("pluralizes commits correctly for singular", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      commits: [makeCommit("abc1234", "fix: bug")],
    });

    const output = formatStats(session);

    expect(output).toContain("1 commit");
    // Should NOT say "1 commits"
    expect(output).not.toContain("1 commits");
  });
});

// ============================================================================
// HINTS SUPPRESSION
// ============================================================================

describe("formatStats hint suppression", () => {
  test("shows hints by default (showHints=true)", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/a" })],
        }),
      ],
      commits: [makeCommit("abc", "msg")],
      rewinds: [makeRewind("u1", ["u2"])],
    });

    const output = formatStats(session);

    expect(output).toContain("(--full to expand)");
    expect(output).toContain("(--tool-input to see commands)");
    expect(output).toContain("(--full to see context)");
    expect(output).toContain("(--full to see messages)");
  });

  test("suppresses all hints when showHints=false", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/a" })],
        }),
      ],
      commits: [makeCommit("abc", "msg")],
      rewinds: [makeRewind("u1", ["u2"])],
      subagents: [
        makeSubagent("agent-x", [assistantTurn("sa1", "work")]),
      ],
    });

    const output = formatStats(session, { showHints: false });

    expect(output).not.toContain("(--full to expand)");
    expect(output).not.toContain("(--tool-input to see commands)");
    expect(output).not.toContain("(--full to see context)");
    expect(output).not.toContain("(--full to see messages)");
    expect(output).not.toContain("(session <path> to expand)");
  });
});

// ============================================================================
// STRUCTURAL INVARIANTS
// ============================================================================

describe("formatStats structural invariants", () => {
  test("starts and ends with heavy rules", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatStats(session);
    const lines = output.split("\n");

    const heavyRule = "\u2501".repeat(38);
    expect(lines[0]).toBe(heavyRule);
    expect(lines[lines.length - 1]).toBe(heavyRule);
  });

  test("uses light rules for section headers", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/a" })],
        }),
      ],
    });

    const output = formatStats(session);

    // Light rule character in section headers
    expect(output).toContain("\u2500\u2500\u2500 Conversation");
    expect(output).toContain("\u2500\u2500\u2500 Tools");
  });
});

// ============================================================================
// REALISTIC FULL SESSION
// ============================================================================

describe("formatStats full session", () => {
  test("renders a complete stats card for a realistic session", () => {
    const session = makeSession({
      sessionId: asSessionId("4a7ffc84-abcd-1234-ef56-789012345678"),
      turns: [
        // 22 user turns, 45 assistant turns (some with tools)
        ...Array.from({ length: 22 }, (_, i) =>
          userTurn(`u${i}`, `User message ${i}`)
        ),
        ...Array.from({ length: 45 }, (_, i) =>
          assistantTurn(`a${i}`, `Assistant response ${i}`, {
            toolCalls:
              i < 18
                ? [toolCall(`te${i}`, "Edit", { file_path: `/f${i}`, old_string: "a", new_string: "b" })]
                : i < 32
                  ? [toolCall(`tr${i}`, "Read", { file_path: `/f${i}` })]
                  : i < 40
                    ? [toolCall(`tb${i}`, "Bash", { command: `cmd${i}` })]
                    : [],
          })
        ),
      ],
      subagents: [
        makeSubagent(
          asAgentId("agent-d4e2f891"),
          [
            assistantTurn("sa1", "Update test fixtures", {
              toolCalls: Array.from({ length: 8 }, (_, i) =>
                toolCall(`st1${i}`, "Edit", {
                  file_path: `/test${i}`,
                  old_string: "old",
                  new_string: "new",
                })
              ),
            }),
            ...Array.from({ length: 11 }, (_, i) =>
              userTurn(`su1${i}`, "")
            ),
          ]
        ),
        makeSubagent(
          asAgentId("agent-f891abcd"),
          [
            assistantTurn("sa2", "Update app code", {
              toolCalls: Array.from({ length: 11 }, (_, i) =>
                toolCall(`st2${i}`, "Read", { file_path: `/app${i}` })
              ),
            }),
            ...Array.from({ length: 17 }, (_, i) =>
              userTurn(`su2${i}`, "")
            ),
          ]
        ),
        makeSubagent(
          asAgentId("agent-cafe0000"),
          [
            assistantTurn("sa3", "Run linting checks", {
              toolCalls: [
                toolCall("st31", "Bash", { command: "bun lint" }),
                toolCall("st32", "Bash", { command: "bun typecheck" }),
              ],
            }),
            ...Array.from({ length: 4 }, (_, i) =>
              userTurn(`su3${i}`, "")
            ),
          ]
        ),
      ],
      commits: [
        makeCommit("abc1234", "fix: resolve session parsing edge case"),
        makeCommit("def5678", "feat: add stats formatter"),
        makeCommit("ghi9012", "test: add formatter-stats tests"),
      ],
      rewinds: [makeRewind("a1", ["u2"])],
      result: {
        success: true,
        durationMs: 872_000,
        costUsd: 1.24,
      },
    });

    const output = formatStats(session);

    // Header
    expect(output).toContain("Session   4a7ffc84");
    expect(output).toContain("Duration  14m 32s");
    expect(output).toContain("Cost  $1.24");

    // Conversation
    expect(output).toContain("Conversation");
    expect(output).toContain("67 turns (22 user, 45 assistant)");

    // Tools
    expect(output).toContain("Tools");
    expect(output).toContain("18x Edit");
    expect(output).toContain("14x Read");
    expect(output).toContain("8x Bash");

    // Subagents
    expect(output).toContain("Subagents (3)");

    // Rewinds
    expect(output).toContain("Rewinds (1)");
    expect(output).toContain("1 rewind detected");

    // Git
    expect(output).toContain("Git");
    expect(output).toContain("3 commits");

    // Hints present by default
    expect(output).toContain("(--full to expand)");
    expect(output).toContain("(--tool-input to see commands)");
    expect(output).toContain("(--full to see context)");
    expect(output).toContain("(--full to see messages)");
  });

  test("suppresses hints in piped mode", () => {
    const session = makeSession({
      sessionId: asSessionId("4a7ffc84-abcd-1234-ef56-789012345678"),
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/a" })],
        }),
      ],
      commits: [makeCommit("abc", "msg")],
      result: { success: true, durationMs: 60_000, costUsd: 0.10 },
    });

    const output = formatStats(session, { showHints: false });

    // Data still present
    expect(output).toContain("Session   4a7ffc84");
    expect(output).toContain("Duration  1m 00s");
    expect(output).toContain("Conversation");
    expect(output).toContain("Tools");
    expect(output).toContain("Git");

    // No hints
    expect(output).not.toContain("(--");
    expect(output).not.toContain("(session");
  });
});
