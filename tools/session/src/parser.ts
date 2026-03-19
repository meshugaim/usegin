/**
 * Core JSONL parser for Claude sessions
 *
 * This module is the main entry point for session parsing. The actual work
 * is split across focused modules:
 *
 * - parse-turn.ts     — Entry-level parsing (parseTurn, extractCommitsFromToolResult)
 * - parse-turns.ts    — Entry[] → ParsedSession (parseEntries, rewind detection)
 * - parse-tokens.ts   — Token usage aggregation across turns
 * - parse-subagents.ts — Subagent/team discovery, listing, and parsing
 *
 * This file contains:
 * - parseSession() orchestrator
 * - StreamingParser class
 * - withTimeout utility
 * - Re-exports of everything so existing imports continue to work
 */

import type { Entry } from "./types";
import { debugLog } from "./debug";
import { isEntry } from "./validation";
import { readJsonlContent } from "./utils";
import { ParsingTimeoutError } from "./errors";
import { formatTurn, type FormatOptions } from "./formatter";
import { parseEntries } from "./parse-turns";
import { parseTurn } from "./parse-turn";
import {
  discoverSubagents,
  extractTeamNames,
  discoverTeamMembers,
} from "./parse-subagents";

// ============================================================================
// Re-exports: preserve the public API so existing imports from "./parser" work
// ============================================================================

export { ParsingTimeoutError } from "./errors";
export { filterNotifications, isNotificationTurn } from "./filter-notifications";
export { parseTurn, extractCommitsFromToolResult } from "./parse-turn";
export { parseEntries } from "./parse-turns";
export { aggregateTokenUsage } from "./parse-tokens";
export {
  listRelatedFiles,
  isWarmupSubagent,
  isAsideQuestion,
  extractBtwContent,
  discoverSubagents,
  parseSubagentFile,
  extractTeamNames,
  discoverTeamMembers,
} from "./parse-subagents";

// ============================================================================
// Types and interfaces defined in this module
// ============================================================================

export interface ParseOptions {
  includeSubagents?: boolean;
  includeWarmups?: boolean; // Default: false (exclude warmup subagents)
  debug?: boolean; // Log timing info to stderr
}

export interface WithTimeoutOptions {
  fileSizeBytes?: number;
  filePath?: string;
}

// ============================================================================
// Timeout utility
// ============================================================================

/**
 * Wrap a promise with a timeout. Rejects with a user-friendly error if it takes too long.
 * @param promise The promise to wrap
 * @param timeoutSeconds Timeout in seconds. 0 or negative disables timeout.
 * @param options Optional context for better error messages
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutSeconds: number,
  options: WithTimeoutOptions = {}
): Promise<T> {
  if (timeoutSeconds <= 0) {
    return promise;
  }

  let timerId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timerId = setTimeout(() => {
          reject(new ParsingTimeoutError(timeoutSeconds, options));
        }, timeoutSeconds * 1000);
      }),
    ]);
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  }
}

// ============================================================================
// Main orchestrator
// ============================================================================

/**
 * Parse a JSONL file into a structured session
 */
export async function parseSession(
  jsonlPath: string,
  options: ParseOptions = {}
): Promise<import("./types").ParsedSession> {
  const debug = options.debug ?? false;

  let stepStart = Date.now();
  debugLog(debug, "Reading file...");
  const content = await readJsonlContent(jsonlPath);
  debugLog(debug, `Read ${content.length} bytes`, stepStart);

  stepStart = Date.now();
  const lines = content.split("\n").filter((line) => line.trim());
  debugLog(debug, `Parsing ${lines.length} entries...`);

  const entries: Entry[] = [];
  let skippedCount = 0;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (!isEntry(parsed)) {
        skippedCount++;
        debugLog(debug, `Skipping invalid entry: missing or unknown type`);
        continue;
      }
      entries.push(parsed);
    } catch {
      skippedCount++;
      debugLog(debug, `Skipping malformed JSON line`);
    }
  }
  debugLog(debug, `Parsed ${entries.length} valid entries${skippedCount > 0 ? `, skipped ${skippedCount}` : ""}`, stepStart);

  stepStart = Date.now();
  debugLog(debug, "Processing turns...");
  const session = parseEntries(entries);
  debugLog(debug, `Processed ${session.turns.length} turns`, stepStart);

  stepStart = Date.now();
  debugLog(debug, "Detecting rewinds...");
  // Rewinds are detected in parseEntries, just report the count
  debugLog(debug, `Found ${session.rewinds.length} rewind(s)`, stepStart);

  // Discover and parse subagents if requested
  if (options.includeSubagents && session.sessionId) {
    stepStart = Date.now();
    debugLog(debug, "Discovering subagents...");
    session.subagents = await discoverSubagents(
      jsonlPath,
      session.sessionId,
      options.includeWarmups ?? false,
      debug
    );
    debugLog(debug, `Found ${session.subagents.length} subagent(s)`, stepStart);

    // Discover team members by scanning tool results for team spawns
    stepStart = Date.now();
    debugLog(debug, "Discovering team members...");
    const teamNames = extractTeamNames(session.turns);
    if (teamNames.size > 0) {
      session.teamMembers = await discoverTeamMembers(
        jsonlPath,
        session.sessionId,
        teamNames,
        debug,
      );
      debugLog(debug, `Found ${session.teamMembers.length} team member(s) across ${teamNames.size} team(s)`, stepStart);
    }
  }

  return session;
}

// ============================================================================
// Streaming parser
// ============================================================================

/**
 * Streaming parser for real-time JSONL processing
 */
export class StreamingParser {
  private buffer = "";
  private options: FormatOptions;

  constructor(options: Partial<FormatOptions> = {}) {
    this.options = {
      toolInput: false,
      toolOutput: false,
      truncate: 500,
      includeSubagents: false,
      ...options,
    };
  }

  /**
   * Feed a chunk of data, returns formatted output for complete lines
   */
  feed(chunk: string): string[] {
    this.buffer += chunk;
    const output: string[] = [];

    // Process complete lines
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed = JSON.parse(line);
        if (!isEntry(parsed)) {
          continue; // Skip invalid entries
        }
        if (parsed.type === "user" || parsed.type === "assistant") {
          const turn = parseTurn(parsed as Entry & { type: "user" | "assistant" });
          if (turn) {
            output.push(formatTurn(turn, this.options));
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    return output;
  }

  /**
   * Flush any remaining buffer content
   */
  end(): string[] {
    if (this.buffer.trim()) {
      const remaining = this.buffer;
      this.buffer = "";
      return this.feed(remaining + "\n");
    }
    return [];
  }
}
