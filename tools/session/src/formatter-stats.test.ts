import { test, expect, describe } from "bun:test";
import { formatStats, formatDuration, formatCost, formatTokenCount } from "./formatter-stats";
import { computeStats } from "./stats";
import {
  makeSession,
  makeSubagent,
  makeCommit,
  makeGitCommit,
  makeRewind,
  makeCompaction,
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
// TOKEN COUNT FORMATTING
// ============================================================================

describe("formatTokenCount", () => {
  test("formats counts under 1,000 as plain numbers", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(1)).toBe("1");
    expect(formatTokenCount(999)).toBe("999");
  });

  test("formats thousands with k suffix", () => {
    expect(formatTokenCount(1000)).toBe("1.0k");
    expect(formatTokenCount(1234)).toBe("1.2k");
    expect(formatTokenCount(45200)).toBe("45.2k");
    expect(formatTokenCount(99900)).toBe("99.9k");
  });

  test("drops decimal for 100k+ values", () => {
    expect(formatTokenCount(100_000)).toBe("100k");
    expect(formatTokenCount(123_456)).toBe("123k");
    expect(formatTokenCount(999_999)).toBe("1000k");
  });

  test("formats millions with M suffix", () => {
    expect(formatTokenCount(1_000_000)).toBe("1.0M");
    expect(formatTokenCount(1_234_567)).toBe("1.2M");
    expect(formatTokenCount(12_345_678)).toBe("12.3M");
    expect(formatTokenCount(99_900_000)).toBe("99.9M");
  });

  test("drops decimal for 100M+ values", () => {
    expect(formatTokenCount(100_000_000)).toBe("100M");
    expect(formatTokenCount(234_000_000)).toBe("234M");
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

  test("renders token count in header when token usage present", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello"), assistantTurn("a1", "Hi!")],
      tokenUsage: {
        inputTokens: 200,
        outputTokens: 1000,
        cacheCreationInputTokens: 10000,
        cacheReadInputTokens: 34000,
      },
      result: {
        success: true,
        durationMs: 60_000,
        costUsd: 0.50,
      },
    });

    const output = formatStats(session);

    // Total = 200 + 1000 + 10000 + 34000 = 45200
    expect(output).toContain("Tokens  45.2k");
  });

  test("omits token count when token usage is absent", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatStats(session);

    expect(output).not.toContain("Tokens");
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
// SEGMENT-AWARE CONVERSATION SECTION (compacted sessions)
// ============================================================================

describe("formatStats segment-aware turn count", () => {
  test("shows segment info for compacted sessions", () => {
    const turns = [
      // Segment 0: 3 turns
      userTurn("u1", "Hello"),
      assistantTurn("a1", "Hi"),
      userTurn("u2", "Question"),
      // Compaction summary (starts segment 1)
      userTurn("cs1", "This session is being continued...", { isCompactionSummary: true }),
      // Segment 1: 3 turns (including summary)
      assistantTurn("a2", "Continuing"),
      userTurn("u3", "More"),
    ];

    const session = makeSession({
      turns,
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Conversation");
    // Should show total turns, number of segments, and current segment size
    expect(output).toContain("6 turns across 2 segments (3 in latest segment)");
  });

  test("shows segment info with multiple compactions", () => {
    const turns = [
      // Segment 0: 4 turns
      userTurn("u1", "Hello"),
      assistantTurn("a1", "Hi"),
      userTurn("u2", "Question"),
      assistantTurn("a2", "Answer"),
      // Compaction summary 1 (starts segment 1)
      userTurn("cs1", "Continued...", { isCompactionSummary: true }),
      // Segment 1: 3 turns (including summary)
      assistantTurn("a3", "Continuing"),
      userTurn("u3", "More"),
      // Compaction summary 2 (starts segment 2)
      userTurn("cs2", "Continued again...", { isCompactionSummary: true }),
      // Segment 2: 2 turns (including summary)
      assistantTurn("a4", "Still going"),
    ];

    const session = makeSession({
      turns,
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
        makeCompaction("2025-01-15T16:20:00Z", 174000),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("9 turns across 3 segments (2 in latest segment)");
  });

  test("non-compacted session shows classic format", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
        userTurn("u2", "How?"),
        assistantTurn("a2", "Like this"),
      ],
      compactions: [],
    });

    const output = formatStats(session);

    // Classic format, no segment info
    expect(output).toContain("4 turns (2 user, 2 assistant)");
    expect(output).not.toContain("segments");
    expect(output).not.toContain("in latest segment");
  });

  test("includes --full hint for compacted sessions", () => {
    const turns = [
      userTurn("u1", "Hello"),
      userTurn("cs1", "Continued...", { isCompactionSummary: true }),
      assistantTurn("a1", "Hi"),
    ];

    const session = makeSession({
      turns,
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("(--full to expand)");
  });

  test("suppresses hint when showHints is false for compacted sessions", () => {
    const turns = [
      userTurn("u1", "Hello"),
      userTurn("cs1", "Continued...", { isCompactionSummary: true }),
      assistantTurn("a1", "Hi"),
    ];

    const session = makeSession({
      turns,
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
      ],
    });

    const output = formatStats(session, { showHints: false });

    expect(output).not.toContain("(--full to expand)");
  });

  test("large compacted session with many segments", () => {
    // Simulate a session with 4 compactions (5 segments)
    const turns: ReturnType<typeof userTurn>[] = [];

    // Segment 0: 300 turns
    for (let i = 0; i < 300; i++) {
      turns.push(i % 2 === 0
        ? userTurn(`s0u${i}`, `msg ${i}`)
        : assistantTurn(`s0a${i}`, `resp ${i}`)
      );
    }

    // 4 compactions, each followed by ~280 turns
    for (let seg = 1; seg <= 4; seg++) {
      turns.push(userTurn(`cs${seg}`, "Continued...", { isCompactionSummary: true }));
      for (let i = 0; i < 279; i++) {
        turns.push(i % 2 === 0
          ? assistantTurn(`s${seg}a${i}`, `resp ${i}`)
          : userTurn(`s${seg}u${i}`, `msg ${i}`)
        );
      }
    }

    const session = makeSession({
      turns,
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
        makeCompaction("2025-01-15T16:20:00Z", 174000),
        makeCompaction("2025-01-15T18:34:00Z", 167000),
        makeCompaction("2025-01-15T19:46:00Z", 167000),
      ],
    });

    const output = formatStats(session);

    // 300 + 4*(280) = 300 + 1120 = 1420 turns, 5 segments, last segment has 280 turns
    expect(output).toContain("1420 turns across 5 segments (280 in latest segment)");
  });
});

// ============================================================================
// SLUG IN HEADER
// ============================================================================

describe("formatStats slug", () => {
  test("shows slug next to session ID in header", () => {
    const session = makeSession({
      sessionId: asSessionId("4a7ffc84-abcd-1234-ef56-789012345678"),
      slug: "snoopy-exploring-elephant",
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatStats(session);

    expect(output).toContain("Session   4a7ffc84  snoopy-exploring-elephant");
  });

  test("omits slug from header when not present", () => {
    const session = makeSession({
      sessionId: asSessionId("4a7ffc84-abcd-1234-ef56-789012345678"),
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatStats(session);

    expect(output).toContain("Session   4a7ffc84");
    // Should not have trailing spaces or undefined
    expect(output).not.toContain("undefined");
  });
});

// ============================================================================
// TURN DURATION SECTION
// ============================================================================

describe("formatStats turn durations", () => {
  test("shows Active Time section with summary stats", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      turnDurations: [5000, 12000, 79259],
    });

    const output = formatStats(session);

    expect(output).toContain("Active Time");
    expect(output).toContain("Total  1m 36s"); // 96259ms
    expect(output).toContain("Avg  32s"); // 32086ms rounds to 32s
    expect(output).toContain("Max  1m 19s"); // 79259ms
    expect(output).toContain("3 turns measured");
  });

  test("omits Active Time section when no turn durations", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
    });

    const output = formatStats(session);

    expect(output).not.toContain("Active Time");
  });

  test("uses singular for single turn", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      turnDurations: [42000],
    });

    const output = formatStats(session);

    expect(output).toContain("1 turn measured");
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

  test("shows token count on subagent line when token data available", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      subagents: [
        makeSubagent(
          asAgentId("agent-tok1"),
          [
            assistantTurn("sa1", "Investigate the auth module"),
          ],
          {
            tokenUsage: {
              inputTokens: 50000,
              outputTokens: 100000,
              cacheCreationInputTokens: 500000,
              cacheReadInputTokens: 1500000,
            },
          }
        ),
      ],
    });

    const output = formatStats(session);

    // Total = 50000 + 100000 + 500000 + 1500000 = 2150000 = 2.1M tok
    expect(output).toContain("2.1M tok");
  });

  test("omits token count on subagent line when no token data", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      subagents: [
        makeSubagent(
          asAgentId("agent-notok"),
          [
            assistantTurn("sa1", "Working on it"),
          ]
        ),
      ],
    });

    const output = formatStats(session);

    expect(output).not.toContain("tok");
  });

  test("omits token count when all token fields are zero", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      subagents: [
        makeSubagent(
          asAgentId("agent-zerotok"),
          [
            assistantTurn("sa1", "Working on it"),
          ],
          {
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              cacheCreationInputTokens: 0,
              cacheReadInputTokens: 0,
            },
          }
        ),
      ],
    });

    const output = formatStats(session);

    expect(output).not.toContain("tok");
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

  test("shows diffstat summary when gitCommits available", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      gitCommits: [
        makeGitCommit("abc1234", "fix: login bug", { insertions: 42, deletions: 7 }),
        makeGitCommit("def5678", "feat: add search", { insertions: 100, deletions: 30 }),
        makeGitCommit("ghi9012", "chore: deps", { insertions: 0, deletions: 0 }),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Git");
    expect(output).toContain("3 commits (+142/-37 lines)");
  });

  test("shows plain commit count when gitCommits have no diffstats", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      gitCommits: [
        makeGitCommit("abc1234", "merge commit"),
        makeGitCommit("def5678", "another merge"),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Git");
    expect(output).toContain("2 commits");
    // No diffstat suffix when all zeros
    expect(output).not.toContain("lines");
  });

  test("falls back to simple count when only regex commits available", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      commits: [
        makeCommit("abc1234", "fix: login bug"),
        makeCommit("def5678", "feat: add search"),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Git");
    expect(output).toContain("2 commits");
    expect(output).not.toContain("lines");
  });
});

