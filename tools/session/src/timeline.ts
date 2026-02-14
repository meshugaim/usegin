/**
 * Timeline event model for chronological session reconstruction.
 *
 * Transforms a ParsedSession into a flat, sorted list of TimelineEvents
 * that interleave user messages, tool calls, subagent lifecycles, commits,
 * and session boundaries into a single chronological stream.
 *
 * This module is pure data transformation — no I/O, no side effects,
 * no formatting. Feed the result into a renderer for display.
 */

import type {
  ParsedSession,
  ParsedSubagent,
  Turn,
  ToolCall,
  AgentId,
  ToolUseId,
  CommitInfo,
  CompactionEvent,
  EntryUuid,
} from "./types";
import { getToolCallInput } from "./types";
import { truncate } from "./format-utils";

// ============================================================================
// TYPES
// ============================================================================

export type TimelineEvent =
  | { kind: "session_start"; timestamp: Date }
  | { kind: "user_message"; timestamp: Date; text: string; queued?: boolean; compactionSummary?: boolean; originalLength?: number }
  | { kind: "assistant_message"; timestamp: Date; text: string }
  | { kind: "tool_call"; timestamp: Date; toolName: string; summary: string }
  | { kind: "subagent_spawn"; timestamp: Date; agentId: AgentId; description: string; report?: string }
  | { kind: "subagent_resume"; timestamp: Date; agentId: AgentId; description: string; report?: string }
  | { kind: "subagent_return"; timestamp: Date; agentId: AgentId; turns: number; durationMs?: number; report?: string }
  | { kind: "commit"; timestamp: Date; hash: string; subject: string }
  | { kind: "interrupted"; timestamp: Date }
  | { kind: "compaction"; timestamp: Date; number: number; trigger: string; preTokens: number }
  | { kind: "idle_gap"; timestamp: Date; durationMs: number }
  | { kind: "session_end"; timestamp: Date; totalDurationMs?: number };

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sort priority for event kinds when timestamps are equal.
 *
 * Lower values sort first. Only events that need explicit ordering
 * have a defined priority; all others are treated as 0 (no preference).
 *
 * Key ordering: compaction markers (-1) should appear before user_messages (0)
 * that follow them, since the summary message is a consequence of the compaction.
 */
function kindSortPriority(kind: TimelineEvent["kind"]): number {
  switch (kind) {
    case "session_start": return -10;
    case "compaction": return -1;
    case "session_end": return 10;
    default: return 0;
  }
}

// ============================================================================
// USER MESSAGE CLASSIFICATION
// ============================================================================

/**
 * Classification of user-turn text to separate human input from system noise.
 *
 * - "human": Real user input — show in timeline
 * - "notification": Task/agent notification (<task-notification>) — skip
 * - "skill_injection": Skill SKILL.md injection — skip
 * - "command": Slash command (<command-message>) — skip (tool call appears separately)
 * - "interrupted": User interrupted the agent — show (useful context)
 * - "tool_result_only": No text, just tool results — skip
 */
export type UserMessageKind =
  | "human"
  | "compaction-summary"
  | "notification"
  | "skill_injection"
  | "command"
  | "interrupted"
  | "tool_result_only";

/**
 * Classify a user turn's text to determine whether it represents real human
 * input or system-generated noise.
 *
 * System messages like task notifications, skill injections, and command
 * wrappers are filtered out so the timeline shows only the narrative —
 * what the human actually said.
 */
export function classifyUserMessage(text: string): UserMessageKind {
  if (!text || text.trim() === "") return "tool_result_only";
  if (text.startsWith("<task-notification>")) return "notification";
  if (text.startsWith("<command-message>")) return "command";
  if (text.startsWith("Base directory for this skill:")) return "skill_injection";
  // Skill loaded as prompt: typically has "# <SkillName>" header and "Triggered by" marker
  if (text.includes("# ") && text.includes("Triggered by")) return "skill_injection";
  if (text === "[Request interrupted by user]") return "interrupted";
  return "human";
}

/**
 * Parse an ISO timestamp string to a Date, returning undefined if invalid.
 */
