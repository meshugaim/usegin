/**
 * Types for context utilization analysis
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface ContextInfo {
  /** Session ID */
  sessionId: string;

  /** Path to the session JSONL file */
  path: string;

  /** Total tokens in context (input + cache) */
  contextTokens: number;

  /** Context window size for the model */
  contextWindow: number;

  /** Utilization as a decimal (0.0 - 1.0) */
  utilization: number;

  /** Utilization as a percentage string (e.g., "35.8%") */
  utilizationPercent: string;

  /** Detailed token breakdown from last API call */
  usage: TokenUsage;

  /** Model used in the session */
  model: string;

  /** Timestamp of the last message */
  lastActivity: string;
}

export interface SubagentInfo {
  /** Agent ID (short identifier) */
  agentId: string;

  /** Path to the subagent JSONL file */
  path: string;

  /** Context info for this subagent */
  context: ContextInfo | null;
}

export interface SessionContextReport {
  /** Main session context info */
  session: ContextInfo;

  /** Subagent context info (if requested) */
  subagents?: SubagentInfo[];
}
