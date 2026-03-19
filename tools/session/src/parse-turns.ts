/**
 * Turn building: convert Entry[] into a ParsedSession with turns, rewinds,
 * commits, compactions, and metadata.
 *
 * Extracted from parser.ts — see parseSession() for the orchestrator.
 */

import type {
  Entry,
  ParsedSession,
  Turn,
  TokenUsage,
  CommitInfo,
  CompactionEvent,
  QueuedMessage,
  SessionId,
  EntryUuid,
  ToolUseId,
  RewindInfo,
} from "./types";
import { asSessionId, asEntryUuid } from "./types";
import { parseTurn, extractCommitsFromToolResult } from "./parse-turn";

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
  // Aggregate token usage across all assistant turns.
  // NOTE: This is intentionally separate from aggregateTokenUsage() in parse-tokens.ts.
  // This aggregates from raw entries AS turns are built (before rewind filtering).
  // aggregateTokenUsage() aggregates from already-parsed Turn objects (used for subagents).
  // They operate at different pipeline stages and cannot be unified.
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
              logicalParentUuid: logicalParent ? asEntryUuid(logicalParent) : null,
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
