/**
 * Subagent file discovery, listing, and parsing.
 *
 * Extracted from parser.ts — handles discovering subagent JSONL files,
 * parsing them into ParsedSubagent objects, and team member discovery.
 */

import { readdir } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import type {
  Entry,
  ParsedSubagent,
  TeamMemberInfo,
  Turn,
  SessionId,
} from "./types";
import { asSessionId, asAgentId } from "./types";
import { debugLog } from "./debug";
import { isEntry, getSessionId, hasAgentId } from "./validation";
import { readJsonlContent } from "./utils";
import { parseTurn } from "./parse-turn";
import { aggregateTokenUsage } from "./parse-tokens";

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
  const content = await readJsonlContent(absolutePath);
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
    const subContent = await readJsonlContent(subagentPath);
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
      const subContent = await readJsonlContent(subagentPath);
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
 * Detect if a subagent is an aside question (from /btw command).
 *
 * Aside questions are identified by their agentId containing "aside_question".
 * These are lightweight subagents spawned when the user asks a tangential
 * question mid-session via `/btw`.
 */
export function isAsideQuestion(subagent: ParsedSubagent): boolean {
  return subagent.agentId?.includes("aside_question") ?? false;
}

/**
 * Extract the question and answer from an aside_question subagent.
 *
 * - Question: the last user turn text, with system-reminder wrapper stripped
 * - Answer: the last assistant turn text
 *
 * Returns null if neither question nor answer can be extracted.
 */
export function extractBtwContent(subagent: ParsedSubagent): { question: string; answer: string } | null {
  const userTurns = subagent.turns.filter((t) => t.role === "user");
  const assistantTurns = subagent.turns.filter((t) => t.role === "assistant");

  // The question is the last user message, but it's often wrapped in a
  // <system-reminder> preamble. Strip that to get the actual human question.
  const rawQuestion = userTurns[userTurns.length - 1]?.text ?? "";
  const question = stripBtwSystemReminder(rawQuestion);
  const answer = assistantTurns[assistantTurns.length - 1]?.text ?? "";

  if (!question && !answer) return null;
  return { question, answer };
}

/**
 * Strip the system-reminder wrapper from a /btw user message.
 *
 * The aside_question subagent receives user messages like:
 *   <system-reminder>This is a side question from the user...
 *   CRITICAL CONSTRAINTS:
 *   ...</system-reminder>
 *
 *   why is it getting truncated?
 *
 * This function extracts just the human question after the closing tag.
 * Falls back to the raw text if no system-reminder is found.
 */
function stripBtwSystemReminder(text: string): string {
  // Try to find content after the closing </system-reminder> tag
  const closeTag = "</system-reminder>";
  const closeIdx = text.lastIndexOf(closeTag);
  if (closeIdx !== -1) {
    const afterTag = text.slice(closeIdx + closeTag.length).trim();
    if (afterTag) return afterTag;
  }

  // No closing tag or nothing after it — return as-is
  return text;
}

/**
 * Discover subagent files for a session
 */
export async function discoverSubagents(
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
export async function parseSubagentFile(
  filePath: string,
  parentSessionId: string,
  debug: boolean = false
): Promise<ParsedSubagent | null> {
  const content = await readJsonlContent(filePath);
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
  const tokenUsage = aggregateTokenUsage(turns);

  return {
    agentId: asAgentId(rawAgentId),
    sessionId: asSessionId(parentSessionId),
    turns,
    startTimestamp,
    ...(tokenUsage ? { tokenUsage } : {}),
  };
}

// ============================================================================
// TEAM MEMBER DISCOVERY
// ============================================================================

/**
 * Extract team names from tool results in the session.
 *
 * Looks for Agent tool results that contain "team_name:" (team member spawns)
 * and TeamCreate results that contain "team_name" (team creation).
 * Returns a set of team names this session is the lead for.
 */
export function extractTeamNames(turns: Turn[]): Set<string> {
  const teamNames = new Set<string>();

  for (const turn of turns) {
    for (const tr of turn.toolResults) {
      // Agent spawn result: "team_name: nesting-test"
      const agentMatch = tr.content.match(/team_name:\s*(\S+)/);
      if (agentMatch) {
        teamNames.add(agentMatch[1]!);
      }
      // TeamCreate result: JSON with "team_name": "nesting-test"
      const createMatch = tr.content.match(/"team_name":\s*"([^"]+)"/);
      if (createMatch) {
        teamNames.add(createMatch[1]!);
      }
    }
  }

  return teamNames;
}

