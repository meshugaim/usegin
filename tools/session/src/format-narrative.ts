/**
 * Narrative output format for session transcripts
 */

import type {
  ParsedSession,
  ParsedSubagent,
  Turn,
  QueuedMessage,
  CompactionEvent,
  EntryUuid,
} from "./types";
import type { GitCommit } from "./git-commits";
import type { FormatOptions } from "./format-shared";
import {
  defaultOptions,
  formatTurn,
} from "./format-shared";
import { formatTokenCount } from "./format-utils";

// ============================================================================
// COMPACTION HELPERS
// ============================================================================

interface CompactionTurnContext {
  compaction: CompactionEvent;
  /** 1-based compaction index */
  index: number;
}

/**
 * Build a lookup map from compaction summary turn UUID to its context.
 *
 * This allows O(1) lookup during turn rendering to decide whether a turn
 * needs a compaction boundary marker inserted before it.
 */
function buildCompactionContext(
  compactions: CompactionEvent[]
): Map<EntryUuid, CompactionTurnContext> {
  const map = new Map<EntryUuid, CompactionTurnContext>();
  for (let i = 0; i < compactions.length; i++) {
    const compaction = compactions[i]!;
    if (compaction.summaryMessageUuid) {
      map.set(compaction.summaryMessageUuid, {
        compaction,
        index: i + 1,
      });
    }
  }
  return map;
}

/**
 * Format a compaction boundary marker line.
 *
 * Example:
 *   ━━━ Compaction #1 (auto) ━━━ 172k tokens ━━━ Segment 2 of 5 ━━━
 */
function formatCompactionMarker(
  compaction: CompactionEvent,
  index: number,
  totalSegments: number
): string {
  const segmentNumber = index + 1; // Segment after this compaction
  const parts = [
    `Compaction #${index} (${compaction.trigger})`,
    `${formatTokenCount(compaction.preTokens)} tokens`,
    `Segment ${segmentNumber} of ${totalSegments}`,
  ];
  return `━━━ ${parts.join(" ━━━ ")} ━━━`;
}

// ============================================================================
// COMMIT INTERLEAVING
// ============================================================================

/**
 * Format a commit block for narrative interleaving.
 *
 * Renders a visually distinct commit marker with the short hash, subject line,
 * and optional diff stats (insertions, deletions, files changed).
 *
 * Example output:
 *   ── commit abc1234 ─────────────────────
 *   fix: login bug (+42, -7, 3 files)
 *   ────────────────────────────────────────
 */
function formatCommitBlock(commit: GitCommit): string {
  const stats: string[] = [];
  if (commit.insertions !== undefined) stats.push(`+${commit.insertions}`);
  if (commit.deletions !== undefined) stats.push(`-${commit.deletions}`);
  if (commit.filesChanged !== undefined) stats.push(`${commit.filesChanged} files`);
  const statsStr = stats.length > 0 ? ` (${stats.join(", ")})` : "";

  return [
    `── commit ${commit.shortHash} ${"─".repeat(Math.max(0, 30 - commit.shortHash.length))}`,
    `${commit.subject}${statsStr}`,
    "─".repeat(40),
  ].join("\n");
}

// ============================================================================
// NARRATIVE FORMAT
// ============================================================================

/**
 * Format a session as a narrative transcript
 */
