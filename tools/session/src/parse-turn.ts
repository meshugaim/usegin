/**
 * Entry-level parsing: convert individual JSONL entries into Turn objects.
 *
 * Extracted from parser.ts — see parseSession() for the orchestrator that
 * calls these functions.
 */

import type {
  Entry,
  AssistantEntry,
  Turn,
  TokenUsage,
  ToolCall,
  ToolResult,
  MessageContent,
  TextContent,
  ToolUseContent,
  ToolResultContent,
  CommitInfo,
  EntryUuid,
  ToolUseId,
} from "./types";
import { asEntryUuid, asToolUseId, normalizeToolResultContent } from "./types";

/**
 * Parse a user or assistant entry into a Turn.
 *
 * Extracts text content, tool calls (from assistant messages), and tool results
 * (from user messages that contain tool responses).
 *
 * @param entry - A user or assistant entry from the JSONL
 * @returns Turn object, or null if the entry has no message content
 */
export function parseTurn(
  entry: Entry & { type: "user" | "assistant" }
): Turn | null {
  const message = entry.message;
  if (!message) return null;

  const content = message.content;
  let text = "";
  const toolCalls: ToolCall[] = [];
  const toolResults: ToolResult[] = [];

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    for (const item of content as MessageContent[]) {
      switch (item.type) {
        case "text":
          text += (item as TextContent).text;
          break;
        case "tool_use":
          const toolUse = item as ToolUseContent;
          toolCalls.push({
            id: asToolUseId(toolUse.id),
            name: toolUse.name,
            input: toolUse.input,
          });
          break;
        case "tool_result":
          const toolResult = item as ToolResultContent;
          toolResults.push({
            toolUseId: asToolUseId(toolResult.tool_use_id),
            // Normalize content: Task tool returns array [{type:"text",text:"..."}]
            // while most tools return plain strings
            content: normalizeToolResultContent(toolResult.content),
            isError: toolResult.is_error ?? false,
          });
          break;
      }
    }
  }

  // Extract per-turn token usage from assistant entries
  let tokenUsage: TokenUsage | undefined;
  if (entry.type === "assistant") {
    const usage = (entry as AssistantEntry).message?.usage;
    if (usage) {
      tokenUsage = {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
      };
    }
  }

  return {
    role: entry.type as "user" | "assistant",
    text: text.trim(),
    toolCalls,
    toolResults,
    uuid: asEntryUuid(entry.uuid ?? ""),
    parentUuid: entry.parentUuid === null ? null : entry.parentUuid ? asEntryUuid(entry.parentUuid) : undefined,
    timestamp: entry.timestamp,
    ...(tokenUsage ? { tokenUsage } : {}),
    isOnCurrentBranch: true, // Will be updated by detectRewinds
  };
}

/**
 * Extract commit hashes from git commit output in a tool result
 * Git commit output format: "[branch hash] commit message"
 * Examples:
 *   [main abc1234] fix: some bug
 *   [wt/ENG-123 def5678] feat: add feature
 */
export function extractCommitsFromToolResult(content: string): CommitInfo[] {
  const commits: CommitInfo[] = [];

  // Match git commit output: [branch hash] message
  // The hash is 7+ hex characters, branch name can contain alphanumeric, /, -, _
  const commitPattern = /\[[\w\-/]+ ([0-9a-f]{7,40})\] (.+)/g;
  let match;

  while ((match = commitPattern.exec(content)) !== null) {
    const hash = match[1];
    const message = match[2];
    if (hash && message) {
      commits.push({ hash, message });
    }
  }

  return commits;
}
