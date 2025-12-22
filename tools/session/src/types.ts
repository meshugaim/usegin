/**
 * Types for Claude session JSONL parsing
 */

// Raw JSONL entry types
export type EntryType =
  | "system"
  | "user"
  | "assistant"
  | "result"
  | "file-history-snapshot"
  | "queue-operation";

export interface BaseEntry {
  type: EntryType;
  uuid?: string;
  parentUuid?: string | null; // Links to parent message for tree structure
  session_id?: string;
  sessionId?: string; // Alternative field name used in some entries
  agentId?: string; // Present in subagent entries
  timestamp?: string;
  parent_tool_use_id?: string | null;
}

export interface SystemEntry extends BaseEntry {
  type: "system";
  subtype: "init";
  cwd: string;
  tools: string[];
  model: string;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type MessageContent = TextContent | ToolUseContent | ToolResultContent;

export interface Message {
  role: "user" | "assistant";
  content: MessageContent[] | string;
}

export interface UserEntry extends BaseEntry {
  type: "user";
  message: Message;
}

export interface AssistantEntry extends BaseEntry {
  type: "assistant";
  message: Message & {
    model: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export interface ResultEntry extends BaseEntry {
  type: "result";
  subtype: "success" | "error";
  result: string;
  duration_ms: number;
  total_cost_usd?: number;
}

export type Entry = SystemEntry | UserEntry | AssistantEntry | ResultEntry;

// Parsed conversation types
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
  isError: boolean;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  uuid: string;
  parentUuid?: string | null;
  isOnCurrentBranch: boolean;
}

export interface ParsedSubagent {
  agentId: string;
  sessionId: string; // Parent session ID
  turns: Turn[];
  startTimestamp?: string;
}

export interface RewindInfo {
  fromUuid: string; // The UUID we rewound from
  abandonedBranchUuids: string[]; // UUIDs of messages on the abandoned branch
}

export interface CommitInfo {
  hash: string; // Short or full commit hash
  message?: string; // First line of commit message if available
}

export interface ParsedSession {
  sessionId: string;
  cwd: string;
  model: string;
  tools: string[];
  turns: Turn[];
  subagents: ParsedSubagent[];
  rewinds: RewindInfo[];
  triggeredSkills: string[]; // Skills invoked via the Skill tool
  commits: CommitInfo[]; // Commits made during this session
  summary?: string; // Session summary from type:"summary" line
  result?: {
    success: boolean;
    durationMs: number;
    costUsd?: number;
  };
}