export function formatNarrative(
  session: ParsedSession,
  options: Partial<FormatOptions> = {}
): string {
  const formatOptions = { ...defaultOptions, ...options };
  const lines: string[] = [];

  // Summary header (separate from other metadata)
  if (session.summary) {
    lines.push("━".repeat(40));
    lines.push(`★ ${session.summary}`);
    lines.push("━".repeat(40));
    lines.push("");
  }

  // Header section (metadata about the session)
  const hasHeaders =
    (session.triggeredSkills && session.triggeredSkills.length > 0) ||
    (session.rewinds && session.rewinds.length > 0);

  if (hasHeaders) {
    lines.push("─".repeat(40));
    if (session.triggeredSkills && session.triggeredSkills.length > 0) {
      lines.push(`SKILLS: ${session.triggeredSkills.join(", ")}`);
    }
    if (session.rewinds && session.rewinds.length > 0) {
      lines.push(`REWINDS: ${session.rewinds.length}`);
    }
    lines.push("─".repeat(40));
    lines.push("");
  }

  // Build compaction context: map from summary turn UUID -> compaction info
  const compactionCtx = buildCompactionContext(session.compactions);
  const totalSegments = session.compactions.length + 1;

  // Helper to render a turn with compaction awareness
  const renderTurn = (turn: Turn): void => {
    // Insert compaction boundary marker before compaction summary turns
    const ctx = compactionCtx.get(turn.uuid);
    if (ctx) {
      lines.push(formatCompactionMarker(ctx.compaction, ctx.index, totalSegments));
      lines.push("");
    }

    lines.push(formatTurn(turn, formatOptions));
    lines.push("");
  };

  // Determine whether to interleave commits into the chronological stream
  const interleaveCommits =
    formatOptions.commits === true &&
    session.gitCommits != null &&
    session.gitCommits.length > 0;

  // Build a unified chronological stream of turns, queued messages, and optionally commits
  type StreamItem =
    | { kind: "turn"; timestamp?: string; turn: Turn }
    | { kind: "queued"; timestamp: string; message: QueuedMessage }
    | { kind: "commit"; timestamp: string; commit: GitCommit };

  const stream: StreamItem[] = [];

  // Always include turns
  for (const turn of session.turns) {
    stream.push({ kind: "turn", timestamp: turn.timestamp, turn });
  }

  // Include queued messages when present
  const queuedMessages = session.queuedMessages ?? [];
  for (const qm of queuedMessages) {
    stream.push({ kind: "queued", timestamp: qm.timestamp, message: qm });
  }

  // Include commits in the stream only when interleaving
  if (interleaveCommits) {
    for (const commit of session.gitCommits!) {
      stream.push({ kind: "commit", timestamp: commit.timestamp, commit });
    }
  }

  // Sort the stream chronologically when we have anything to interleave
  const needsMerge = queuedMessages.length > 0 || interleaveCommits;
  if (needsMerge) {
    stream.sort((a, b) => {
      // Items without timestamps go first (preserve original behavior)
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return -1;
      if (!b.timestamp) return 1;
      return a.timestamp.localeCompare(b.timestamp);
    });
  }

  // Render the stream
  for (const item of stream) {
    switch (item.kind) {
      case "turn":
        renderTurn(item.turn);
        break;
      case "queued":
        lines.push(`USER (queued): ${item.message.content}`);
        lines.push("");
        break;
      case "commit":
        lines.push(formatCommitBlock(item.commit));
        lines.push("");
        break;
    }
  }

  // Commits section (appended at end) — only when NOT interleaving
  if (!interleaveCommits) {
    if (session.gitCommits && session.gitCommits.length > 0) {
      lines.push("─── Commits " + "─".repeat(28));
      for (const commit of session.gitCommits) {
        const diffStats =
          commit.insertions !== undefined || commit.deletions !== undefined
            ? `  (+${commit.insertions ?? 0}/-${commit.deletions ?? 0})`
            : "";
        lines.push(`  ${commit.shortHash}  ${commit.subject}${diffStats}`);
      }
      lines.push("");
    } else if (session.commits.length > 0) {
      lines.push("─── Commits " + "─".repeat(28));
      for (const commit of session.commits) {
        const shortHash = commit.hash.slice(0, 7);
        lines.push(`  ${shortHash}  ${commit.message ?? ""}`);
      }
      lines.push("");
    }
  }

  // Subagent transcripts (appended at end)
  if (formatOptions.includeSubagents && session.subagents.length > 0) {
    lines.push("");
    lines.push("═".repeat(60));
    lines.push(`SUBAGENTS (${session.subagents.length})`);
    lines.push("═".repeat(60));

    for (const subagent of session.subagents) {
      lines.push("");
      lines.push(formatSubagent(subagent, formatOptions));
    }
  }

  return lines.join("\n");
}

/**
 * Format a subagent transcript
 */
function formatSubagent(subagent: ParsedSubagent, formatOptions: FormatOptions): string {
  const lines: string[] = [];

  // Subagent header
  lines.push("─".repeat(40));
  lines.push(`SUBAGENT: ${subagent.agentId}`);
  if (subagent.startTimestamp) {
    lines.push(`Started: ${subagent.startTimestamp}`);
  }
  lines.push(`Turns: ${subagent.turns.length}`);
  lines.push("─".repeat(40));
  lines.push("");

  // Subagent turns
  for (const turn of subagent.turns) {
    lines.push(formatTurn(turn, formatOptions));
    lines.push("");
  }

  return lines.join("\n");
}
