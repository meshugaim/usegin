/**
 * Session metadata extraction.
 *
 * This module handles extracting metadata from session files,
 * including user messages, summaries, and line counts.
 */

import { isEntry } from "../validation";
import type { SessionMeta, SessionSummary } from "./types";

// =============================================================================
// MESSAGE FORMATTING
// =============================================================================

/**
 * Truncate a message to a reasonable length for display.
 */
export function truncateMessage(text: string, maxLen = 80): string {
  // Replace newlines with spaces
  const singleLine = text.replace(/\n+/g, " ").trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.slice(0, maxLen - 3) + "...";
}

// =============================================================================
// SESSION METADATA EXTRACTION
// =============================================================================

/**
 * Extract metadata from a session file including summary, user messages, and line count.
 */
export async function extractSessionMeta(sessionPath: string): Promise<SessionMeta> {
  const file = Bun.file(sessionPath);
  const content = await file.text();
  const lines = content.split("\n").filter((l) => l.trim());

  const messages: string[] = [];
  let summary: string | null = null;
  let hasUserMessages = false;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (!isEntry(parsed)) {
        continue; // Skip invalid entries
      }

      // Check for summary line
      if (parsed.type === "summary" && parsed.summary) {
        summary = parsed.summary;
        continue;
      }

      if (parsed.type === "user" && parsed.message?.content) {
        hasUserMessages = true;
        // Extract text from message content
        const msgContent = parsed.message.content;
        if (typeof msgContent === "string") {
          const text = msgContent.trim();
          if (text && !text.startsWith("<")) {
            // Skip system reminders etc
            messages.push(truncateMessage(text));
          }
        } else if (Array.isArray(msgContent)) {
          for (const part of msgContent) {
            if (part.type === "text" && part.text) {
              const text = part.text.trim();
              if (text && !text.startsWith("<")) {
                messages.push(truncateMessage(text));
              }
            }
          }
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  return { messages, lineCount: lines.length, summary, hasUserMessages };
}

/**
 * Extract user messages and line count from a session file (lightweight, no full parse).
 */
export async function extractSessionSummary(sessionPath: string): Promise<SessionSummary> {
  const meta = await extractSessionMeta(sessionPath);
  return { messages: meta.messages, lineCount: meta.lineCount };
}

/**
 * Extract user messages from a session file (lightweight, no full parse).
 * @deprecated Use extractSessionSummary instead
 */
export async function extractUserMessages(sessionPath: string): Promise<string[]> {
  const summary = await extractSessionSummary(sessionPath);
  return summary.messages;
}
