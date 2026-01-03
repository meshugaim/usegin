/**
 * Session integration for crun
 * Extracts prompt info from Claude session files
 */

import { homedir } from "os";
import { Glob } from "bun";
import { basename } from "path";

/**
 * Find session file path by session ID
 * Searches all project directories for the session
 */
export async function findSessionPath(sessionId: string): Promise<string | null> {
  const claudeDir = `${homedir()}/.claude/projects`;

  // Session files are stored as <session-id>.jsonl
  const glob = new Glob(`**/${sessionId}.jsonl`);

  for await (const file of glob.scan({ cwd: claudeDir, absolute: true })) {
    // Skip subagent files
    if (basename(file).startsWith("agent-")) {
      continue;
    }
    return file;
  }

  return null;
}

/**
 * Extract the first user message from a session file
 * This is used as the prompt preview in list output
 */
export async function getFirstUserMessage(sessionPath: string): Promise<string | null> {
  try {
    const file = Bun.file(sessionPath);
    const content = await file.text();
    const lines = content.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line);

        // Look for user messages
        if (entry.type === "user" && entry.message?.role === "user") {
          const msgContent = entry.message.content;

          if (typeof msgContent === "string") {
            return msgContent.trim();
          } else if (Array.isArray(msgContent)) {
            for (const part of msgContent) {
              if (part.type === "text" && part.text) {
                return part.text.trim();
              }
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Session file not found or can't be read
  }

  return null;
}

/**
 * Get prompt preview for a session ID
 * Returns first user message, truncated for display
 */
export async function getPromptPreview(
  sessionId: string,
  maxLength: number = 40
): Promise<string | null> {
  const sessionPath = await findSessionPath(sessionId);
  if (!sessionPath) return null;

  const firstMessage = await getFirstUserMessage(sessionPath);
  if (!firstMessage) return null;

  // Truncate for display
  const singleLine = firstMessage.replace(/\n+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return singleLine.slice(0, maxLength - 3) + "...";
}

/**
 * Resolve a short session ID prefix to full session ID(s)
 * Like git's short hash resolution
 * Returns all matching session IDs (empty if none, multiple if ambiguous)
 */
export async function resolveSessionId(shortId: string): Promise<string[]> {
  const claudeDir = `${homedir()}/.claude/projects`;

  // If it's already a full UUID (36 chars), return as-is
  if (shortId.length === 36) {
    const exists = await findSessionPath(shortId);
    return exists ? [shortId] : [];
  }

  // Search for all sessions starting with this prefix
  const glob = new Glob(`**/${shortId}*.jsonl`);
  const matches: string[] = [];

  for await (const file of glob.scan({ cwd: claudeDir, absolute: true })) {
    // Skip subagent files
    if (basename(file).startsWith("agent-")) {
      continue;
    }
    // Extract session ID from filename
    const sessionId = basename(file, ".jsonl");
    if (!matches.includes(sessionId)) {
      matches.push(sessionId);
    }
  }

  return matches;
}

/**
 * Resolve a short session ID to exactly one session
 * Returns the session ID if unique, throws if ambiguous or not found
 */
export async function resolveUniqueSessionId(shortId: string): Promise<string> {
  const matches = await resolveSessionId(shortId);

  if (matches.length === 0) {
    throw new Error(`Session not found: ${shortId}`);
  }

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous session ID '${shortId}' matches ${matches.length} sessions:\n` +
        matches.map((m) => `  ${m}`).join("\n")
    );
  }

  return matches[0];
}
