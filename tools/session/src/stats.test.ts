import { test, expect, describe } from "bun:test";
import { computeStats, computeTokenStats } from "./stats";
import type { SessionStats, SubagentSummary, TokenStats } from "./stats";
import {
  makeSession,
  makeSubagent,
  makeCommit,
  makeGitCommit,
  makeRewind,
  userTurn,
  assistantTurn,
  toolCall,
  toolResult,
} from "./testing";
import { asAgentId } from "./types";
import type { TokenUsage } from "./types";

describe("computeStats", () => {
  // ========================================================================
  // EMPTY SESSION
  // ========================================================================

  describe("empty session", () => {
    test("returns zero counts for a session with no turns", () => {
      const session = makeSession();
      const stats = computeStats(session);

      expect(stats.turnCount).toEqual({ total: 0, user: 0, assistant: 0 });
      expect(stats.toolCounts).toEqual({});
      expect(stats.subagentSummaries).toEqual([]);
      expect(stats.commitCount).toBe(0);
      expect(stats.rewindCount).toBe(0);
      expect(stats.durationMs).toBeUndefined();
      expect(stats.costUsd).toBeUndefined();
      expect(stats.tokenUsage).toBeUndefined();
    });
  });

  // ========================================================================
  // TURN COUNTING
  // ========================================================================

  describe("turn counting", () => {
    test("counts user and assistant turns separately", () => {
      const session = makeSession({
        turns: [
          userTurn("u1", "Hello"),
          assistantTurn("a1", "Hi there!"),
          userTurn("u2", "How are you?"),
          assistantTurn("a2", "Great, thanks!"),
          userTurn("u3", "Bye"),
        ],
      });

      const stats = computeStats(session);

      expect(stats.turnCount.total).toBe(5);
      expect(stats.turnCount.user).toBe(3);
      expect(stats.turnCount.assistant).toBe(2);
    });

    test("handles session with only user turns", () => {
      const session = makeSession({
        turns: [userTurn("u1", "Hello"), userTurn("u2", "Anyone there?")],
      });

      const stats = computeStats(session);

      expect(stats.turnCount).toEqual({ total: 2, user: 2, assistant: 0 });
    });

    test("handles session with only assistant turns", () => {
      const session = makeSession({
        turns: [assistantTurn("a1", "Starting up...")],
      });

      const stats = computeStats(session);

      expect(stats.turnCount).toEqual({ total: 1, user: 0, assistant: 1 });
    });
  });

  // ========================================================================
  // TOOL COUNTING
  // ========================================================================

  describe("tool counting", () => {
    test("counts tool calls from assistant turns", () => {
      const session = makeSession({
        turns: [
          assistantTurn("a1", "Let me check", {
            toolCalls: [
              toolCall("t1", "Read", { file_path: "/src/index.ts" }),
              toolCall("t2", "Read", { file_path: "/src/types.ts" }),
              toolCall("t3", "Bash", { command: "ls" }),
            ],
          }),
          userTurn("u1", "", {
            toolResults: [
              toolResult("t1", "contents"),
              toolResult("t2", "more contents"),
              toolResult("t3", "file list"),
            ],
          }),
          assistantTurn("a2", "Now editing", {
            toolCalls: [
              toolCall("t4", "Edit", {
                file_path: "/src/index.ts",
                old_string: "a",
                new_string: "b",
              }),
              toolCall("t5", "Read", { file_path: "/src/util.ts" }),
            ],
          }),
        ],
      });

      const stats = computeStats(session);

      // Read: 3, Bash: 1, Edit: 1
      expect(stats.toolCounts).toEqual({
        Read: 3,
        Bash: 1,
        Edit: 1,
      });
    });

    test("sorts tool counts by count descending", () => {
      const session = makeSession({
        turns: [
          assistantTurn("a1", "", {
            toolCalls: [
              toolCall("t1", "Bash", { command: "echo 1" }),
              toolCall("t2", "Read", { file_path: "/a" }),
              toolCall("t3", "Read", { file_path: "/b" }),
              toolCall("t4", "Read", { file_path: "/c" }),
              toolCall("t5", "Grep", { pattern: "foo" }),
              toolCall("t6", "Grep", { pattern: "bar" }),
            ],
          }),
        ],
      });

      const stats = computeStats(session);
      const entries = Object.entries(stats.toolCounts);

      expect(entries[0]).toEqual(["Read", 3]);
      expect(entries[1]).toEqual(["Grep", 2]);
      expect(entries[2]).toEqual(["Bash", 1]);
    });

    test("returns empty record when no tool calls", () => {
      const session = makeSession({
        turns: [
          userTurn("u1", "Hello"),
          assistantTurn("a1", "Hi, no tools needed!"),
        ],
      });

      const stats = computeStats(session);

      expect(stats.toolCounts).toEqual({});
    });
  });

  // ========================================================================
  // SUBAGENT SUMMARIES
  // ========================================================================

  describe("subagent summaries", () => {
    test("summarizes subagent with turns and tool calls", () => {
      const agentId = asAgentId("agent-abc");
      const subagent = makeSubagent(agentId, [
        assistantTurn("sa1", "Searching codebase", {
          toolCalls: [
            toolCall("st1", "Grep", { pattern: "TODO" }),
            toolCall("st2", "Read", { file_path: "/src/main.ts" }),
          ],
        }),
        userTurn("su1", "", {
          toolResults: [
            toolResult("st1", "3 matches"),
            toolResult("st2", "file content"),
          ],
        }),
        assistantTurn("sa2", "Found the issues", {
          toolCalls: [toolCall("st3", "Edit", { file_path: "/src/main.ts", old_string: "a", new_string: "b" })],
        }),
      ]);

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      expect(stats.subagentSummaries).toHaveLength(1);
      const summary = stats.subagentSummaries[0]!;
      expect(summary.agentId).toBe(agentId);
      expect(summary.turns).toBe(3);
      expect(summary.toolCalls).toBe(3);
    });

    test("uses first assistant text as description fallback", () => {
      const agentId = asAgentId("agent-xyz");
      const subagent = makeSubagent(agentId, [
        assistantTurn("sa1", "Analyzing the authentication module for vulnerabilities"),
      ]);

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      expect(stats.subagentSummaries[0]!.description).toBe(
        "Analyzing the authentication module for vulnerabilities"
      );
    });

    test("truncates long descriptions to 80 characters", () => {
      const agentId = asAgentId("agent-long");
      const longText =
        "This is a very long description that exceeds eighty characters and should be truncated by the stats function to fit within the limit";
      const subagent = makeSubagent(agentId, [
        assistantTurn("sa1", longText),
      ]);

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      const desc = stats.subagentSummaries[0]!.description;
      expect(desc.length).toBe(80);
      expect(desc.endsWith("...")).toBe(true);
    });

    test("extracts description from Task tool call when agentId matches result", () => {
      const agentId = asAgentId("agent-task-match");
      const subagent = makeSubagent(agentId, [
        assistantTurn("sa1", "Working on it..."),
      ]);

      // Main session has a Task tool call whose result mentions the agentId
      const session = makeSession({
        turns: [
          assistantTurn("a1", "Let me spawn a subagent", {
            toolCalls: [
              toolCall("task1", "Task", {
                prompt: "Search for all TODO comments in the codebase",
                description: "Find TODOs",
              }),
            ],
          }),
          userTurn("u1", "", {
            toolResults: [
              toolResult(
                "task1",
                `Subagent completed. agentId: ${String(agentId)}`
              ),
            ],
          }),
        ],
        subagents: [subagent],
      });

      const stats = computeStats(session);

      expect(stats.subagentSummaries[0]!.description).toBe(
        "Search for all TODO comments in the codebase"
      );
    });

    test("returns empty description for subagent with no turns", () => {
      const agentId = asAgentId("agent-empty");
      const subagent = makeSubagent(agentId, []);

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      expect(stats.subagentSummaries[0]!.description).toBe("");
      expect(stats.subagentSummaries[0]!.turns).toBe(0);
      expect(stats.subagentSummaries[0]!.toolCalls).toBe(0);
    });

    test("handles multiple subagents", () => {
      const session = makeSession({
        subagents: [
          makeSubagent("agent-1", [
            assistantTurn("sa1", "First agent"),
          ]),
          makeSubagent("agent-2", [
            assistantTurn("sa2", "Second agent", {
              toolCalls: [toolCall("st1", "Bash", { command: "echo hi" })],
            }),
          ]),
          makeSubagent("agent-3", []),
        ],
      });

      const stats = computeStats(session);

      expect(stats.subagentSummaries).toHaveLength(3);
      expect(stats.subagentSummaries[0]!.description).toBe("First agent");
      expect(stats.subagentSummaries[1]!.toolCalls).toBe(1);
      expect(stats.subagentSummaries[2]!.turns).toBe(0);
    });

    test("filters out compaction subagents (acompact- prefix)", () => {
      const session = makeSession({
        subagents: [
          makeSubagent("agent-real", [
            assistantTurn("sa1", "Real subagent work"),
          ]),
          makeSubagent("acompact-abc123", [
            assistantTurn("sa2", "Compaction summary generator"),
          ]),
          makeSubagent("agent-also-real", [
            assistantTurn("sa3", "Another real subagent"),
          ]),
        ],
      });

      const stats = computeStats(session);

      // Only the 2 real subagents should appear — compaction subagent is filtered
      expect(stats.subagentSummaries).toHaveLength(2);
      expect(stats.subagentSummaries[0]!.agentId).toBe("agent-real");
      expect(stats.subagentSummaries[1]!.agentId).toBe("agent-also-real");
    });

    test("computes duration from first to last turn timestamps", () => {
      const agentId = asAgentId("agent-dur");
      const subagent = makeSubagent(agentId, [
        assistantTurn("sa1", "Starting work", {
          timestamp: "2025-01-15T10:00:00.000Z",
        }),
        userTurn("su1", "", {
          timestamp: "2025-01-15T10:00:30.000Z",
        }),
        assistantTurn("sa2", "Done", {
          timestamp: "2025-01-15T10:01:00.000Z",
        }),
      ]);

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      expect(stats.subagentSummaries[0]!.durationMs).toBe(60000);
    });

    test("prefers startTimestamp over first turn timestamp for duration", () => {
      const agentId = asAgentId("agent-start-ts");
      const subagent = makeSubagent(
        agentId,
        [
          assistantTurn("sa1", "Working", {
            timestamp: "2025-01-15T10:00:10.000Z",
          }),
          assistantTurn("sa2", "Done", {
            timestamp: "2025-01-15T10:01:00.000Z",
          }),
        ],
        { startTimestamp: "2025-01-15T10:00:00.000Z" }
      );

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      // 60s from startTimestamp, not 50s from first turn
      expect(stats.subagentSummaries[0]!.durationMs).toBe(60000);
    });

    test("returns undefined duration when turns lack timestamps", () => {
      const agentId = asAgentId("agent-no-ts");
      const subagent = makeSubagent(agentId, [
        assistantTurn("sa1", "No timestamps here"),
        assistantTurn("sa2", "Still none"),
      ]);

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      expect(stats.subagentSummaries[0]!.durationMs).toBeUndefined();
    });

    test("returns undefined duration for single-turn subagent", () => {
      const agentId = asAgentId("agent-single");
      const subagent = makeSubagent(agentId, [
        assistantTurn("sa1", "Just one turn", {
          timestamp: "2025-01-15T10:00:00.000Z",
        }),
      ]);

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      // first and last are the same turn, so duration is 0
      expect(stats.subagentSummaries[0]!.durationMs).toBe(0);
    });

    test("returns undefined duration for empty subagent without startTimestamp", () => {
      const agentId = asAgentId("agent-empty-dur");
      const subagent = makeSubagent(agentId, []);

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      expect(stats.subagentSummaries[0]!.durationMs).toBeUndefined();
    });

    test("includes tokenUsage when subagent has token data", () => {
      const agentId = asAgentId("agent-tok");
      const tokenUsage: TokenUsage = {
        inputTokens: 5000,
        outputTokens: 12000,
        cacheCreationInputTokens: 80000,
        cacheReadInputTokens: 400000,
      };
      const subagent = makeSubagent(
        agentId,
        [assistantTurn("sa1", "Working")],
        { tokenUsage }
      );

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      expect(stats.subagentSummaries[0]!.tokenUsage).toEqual(tokenUsage);
    });

    test("omits tokenUsage when subagent has no token data", () => {
      const agentId = asAgentId("agent-no-tok");
      const subagent = makeSubagent(agentId, [
        assistantTurn("sa1", "Working"),
      ]);

      const session = makeSession({ subagents: [subagent] });
      const stats = computeStats(session);

      expect(stats.subagentSummaries[0]!.tokenUsage).toBeUndefined();
    });
  });

  // ========================================================================
  // COMMITS AND REWINDS
  // ========================================================================

  describe("commits and rewinds", () => {
    test("counts commits", () => {
      const session = makeSession({
        commits: [
          makeCommit("abc1234", "fix: login bug"),
          makeCommit("def5678", "feat: add search"),
          makeCommit("ghi9012"),
        ],
      });

      const stats = computeStats(session);

      expect(stats.commitCount).toBe(3);
    });

    test("counts rewinds", () => {
      const session = makeSession({
        rewinds: [
          makeRewind("a1", ["u2", "a2"]),
          makeRewind("a3", ["u4"]),
        ],
      });

      const stats = computeStats(session);

      expect(stats.rewindCount).toBe(2);
    });

    test("handles zero commits and rewinds", () => {
      const session = makeSession();
      const stats = computeStats(session);

      expect(stats.commitCount).toBe(0);
      expect(stats.rewindCount).toBe(0);
    });

    test("prefers gitCommits over regex commits for commitCount", () => {
      const session = makeSession({
        commits: [
          makeCommit("abc1234", "fix: login bug"),
        ],
        gitCommits: [
          makeGitCommit("abc1234", "fix: login bug", { insertions: 10, deletions: 3 }),
          makeGitCommit("def5678", "feat: add search", { insertions: 50, deletions: 0 }),
          makeGitCommit("ghi9012", "chore: update deps", { insertions: 5, deletions: 20 }),
        ],
      });

      const stats = computeStats(session);

      // Should use gitCommits count (3), not regex commits count (1)
      expect(stats.commitCount).toBe(3);
    });

    test("passes gitCommits through to stats when available", () => {
      const gitCommits = [
        makeGitCommit("abc1234", "fix: login bug", { insertions: 10, deletions: 3 }),
        makeGitCommit("def5678", "feat: add search", { insertions: 50, deletions: 0 }),
      ];

      const session = makeSession({ gitCommits });
      const stats = computeStats(session);

      expect(stats.gitCommits).toEqual(gitCommits);
    });

    test("omits gitCommits from stats when not available", () => {
      const session = makeSession({
        commits: [makeCommit("abc1234", "fix: bug")],
      });

      const stats = computeStats(session);

      expect(stats.gitCommits).toBeUndefined();
    });

    test("falls back to regex commits when gitCommits is empty array", () => {
      const session = makeSession({
        commits: [
          makeCommit("abc1234", "fix: login bug"),
          makeCommit("def5678", "feat: search"),
        ],
        gitCommits: [],
      });

      const stats = computeStats(session);

      expect(stats.commitCount).toBe(2);
      expect(stats.gitCommits).toBeUndefined();
    });
  });

  // ========================================================================
  // DURATION AND COST FROM RESULT
  // ========================================================================

  describe("duration and cost", () => {
    test("extracts duration and cost from session result", () => {
      const session = makeSession({
        result: {
          success: true,
          durationMs: 45000,
          costUsd: 0.12,
        },
      });

      const stats = computeStats(session);

      expect(stats.durationMs).toBe(45000);
      expect(stats.costUsd).toBe(0.12);
    });

    test("extracts duration without cost when cost is absent", () => {
      const session = makeSession({
        result: {
          success: true,
          durationMs: 30000,
        },
      });

      const stats = computeStats(session);

      expect(stats.durationMs).toBe(30000);
      expect(stats.costUsd).toBeUndefined();
    });

    test("omits duration and cost when result is absent", () => {
      const session = makeSession();
      const stats = computeStats(session);

      expect(stats.durationMs).toBeUndefined();
      expect(stats.costUsd).toBeUndefined();
    });

    test("includes duration even for failed sessions", () => {
      const session = makeSession({
        result: {
          success: false,
          durationMs: 5000,
          costUsd: 0.01,
        },
      });

      const stats = computeStats(session);

      expect(stats.durationMs).toBe(5000);
      expect(stats.costUsd).toBe(0.01);
    });
  });

  // ========================================================================
  // TOKEN USAGE
  // ========================================================================

  describe("token usage", () => {
    test("passes through token usage from session", () => {
      const session = makeSession({
        tokenUsage: {
          inputTokens: 500,
          outputTokens: 1200,
          cacheCreationInputTokens: 10000,
          cacheReadInputTokens: 50000,
        },
      });

      const stats = computeStats(session);

      expect(stats.tokenUsage).toEqual({
        inputTokens: 500,
        outputTokens: 1200,
        cacheCreationInputTokens: 10000,
        cacheReadInputTokens: 50000,
      });
    });

    test("omits token usage when not present on session", () => {
      const session = makeSession();
      const stats = computeStats(session);

      expect(stats.tokenUsage).toBeUndefined();
    });

    test("includes token usage alongside duration and cost", () => {
      const session = makeSession({
        result: {
          success: true,
          durationMs: 60000,
          costUsd: 0.50,
        },
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 2000,
          cacheCreationInputTokens: 5000,
          cacheReadInputTokens: 30000,
        },
      });

      const stats = computeStats(session);

      expect(stats.durationMs).toBe(60000);
      expect(stats.costUsd).toBe(0.50);
      expect(stats.tokenUsage).toBeDefined();
      expect(stats.tokenUsage!.outputTokens).toBe(2000);
    });
  });

  // ========================================================================
  // TURN DURATION STATS
  // ========================================================================

  describe("turn duration stats", () => {
    test("computes summary stats from turnDurations", () => {
      const session = makeSession({
        turnDurations: [5000, 12000, 79259],
      });

      const stats = computeStats(session);

      expect(stats.turnDurationStats).toBeDefined();
      expect(stats.turnDurationStats!.totalActiveMs).toBe(96259);
      expect(stats.turnDurationStats!.averageMs).toBe(32086); // Math.round(96259/3)
      expect(stats.turnDurationStats!.longestMs).toBe(79259);
      expect(stats.turnDurationStats!.count).toBe(3);
    });

    test("handles single turn duration", () => {
      const session = makeSession({
        turnDurations: [42000],
      });

      const stats = computeStats(session);

      expect(stats.turnDurationStats).toBeDefined();
      expect(stats.turnDurationStats!.totalActiveMs).toBe(42000);
      expect(stats.turnDurationStats!.averageMs).toBe(42000);
      expect(stats.turnDurationStats!.longestMs).toBe(42000);
      expect(stats.turnDurationStats!.count).toBe(1);
    });

    test("returns undefined turnDurationStats when no durations", () => {
      const session = makeSession();
      const stats = computeStats(session);

      expect(stats.turnDurationStats).toBeUndefined();
    });

    test("returns undefined turnDurationStats when durations is empty array", () => {
      const session = makeSession({
        turnDurations: [],
      });

      const stats = computeStats(session);

      expect(stats.turnDurationStats).toBeUndefined();
    });
  });

  // ========================================================================
  // INTEGRATION: FULL SESSION
  // ========================================================================

  describe("full session integration", () => {
    test("computes all stats for a realistic session", () => {
      const agentId = asAgentId("agent-research");

      const session = makeSession({
        turns: [
          userTurn("u1", "Fix the login bug"),
          assistantTurn("a1", "Let me investigate", {
            toolCalls: [
              toolCall("t1", "Grep", { pattern: "login" }),
              toolCall("t2", "Read", { file_path: "/src/auth.ts" }),
            ],
          }),
          userTurn("u2", "", {
            toolResults: [
              toolResult("t1", "3 matches found"),
              toolResult("t2", "file contents"),
            ],
          }),
          assistantTurn("a2", "Found the issue, fixing now", {
            toolCalls: [
              toolCall("t3", "Edit", {
                file_path: "/src/auth.ts",
                old_string: "bug",
                new_string: "fix",
              }),
              toolCall("t4", "Bash", { command: "bun test" }),
            ],
          }),
          userTurn("u3", "", {
            toolResults: [
              toolResult("t3", "edited"),
              toolResult("t4", "all tests pass"),
            ],
          }),
          assistantTurn("a3", "Fixed the login bug. Tests pass."),
        ],
        subagents: [
          makeSubagent(agentId, [
            assistantTurn("sa1", "Researching auth patterns", {
              toolCalls: [toolCall("st1", "Read", { file_path: "/docs/auth.md" })],
            }),
          ]),
        ],
        commits: [makeCommit("abc1234", "fix: login bug")],
        rewinds: [makeRewind("a1", ["u2-old"])],
        tokenUsage: {
          inputTokens: 150,
          outputTokens: 800,
          cacheCreationInputTokens: 5000,
          cacheReadInputTokens: 25000,
        },
        result: {
          success: true,
          durationMs: 120000,
          costUsd: 0.35,
        },
      });

      const stats = computeStats(session);

      expect(stats.turnCount).toEqual({ total: 6, user: 3, assistant: 3 });
      expect(stats.toolCounts).toEqual({
        Read: 1,
        Grep: 1,
        Edit: 1,
        Bash: 1,
      });
      expect(stats.subagentSummaries).toHaveLength(1);
      expect(stats.subagentSummaries[0]!.agentId).toBe(agentId);
      expect(stats.commitCount).toBe(1);
      expect(stats.rewindCount).toBe(1);
      expect(stats.durationMs).toBe(120000);
      expect(stats.costUsd).toBe(0.35);
      expect(stats.tokenUsage).toEqual({
        inputTokens: 150,
        outputTokens: 800,
        cacheCreationInputTokens: 5000,
        cacheReadInputTokens: 25000,
      });
    });
  });
});

