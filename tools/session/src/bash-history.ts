/**
 * Bash history extraction from parsed session turns.
 *
 * Pure functions that extract Bash tool calls from session turns
 * and format them for display in fzf or grep output.
 *
 * This module operates on the parsed Turn[] representation (not raw JSONL),
 * pairing Bash tool calls with their results via toolUseId matching.
 */

import type { Turn, ToolCall, ToolResult } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface BashCommand {
  /** ISO timestamp from the turn */
  timestamp: string | null;
  /** Claude's description of what the command does (from tool input) */
  description: string;
  /** The actual command text */
  command: string;
  /** Command output (from tool result) */
  output: string;
  /** Whether the command errored */
  isError: boolean;
  /** Turn index in the session */
  turnIndex: number;
}

// =============================================================================
// EXTRACTION
// =============================================================================

/**
 * Extract Bash commands from parsed session turns.
 *
 * Pairs tool calls with their results via toolUseId matching.
 * Skips non-Bash tools and empty commands.
 */
export function extractBashCommands(turns: Turn[]): BashCommand[] {
  const commands: BashCommand[] = [];

  // Build a map of toolUseId -> result for quick lookup.
  // Results live in user turns (the turn after the assistant's tool call).
  const resultMap = new Map<string, ToolResult>();
  for (const turn of turns) {
    for (const result of turn.toolResults) {
      resultMap.set(result.toolUseId, result);
    }
  }

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.role !== "assistant") continue;

    for (const tc of turn.toolCalls) {
      if (tc.name !== "Bash") continue;

      const input = tc.input as Record<string, unknown>;
      const command = String(input.command || "");
      const description = String(input.description || "");

      if (!command) continue;

      const result = resultMap.get(tc.id);

      commands.push({
        timestamp: turn.timestamp ?? null,
        description,
        command,
        output: result?.content ?? "",
        isError: result?.isError ?? false,
        turnIndex: i,
      });
    }
  }

  return commands;
}

// =============================================================================
// FORMATTING
// =============================================================================

/**
 * Format a BashCommand as a multi-line fzf entry.
 *
 * Line 1: [timestamp]  description
 * Line 2: $ command
 */
export function formatBashEntry(cmd: BashCommand): string {
  const ts = cmd.timestamp
    ? new Date(cmd.timestamp).toISOString().slice(0, 16).replace("T", " ")
    : "           ";
  const desc = cmd.description || "(no description)";
  return `[${ts}]  ${desc}\n$ ${cmd.command}`;
}

/**
 * Format commands for non-interactive grep output.
 *
 * Filters commands where the pattern matches (case-insensitive) in
 * the command text, description, or output.
 */
export function formatBashGrep(commands: BashCommand[], pattern: string): string {
  const lower = pattern.toLowerCase();
  const matches = commands.filter(
    (cmd) =>
      cmd.command.toLowerCase().includes(lower) ||
      cmd.description.toLowerCase().includes(lower) ||
      cmd.output.toLowerCase().includes(lower)
  );

  if (matches.length === 0) return `No commands matching "${pattern}".`;

  const lines: string[] = [`Found ${matches.length} command(s) matching "${pattern}":\n`];
  for (const cmd of matches) {
    lines.push(formatBashEntry(cmd));
    lines.push("");
  }
  return lines.join("\n");
}
