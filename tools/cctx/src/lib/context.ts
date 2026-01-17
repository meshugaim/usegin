/**
 * Context utilization parsing from Claude session JSONL files
 */

import type { TokenUsage, ContextInfo } from "./types";
import { basename } from "path";

/** Known context window sizes by model */
const CONTEXT_WINDOWS: Record<string, number> = {
  "claude-opus-4-5-20251101": 200000,
  "claude-sonnet-4-5-20250514": 200000,
  "claude-sonnet-4-20250514": 200000,
  "claude-haiku-4-5-20250514": 200000,
  // Fallback for unknown models
  default: 200000,
};

interface MessageUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface ParsedLine {
  type?: string;
  message?: {
    model?: string;
    usage?: MessageUsage;
  };
  timestamp?: string;
}

/**
 * Get context window size for a model
 */
export function getContextWindow(model: string): number {
  return CONTEXT_WINDOWS[model] ?? CONTEXT_WINDOWS.default;
}

/**
 * Parse a session JSONL file and extract the latest context usage
 */
export async function parseSessionContext(
  sessionPath: string
): Promise<ContextInfo | null> {
  const file = Bun.file(sessionPath);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  const lines = content.split("\n").filter((l) => l.trim());

  if (lines.length === 0) {
    return null;
  }

  // Find the last message with usage info (scan from end for efficiency)
  let lastUsage: MessageUsage | null = null;
  let model = "unknown";
  let lastTimestamp = "";

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed: ParsedLine = JSON.parse(lines[i]);

      // Capture timestamp from any line (before we find usage)
      if (parsed.timestamp && !lastTimestamp) {
        lastTimestamp = parsed.timestamp;
      }

      // Look for assistant messages with usage
      if (parsed.message?.usage && !lastUsage) {
        lastUsage = parsed.message.usage;
        if (parsed.message.model) {
          model = parsed.message.model;
        }
        // If we already have timestamp, we're done
        if (lastTimestamp) break;
        // Otherwise continue scanning for timestamp only
      }

      // If we have usage but still need timestamp, keep scanning
      if (lastUsage && lastTimestamp) break;
    } catch {
      // Skip malformed lines
    }
  }

  if (!lastUsage) {
    return null;
  }

  const usage: TokenUsage = {
    inputTokens: lastUsage.input_tokens ?? 0,
    outputTokens: lastUsage.output_tokens ?? 0,
    cacheReadInputTokens: lastUsage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: lastUsage.cache_creation_input_tokens ?? 0,
  };

  // Context = what was sent to the model (input + cached tokens)
  const contextTokens =
    usage.inputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;

  const contextWindow = getContextWindow(model);
  const utilization = contextTokens / contextWindow;

  // Extract session ID from filename
  const filename = basename(sessionPath);
  const sessionId = filename.replace(/\.jsonl$/, "");

  return {
    sessionId,
    path: sessionPath,
    contextTokens,
    contextWindow,
    utilization,
    utilizationPercent: `${(utilization * 100).toFixed(1)}%`,
    usage,
    model,
    lastActivity: lastTimestamp,
  };
}

/**
 * Calculate remaining context capacity
 */
export function getRemainingContext(info: ContextInfo): {
  tokens: number;
  percent: string;
} {
  const remaining = info.contextWindow - info.contextTokens;
  const percent = ((remaining / info.contextWindow) * 100).toFixed(1);
  return {
    tokens: Math.max(0, remaining),
    percent: `${percent}%`,
  };
}
