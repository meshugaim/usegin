/**
 * Markdown output format for session transcripts
 */

import type { ParsedSession } from "./types";
import { getToolSummary } from "./formatter";

/**
 * Format a session as readable Markdown
 */
export function formatMarkdown(session: ParsedSession): string {
  const lines: string[] = [];

  // Title
  if (session.summary) {
    lines.push(`# ${session.summary}`);
  } else {
    lines.push(`# Session ${session.sessionId}`);
  }
  lines.push("");

  // Metadata
  lines.push("## Metadata");
  lines.push("");
  lines.push(`- **Session ID:** ${session.sessionId}`);
  lines.push(`- **Working Directory:** ${session.cwd}`);
  lines.push(`- **Model:** ${session.model}`);
  if (session.triggeredSkills.length > 0) {
    lines.push(`- **Skills:** ${session.triggeredSkills.join(", ")}`);
  }
  if (session.rewinds.length > 0) {
    lines.push(`- **Rewinds:** ${session.rewinds.length}`);
  }
  if (session.result) {
    lines.push(`- **Duration:** ${(session.result.durationMs / 1000).toFixed(1)}s`);
    if (session.result.costUsd !== undefined) {
      lines.push(`- **Cost:** $${session.result.costUsd.toFixed(4)}`);
    }
  }
  lines.push("");

  // Conversation
  lines.push("## Conversation");
  lines.push("");

  for (const turn of session.turns) {
    const prefix = turn.isOnCurrentBranch === false ? "~~[REWIND]~~ " : "";
    const role = turn.role === "user" ? "**User**" : "**Assistant**";

    if (turn.text) {
      lines.push(`### ${prefix}${role}`);
      lines.push("");
      lines.push(turn.text);
      lines.push("");
    }

    // Tool calls
    for (const tool of turn.toolCalls) {
      const summary = getToolSummary(tool);
      lines.push(`> 🔧 **${tool.name}**: ${summary}`);
    }

    if (turn.toolCalls.length > 0) {
      lines.push("");
    }
  }

  // Subagents
  if (session.subagents.length > 0) {
    lines.push("## Subagents");
    lines.push("");

    for (const subagent of session.subagents) {
      lines.push(`### Subagent: ${subagent.agentId}`);
      lines.push("");

      for (const turn of subagent.turns) {
        const role = turn.role === "user" ? "**User**" : "**Assistant**";
        if (turn.text) {
          lines.push(`#### ${role}`);
          lines.push("");
          lines.push(turn.text);
          lines.push("");
        }
      }
    }
  }

  return lines.join("\n");
}
