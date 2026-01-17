/**
 * Output formatting for context utilization reports
 */

import type { ContextInfo, SessionContextReport, SubagentInfo } from "./types";
import { getRemainingContext } from "./context";

/**
 * Format a number with thousands separators
 */
function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Format context info as JSON (for programmatic use by agents)
 */
export function formatJson(report: SessionContextReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format context info as a compact single line (for quick checks)
 */
export function formatCompact(info: ContextInfo): string {
  const remaining = getRemainingContext(info);
  return `${info.utilizationPercent} (${formatNumber(info.contextTokens)}/${formatNumber(info.contextWindow)}) - ${formatNumber(remaining.tokens)} remaining`;
}

/**
 * Format context info as human-readable text
 */
export function formatHuman(report: SessionContextReport): string {
  const lines: string[] = [];
  const { session } = report;
  const remaining = getRemainingContext(session);

  // Header
  lines.push(`Session: ${session.sessionId.slice(0, 8)}...`);
  lines.push(`Model:   ${session.model}`);
  lines.push("");

  // Main utilization bar
  const barWidth = 40;
  const filled = Math.round(session.utilization * barWidth);
  const empty = barWidth - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);

  lines.push(`Context: [${bar}] ${session.utilizationPercent}`);
  lines.push("");

  // Token breakdown
  lines.push("Tokens:");
  lines.push(`  Used:      ${formatNumber(session.contextTokens).padStart(10)}`);
  lines.push(`  Remaining: ${formatNumber(remaining.tokens).padStart(10)}`);
  lines.push(`  Window:    ${formatNumber(session.contextWindow).padStart(10)}`);

  // Detailed breakdown
  lines.push("");
  lines.push("Breakdown:");
  lines.push(`  Input:         ${formatNumber(session.usage.inputTokens).padStart(10)}`);
  lines.push(`  Cache read:    ${formatNumber(session.usage.cacheReadInputTokens).padStart(10)}`);
  lines.push(`  Cache created: ${formatNumber(session.usage.cacheCreationInputTokens).padStart(10)}`);
  lines.push(`  Output:        ${formatNumber(session.usage.outputTokens).padStart(10)}`);

  // Subagents if present
  if (report.subagents && report.subagents.length > 0) {
    lines.push("");
    lines.push("Subagents:");

    for (const sub of report.subagents) {
      if (sub.context) {
        lines.push(
          `  ${sub.agentId}: ${sub.context.utilizationPercent} (${formatNumber(sub.context.contextTokens)} tokens)`
        );
      } else {
        lines.push(`  ${sub.agentId}: (no usage data)`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format just the utilization percentage (for status line integration)
 */
export function formatPercent(info: ContextInfo): string {
  return info.utilizationPercent;
}

/**
 * Format as a simple key-value output (easy to parse with grep/awk)
 */
export function formatKeyValue(report: SessionContextReport): string {
  const { session } = report;
  const remaining = getRemainingContext(session);

  const lines = [
    `session_id=${session.sessionId}`,
    `model=${session.model}`,
    `context_tokens=${session.contextTokens}`,
    `context_window=${session.contextWindow}`,
    `utilization=${session.utilization.toFixed(4)}`,
    `utilization_percent=${session.utilizationPercent}`,
    `remaining_tokens=${remaining.tokens}`,
    `remaining_percent=${remaining.percent}`,
    `input_tokens=${session.usage.inputTokens}`,
    `output_tokens=${session.usage.outputTokens}`,
    `cache_read_tokens=${session.usage.cacheReadInputTokens}`,
    `cache_creation_tokens=${session.usage.cacheCreationInputTokens}`,
  ];

  if (report.subagents) {
    lines.push(`subagent_count=${report.subagents.length}`);
  }

  return lines.join("\n");
}