// ============================================================================
// COMPACTIONS SECTION
// ============================================================================

describe("formatStats compactions section", () => {
  test("omits Compactions section when no compactions", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      compactions: [],
    });

    const output = formatStats(session);

    expect(output).not.toContain("Compactions");
  });

  test("shows Compactions section with count in header", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Compactions (1)");
  });

  test("shows timestamp, token count, and trigger for each compaction", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
        makeCompaction("2025-01-15T16:20:00Z", 174000),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Compactions (2)");
    expect(output).toContain("#1  14:55  172k tokens");
    expect(output).toContain("(auto)");
    expect(output).toContain("#2  16:20  174k tokens");
  });

  test("shows manual trigger type", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      compactions: [
        makeCompaction("2025-01-15T10:30:00Z", 150000, { trigger: "manual" }),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("(manual)");
  });

  test("shows segment turn breakdown", () => {
    // 4 compactions create 5 segments.
    // We need turns with isCompactionSummary markers to determine segment boundaries.
    // The compaction summaries are user turns that follow compact_boundary entries.
    // Turns before the first compaction summary = segment 0
    // Turns between compaction summary N and N+1 = segment N+1
    const turns = [
      // Segment 0: 4 turns before first compaction
      userTurn("u1", "Hello"),
      assistantTurn("a1", "Hi"),
      userTurn("u2", "Question"),
      assistantTurn("a2", "Answer"),
      // Compaction summary 1 (counts as part of segment 1)
      userTurn("cs1", "This session is being continued...", { isOnCurrentBranch: true }),
      // Segment 1: 3 turns (including the summary)
      assistantTurn("a3", "Continuing"),
      userTurn("u3", "More"),
      // Compaction summary 2 (counts as part of segment 2)
      userTurn("cs2", "This session is being continued...", { isOnCurrentBranch: true }),
      // Segment 2: 2 turns (including the summary)
      assistantTurn("a4", "Still going"),
    ];
    // Mark compaction summaries
    turns[4]!.isCompactionSummary = true;
    turns[7]!.isCompactionSummary = true;

    const session = makeSession({
      turns,
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
        makeCompaction("2025-01-15T16:20:00Z", 174000),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("3 segments:");
  });

  test("shows segment turn counts separated by arrows", () => {
    const turns = [
      // Segment 0: 3 turns
      userTurn("u1", "Hello"),
      assistantTurn("a1", "Hi"),
      userTurn("u2", "Question"),
      // Compaction summary (part of segment 1)
      userTurn("cs1", "Continued...", { isOnCurrentBranch: true }),
      // Segment 1: 2 turns (summary + 1 more)
      assistantTurn("a2", "Answer"),
    ];
    turns[3]!.isCompactionSummary = true;

    const session = makeSession({
      turns,
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
      ],
    });

    const output = formatStats(session);

    // 2 segments: 3 turns before compaction, 2 turns after (including summary)
    // Last segment is bracketed to highlight it as the active segment
    expect(output).toContain("2 segments:");
    expect(output).toMatch(/3 .+ \[2\] turns/);
  });

  test("shows compaction section between Conversation and Tokens sections", () => {
    const session = makeSession({
      model: "claude-sonnet-4-5-20250929",
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!", {
          tokenUsage: {
            inputTokens: 4000,
            outputTokens: 12000,
            cacheCreationInputTokens: 10000,
            cacheReadInputTokens: 150000,
          },
        }),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
      ],
    });

    const output = formatStats(session);

    // Compactions should appear after Conversation and before Tokens
    const conversationIdx = output.indexOf("Conversation");
    const compactionsIdx = output.indexOf("Compactions");
    const tokensIdx = output.indexOf("Tokens");

    expect(conversationIdx).toBeGreaterThan(-1);
    expect(compactionsIdx).toBeGreaterThan(-1);
    expect(tokensIdx).toBeGreaterThan(-1);
    expect(compactionsIdx).toBeGreaterThan(conversationIdx);
    expect(compactionsIdx).toBeLessThan(tokensIdx);
  });

  test("handles multiple compactions with realistic data", () => {
    // Simulates a session with 4 compactions (from the example output)
    const session = makeSession({
      turns: [
        // Just enough turns to make it non-empty
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi"),
      ],
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
        makeCompaction("2025-01-15T16:20:00Z", 174000),
        makeCompaction("2025-01-15T18:34:00Z", 167000),
        makeCompaction("2025-01-15T19:46:00Z", 167000),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("Compactions (4)");
    expect(output).toContain("#1  14:55  172k tokens");
    expect(output).toContain("#2  16:20  174k tokens");
    expect(output).toContain("#3  18:34  167k tokens");
    expect(output).toContain("#4  19:46  167k tokens");
  });

  test("formats compaction with arrow indicator", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
      ],
    });

    const output = formatStats(session);

    // Each compaction line should show "→ compacted"
    expect(output).toMatch(/172k tokens .+ compacted/);
  });

  test("singular segment label for single compaction with no boundary turns", () => {
    // If there are 0 compactions, no segment line.
    // If there is 1 compaction, there are 2 segments.
    const turns = [
      userTurn("u1", "Hello"),
      userTurn("cs1", "Continued...", { isOnCurrentBranch: true }),
      assistantTurn("a1", "Answer"),
    ];
    turns[1]!.isCompactionSummary = true;

    const session = makeSession({
      turns,
      compactions: [
        makeCompaction("2025-01-15T14:55:00Z", 172000),
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("2 segments:");
  });
});

// ============================================================================
// TOKEN STATS SECTION (context/cost/cache display)
// ============================================================================

describe("formatStats token stats section", () => {
  /**
   * Helper: create a session with per-turn tokenUsage on assistant turns,
   * which triggers tokenStats computation via computeStats.
   */
  function makeSessionWithTokenStats(overrides: {
    model?: string;
    turnTokenUsages: Array<{
      inputTokens: number;
      outputTokens: number;
      cacheCreationInputTokens: number;
      cacheReadInputTokens: number;
    }>;
  }) {
    const { model = "claude-sonnet-4-5-20250929", turnTokenUsages } = overrides;
    const turns = turnTokenUsages.flatMap((usage, i) => [
      userTurn(`u${i}`, `msg ${i}`),
      assistantTurn(`a${i}`, `resp ${i}`, { tokenUsage: usage }),
    ]);

    return makeSession({ model, turns });
  }

  test("shows Context / Cost / Output / Cache section when tokenStats available", () => {
    const session = makeSessionWithTokenStats({
      turnTokenUsages: [
        {
          inputTokens: 4000,
          outputTokens: 12000,
          cacheCreationInputTokens: 10000,
          cacheReadInputTokens: 150000,
        },
      ],
    });

    const output = formatStats(session);

    // Section header
    expect(output).toContain("Tokens");

    // Line 1: Context peak / window (percent)
    // context = 4000 + 10000 + 150000 = 164000
    // window = 200000
    // pct = 164000/200000 = 82%
    expect(output).toContain("Context  164k / 200k (82%)");

    // Cost should be present (known model: sonnet 4.5)
    expect(output).toContain("Cost  $");

    // Line 2: Output tokens
    // cumulativeOutput = 12000
    expect(output).toContain("Output   12.0k tokens");

    // Cache rate = 150000 / 164000 = 91.46% -> 91%
    expect(output).toContain("Cache  91%");
  });

  test("shows context in header as concise summary", () => {
    const session = makeSessionWithTokenStats({
      turnTokenUsages: [
        {
          inputTokens: 2000,
          outputTokens: 5000,
          cacheCreationInputTokens: 8000,
          cacheReadInputTokens: 90000,
        },
      ],
    });

    const output = formatStats(session);
    const headerLine = output.split("\n")[1]!;

    // context = 2000 + 8000 + 90000 = 100000
    // pct = 100000/200000 = 50%
    expect(headerLine).toContain("Context 100k (50%)");
    // Should NOT show old "Tokens" format
    expect(headerLine).not.toContain("Tokens");
  });

  test("omits Cost when model is unknown", () => {
    const session = makeSessionWithTokenStats({
      model: "unknown-model-xyz",
      turnTokenUsages: [
        {
          inputTokens: 1000,
          outputTokens: 2000,
          cacheCreationInputTokens: 3000,
          cacheReadInputTokens: 44000,
        },
      ],
    });

    const output = formatStats(session);

    // Context line should be present
    expect(output).toContain("Context  48.0k / 200k (24%)");

    // Cost should NOT be present (unknown model)
    const tokenSection = output.split("Tokens")[1]?.split("\n") ?? [];
    const contextLine = tokenSection.find((l) => l.includes("Context"));
    if (contextLine) {
      expect(contextLine).not.toContain("Cost");
    }

    // Output and cache should still be present
    expect(output).toContain("Output   2.0k tokens");
    expect(output).toContain("Cache  92%");
  });

  test("falls back to old Tokens display when no per-turn tokenUsage", () => {
    // Session-level tokenUsage but no per-turn data -> old fallback
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
      ],
      tokenUsage: {
        inputTokens: 200,
        outputTokens: 1000,
        cacheCreationInputTokens: 10000,
        cacheReadInputTokens: 34000,
      },
    });

    const output = formatStats(session);

    // Old-style header display
    expect(output).toContain("Tokens  45.2k");
    // Should NOT have the new Tokens section
    expect(output).not.toContain("Context  ");
  });

  test("rounds cache hit rate to nearest percent", () => {
    // cacheRead=1, totalInput=3 => 33.33% -> 33%
    const session = makeSessionWithTokenStats({
      turnTokenUsages: [
        {
          inputTokens: 1,
          outputTokens: 100,
          cacheCreationInputTokens: 1,
          cacheReadInputTokens: 1,
        },
      ],
    });

    const output = formatStats(session);

    // cacheRate = 1/3 = 33%
    expect(output).toContain("Cache  33%");
  });

  test("handles zero tokens gracefully", () => {
    const session = makeSessionWithTokenStats({
      turnTokenUsages: [
        {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
      ],
    });

    const output = formatStats(session);

    // context = 0, pct = 0%
    expect(output).toContain("Context  0 / 200k (0%)");
    expect(output).toContain("Output   0 tokens");
    expect(output).toContain("Cache  0%");
  });

  test("accumulates across multiple assistant turns for peak context", () => {
    const session = makeSessionWithTokenStats({
      turnTokenUsages: [
        // Turn 1: context = 50k
        {
          inputTokens: 10000,
          outputTokens: 5000,
          cacheCreationInputTokens: 20000,
          cacheReadInputTokens: 20000,
        },
        // Turn 2: context = 120k (peak)
        {
          inputTokens: 20000,
          outputTokens: 8000,
          cacheCreationInputTokens: 30000,
          cacheReadInputTokens: 70000,
        },
        // Turn 3: context = 80k (below peak)
        {
          inputTokens: 10000,
          outputTokens: 3000,
          cacheCreationInputTokens: 20000,
          cacheReadInputTokens: 50000,
        },
      ],
    });

    const output = formatStats(session);

    // Peak context = 120k, pct = 60%
    expect(output).toContain("Context  120k / 200k (60%)");
    // Cumulative output = 5000 + 8000 + 3000 = 16000
    expect(output).toContain("Output   16.0k tokens");
    // Header should show peak context
    expect(output).toContain("Context 120k (60%)");
  });

  test("Cost and Cache align with right-padding on their lines", () => {
    const session = makeSessionWithTokenStats({
      turnTokenUsages: [
        {
          inputTokens: 4000,
          outputTokens: 892000,
          cacheCreationInputTokens: 10000,
          cacheReadInputTokens: 150000,
        },
      ],
    });

    const output = formatStats(session);

    // Find the Context line and verify Cost is on the same line
    const lines = output.split("\n");
    const contextLine = lines.find((l) => l.includes("Context  164k"));
    expect(contextLine).toBeDefined();
    expect(contextLine).toContain("Cost  $");

    // Find the Output line and verify Cache is on the same line
    const outputLine = lines.find((l) => l.includes("Output   892k"));
    expect(outputLine).toBeDefined();
    expect(outputLine).toContain("Cache  ");
  });

  test("shows Tokens section header with light rule", () => {
    const session = makeSessionWithTokenStats({
      turnTokenUsages: [
        {
          inputTokens: 1000,
          outputTokens: 2000,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
      ],
    });

    const output = formatStats(session);

    expect(output).toContain("\u2500\u2500\u2500 Tokens");
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
    expect(output).not.toContain("(--timeline to see flow)");
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
      tokenUsage: {
        inputTokens: 500,
        outputTokens: 4500,
        cacheCreationInputTokens: 15000,
        cacheReadInputTokens: 125200,
      },
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
    // Total tokens = 500 + 4500 + 15000 + 125200 = 145200
    expect(output).toContain("Tokens  145k");

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

// ============================================================================
// JSON FORMAT OUTPUT (--format json)
// ============================================================================

/**
 * The JSON format combines session metadata with computeStats output.
 * This mirrors the logic in cli.ts for --format json.
 * We test the shape here to ensure contract stability for agent consumers.
 */
function buildJsonOutput(session: ReturnType<typeof makeSession>) {
  const stats = computeStats(session);
  return {
    sessionId: session.sessionId,
    slug: session.slug ?? null,
    model: session.model,
    cwd: session.cwd,
    summary: session.summary ?? null,
    startTimestamp: session.startTimestamp ?? null,
    endTimestamp: session.endTimestamp ?? null,
    ...stats,
  };
}

describe("JSON format output shape", () => {
  test("includes session metadata fields", () => {
    const session = makeSession({
      sessionId: asSessionId("abc12345-6789-0000-1111-222233334444"),
      model: "claude-sonnet-4-20250514",
      summary: "Implemented the JSON format",
    });

    const json = buildJsonOutput(session);

    expect(json.sessionId).toBe("abc12345-6789-0000-1111-222233334444");
    expect(json.model).toBe("claude-sonnet-4-20250514");
    expect(json.cwd).toBe("/test/workspace");
    expect(json.summary).toBe("Implemented the JSON format");
  });

  test("summary is null when not present on session", () => {
    const session = makeSession();
    const json = buildJsonOutput(session);

    expect(json.summary).toBeNull();
  });

  test("includes all stats fields", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!", {
          toolCalls: [
            toolCall("t1", "Read", { file_path: "/a" }),
            toolCall("t2", "Bash", { command: "ls" }),
          ],
        }),
      ],
      subagents: [
        makeSubagent("agent-001", [
          assistantTurn("sa1", "Working on it"),
        ]),
      ],
      commits: [makeCommit("abc1234", "fix: bug")],
      rewinds: [makeRewind("u1", ["u2"])],
      result: {
        success: true,
        durationMs: 120_000,
        costUsd: 0.50,
      },
    });

    const json = buildJsonOutput(session);

    // Turn counts
    expect(json.turnCount).toEqual({
      total: 2,
      user: 1,
      assistant: 1,
    });

    // Tool counts (sorted by frequency desc)
    expect(json.toolCounts).toEqual({
      Read: 1,
      Bash: 1,
    });

    // Subagent summaries
    expect(json.subagentSummaries).toHaveLength(1);
    expect(json.subagentSummaries[0]!.agentId).toBe("agent-001");
    expect(json.subagentSummaries[0]!.turns).toBe(1);
    expect(json.subagentSummaries[0]!.toolCalls).toBe(0);

    // Scalar stats
    expect(json.commitCount).toBe(1);
    expect(json.rewindCount).toBe(1);
    expect(json.durationMs).toBe(120_000);
    expect(json.costUsd).toBe(0.50);
  });

  test("omits optional fields when not present", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
    });

    const json = buildJsonOutput(session);

    expect(json.durationMs).toBeUndefined();
    expect(json.costUsd).toBeUndefined();
    expect(json.tokenUsage).toBeUndefined();
  });

  test("includes token usage in JSON output", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      tokenUsage: {
        inputTokens: 300,
        outputTokens: 1500,
        cacheCreationInputTokens: 8000,
        cacheReadInputTokens: 40000,
      },
    });

    const json = buildJsonOutput(session);

    expect(json.tokenUsage).toEqual({
      inputTokens: 300,
      outputTokens: 1500,
      cacheCreationInputTokens: 8000,
      cacheReadInputTokens: 40000,
    });
  });

  test("includes tokenStats in JSON output when per-turn token data available", () => {
    const session = makeSession({
      model: "claude-sonnet-4-5-20250929",
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "First response", {
          tokenUsage: {
            inputTokens: 4000,
            outputTokens: 12000,
            cacheCreationInputTokens: 10000,
            cacheReadInputTokens: 150000,
          },
        }),
        userTurn("u2", "Follow up"),
        assistantTurn("a2", "Second response", {
          tokenUsage: {
            inputTokens: 5000,
            outputTokens: 8000,
            cacheCreationInputTokens: 12000,
            cacheReadInputTokens: 160000,
          },
        }),
      ],
    });

    const json = buildJsonOutput(session);

    // tokenStats should be present with raw numeric values
    expect(json.tokenStats).toBeDefined();

    // Peak context = max(4000+10000+150000, 5000+12000+160000) = max(164000, 177000) = 177000
    expect(json.tokenStats!.peakContextTokens).toBe(177000);
    expect(json.tokenStats!.peakContextPercent).toBeCloseTo(177000 / 200000, 6);

    // Final context = last assistant turn = 5000+12000+160000 = 177000
    expect(json.tokenStats!.finalContextTokens).toBe(177000);

    // Cumulative output = 12000 + 8000 = 20000
    expect(json.tokenStats!.cumulativeOutputTokens).toBe(20000);

    // Cumulative input = 164000 + 177000 = 341000
    expect(json.tokenStats!.cumulativeInputTokens).toBe(341000);

    // Cache hit rate = (150000+160000) / 341000
    expect(json.tokenStats!.cacheHitRate).toBeCloseTo(310000 / 341000, 6);

    // Cost should be defined for known model
    expect(json.tokenStats!.estimatedCostUsd).toBeDefined();
    expect(typeof json.tokenStats!.estimatedCostUsd).toBe("number");

    // Context window
    expect(json.tokenStats!.contextWindowSize).toBe(200000);
    expect(json.tokenStats!.model).toBe("claude-sonnet-4-5-20250929");
  });

  test("omits tokenStats when no per-turn token data", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
      ],
    });

    const json = buildJsonOutput(session);

    expect(json.tokenStats).toBeUndefined();
  });

  test("includes per-subagent tokenUsage in JSON subagentSummaries", () => {
    const session = makeSession({
      turns: [userTurn("u1", "Hello")],
      subagents: [
        makeSubagent(
          asAgentId("agent-with-tokens"),
          [assistantTurn("sa1", "Working on analysis")],
          {
            tokenUsage: {
              inputTokens: 5000,
              outputTokens: 12000,
              cacheCreationInputTokens: 80000,
              cacheReadInputTokens: 400000,
            },
          }
        ),
        makeSubagent(
          asAgentId("agent-no-tokens"),
          [assistantTurn("sa2", "Quick task")]
        ),
      ],
    });

    const json = buildJsonOutput(session);

    expect(json.subagentSummaries).toHaveLength(2);

    // First subagent has tokenUsage
    const withTokens = json.subagentSummaries[0]!;
    expect(withTokens.agentId).toBe("agent-with-tokens");
    expect(withTokens.tokenUsage).toEqual({
      inputTokens: 5000,
      outputTokens: 12000,
      cacheCreationInputTokens: 80000,
      cacheReadInputTokens: 400000,
    });

    // Second subagent has no tokenUsage
    const noTokens = json.subagentSummaries[1]!;
    expect(noTokens.agentId).toBe("agent-no-tokens");
    expect(noTokens.tokenUsage).toBeUndefined();
  });

  test("tokenStats and subagent tokenUsage survive JSON round-trip", () => {
    const session = makeSession({
      model: "claude-sonnet-4-5-20250929",
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Response", {
          tokenUsage: {
            inputTokens: 2000,
            outputTokens: 5000,
            cacheCreationInputTokens: 8000,
            cacheReadInputTokens: 90000,
          },
        }),
      ],
      subagents: [
        makeSubagent(
          asAgentId("agent-roundtrip"),
          [assistantTurn("sa1", "Subagent work")],
          {
            tokenUsage: {
              inputTokens: 1000,
              outputTokens: 3000,
              cacheCreationInputTokens: 5000,
              cacheReadInputTokens: 20000,
            },
          }
        ),
      ],
    });

    const json = buildJsonOutput(session);
    const serialized = JSON.stringify(json, null, 2);
    const parsed = JSON.parse(serialized);

    // tokenStats survives round-trip
    expect(parsed.tokenStats).toBeDefined();
    expect(parsed.tokenStats.peakContextTokens).toBe(100000); // 2000+8000+90000
    expect(parsed.tokenStats.peakContextPercent).toBeCloseTo(0.5, 2);
    expect(parsed.tokenStats.finalContextTokens).toBe(100000);
    expect(parsed.tokenStats.cumulativeOutputTokens).toBe(5000);
    expect(parsed.tokenStats.cacheHitRate).toBeCloseTo(0.9, 1);
    expect(parsed.tokenStats.contextWindowSize).toBe(200000);
    expect(parsed.tokenStats.model).toBe("claude-sonnet-4-5-20250929");
    expect(typeof parsed.tokenStats.estimatedCostUsd).toBe("number");

    // Subagent tokenUsage survives round-trip
    expect(parsed.subagentSummaries).toHaveLength(1);
    expect(parsed.subagentSummaries[0].tokenUsage).toEqual({
      inputTokens: 1000,
      outputTokens: 3000,
      cacheCreationInputTokens: 5000,
      cacheReadInputTokens: 20000,
    });
  });

  test("round-trips through JSON.stringify/parse cleanly", () => {
    const session = makeSession({
      sessionId: asSessionId("roundtrip-test-id"),
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!", {
          toolCalls: [toolCall("t1", "Read", { file_path: "/file.ts" })],
        }),
      ],
      commits: [makeCommit("abc", "feat: add feature")],
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 500,
        cacheCreationInputTokens: 2000,
        cacheReadInputTokens: 10000,
      },
      result: { success: true, durationMs: 60_000, costUsd: 0.25 },
    });

    const json = buildJsonOutput(session);
    const serialized = JSON.stringify(json, null, 2);
    const parsed = JSON.parse(serialized);

    expect(parsed.sessionId).toBe("roundtrip-test-id");
    expect(parsed.turnCount.total).toBe(2);
    expect(parsed.toolCounts.Read).toBe(1);
    expect(parsed.commitCount).toBe(1);
    expect(parsed.durationMs).toBe(60_000);
    expect(parsed.costUsd).toBe(0.25);
    expect(parsed.tokenUsage).toEqual({
      inputTokens: 100,
      outputTokens: 500,
      cacheCreationInputTokens: 2000,
      cacheReadInputTokens: 10000,
    });
  });
});

// ============================================================================
// BTW COUNT IN STATS CARD
// ============================================================================

describe("formatStats btw count", () => {
  test("shows btw count when aside_question subagents exist", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
      ],
      subagents: [
        makeSubagent("agent-aside_question-q1", [
          userTurn("u2", "What is X?"),
          assistantTurn("a2", "X is Y."),
        ]),
        makeSubagent("agent-aside_question-q2", [
          userTurn("u3", "What is Z?"),
          assistantTurn("a3", "Z is W."),
        ]),
      ],
    });

    const output = formatStats(session, { showHints: false });

    expect(output).toContain("2 btw");
  });

  test("omits btw count when no aside_question subagents exist", () => {
    const session = makeSession({
      turns: [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi!"),
      ],
      subagents: [
        makeSubagent("agent-regular-task", [
          userTurn("u2", "Do something"),
          assistantTurn("a2", "Done."),
        ]),
      ],
    });

    const output = formatStats(session, { showHints: false });

    expect(output).not.toContain("btw");
  });
});