// ============================================================================
// computeTokenStats
// ============================================================================

describe("computeTokenStats", () => {
  // ========================================================================
  // EMPTY TURNS
  // ========================================================================

  describe("empty turns", () => {
    test("returns sensible defaults for empty turns array", () => {
      const stats = computeTokenStats([]);

      expect(stats.peakContextTokens).toBe(0);
      expect(stats.peakContextPercent).toBe(0);
      expect(stats.finalContextTokens).toBe(0);
      expect(stats.cumulativeOutputTokens).toBe(0);
      expect(stats.cumulativeInputTokens).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
      expect(stats.estimatedCostUsd).toBeUndefined();
      expect(stats.contextWindowSize).toBe(200_000);
      expect(stats.model).toBeUndefined();
    });

    test("returns zeros when turns have no tokenUsage", () => {
      const turns = [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi there!"),
        userTurn("u2", "Thanks"),
      ];

      const stats = computeTokenStats(turns);

      expect(stats.peakContextTokens).toBe(0);
      expect(stats.finalContextTokens).toBe(0);
      expect(stats.cumulativeOutputTokens).toBe(0);
      expect(stats.cumulativeInputTokens).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
    });
  });

  // ========================================================================
  // PEAK CONTEXT DETECTION
  // ========================================================================

  describe("peak context detection", () => {
    test("tracks peak context across multiple turns with growing context", () => {
      const turns = [
        assistantTurn("a1", "First response", {
          tokenUsage: {
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationInputTokens: 5000,
            cacheReadInputTokens: 10000,
          },
        }),
        userTurn("u1", "Next question"),
        assistantTurn("a2", "Second response", {
          tokenUsage: {
            inputTokens: 2000,
            outputTokens: 800,
            cacheCreationInputTokens: 8000,
            cacheReadInputTokens: 30000,
          },
        }),
        userTurn("u2", "Another question"),
        assistantTurn("a3", "Third response", {
          tokenUsage: {
            inputTokens: 3000,
            outputTokens: 1200,
            cacheCreationInputTokens: 10000,
            cacheReadInputTokens: 50000,
          },
        }),
      ];

      const stats = computeTokenStats(turns);

      // Turn 1 context: 1000 + 5000 + 10000 = 16000
      // Turn 2 context: 2000 + 8000 + 30000 = 40000
      // Turn 3 context: 3000 + 10000 + 50000 = 63000
      expect(stats.peakContextTokens).toBe(63000);
      expect(stats.peakContextPercent).toBeCloseTo(63000 / 200_000, 6);
    });

    test("detects peak when middle turn has highest context", () => {
      const turns = [
        assistantTurn("a1", "Start", {
          tokenUsage: {
            inputTokens: 1000,
            outputTokens: 200,
            cacheCreationInputTokens: 5000,
            cacheReadInputTokens: 10000,
          },
        }),
        userTurn("u1", ""),
        assistantTurn("a2", "Big response", {
          tokenUsage: {
            inputTokens: 10000,
            outputTokens: 3000,
            cacheCreationInputTokens: 50000,
            cacheReadInputTokens: 100000,
          },
        }),
        userTurn("u2", ""),
        // After compaction, context shrinks
        assistantTurn("a3", "After compaction", {
          tokenUsage: {
            inputTokens: 500,
            outputTokens: 100,
            cacheCreationInputTokens: 2000,
            cacheReadInputTokens: 5000,
          },
        }),
      ];

      const stats = computeTokenStats(turns);

      // Peak is turn 2: 10000 + 50000 + 100000 = 160000
      expect(stats.peakContextTokens).toBe(160000);
      expect(stats.peakContextPercent).toBeCloseTo(160000 / 200_000, 6);
    });
  });

  // ========================================================================
  // FINAL CONTEXT
  // ========================================================================

  describe("final context", () => {
    test("final context is the last assistant turn's context size", () => {
      const turns = [
        assistantTurn("a1", "Big context", {
          tokenUsage: {
            inputTokens: 10000,
            outputTokens: 1000,
            cacheCreationInputTokens: 50000,
            cacheReadInputTokens: 80000,
          },
        }),
        userTurn("u1", ""),
        assistantTurn("a2", "Smaller context", {
          tokenUsage: {
            inputTokens: 500,
            outputTokens: 200,
            cacheCreationInputTokens: 2000,
            cacheReadInputTokens: 5000,
          },
        }),
      ];

      const stats = computeTokenStats(turns);

      // Last assistant turn context: 500 + 2000 + 5000 = 7500
      expect(stats.finalContextTokens).toBe(7500);
    });

    test("final context ignores trailing user turns", () => {
      const turns = [
        assistantTurn("a1", "Response", {
          tokenUsage: {
            inputTokens: 3000,
            outputTokens: 500,
            cacheCreationInputTokens: 10000,
            cacheReadInputTokens: 20000,
          },
        }),
        userTurn("u1", "One more question"),
      ];

      const stats = computeTokenStats(turns);

      // Last assistant turn context: 3000 + 10000 + 20000 = 33000
      expect(stats.finalContextTokens).toBe(33000);
    });
  });

  // ========================================================================
  // CUMULATIVE TOKENS
  // ========================================================================

  describe("cumulative tokens", () => {
    test("sums output tokens across all assistant turns", () => {
      const turns = [
        assistantTurn("a1", "First", {
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 500,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
        }),
        userTurn("u1", ""),
        assistantTurn("a2", "Second", {
          tokenUsage: {
            inputTokens: 200,
            outputTokens: 800,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
        }),
        userTurn("u2", ""),
        assistantTurn("a3", "Third", {
          tokenUsage: {
            inputTokens: 300,
            outputTokens: 1200,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
        }),
      ];

      const stats = computeTokenStats(turns);

      expect(stats.cumulativeOutputTokens).toBe(500 + 800 + 1200);
    });

    test("sums all input categories for cumulativeInputTokens", () => {
      const turns = [
        assistantTurn("a1", "Turn 1", {
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 50,
            cacheCreationInputTokens: 200,
            cacheReadInputTokens: 300,
          },
        }),
        userTurn("u1", ""),
        assistantTurn("a2", "Turn 2", {
          tokenUsage: {
            inputTokens: 400,
            outputTokens: 75,
            cacheCreationInputTokens: 500,
            cacheReadInputTokens: 600,
          },
        }),
      ];

      const stats = computeTokenStats(turns);

      // (100 + 200 + 300) + (400 + 500 + 600) = 600 + 1500 = 2100
      expect(stats.cumulativeInputTokens).toBe(2100);
    });
  });

  // ========================================================================
  // CACHE HIT RATE
  // ========================================================================

  describe("cache hit rate", () => {
    test("computes cache hit rate as cacheRead / total input", () => {
      const turns = [
        assistantTurn("a1", "Response", {
          tokenUsage: {
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationInputTokens: 2000,
            cacheReadInputTokens: 7000,
          },
        }),
      ];

      const stats = computeTokenStats(turns);

      // cacheRead / (input + cacheRead + cacheCreation) = 7000 / (1000 + 7000 + 2000) = 0.7
      expect(stats.cacheHitRate).toBeCloseTo(0.7, 6);
    });

    test("returns zero cache hit rate when no cache reads", () => {
      const turns = [
        assistantTurn("a1", "Response", {
          tokenUsage: {
            inputTokens: 5000,
            outputTokens: 1000,
            cacheCreationInputTokens: 3000,
            cacheReadInputTokens: 0,
          },
        }),
      ];

      const stats = computeTokenStats(turns);

      expect(stats.cacheHitRate).toBe(0);
    });

    test("computes cache hit rate across multiple turns", () => {
      const turns = [
        assistantTurn("a1", "Turn 1", {
          tokenUsage: {
            inputTokens: 1000,
            outputTokens: 200,
            cacheCreationInputTokens: 5000,
            cacheReadInputTokens: 0,
          },
        }),
        userTurn("u1", ""),
        assistantTurn("a2", "Turn 2", {
          tokenUsage: {
            inputTokens: 500,
            outputTokens: 300,
            cacheCreationInputTokens: 1000,
            cacheReadInputTokens: 4500,
          },
        }),
      ];

      const stats = computeTokenStats(turns);

      // Total cacheRead = 0 + 4500 = 4500
      // Total input = (1000 + 5000 + 0) + (500 + 1000 + 4500) = 6000 + 6000 = 12000
      // Hit rate = 4500 / 12000 = 0.375
      expect(stats.cacheHitRate).toBeCloseTo(0.375, 6);
    });

    test("returns zero cache hit rate when total input is zero", () => {
      // Edge case: assistant turn with all-zero token usage
      const turns = [
        assistantTurn("a1", "Response", {
          tokenUsage: {
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
        }),
      ];

      const stats = computeTokenStats(turns);

      expect(stats.cacheHitRate).toBe(0);
    });
  });

  // ========================================================================
  // COST ESTIMATION
  // ========================================================================

  describe("cost estimation", () => {
    test("computes cost when model is known", () => {
      const turns = [
        assistantTurn("a1", "Response", {
          tokenUsage: {
            inputTokens: 100_000,
            outputTokens: 50_000,
            cacheCreationInputTokens: 200_000,
            cacheReadInputTokens: 500_000,
          },
        }),
      ];

      const stats = computeTokenStats(turns, "claude-sonnet-4-5-20250929");

      // Sonnet pricing: input=$3/M, output=$15/M, cacheWrite=$3.75/M, cacheRead=$0.30/M
      // 100k * 3/1M + 50k * 15/1M + 200k * 3.75/1M + 500k * 0.3/1M
      // = 0.30 + 0.75 + 0.75 + 0.15 = 1.95
      expect(stats.estimatedCostUsd).toBeCloseTo(1.95, 6);
      expect(stats.model).toBe("claude-sonnet-4-5-20250929");
    });

    test("cost is undefined when model is unknown", () => {
      const turns = [
        assistantTurn("a1", "Response", {
          tokenUsage: {
            inputTokens: 100_000,
            outputTokens: 50_000,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
        }),
      ];

      const stats = computeTokenStats(turns, "gpt-4o-unknown");

      expect(stats.estimatedCostUsd).toBeUndefined();
      expect(stats.model).toBe("gpt-4o-unknown");
    });

    test("cost is undefined when model is not provided", () => {
      const turns = [
        assistantTurn("a1", "Response", {
          tokenUsage: {
            inputTokens: 50_000,
            outputTokens: 10_000,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
        }),
      ];

      const stats = computeTokenStats(turns);

      expect(stats.estimatedCostUsd).toBeUndefined();
      expect(stats.model).toBeUndefined();
    });

    test("sums costs across multiple turns for known model", () => {
      const turns = [
        assistantTurn("a1", "Turn 1", {
          tokenUsage: {
            inputTokens: 50_000,
            outputTokens: 10_000,
            cacheCreationInputTokens: 100_000,
            cacheReadInputTokens: 0,
          },
        }),
        userTurn("u1", ""),
        assistantTurn("a2", "Turn 2", {
          tokenUsage: {
            inputTokens: 10_000,
            outputTokens: 20_000,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 150_000,
          },
        }),
      ];

      const stats = computeTokenStats(turns, "claude-sonnet-4-5-20250929");

      // Cumulative: input=60k, output=30k, cacheWrite=100k, cacheRead=150k
      // 60k * 3/1M + 30k * 15/1M + 100k * 3.75/1M + 150k * 0.3/1M
      // = 0.18 + 0.45 + 0.375 + 0.045 = 1.05
      expect(stats.estimatedCostUsd).toBeCloseTo(1.05, 6);
    });
  });

  // ========================================================================
  // CONTEXT WINDOW SIZE
  // ========================================================================

  describe("context window", () => {
    test("contextWindowSize defaults to 200K for unknown models", () => {
      const stats = computeTokenStats([]);
      expect(stats.contextWindowSize).toBe(200_000);
    });

    test("contextWindowSize is 1M for opus-4-6", () => {
      const stats = computeTokenStats([], "claude-opus-4-6");
      expect(stats.contextWindowSize).toBe(1_000_000);
    });

    test("peakContextPercent is relative to model context window", () => {
      const turns = [
        assistantTurn("a1", "Response", {
          tokenUsage: {
            inputTokens: 50_000,
            outputTokens: 10_000,
            cacheCreationInputTokens: 50_000,
            cacheReadInputTokens: 100_000,
          },
        }),
      ];

      // Against 200K (default) — 200K context = 100%
      const stats200k = computeTokenStats(turns);
      expect(stats200k.peakContextPercent).toBeCloseTo(1.0, 6);

      // Against 1M (opus-4-6) — 200K context = 20%
      const stats1m = computeTokenStats(turns, "claude-opus-4-6");
      expect(stats1m.peakContextPercent).toBeCloseTo(0.2, 6);
    });
  });

  // ========================================================================
  // SKIPS USER TURNS
  // ========================================================================

  describe("ignores non-assistant turns", () => {
    test("user turns without tokenUsage are skipped", () => {
      const turns = [
        userTurn("u1", "Hello"),
        assistantTurn("a1", "Hi", {
          tokenUsage: {
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationInputTokens: 2000,
            cacheReadInputTokens: 3000,
          },
        }),
        userTurn("u2", "Thanks"),
      ];

      const stats = computeTokenStats(turns);

      expect(stats.peakContextTokens).toBe(6000); // 1000 + 2000 + 3000
      expect(stats.cumulativeOutputTokens).toBe(500);
      expect(stats.cumulativeInputTokens).toBe(6000); // 1000 + 2000 + 3000
    });
  });

  // ========================================================================
  // INTEGRATION WITH computeStats
  // ========================================================================

  describe("integration with computeStats", () => {
    test("computeStats includes tokenStats when turns have tokenUsage", () => {
      const session = makeSession({
        model: "claude-sonnet-4-5-20250929",
        turns: [
          userTurn("u1", "Hello"),
          assistantTurn("a1", "Hi", {
            tokenUsage: {
              inputTokens: 1000,
              outputTokens: 500,
              cacheCreationInputTokens: 5000,
              cacheReadInputTokens: 10000,
            },
          }),
          userTurn("u2", ""),
          assistantTurn("a2", "Done", {
            tokenUsage: {
              inputTokens: 2000,
              outputTokens: 800,
              cacheCreationInputTokens: 8000,
              cacheReadInputTokens: 30000,
            },
          }),
        ],
      });

      const stats = computeStats(session);

      expect(stats.tokenStats).toBeDefined();
      expect(stats.tokenStats!.peakContextTokens).toBe(40000); // 2000+8000+30000
      expect(stats.tokenStats!.finalContextTokens).toBe(40000);
      expect(stats.tokenStats!.cumulativeOutputTokens).toBe(1300); // 500+800
      expect(stats.tokenStats!.model).toBe("claude-sonnet-4-5-20250929");
      expect(stats.tokenStats!.estimatedCostUsd).toBeDefined();
    });

    test("computeStats omits tokenStats when no turns have tokenUsage", () => {
      const session = makeSession({
        turns: [
          userTurn("u1", "Hello"),
          assistantTurn("a1", "Hi"),
        ],
      });

      const stats = computeStats(session);

      expect(stats.tokenStats).toBeUndefined();
    });
  });

  // ========================================================================
  // BTW COUNT (aside_question subagents)
  // ========================================================================

  describe("btwCount", () => {
    test("counts aside_question subagents", () => {
      const session = makeSession({
        subagents: [
          makeSubagent("agent-aside_question-abc123", [
            userTurn("u1", "What is X?"),
            assistantTurn("a1", "X is Y."),
          ]),
          makeSubagent("agent-aside_question-def456", [
            userTurn("u2", "What is Z?"),
            assistantTurn("a2", "Z is W."),
          ]),
        ],
      });

      const stats = computeStats(session);

      expect(stats.btwCount).toBe(2);
    });

    test("returns 0 when no aside_question subagents exist", () => {
      const session = makeSession({
        subagents: [
          makeSubagent("agent-regular-task-xyz", [
            userTurn("u1", "Do work"),
            assistantTurn("a1", "Done."),
          ]),
        ],
      });

      const stats = computeStats(session);

      expect(stats.btwCount).toBe(0);
    });

    test("returns 0 for session with no subagents", () => {
      const session = makeSession();
      const stats = computeStats(session);

      expect(stats.btwCount).toBe(0);
    });

    test("only counts aside_question subagents, not regular ones", () => {
      const session = makeSession({
        subagents: [
          makeSubagent("agent-aside_question-q1", [
            userTurn("u1", "Question?"),
            assistantTurn("a1", "Answer."),
          ]),
          makeSubagent("agent-regular-task-t1", [
            userTurn("u2", "Task"),
            assistantTurn("a2", "Done."),
          ]),
          makeSubagent("agent-aside_question-q2", [
            userTurn("u3", "Another question?"),
            assistantTurn("a3", "Another answer."),
          ]),
        ],
      });

      const stats = computeStats(session);

      expect(stats.btwCount).toBe(2);
    });
  });
});
