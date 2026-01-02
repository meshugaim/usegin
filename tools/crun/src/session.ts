/**
 * Session integration for crun
 * Extracts prompt info from Claude session files
 */

import { homedir } from "os";
import { Glob } from "bun";
import { basename, dirname } from "path";

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
