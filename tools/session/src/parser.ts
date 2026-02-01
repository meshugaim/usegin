/**
 * Core JSONL parser for Claude sessions
 */

import { readdir } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { formatTurn, type FormatOptions } from "./formatter";
import type {
  Entry,
  ParsedSession,
  ParsedSubagent,
  Turn,
  ToolCall,
  ToolResult,
  MessageContent,
  TextContent,
  ToolUseContent,
  ToolResultContent,
  RewindInfo,
  CommitInfo,
  SessionId,
  EntryUuid,
  AgentId,
  ToolUseId,
} from "./types";
import { asSessionId, asEntryUuid, asAgentId, asToolUseId } from "./types";
import { debugLog } from "./debug";
import { isEntry, getSessionId, hasAgentId } from "./validation";
import { ParsingTimeoutError } from "./errors";

// Re-export for consumers
export { ParsingTimeoutError } from "./errors";

export interface ParseOptions {
  includeSubagents?: boolean;
  includeWarmups?: boolean; // Default: false (exclude warmup subagents)
  debug?: boolean; // Log timing info to stderr
}

export interface WithTimeoutOptions {
  fileSizeBytes?: number;
  filePath?: string;
}

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

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ParsingTimeoutError(timeoutSeconds, options));
      }, timeoutSeconds * 1000);
    }),
  ]);
}

/**
 * List all files related to a session (main file + subagent files)
 * Returns absolute paths, useful for uploading session bundles
 */
export async function listRelatedFiles(jsonlPath: string): Promise<string[]> {
  const absolutePath = jsonlPath.startsWith("/")
    ? jsonlPath
    : join(process.cwd(), jsonlPath);

  const files = [absolutePath];

  // Get sessionId from main file
  const mainFile = Bun.file(absolutePath);
  const content = await mainFile.text();
  const firstLine = content.split("\n")[0];

  let sessionId = "";
  try {
    const parsed = JSON.parse(firstLine);
    if (!isEntry(parsed)) {
      return files;
    }
    sessionId = getSessionId(parsed);
  } catch {
    return files;
  }

  if (!sessionId) {
    // Try to get sessionId from filename (UUID format)
    const filename = basename(absolutePath);
    const uuidMatch = filename.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i
    );
    if (uuidMatch) {
      sessionId = uuidMatch[1];
    }
  }

  if (!sessionId) return files;

  // Find related subagent files
  const dir = dirname(absolutePath);
  const dirFiles = await readdir(dir);
  const subagentFiles = dirFiles.filter(
    (filename) => filename.startsWith("agent-") && filename.endsWith(".jsonl")
  );

  for (const subagentFile of subagentFiles) {
    const subagentPath = join(dir, subagentFile);
    const subFile = Bun.file(subagentPath);
    const subContent = await subFile.text();
    const subFirstLine = subContent.split("\n")[0];

    try {
      const subParsed = JSON.parse(subFirstLine);
      if (!isEntry(subParsed)) {
        continue; // Skip files with invalid first entry
      }
      const subSessionId = getSessionId(subParsed);
      if (subSessionId === sessionId) {
        files.push(subagentPath);
      }
    } catch {
      // Skip malformed files
    }
  }

  return files;
}

/**
 * Parse a JSONL file into a structured session
 */
export async function parseSession(
  jsonlPath: string,
  options: ParseOptions = {}
): Promise<ParsedSession> {
  const debug = options.debug ?? false;

  let stepStart = Date.now();
  debugLog(debug, "Reading file...");
  const file = Bun.file(jsonlPath);
  const content = await file.text();
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
  }

  return session;
}

/**
 * Detect if a subagent is a warmup (single message, no tool results)
 * Warmups are subagents that only have the initial "I'll start exploring..." message
 * but never actually executed any tools.
 */
export function isWarmupSubagent(subagent: ParsedSubagent): boolean {
  // Warmups have very few turns (typically 1)
  if (subagent.turns.length > 2) return false;

  // Check if any turn has tool results (indicates real work was done)
  const hasToolResults = subagent.turns.some(
    (turn) => turn.toolResults.length > 0
  );

  return !hasToolResults;
}

/**
 * Discover subagent files for a session
 */