/**
 * Discover team member sessions by scanning sibling JSONL files.
 *
 * Team members are separate sessions in the same directory. Their first JSONL
 * entry contains `teamName` and `agentName` fields. We match them by teamName
 * against the teams this session created.
 */
export async function discoverTeamMembers(
  mainSessionPath: string,
  mainSessionId: string,
  teamNames: Set<string>,
  debug: boolean = false,
): Promise<TeamMemberInfo[]> {
  if (teamNames.size === 0) return [];

  const dir = dirname(mainSessionPath);
  const mainFilename = basename(mainSessionPath);
  const members: TeamMemberInfo[] = [];

  try {
    const files = await readdir(dir);
    // Only check UUID-shaped JSONL files (not agent-*.jsonl subagent files)
    const sessionFiles = files.filter(
      (f) => f.endsWith(".jsonl") && !f.startsWith("agent-") && f !== mainFilename,
    );

    for (const file of sessionFiles) {
      const filePath = join(dir, file);
      try {
        const content = await readJsonlContent(filePath);
        const firstNewline = content.indexOf("\n");
        const firstLine = firstNewline > 0 ? content.slice(0, firstNewline) : content;
        if (!firstLine.trim()) continue;

        const firstEntry = JSON.parse(firstLine);
        const entryTeamName = firstEntry.teamName as string | undefined;
        const entryAgentName = firstEntry.agentName as string | undefined;
        const entrySessionId = (firstEntry.sessionId ?? firstEntry.session_id) as string | undefined;

        if (!entryTeamName || !teamNames.has(entryTeamName)) continue;
        // Skip the lead's own session
        if (entrySessionId === mainSessionId) continue;

        // Count turns and subagents by scanning lines
        let turnCount = 0;
        let subagentCount = 0;
        let startTs: string | undefined;
        let endTs: string | undefined;
        const lines = content.split("\n").filter((l: string) => l.trim());
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const ts = entry.timestamp as string | undefined;
            if (ts) {
              if (!startTs) startTs = ts;
              endTs = ts;
            }
            if (entry.type === "user" || entry.type === "assistant") {
              turnCount++;
            }
          } catch {
            // skip malformed lines
          }
        }

        // Count subagent files for this team member's session
        if (entrySessionId) {
          const agentFiles = files.filter(
            (f) => f.startsWith("agent-") && f.endsWith(".jsonl"),
          );
          for (const af of agentFiles) {
            try {
              const agentContent = await readJsonlContent(join(dir, af));
              const agentFirstLine = agentContent.slice(0, agentContent.indexOf("\n") || agentContent.length);
              const agentEntry = JSON.parse(agentFirstLine);
              if (agentEntry.sessionId === entrySessionId) {
                subagentCount++;
              }
            } catch {
              // skip
            }
          }
          // Also check nested layout
          const sessionBasename = basename(file, ".jsonl");
          const nestedDir = join(dir, sessionBasename, "subagents");
          try {
            const nestedFiles = await readdir(nestedDir);
            subagentCount += nestedFiles.filter(
              (f) => f.startsWith("agent-") && f.endsWith(".jsonl"),
            ).length;
          } catch {
            // no nested dir
          }
        }

        members.push({
          name: entryAgentName || "unknown",
          teamName: entryTeamName,
          sessionId: asSessionId(entrySessionId || file.replace(".jsonl", "")),
          turns: turnCount,
          subagentCount,
          ...(startTs ? { startTimestamp: startTs } : {}),
          ...(endTs ? { endTimestamp: endTs } : {}),
        });

        debugLog(debug, `Found team member: ${entryAgentName} (team: ${entryTeamName}, session: ${entrySessionId})`);
      } catch {
        // skip files that can't be parsed
      }
    }
  } catch (error) {
    debugLog(debug, `Could not scan for team members in ${dir}: ${(error as Error).message}`);
  }

  // Sort by start timestamp
  members.sort((a, b) => {
    if (!a.startTimestamp || !b.startTimestamp) return 0;
    return a.startTimestamp.localeCompare(b.startTimestamp);
  });

  return members;
}
