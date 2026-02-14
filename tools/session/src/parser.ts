/**
 * Core JSONL parser for Claude sessions
 */

import { readdir } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { formatTurn, type FormatOptions } from "./formatter";
import type {
  Entry,
  AssistantEntry,
  ParsedSession,
  ParsedSubagent,
  Turn,
  TokenUsage,
  ToolCall,
  ToolResult,
  MessageContent,
  TextContent,
  ToolUseContent,
  ToolResultContent,
  RewindInfo,
  CommitInfo,
  CompactionEvent,
  QueuedMessage,
  SessionId,
  EntryUuid,
  AgentId,
  ToolUseId,
} from "./types";
import { asSessionId, asEntryUuid, asAgentId, asToolUseId, normalizeToolResultContent } from "./types";
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
  const firstLine = content.split("\n")[0] ?? "";

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
    if (uuidMatch && uuidMatch[1]) {
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

  const seenFiles = new Set<string>();

  for (const subagentFile of subagentFiles) {
    seenFiles.add(subagentFile);
    const subagentPath = join(dir, subagentFile);
    const subFile = Bun.file(subagentPath);
    const subContent = await subFile.text();
    const subFirstLine = subContent.split("\n")[0] ?? "";

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

  // Also check the new layout: <sessionId>/subagents/ directory
  const sessionFilename = basename(absolutePath, ".jsonl");
  const nestedSubagentsDir = join(dir, sessionFilename, "subagents");
  try {
    const nestedDirFiles = await readdir(nestedSubagentsDir);
    const nestedSubagentFiles = nestedDirFiles.filter(
      (filename) => filename.startsWith("agent-") && filename.endsWith(".jsonl") && !seenFiles.has(filename)
    );

    for (const subagentFile of nestedSubagentFiles) {
      const subagentPath = join(nestedSubagentsDir, subagentFile);
      const subFile = Bun.file(subagentPath);
      const subContent = await subFile.text();
      const subFirstLine = subContent.split("\n")[0] ?? "";

      try {
        const subParsed = JSON.parse(subFirstLine);
        if (!isEntry(subParsed)) {
          continue;
        }
        const subSessionId = getSessionId(subParsed);
        if (subSessionId === sessionId) {
          files.push(subagentPath);
        }
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // Nested subagents directory doesn't exist — that's fine
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
    const seenFiles = new Set<string>();

    for (const subagentFile of subagentFiles) {
      seenFiles.add(subagentFile);
      const subagentPath = join(dir, subagentFile);
      const subagent = await parseSubagentFile(subagentPath, sessionId, debug);
      if (subagent) {
        // Filter out warmups unless explicitly requested
        if (includeWarmups || !isWarmupSubagent(subagent)) {
          subagents.push(subagent);
        }
      }
    }

    // Also check the new layout: <sessionId>/subagents/ directory
    const sessionFilename = basename(mainSessionPath, ".jsonl");
    const nestedSubagentsDir = join(dir, sessionFilename, "subagents");
    try {
      const nestedFiles = await readdir(nestedSubagentsDir);
      const nestedSubagentFiles = nestedFiles.filter(
        (filename) => filename.startsWith("agent-") && filename.endsWith(".jsonl") && !seenFiles.has(filename)
      );

      for (const subagentFile of nestedSubagentFiles) {
        const subagentPath = join(nestedSubagentsDir, subagentFile);
        const subagent = await parseSubagentFile(subagentPath, sessionId, debug);
        if (subagent) {
          if (includeWarmups || !isWarmupSubagent(subagent)) {
            subagents.push(subagent);
          }
        }
      }
    } catch {
      // Nested subagents directory doesn't exist — that's fine
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

  const firstLine = lines[0];
  if (!firstLine) return null;

  // Check first entry to see if this subagent belongs to our session
  let firstEntry: Entry | null = null;
  try {
    const parsed = JSON.parse(firstLine);
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
    // Access timestamp from entry (exists on some entry types)
    const entryTimestamp = (entry as { timestamp?: string }).timestamp;
    if (!startTimestamp && entryTimestamp) {
      startTimestamp = entryTimestamp;
    }

    if (entry.type === "user" || entry.type === "assistant") {
      const turn = parseTurn(entry as Entry & { type: "user" | "assistant" });
      if (turn) {
        turns.push(turn);
      }
    }
  }

  // Aggregate token usage from assistant turns that carry per-turn data
  const turnsWithTokens = turns.filter((t) => t.tokenUsage);
  const tokenUsage =
    turnsWithTokens.length > 0
      ? turnsWithTokens.reduce(
          (acc, t) => ({
            inputTokens: acc.inputTokens + t.tokenUsage!.inputTokens,
            outputTokens: acc.outputTokens + t.tokenUsage!.outputTokens,
            cacheCreationInputTokens:
              acc.cacheCreationInputTokens + t.tokenUsage!.cacheCreationInputTokens,
            cacheReadInputTokens:
              acc.cacheReadInputTokens + t.tokenUsage!.cacheReadInputTokens,
          }),
          {
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          }
        )
      : undefined;

  return {
    agentId: asAgentId(rawAgentId),
    sessionId: asSessionId(parentSessionId),
    turns,
    startTimestamp,
    ...(tokenUsage ? { tokenUsage } : {}),
  };
}

/**
 * Detect rewinds by analyzing the parent-child relationships in turns.
 *
 * A rewind occurs when a turn's parentUuid points to a message that already
 * has a different child in the recorded sequence. This creates a branching
 * tree structure where earlier branches are abandoned in favor of newer ones.
 *
 * @param turns - All turns parsed from the session
 * @param allEntryParents - Map of every entry's uuid to its parentUuid (includes non-turn entries)
 * @returns Array of RewindInfo describing each branch point and abandoned turns
 */
function detectRewinds(
  turns: Turn[],
  allEntryParents: Map<string, string | null>
): RewindInfo[] {
  if (turns.length === 0) return [];

  // Check if we have parentUuid data - if not, assume linear (legacy format)
  const hasParentData = turns.some((turn) => turn.parentUuid !== undefined);
  if (!hasParentData) return [];

  // Build a set of turn uuids for quick lookup
  const turnUuids = new Set<string>(
    turns.map((t) => t.uuid).filter((uuid): uuid is EntryUuid => Boolean(uuid))
  );

  /**
   * Find the nearest turn ancestor for a given turn.
   *
   * The session JSONL may have intermediate non-turn entries (progress, hooks,
   * saved_hook_context) between turns in the parent chain. This function walks
   * up through those intermediates to find the actual turn that logically
   * precedes the given turn.
   *
   * Example: If turn U2 has parentUuid pointing to a progress entry P1,
   * and P1 has parentUuid pointing to assistant turn A1, this returns A1.
   *
   * @param turn - The turn to find the ancestor for
   * @returns The uuid of the nearest turn ancestor, or null if none found
   */
  function findNearestTurnAncestor(turn: Turn): EntryUuid | null {
    const visited = new Set<string>();
    let currentUuid: string | null = turn.parentUuid ?? null;

    while (currentUuid !== null) {
      // Cycle detection - parent chains can form cycles in edge cases
      if (visited.has(currentUuid)) {
        break;
      }
      visited.add(currentUuid);

      // If this is a turn, we found the logical parent
      if (turnUuids.has(currentUuid)) {
        return asEntryUuid(currentUuid);
      }

      // Walk to the parent of this non-turn entry
      const parentOfCurrent = allEntryParents.get(currentUuid);
      if (parentOfCurrent === undefined) {
        // Not in our map, stop
        break;
      }
      currentUuid = parentOfCurrent;
    }

    return null;
  }

  const rewinds: RewindInfo[] = [];

  // Build a map of turn ancestor -> descendant turns (in order of appearance)
  // This groups turns by their logical parent, ignoring intermediate non-turn entries
  const childrenByAncestor = new Map<EntryUuid | null, EntryUuid[]>();

  for (const turn of turns) {
    const ancestor = findNearestTurnAncestor(turn);
    if (!childrenByAncestor.has(ancestor)) {
      childrenByAncestor.set(ancestor, []);
    }
    childrenByAncestor.get(ancestor)!.push(turn.uuid);
  }

  // Build a lookup from uuid to turn role for filtering hook-injected forks
  const turnByUuid = new Map<string, Turn>();
  for (const turn of turns) {
    if (turn.uuid) {
      turnByUuid.set(turn.uuid, turn);
    }
  }

  // Find rewind points: ancestors with multiple children indicate a branch
  for (const [ancestorUuid, children] of childrenByAncestor) {
    if (children.length > 1 && ancestorUuid !== null) {
      // Multiple children from same ancestor = rewinds happened
      // The last child is on the current branch, others are abandoned
      const abandonedChildren = children.slice(0, -1);

      for (const abandonedChild of abandonedChildren) {
        // Skip hook-injected assistant forks: when a PreToolUse hook fires,
        // it injects an assistant entry between the original assistant's tool
        // dispatch and the user's tool result. This creates a structural fork
        // that looks like a rewind but isn't. Real rewinds are always initiated
        // by users, so the abandoned child of a real rewind is always a user turn.
        const abandonedTurn = turnByUuid.get(abandonedChild);
        if (abandonedTurn?.role === "assistant") {
          continue;
        }

        // Collect all descendants of this abandoned child
        const abandonedBranch = collectDescendants(abandonedChild, childrenByAncestor);
        rewinds.push({
          fromUuid: ancestorUuid,
          abandonedBranchUuids: abandonedBranch,
        });
      }
    }
  }

  return rewinds;
}

/**
 * Collect all descendants of a given uuid in the turn tree (including the uuid itself).
 *
 * Used to identify all turns on an abandoned branch when detecting rewinds.
 * Includes cycle detection to handle malformed parent chains gracefully.
 *
 * @param uuid - The root uuid to collect descendants from
 * @param childrenByAncestor - Map of ancestor uuid to child turn uuids
 * @param visited - Set of already-visited uuids (for cycle detection)
 * @returns Array of all descendant uuids including the root
 */
function collectDescendants(
  uuid: EntryUuid,
  childrenByAncestor: Map<EntryUuid | null, EntryUuid[]>,
  visited: Set<EntryUuid> = new Set()
): EntryUuid[] {
  // Cycle detection: if we've already visited this uuid, stop recursing
  if (visited.has(uuid)) {
    return [];
  }
  visited.add(uuid);

  const result: EntryUuid[] = [uuid];
  const children = childrenByAncestor.get(uuid) ?? [];

  for (const child of children) {
    result.push(...collectDescendants(child, childrenByAncestor, visited));
  }

  return result;
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

/**
 * Parse an array of JSONL entries into a structured session.
 *
 * This is the core parsing function that:
 * 1. Extracts session metadata (id, cwd, model, tools)
 * 2. Converts user/assistant entries into Turn objects
 * 3. Extracts skills invoked via the Skill tool
 * 4. Extracts git commits from tool results
 * 5. Detects rewinds (branch points) and marks which turns are on the current branch
 *
 * @param entries - Array of validated Entry objects from the JSONL file
 * @returns ParsedSession containing all extracted data
 */
export function parseEntries(entries: Entry[]): ParsedSession {
  let rawSessionId = "";
  let cwd = "";
  let model = "";
  let slug = "";
  let tools: string[] = [];
  const turns: Turn[] = [];
  const triggeredSkills: string[] = [];
  const commits: CommitInfo[] = [];
  const queuedMessages: QueuedMessage[] = [];
  const turnDurations: number[] = [];
  const seenHashes = new Set<string>(); // Dedupe by hash
  // Map tool_use_id -> tool name, so we can filter which tool results to scan for commits.
  // Assistant turns (with tool_use blocks) always precede user turns (with tool_result blocks),
  // so this map is populated before we need to look up a result's originating tool.
  const toolUseIdToName = new Map<ToolUseId, string>();
  let summary: string | undefined;
  let result: ParsedSession["result"];
  let startTimestamp: string | undefined;
  let endTimestamp: string | undefined;
  // Compaction tracking
  const compactions: CompactionEvent[] = [];
  // Track compact_boundary UUIDs awaiting their summary message.
  // After a compact_boundary, the next user turn has parentUuid pointing
  // to the boundary entry. When we encounter that user turn, we tag it
  // as a compaction summary and remove the boundary from this set.
  const pendingCompactionBoundaryUuids = new Set<string>();
  // Aggregate token usage across all assistant turns
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreationInputTokens = 0;
  let totalCacheReadInputTokens = 0;
  let hasUsageData = false;

  // Build a map of all entry uuid -> parentUuid for branch tracking
  // This includes system entries which can be part of the parent chain
  const allEntryParents = new Map<string, string | null>();

  for (const entry of entries) {
    // Cast to access common optional fields that may exist on various entry types
    const e = entry as unknown as Record<string, unknown>;

    // Track parent relationships for all entries with uuids
    const uuid = e.uuid as string | undefined;
    const parentUuid = e.parentUuid as string | null | undefined;
    if (uuid) {
      allEntryParents.set(uuid, parentUuid ?? null);
    }

    // Capture first and last timestamps across all entries
    const entryTimestamp = e.timestamp as string | undefined;
    if (entryTimestamp) {
      if (!startTimestamp) {
        startTimestamp = entryTimestamp;
      }
      endTimestamp = entryTimestamp;
    }

    // Try to extract sessionId from any entry if not yet found
    if (!rawSessionId) {
      rawSessionId = (e.session_id as string) || (e.sessionId as string) || "";
    }

    // Extract cwd from any entry that has it (user, assistant, progress, etc.)
    // Modern Claude Code sessions may not have a system/init entry, but most
    // entry types include a cwd field. Capture from the first entry that has one.
    if (!cwd) {
      const entryCwd = e.cwd as string | undefined;
      if (entryCwd) {
        cwd = entryCwd;
      }
    }

    // Extract slug (human-readable session name like "gleaming-fluttering-torvalds")
    // from the first entry that has it. Most entry types carry slug.
    if (!slug) {
      const entrySlug = e.slug as string | undefined;
      if (entrySlug) {
        slug = entrySlug;
      }
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
        // system/turn_duration entries carry per-turn timing data
        if ((e.subtype as string) === "turn_duration") {
          const durationMs = e.durationMs as number | undefined;
          if (typeof durationMs === "number" && durationMs >= 0) {
            turnDurations.push(durationMs);
          }
        }
        // Auto-compaction boundary: extract metadata and prepare to tag
        // the immediately-following user message as a compaction summary.
        if ((e.subtype as string) === "compact_boundary") {
          const compactMeta = e.compactMetadata as { trigger?: string; preTokens?: number } | undefined;
          const boundaryUuid = e.uuid as string | undefined;
          const logicalParent = e.logicalParentUuid as string | undefined;
          const timestamp = e.timestamp as string | undefined;

          if (boundaryUuid && timestamp) {
            compactions.push({
              timestamp,
              trigger: compactMeta?.trigger ?? "unknown",
              preTokens: compactMeta?.preTokens ?? 0,
              boundaryUuid: asEntryUuid(boundaryUuid),
              logicalParentUuid: asEntryUuid(logicalParent ?? ""),
              // summaryMessageUuid will be filled in when we encounter the
              // following user turn whose parentUuid matches this boundary
            });
            pendingCompactionBoundaryUuids.add(boundaryUuid);
          }
        }
        break;

      case "user":
      case "assistant":
        const turn = parseTurn(entry);
        if (turn) {
          // Tag user turns that are compaction summaries.
          // The user message immediately following a compact_boundary has its
          // parentUuid pointing to the boundary entry's uuid.
          if (
            turn.role === "user" &&
            turn.parentUuid &&
            pendingCompactionBoundaryUuids.has(turn.parentUuid)
          ) {
            turn.isCompactionSummary = true;
            // Link the compaction event to this summary message
            const compaction = compactions.find(
              (c) => c.boundaryUuid === turn.parentUuid
            );
            if (compaction) {
              compaction.summaryMessageUuid = asEntryUuid(turn.uuid);
            }
            pendingCompactionBoundaryUuids.delete(turn.parentUuid);
          }
          turns.push(turn);
          // Index tool calls by id so we can match results to their originating tool.
          // Also extract triggered skills from Skill tool calls.
          for (const toolCall of turn.toolCalls) {
            toolUseIdToName.set(toolCall.id, toolCall.name);
            if (toolCall.name === "Skill" && toolCall.input.skill) {
              const skillName = toolCall.input.skill as string;
              if (!triggeredSkills.includes(skillName)) {
                triggeredSkills.push(skillName);
              }
            }
          }
          // Extract commits from Bash tool results only.
          // Git commit output ("[branch hash] message") can appear in any text,
          // so we limit scanning to Bash results to avoid false positives from
          // Read, Grep, or other tools that might contain matching patterns.
          for (const toolResult of turn.toolResults) {
            const toolName = toolUseIdToName.get(toolResult.toolUseId);
            if (toolName !== "Bash") continue;
            const foundCommits = extractCommitsFromToolResult(toolResult.content);
            for (const commit of foundCommits) {
              if (!seenHashes.has(commit.hash)) {
                seenHashes.add(commit.hash);
                commits.push(commit);
              }
            }
          }
          // Extract model from the first assistant entry that has one.
          // Modern Claude Code sessions often lack system/init, so the model
          // field on the assistant message is the most reliable source.
          if (entry.type === "assistant" && !model) {
            const entryModel = entry.message?.model;
            if (entryModel) {
              model = entryModel;
            }
          }
          // Aggregate token usage from assistant entries
          if (entry.type === "assistant") {
            const usage = entry.message?.usage;
            if (usage) {
              hasUsageData = true;
              totalInputTokens += usage.input_tokens ?? 0;
              totalOutputTokens += usage.output_tokens ?? 0;
              totalCacheCreationInputTokens += usage.cache_creation_input_tokens ?? 0;
              totalCacheReadInputTokens += usage.cache_read_input_tokens ?? 0;
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

      case "queue-operation":
        // queue-operation entries represent user messages sent while the agent
        // was mid-turn. Both "enqueue" (message queued) and "popAll" (messages
        // delivered to the agent) carry the user's text. Surface them so they
        // can appear in the timeline and narrative formatter.
        if (
          (entry.operation === "enqueue" || entry.operation === "popAll") &&
          typeof entry.content === "string" &&
          entry.content.trim() !== "" &&
          entry.timestamp
        ) {
          queuedMessages.push({
            timestamp: entry.timestamp,
            content: entry.content,
          });
        }
        break;
    }
  }

  // Detect rewinds and mark current branch
  const rewinds = detectRewinds(turns, allEntryParents);

  // Build the set of abandoned turn UUIDs from rewind detection.
  // A turn is on the current branch if it is NOT on any abandoned rewind branch.
  // This is consistent with detectRewinds: if a fork isn't counted as a rewind
  // (e.g., hook-injected assistant forks), its turns remain on the current branch.
  const abandonedUuids = new Set<string>();
  for (const rewind of rewinds) {
    for (const uuid of rewind.abandonedBranchUuids) {
      abandonedUuids.add(uuid);
    }
  }

  // Update isOnCurrentBranch for each turn
  for (const turn of turns) {
    turn.isOnCurrentBranch = turn.uuid ? !abandonedUuids.has(turn.uuid) : true;
  }

  // Convert raw sessionId to branded type
  const sessionId: SessionId = asSessionId(rawSessionId);

  // Build token usage if any usage data was found
  const tokenUsage: TokenUsage | undefined = hasUsageData
    ? {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheCreationInputTokens: totalCacheCreationInputTokens,
        cacheReadInputTokens: totalCacheReadInputTokens,
      }
    : undefined;

  return {
    sessionId,
    cwd,
    model,
    tools,
    turns,
    subagents: [],
    rewinds,
    triggeredSkills,
    commits,
    compactions,
    ...(queuedMessages.length > 0 ? { queuedMessages } : {}),
    ...(slug ? { slug } : {}),
    ...(turnDurations.length > 0 ? { turnDurations } : {}),
    summary,
    startTimestamp,
    endTimestamp,
    tokenUsage,
    result,
  };
}

/**
 * Parse a user or assistant entry into a Turn.
 *
 * Extracts text content, tool calls (from assistant messages), and tool results
 * (from user messages that contain tool responses).
 *
 * @param entry - A user or assistant entry from the JSONL
 * @returns Turn object, or null if the entry has no message content
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