function parseTimestamp(ts: string | undefined): Date | undefined {
  if (!ts) return undefined;
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

/**
 * Summarize a tool call for timeline display.
 *
 * Returns a short, human-readable string describing what the tool call does.
 * Similar to getToolSummary in formatter.ts but tuned for timeline brevity.
 */
export function summarizeToolCall(tc: ToolCall): string {
  const input = tc.input;

  switch (tc.name) {
    case "Read":
      return String(input.file_path || "");
    case "Write":
      return String(input.file_path || "");
    case "Edit":
      return String(input.file_path || "");
    case "Glob":
      return `pattern="${input.pattern || ""}"`;
    case "Grep":
      return `pattern="${input.pattern || ""}"`;
    case "Bash": {
      const cmd = String(input.command || "");
      return truncate(cmd, 60);
    }
    case "Task":
      return truncate(String(input.description || input.prompt || ""), 60);
    case "Skill":
      return String(input.skill || "");
    case "TodoWrite": {
      const todoInput = getToolCallInput("TodoWrite", tc);
      return `${todoInput?.todos.length ?? 0} todos`;
    }
    default: {
      // Return first string value found, truncated
      for (const v of Object.values(input)) {
        if (typeof v === "string" && v.length > 0) {
          return truncate(v, 60);
        }
      }
      return "";
    }
  }
}

/**
 * Compute duration in ms between two Dates.
 * Returns undefined if the delta is negative.
 */
function durationMs(start: Date, end: Date): number | undefined {
  const delta = end.getTime() - start.getTime();
  return delta >= 0 ? delta : undefined;
}

// ============================================================================
// SUBAGENT MATCHING
// ============================================================================

/**
 * Find the last turn timestamp of a subagent, used as its "return" time.
 */
function subagentEndTimestamp(sub: ParsedSubagent): Date | undefined {
  // Walk backwards to find the last turn with a timestamp
  for (let i = sub.turns.length - 1; i >= 0; i--) {
    const ts = parseTimestamp(sub.turns[i]!.timestamp);
    if (ts) return ts;
  }
  return undefined;
}

/**
 * Find the start timestamp of a subagent.
 * Prefers the explicit startTimestamp, falls back to first turn.
 */
function subagentStartTimestamp(sub: ParsedSubagent): Date | undefined {
  return parseTimestamp(sub.startTimestamp) ?? parseTimestamp(sub.turns[0]?.timestamp);
}

/**
 * Build a description for a subagent spawn event.
 *
 * Priority:
 * 1. Task tool call prompt that spawned this subagent (matched via tool result agentId)
 * 2. First assistant turn text, truncated to 80 chars
 * 3. Empty string
 */
function buildSpawnDescription(
  sub: ParsedSubagent,
  mainTurns: Turn[],
): string {
  // Try matching via Task tool call results in the main session.
  // Skip resume calls — we want the original spawn description.
  for (const turn of mainTurns) {
    for (const tr of turn.toolResults) {
      if (tr.content.includes(String(sub.agentId))) {
        const matchingTurn = mainTurns.find((t) =>
          t.toolCalls.some((tc) => tc.id === tr.toolUseId),
        );
        if (matchingTurn) {
          const taskCall = matchingTurn.toolCalls.find(
            (tc) => tc.id === tr.toolUseId,
          );
          if (taskCall) {
            const taskInput = getToolCallInput("Task", taskCall);
            if (taskInput && !taskInput.resume) {
              // Prefer description (short summary) over prompt (full instruction text)
              const desc = taskInput.description || taskInput.prompt;
              const name = taskInput.name;
              return name
                ? `${name}: ${truncate(desc, 70)}`
                : truncate(desc, 80);
            }
          }
        }
      }
    }
  }

  // Fallback: first assistant turn text
  const firstAssistant = sub.turns.find((t) => t.role === "assistant");
  if (firstAssistant?.text) {
    return truncate(firstAssistant.text, 80);
  }

  return "";
}

// ============================================================================
// SUBAGENT REPORT EXTRACTION
// ============================================================================

/**
 * Build a map of toolUseId -> report text from Task tool results in the main session.
 *
 * When a Task tool call completes, its tool_result content contains the subagent's
 * final output. This function scans main session turns to find those results and
 * extracts a cleaned, truncated preview of the report.
 *
 * Uses toolUseId as key (rather than agentId) so that multiple Task calls for the
 * same agent (spawn + resume) each get their own report.
 */
function buildToolUseReportMap(
  mainTurns: Turn[],
  reportLines: number = 1,
): Map<ToolUseId, string> {
  const reports = new Map<ToolUseId, string>();

  // Build a set of Task tool use IDs for quick lookup
  const taskToolUseIds = new Set<string>();
  for (const turn of mainTurns) {
    for (const tc of turn.toolCalls) {
      if (tc.name === "Task") {
        taskToolUseIds.add(tc.id);
      }
    }
  }

  // Scan all tool results and match them to Task tool calls
  for (const turn of mainTurns) {
    for (const tr of turn.toolResults) {
      if (taskToolUseIds.has(tr.toolUseId)) {
        const cleaned = cleanReportText(tr.content, reportLines);
        if (cleaned) {
          reports.set(tr.toolUseId, cleaned);
        }
      }
    }
  }

  return reports;
}

/**
 * Find the Task tool call that originally spawned a given subagent.
 *
 * Scans main turns for a Task tool_result whose content mentions the agentId
 * and whose corresponding Task tool_call does NOT have a `resume` field.
 * Returns the toolUseId of the spawning Task call, or undefined.
 */
function findSpawnToolUseId(
  agentId: AgentId,
  mainTurns: Turn[],
): ToolUseId | undefined {
  for (const turn of mainTurns) {
    for (const tr of turn.toolResults) {
      if (!tr.content.includes(String(agentId))) continue;
      // Find the matching Task tool call
      for (const t of mainTurns) {
        for (const tc of t.toolCalls) {
          if (tc.id === tr.toolUseId && tc.name === "Task") {
            const taskInput = getToolCallInput("Task", tc);
            if (taskInput && !taskInput.resume) {
              return tc.id;
            }
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Preamble patterns — lines that are just throat-clearing before the real content.
 * These are only skipped when there are enough substantive lines after them.
 */
const PREAMBLE_PATTERNS = [
  /^here is/i,
  /^here's/i,
  /^done\.?$/i,
  /^all done\.?$/i,
  /^commit succeeded/i,
  /^all tasks complete/i,
  /^i now have/i,
  /^i've completed/i,
  /^i have completed/i,
  /^task complete/i,
  /^completed\.?$/i,
  /^finished\.?$/i,
  /^summary:?$/i,
];

/**
 * Check if a line matches a preamble pattern.
 */
function isPreambleLine(text: string): boolean {
  return PREAMBLE_PATTERNS.some((p) => p.test(text));
}

/**
 * Clean and extract subagent report lines for timeline display.
 *
 * The raw tool result content can be very long (the subagent's entire final message).
 * This function:
 * 1. Strips markdown heading markers (## , ### , etc.)
 * 2. Strips trailing agentId metadata from lines
 * 3. Skips empty lines, metadata-only lines, `---` separators, and `<usage>` blocks
 * 4. Skips preamble-ish first lines (when enough substance follows)
 * 5. Collects up to `maxLines` meaningful lines
 * 6. Truncates each line to ~120 characters
 * 7. Joins collected lines with newline
 *
 * @param raw - Raw tool result content
 * @param maxLines - Maximum number of meaningful lines to collect (default: 1)
 */
export function cleanReportText(raw: string, maxLines: number = 1): string {
  const lines = raw.split("\n");

  // First pass: collect all meaningful lines
  const meaningful: string[] = [];
  let inUsageBlock = false;

  for (const line of lines) {
    let cleaned = line.trim();
    if (!cleaned) continue;

    // Skip <usage> XML blocks
    if (cleaned.startsWith("<usage>") || cleaned.startsWith("<usage ")) {
      inUsageBlock = true;
      continue;
    }
    if (inUsageBlock) {
      if (cleaned.includes("</usage>")) {
        inUsageBlock = false;
      }
      continue;
    }

    // Skip --- separators
    if (/^-{3,}$/.test(cleaned)) continue;

    // Strip markdown heading markers
    cleaned = cleaned.replace(/^#{1,6}\s+/, "");
    if (!cleaned) continue;

    // Skip lines that are purely agentId metadata
    if (/^(Done\.?\s*)?agentId:/i.test(cleaned)) continue;
    if (/^agentId\s*=/i.test(cleaned)) continue;

    // Strip trailing agentId metadata (e.g. "... agentId: agent-abc")
    cleaned = cleaned.replace(/\s+agentId:\s*\S+\s*$/, "");
    cleaned = cleaned.trim();
    if (!cleaned) continue;

    meaningful.push(cleaned);
  }

  if (meaningful.length === 0) return "";

  // Second pass: skip preamble lines at the start, but only if enough
  // substance follows. If the report is just one line of substance, show
  // it even if it looks like preamble.
  let startIdx = 0;
  while (
    startIdx < meaningful.length &&
    isPreambleLine(meaningful[startIdx]!) &&
    meaningful.length - startIdx - 1 >= 1 // at least 1 line after this preamble
  ) {
    startIdx++;
  }

  const selected = meaningful.slice(startIdx, startIdx + maxLines);
  return selected.map((l) => truncate(l, 120)).join("\n");
}

// ============================================================================
// BUILD TIMELINE
// ============================================================================

/** Options for buildTimeline. */
export interface BuildTimelineOptions {
  /** Number of report lines to extract from subagent results (default: 1). */
  reportLines?: number;
}

/**
 * Build a chronologically sorted timeline from a parsed session.
 *
 * Walks the session's turns, subagents, and commits to produce a flat
 * list of events ordered by timestamp. Events without valid timestamps
 * are silently skipped.
 *
 * @param session - A fully parsed session (with subagents if available)
 * @param options - Optional configuration for timeline construction
 * @returns Sorted array of timeline events
 */
export function buildTimeline(
  session: ParsedSession,
  options?: BuildTimelineOptions,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // --- Session start ---
  const startDate = parseTimestamp(session.startTimestamp);
  if (startDate) {
    events.push({ kind: "session_start", timestamp: startDate });
  }

  // --- Main session turns ---
  for (const turn of session.turns) {
    const ts = parseTimestamp(turn.timestamp);
    if (!ts) continue;

    if (turn.role === "user") {
      // Compaction summaries are detected via the turn metadata flag
      // (set by the parser when a user message follows a compact_boundary).
      // They get their own classification so they render distinctly.
      if (turn.isCompactionSummary) {
        events.push({
          kind: "user_message",
          timestamp: ts,
          text: truncate(turn.text, 100),
          compactionSummary: true,
          originalLength: turn.text.length,
        });
        continue;
      }

      const classification = classifyUserMessage(turn.text);
      // Only emit events for real human input and interruptions.
      // System noise (notifications, skill injections, commands, bare tool results)
      // is filtered out to keep the timeline readable.
      if (classification === "interrupted") {
        events.push({ kind: "interrupted", timestamp: ts });
      } else if (classification === "human") {
        events.push({
          kind: "user_message",
          timestamp: ts,
          text: truncate(turn.text, 80),
        });
      }
    }

    // Assistant text without tool calls — the agent speaking to the user.
    // These are the narrative glue that explains what happened between actions.
    if (turn.role === "assistant" && turn.text && turn.toolCalls.length === 0) {
      events.push({
        kind: "assistant_message",
        timestamp: ts,
        text: truncate(turn.text, 80),
      });
    }

    // Tool calls (from assistant turns)
    for (const tc of turn.toolCalls) {
      // Task tool calls get a subagent_spawn event instead of a plain tool_call
      if (tc.name === "Task") {
        // We'll handle subagent spawns separately below to get the agentId
        continue;
      }

      events.push({
        kind: "tool_call",
        timestamp: ts,
        toolName: tc.name,
        summary: summarizeToolCall(tc),
      });
    }
  }

  // --- Queued user messages ---
  // These are messages the user sent while the agent was mid-turn.
  // They exist as queue-operation/enqueue entries rather than normal turns.
  if (session.queuedMessages) {
    for (const qm of session.queuedMessages) {
      const ts = parseTimestamp(qm.timestamp);
      if (!ts) continue;

      // Apply the same classification as regular user messages —
      // queued task-notifications are still noise.
      const classification = classifyUserMessage(qm.content);
      if (classification === "interrupted") {
        events.push({ kind: "interrupted", timestamp: ts });
      } else if (classification === "human") {
        events.push({
          kind: "user_message",
          timestamp: ts,
          text: truncate(qm.content, 80),
          queued: true,
        });
      }
    }
  }

  // --- Subagent spawn, resume, and return events ---
  const { reportLines = 1 } = options ?? {};
  const reportMap = buildToolUseReportMap(session.turns, reportLines);

  for (const sub of session.subagents) {
    const spawnTs = subagentStartTimestamp(sub);
    if (spawnTs) {
      // Find the spawning Task call's toolUseId for report lookup
      const spawnToolUseId = findSpawnToolUseId(sub.agentId, session.turns);
      const spawnReport = spawnToolUseId ? reportMap.get(spawnToolUseId) : undefined;
      events.push({
        kind: "subagent_spawn",
        timestamp: spawnTs,
        agentId: sub.agentId,
        description: buildSpawnDescription(sub, session.turns),
        ...(spawnReport ? { report: spawnReport } : {}),
      });
    }

    const endTs = subagentEndTimestamp(sub);
    if (endTs) {
      const startTs = subagentStartTimestamp(sub);
      events.push({
        kind: "subagent_return",
        timestamp: endTs,
        agentId: sub.agentId,
        turns: sub.turns.length,
        ...(startTs ? { durationMs: durationMs(startTs, endTs) } : {}),
      });
    }
  }

  // --- Subagent resume events ---
  // Scan assistant turns for Task tool calls with a `resume` field.
  // These represent a previously-returned agent being resumed with a new prompt.
  for (const turn of session.turns) {
    const ts = parseTimestamp(turn.timestamp);
    if (!ts) continue;

    for (const tc of turn.toolCalls) {
      const taskInput = getToolCallInput("Task", tc);
      if (!taskInput?.resume) continue;

      const agentId = taskInput.resume as AgentId;
      const desc = taskInput.description || taskInput.prompt;
      const name = taskInput.name;
      const description = name
        ? `${name}: ${truncate(desc, 70)}`
        : truncate(desc, 80);

      const resumeReport = reportMap.get(tc.id);

      events.push({
        kind: "subagent_resume",
        timestamp: ts,
        agentId,
        description,
        ...(resumeReport ? { report: resumeReport } : {}),
      });
    }
  }

  // --- Commit events ---
  // Prefer gitCommits (from git log) if available, fall back to regex-extracted commits
  const commits: CommitInfo[] = session.commits;
  for (const commit of commits) {
    // CommitInfo doesn't have a timestamp, so we can't place these precisely.
    // If a GitCommit (from git-commits.ts) is in use and has a timestamp, it
    // would be on a different field. For now, skip commits without timestamps.
    // However, we check if the commit object has a timestamp property (duck typing
    // for GitCommit which extends CommitInfo with extra fields).
    const commitAny = commit as Record<string, unknown>;
    const commitTs = parseTimestamp(commitAny.timestamp as string | undefined);
    if (commitTs) {
      events.push({
        kind: "commit",
        timestamp: commitTs,
        hash: commit.hash,
        subject: commit.message ?? "",
      });
    }
  }

  // --- Compaction boundary events ---
  // Each compaction marks a context window reset. They are numbered
  // sequentially (1-based) for display in the timeline.
  for (let i = 0; i < session.compactions.length; i++) {
    const compaction = session.compactions[i]!;
    const compTs = parseTimestamp(compaction.timestamp);
    if (compTs) {
      events.push({
        kind: "compaction",
        timestamp: compTs,
        number: i + 1,
        trigger: compaction.trigger,
        preTokens: compaction.preTokens,
      });
    }
  }

  // --- Session end ---
  const endDate = parseTimestamp(session.endTimestamp);
  if (endDate) {
    const totalMs = startDate ? durationMs(startDate, endDate) : undefined;
    events.push({
      kind: "session_end",
      timestamp: endDate,
      ...(totalMs !== undefined ? { totalDurationMs: totalMs } : {}),
    });
  }

  // --- Sort chronologically ---
  // When timestamps are equal, use kind priority as tiebreaker.
  // Compaction markers should appear before compaction summary messages.
  events.sort((a, b) => {
    const timeDiff = a.timestamp.getTime() - b.timestamp.getTime();
    if (timeDiff !== 0) return timeDiff;
    return (kindSortPriority(a.kind) ?? 0) - (kindSortPriority(b.kind) ?? 0);
  });

  // --- Detect idle gaps ---
  // Insert idle_gap events when consecutive events are more than 5 minutes apart.
  // This makes dead time visible in the timeline — waiting for CI, thinking,
  // context switches, etc.
  const IDLE_GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  const enrichedEvents: TimelineEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    if (i > 0) {
      const gap =
        events[i]!.timestamp.getTime() - events[i - 1]!.timestamp.getTime();
      if (gap > IDLE_GAP_THRESHOLD_MS) {
        enrichedEvents.push({
          kind: "idle_gap",
          timestamp: events[i - 1]!.timestamp,
          durationMs: gap,
        });
      }
    }
    enrichedEvents.push(events[i]!);
  }

  return enrichedEvents;
}