async function discoverSubagents(
  mainSessionPath: string,
  sessionId: string,
  includeWarmups: boolean,
  debug: boolean = false
): Promise<ParsedSubagent[]> {
  const dir = dirname(mainSessionPath);
  const mainFilename = basename(mainSessionPath);

  try {
    const files = await readdir(dir);
    const subagentFiles = files.filter(
      (filename) => filename.startsWith("agent-") && filename.endsWith(".jsonl") && filename !== mainFilename
    );

    const subagents: ParsedSubagent[] = [];

    for (const subagentFile of subagentFiles) {
      const subagentPath = join(dir, subagentFile);
      const subagent = await parseSubagentFile(subagentPath, sessionId, debug);
      if (subagent) {
        // Filter out warmups unless explicitly requested
        if (includeWarmups || !isWarmupSubagent(subagent)) {
          subagents.push(subagent);
        }
      }
    }

    // Sort by start timestamp
    subagents.sort((a, b) => {
      if (!a.startTimestamp || !b.startTimestamp) return 0;
      return a.startTimestamp.localeCompare(b.startTimestamp);
    });

    return subagents;
  } catch (error) {
    debugLog(debug, `Could not read subagents directory ${dir}: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Parse a subagent file if it belongs to the given session
 */
async function parseSubagentFile(
  filePath: string,
  parentSessionId: string,
  debug: boolean = false
): Promise<ParsedSubagent | null> {
  const file = Bun.file(filePath);
  const content = await file.text();
  const lines = content.split("\n").filter((line) => line.trim());
  const filename = basename(filePath);

  if (lines.length === 0) return null;

  // Check first entry to see if this subagent belongs to our session
  let firstEntry: Entry | null = null;
  try {
    const parsed = JSON.parse(lines[0]);
    if (!isEntry(parsed)) {
      debugLog(debug, `Skipping ${filename}: first line is not a valid entry`);
      return null;
    }
    firstEntry = parsed;
  } catch (error) {
    debugLog(debug, `Skipping ${filename}: could not parse first line - ${(error as Error).message}`);
    return null;
  }

  // Check if this subagent belongs to the parent session
  const entrySessionId = getSessionId(firstEntry);
  if (entrySessionId !== parentSessionId) {
    return null;
  }

  // Must have an agentId to be a valid subagent file
  if (!hasAgentId(firstEntry)) {
    return null;
  }
  const rawAgentId = firstEntry.agentId;

  // Parse all entries
  const entries: Entry[] = [];
  let skippedCount = 0;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (!isEntry(parsed)) {
        skippedCount++;
        continue; // Skip invalid entries
      }
      entries.push(parsed);
    } catch {
      skippedCount++;
    }
  }
  if (skippedCount > 0) {
    debugLog(debug, `Subagent ${filename}: skipped ${skippedCount} malformed line(s)`);
  }

  const turns: Turn[] = [];
  let startTimestamp: string | undefined;

  for (const entry of entries) {
    if (!startTimestamp && entry.timestamp) {
      startTimestamp = entry.timestamp;
    }

    if (entry.type === "user" || entry.type === "assistant") {
      const turn = parseTurn(entry as Entry & { type: "user" | "assistant" });
      if (turn) {
        turns.push(turn);
      }
    }
  }

  return {
    agentId: asAgentId(rawAgentId),
    sessionId: asSessionId(parentSessionId),
    turns,
    startTimestamp,
  };
}

/**
 * Detect rewinds by analyzing the parent-child relationships in turns.
 * A rewind occurs when a turn's parentUuid points to a message that already
 * has a different child in the recorded sequence.
 */
function detectRewinds(turns: Turn[]): RewindInfo[] {
  if (turns.length === 0) return [];

  // Check if we have parentUuid data - if not, assume linear (legacy format)
  const hasParentData = turns.some((turn) => turn.parentUuid !== undefined);
  if (!hasParentData) return [];

  const rewinds: RewindInfo[] = [];

  // Build a map of uuid -> children (in order of appearance)
  const childrenMap = new Map<EntryUuid | null, EntryUuid[]>();

  for (const turn of turns) {
    const parentKey = turn.parentUuid ?? null;
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(turn.uuid);
  }

  // Find rewind points: nodes with multiple children
  for (const [parentUuid, children] of childrenMap) {
    if (children.length > 1 && parentUuid !== null) {
      // Multiple children from same parent = rewinds happened
      // The last child is on the current branch, others are abandoned
      const abandonedChildren = children.slice(0, -1);

      for (const abandonedChild of abandonedChildren) {
        // Collect all descendants of this abandoned child
        const abandonedBranch = collectDescendants(abandonedChild, childrenMap);
        rewinds.push({
          fromUuid: parentUuid,
          abandonedBranchUuids: abandonedBranch,
        });
      }
    }
  }

  return rewinds;
}

/**
 * Collect all descendants of a given uuid (including the uuid itself)
 * Uses visited set to prevent infinite recursion on cyclic graphs
 */
function collectDescendants(
  uuid: EntryUuid,
  childrenMap: Map<EntryUuid | null, EntryUuid[]>,
  visited: Set<EntryUuid> = new Set()
): EntryUuid[] {
  // Cycle detection: if we've already visited this uuid, stop recursing
  if (visited.has(uuid)) {
    return [];
  }
  visited.add(uuid);

  const result: EntryUuid[] = [uuid];
  const children = childrenMap.get(uuid) ?? [];

  for (const child of children) {
    result.push(...collectDescendants(child, childrenMap, visited));
  }

  return result;
}

/**
 * Determine the current branch by walking from the last turn back to root.
 * Returns a set of uuids that are on the current branch.
 */
function findCurrentBranch(
  turns: Turn[],
  allEntryParents: Map<string, string | null>
): Set<EntryUuid> {
  if (turns.length === 0) return new Set();

  // Check if we have parentUuid data - if not, all turns are on current branch
  const hasParentData = turns.some((turn) => turn.parentUuid !== undefined);
  if (!hasParentData) {
    return new Set(turns.map((turn) => turn.uuid).filter(Boolean));
  }

  // Build uuid -> turn map
  const turnMap = new Map<EntryUuid, Turn>();
  for (const turn of turns) {
    if (turn.uuid) {
      turnMap.set(turn.uuid, turn);
    }
  }

  // Start from the last turn and walk back via parentUuid
  // Use allEntryParents to jump through system entries
  const currentBranch = new Set<EntryUuid>();
  const visited = new Set<string>(); // Track visited to detect cycles
  let currentUuid: string | null = turns[turns.length - 1]?.uuid ?? null;

  while (currentUuid) {
    // Detect cycles - break if we've visited this UUID before
    if (visited.has(currentUuid)) {
      break;
    }
    visited.add(currentUuid);

    // If this is a turn, add it to current branch
    if (turnMap.has(asEntryUuid(currentUuid))) {
      currentBranch.add(asEntryUuid(currentUuid));
    }
    // Walk to parent (could be a turn or system entry)
    const parentUuid = allEntryParents.get(currentUuid);
    if (parentUuid) {
      currentUuid = parentUuid;
    } else {
      break;
    }
  }

  return currentBranch;
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
    commits.push({ hash, message });
  }

  return commits;
}

/**
 * Parse entries into a structured session
 */
export function parseEntries(entries: Entry[]): ParsedSession {
  let rawSessionId = "";
  let cwd = "";
  let model = "";
  let tools: string[] = [];
  const turns: Turn[] = [];
  const triggeredSkills: string[] = [];
  const commits: CommitInfo[] = [];
  const seenHashes = new Set<string>(); // Dedupe by hash
  let summary: string | undefined;
  let result: ParsedSession["result"];

  // Build a map of all entry uuid -> parentUuid for branch tracking
  // This includes system entries which can be part of the parent chain
  const allEntryParents = new Map<string, string | null>();

  for (const entry of entries) {
    // Track parent relationships for all entries with uuids
    if (entry.uuid) {
      allEntryParents.set(entry.uuid, entry.parentUuid ?? null);
    }

    // Try to extract sessionId from any entry if not yet found
    if (!rawSessionId) {
      rawSessionId = entry.session_id || entry.sessionId || "";
    }

    switch (entry.type) {
      case "summary":
        summary = entry.summary;
        continue;
      case "system":
        if (entry.subtype === "init") {
          rawSessionId = entry.session_id || rawSessionId;
          cwd = entry.cwd;
          model = entry.model;
          tools = entry.tools;
        }
        break;

      case "user":
      case "assistant":
        const turn = parseTurn(entry);
        if (turn) {
          turns.push(turn);
          // Extract triggered skills from Skill tool calls
          for (const toolCall of turn.toolCalls) {
            if (toolCall.name === "Skill" && toolCall.input.skill) {
              const skillName = toolCall.input.skill as string;
              if (!triggeredSkills.includes(skillName)) {
                triggeredSkills.push(skillName);
              }
            }
          }
          // Extract commits from tool results (git commit output)
          for (const toolResult of turn.toolResults) {
            const foundCommits = extractCommitsFromToolResult(toolResult.content);
            for (const commit of foundCommits) {
              if (!seenHashes.has(commit.hash)) {
                seenHashes.add(commit.hash);
                commits.push(commit);
              }
            }
          }
        }
        break;

      case "result":
        result = {
          success: entry.subtype === "success",
          durationMs: entry.duration_ms,
          costUsd: entry.total_cost_usd,
        };
        break;
    }
  }

  // Detect rewinds and mark current branch
  const rewinds = detectRewinds(turns);
  const currentBranch = findCurrentBranch(turns, allEntryParents);

  // Update isOnCurrentBranch for each turn
  for (const turn of turns) {
    turn.isOnCurrentBranch = turn.uuid ? currentBranch.has(turn.uuid) : true;
  }

  // Convert raw sessionId to branded type
  const sessionId: SessionId = asSessionId(rawSessionId);

  return { sessionId, cwd, model, tools, turns, subagents: [], rewinds, triggeredSkills, commits, summary, result };
}

/**
 * Parse a user or assistant entry into a Turn
 */
function parseTurn(
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
            content: toolResult.content,
            isError: toolResult.is_error ?? false,
          });
          break;
      }
    }
  }

  return {
    role: entry.type as "user" | "assistant",
    text: text.trim(),
    toolCalls,
    toolResults,
    uuid: asEntryUuid(entry.uuid ?? ""),
    parentUuid: entry.parentUuid === null ? null : entry.parentUuid ? asEntryUuid(entry.parentUuid) : undefined,
    isOnCurrentBranch: true, // Will be updated by detectRewinds
  };
}

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
