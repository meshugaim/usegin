/**
 * Real-time activity tracking for auto-implement sessions.
 *
 * Parses Claude CLI `--output-format stream-json` events, writes compact
 * activity events to `<runDir>/activity.jsonl`, and returns one-line
 * summaries for the operator's terminal.
 *
 * The activity log is the single source of truth for the watch dashboard —
 * it replaces the previous approach of reading Claude's internal JSONL.
 */

import { appendFile, mkdir } from "fs/promises";
import { join } from "path";

// ---------------------------------------------------------------------------
// Activity event types (written to activity.jsonl)
// ---------------------------------------------------------------------------

export interface ToolCallEvent {
  ts: string;
  type: "tool_call";
  name: string;
  detail: string;
}

export interface ToolResultEvent {
  ts: string;
  type: "tool_result";
  name: string;
  isError: boolean;
  detail: string;
}

export interface TextEvent {
  ts: string;
  type: "text";
  preview: string;
}

export interface UsageEvent {
  ts: string;
  type: "usage";
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  contextPercent: number;
}

export interface ResultEvent {
  ts: string;
  type: "result";
  success: boolean;
  durationMs: number;
  costUsd?: number;
}

export type ActivityEvent =
  | ToolCallEvent
  | ToolResultEvent
  | TextEvent
  | UsageEvent
  | ResultEvent;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTEXT_WINDOW = 1_000_000;
const ACTIVITY_FILE = "activity.jsonl";
/** Raw stream-json output — can be piped through `session --stream` for full narrative view */
const STREAM_FILE = "stream.jsonl";

/** Only log a usage event when context % changes by this much */
const USAGE_DELTA_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// ActivityWriter
// ---------------------------------------------------------------------------

export class ActivityWriter {
  private buffer = "";
  private activityPath: string;
  private lastContextPercent = 0;
  private pendingToolCalls = new Map<string, string>(); // tool_use_id → tool name

  constructor(private runDir: string) {
    this.activityPath = join(runDir, ACTIVITY_FILE);
  }

  /**
   * Process a chunk of stream-json output from Claude CLI.
   * Saves raw stream-json for `session --stream` compatibility,
   * writes compact activity events, and returns formatted summaries.
   */
  async processChunk(chunk: string): Promise<string[]> {
    // Save raw stream-json (users can `tail -f stream.jsonl | session --stream`)
    await this.writeRaw(chunk);

    this.buffer += chunk;
    const summaries: string[] = [];

    // Split into complete lines
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || ""; // Keep incomplete last line

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line);
        const results = await this.processEntry(entry);
        summaries.push(...results);
      } catch {
        // Skip malformed lines
      }
    }

    return summaries;
  }

  /**
   * Flush any remaining buffer content. Call when the process exits.
   */
  async flush(): Promise<string[]> {
    if (!this.buffer.trim()) return [];
    const remaining = this.buffer;
    this.buffer = "";
    return this.processChunk(remaining + "\n");
  }

  /**
   * Process a single stream-json entry and return terminal summaries.
   */
  private async processEntry(
    entry: Record<string, unknown>
  ): Promise<string[]> {
    const summaries: string[] = [];

    if (entry.type === "assistant") {
      const message = entry.message as Record<string, unknown> | undefined;
      if (!message) return summaries;

      const content = message.content;
      if (Array.isArray(content)) {
        for (const block of content as Array<Record<string, unknown>>) {
          if (block.type === "tool_use") {
            const s = await this.handleToolCall(block);
            if (s) summaries.push(s);
          } else if (block.type === "text") {
            const s = await this.handleText(block);
            if (s) summaries.push(s);
          }
        }
      }

      // Extract token usage
      const usage = message.usage as Record<string, number> | undefined;
      if (usage) {
        const s = await this.handleUsage(usage);
        if (s) summaries.push(s);
      }
    } else if (entry.type === "user") {
      const message = entry.message as Record<string, unknown> | undefined;
      if (!message) return summaries;

      const content = message.content;
      if (Array.isArray(content)) {
        for (const block of content as Array<Record<string, unknown>>) {
          if (block.type === "tool_result") {
            const s = await this.handleToolResult(block);
            if (s) summaries.push(s);
          }
        }
      }
    } else if (entry.type === "result") {
      const s = await this.handleResult(entry);
      if (s) summaries.push(s);
    }

    return summaries;
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private async handleToolCall(
    block: Record<string, unknown>
  ): Promise<string | null> {
    const name = String(block.name || "unknown");
    const input = block.input as Record<string, unknown> | undefined;
    const id = String(block.id || "");

    // Track for matching with result
    this.pendingToolCalls.set(id, name);

    const detail = summarizeToolInput(name, input);

    const event: ToolCallEvent = {
      ts: new Date().toISOString(),
      type: "tool_call",
      name,
      detail,
    };
    await this.writeEvent(event);

    // Build output lines — header + optional inline content
    const lines: string[] = [];
    lines.push(`${ts()} \x1b[36m${name.padEnd(6)}\x1b[0m ${detail}`);

    // Show Edit diffs inline
    if (name === "Edit" && input) {
      const diffLines = formatEditDiff(input);
      if (diffLines) lines.push(diffLines);
    }

    // Show Write content preview
    if (name === "Write" && input?.content) {
      const content = String(input.content);
      const lineCount = content.split("\n").length;
      lines.push(`\x1b[2m         ${lineCount} lines written\x1b[0m`);
    }

    return lines.join("\n");
  }

  private async handleToolResult(
    block: Record<string, unknown>
  ): Promise<string | null> {
    const toolUseId = String(block.tool_use_id || "");
    const isError = block.is_error === true;
    const name = this.pendingToolCalls.get(toolUseId) || "unknown";
    this.pendingToolCalls.delete(toolUseId);

    const content = normalizeResultContent(block.content);

    const event: ToolResultEvent = {
      ts: new Date().toISOString(),
      type: "tool_result",
      name,
      isError,
      detail: content.slice(0, 200),
    };
    await this.writeEvent(event);

    // Always show errors
    if (isError) {
      return `${ts()} \x1b[31m${name} ERROR\x1b[0m ${content.slice(0, 120)}`;
    }

    // Show Bash output (truncated, indented)
    if (name === "Bash" && content.length > 0) {
      const outputLines = content.split("\n").slice(0, 8);
      const truncated = content.split("\n").length > 8 ? `\n\x1b[2m         ... (${content.split("\n").length} lines total)\x1b[0m` : "";
      const formatted = outputLines.map((l) => `\x1b[2m         ${l.slice(0, 120)}\x1b[0m`).join("\n");
      return formatted + truncated;
    }

    return null;
  }

  private async handleText(
    block: Record<string, unknown>
  ): Promise<string | null> {
    const text = String(block.text || "").trim();
    if (!text) return null;

    // Only show substantial text (skip short acknowledgments)
    if (text.length < 20) return null;

    const preview = text.slice(0, 300).replace(/\n/g, " ");

    const event: TextEvent = {
      ts: new Date().toISOString(),
      type: "text",
      preview: preview.slice(0, 150),
    };
    await this.writeEvent(event);

    return `${ts()} \x1b[2m${preview}\x1b[0m`;
  }

  private async handleUsage(
    usage: Record<string, number>
  ): Promise<string | null> {
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens || 0;

    const contextTokens = inputTokens + cacheReadTokens + cacheWriteTokens;
    const contextPercent = Math.round((contextTokens / CONTEXT_WINDOW) * 100);

    const event: UsageEvent = {
      ts: new Date().toISOString(),
      type: "usage",
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      contextPercent,
    };
    await this.writeEvent(event);

    // Only show in terminal when context changes significantly
    const delta = Math.abs(contextPercent - this.lastContextPercent);
    if (delta >= USAGE_DELTA_THRESHOLD || this.lastContextPercent === 0) {
      this.lastContextPercent = contextPercent;
      const color = contextPercent > 60 ? "\x1b[33m" : contextPercent > 80 ? "\x1b[31m" : "\x1b[32m";
      return `${ts()} ${color}Context: ${contextPercent}% (${fmtTokens(contextTokens)}/${fmtTokens(CONTEXT_WINDOW)})${"\x1b[0m"}`;
    }

    return null;
  }

  private async handleResult(
    entry: Record<string, unknown>
  ): Promise<string | null> {
    const success = entry.subtype === "success";
    const durationMs = (entry.duration_ms as number) || 0;
    const costUsd = entry.total_cost_usd as number | undefined;

    const event: ResultEvent = {
      ts: new Date().toISOString(),
      type: "result",
      success,
      durationMs,
      costUsd,
    };
    await this.writeEvent(event);

    const durationStr = durationMs > 60_000
      ? `${Math.round(durationMs / 60_000)}min`
      : `${Math.round(durationMs / 1000)}s`;
    const costStr = costUsd !== undefined ? `, $${costUsd.toFixed(2)}` : "";

    return `${ts()} Session ${success ? "complete" : "failed"} (${durationStr}${costStr})`;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private async writeEvent(event: ActivityEvent): Promise<void> {
    await mkdir(this.runDir, { recursive: true });
    await appendFile(this.activityPath, JSON.stringify(event) + "\n");
  }

  private async writeRaw(chunk: string): Promise<void> {
    await mkdir(this.runDir, { recursive: true });
    await appendFile(join(this.runDir, STREAM_FILE), chunk);
  }
}

// ---------------------------------------------------------------------------
// Reading activity logs (for watch dashboard)
// ---------------------------------------------------------------------------

/**
 * Read the latest context percent from an activity log.
 */
export async function readLatestContext(
  runDir: string
): Promise<string | null> {
  try {
    const path = join(runDir, ACTIVITY_FILE);
    const file = Bun.file(path);
    if (!(await file.exists())) return null;

    const text = await file.text();
    const lines = text.trim().split("\n").filter(Boolean);

    // Scan from end for most recent usage event
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const event = JSON.parse(lines[i]) as ActivityEvent;
        if (event.type === "usage") {
          const contextTokens =
            event.inputTokens + event.cacheReadTokens + event.cacheWriteTokens;
          return `${event.contextPercent}% (${fmtTokens(contextTokens)}/${fmtTokens(CONTEXT_WINDOW)})`;
        }
      } catch {
        // Skip malformed
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Read recent activity from an activity log.
 */
export async function readRecentActivity(
  runDir: string,
  limit = 8
): Promise<Array<{ time: string; type: string; detail: string }>> {
  try {
    const path = join(runDir, ACTIVITY_FILE);
    const file = Bun.file(path);
    if (!(await file.exists())) return [];

    const text = await file.text();
    const lines = text.trim().split("\n").filter(Boolean);

    const activities: Array<{ time: string; type: string; detail: string }> = [];

    // Read from end
    const start = Math.max(0, lines.length - limit * 3); // Over-read to filter
    for (let i = start; i < lines.length; i++) {
      try {
        const event = JSON.parse(lines[i]) as ActivityEvent;
        const time = new Date(event.ts).toTimeString().slice(0, 8);

        switch (event.type) {
          case "tool_call":
            activities.push({
              time,
              type: event.name,
              detail: event.detail,
            });
            break;
          case "tool_result":
            if (event.isError) {
              activities.push({
                time,
                type: `${event.name}!`,
                detail: event.detail,
              });
            }
            break;
          case "text":
            activities.push({
              time,
              type: "text",
              detail: event.preview.slice(0, 80),
            });
            break;
          case "usage":
            activities.push({
              time,
              type: "ctx",
              detail: `${event.contextPercent}%`,
            });
            break;
          case "result":
            activities.push({
              time,
              type: "done",
              detail: event.success ? "success" : "failed",
            });
            break;
        }
      } catch {
        // Skip malformed
      }
    }

    return activities.slice(-limit);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ts(): string {
  return `\x1b[2m[${new Date().toTimeString().slice(0, 8)}]\x1b[0m`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * Generate a compact one-line summary of a tool call's input.
 */
function summarizeToolInput(
  name: string,
  input: Record<string, unknown> | undefined
): string {
  if (!input) return "";

  switch (name) {
    case "Read":
    case "Write":
      return shortPath(String(input.file_path || ""));
    case "Edit": {
      const path = shortPath(String(input.file_path || ""));
      const oldLen = String(input.old_string || "").split("\n").length;
      const newLen = String(input.new_string || "").split("\n").length;
      return `${path} (${oldLen}→${newLen} lines)`;
    }
    case "Bash": {
      const cmd = String(input.command || "").slice(0, 80);
      const desc = input.description ? String(input.description).slice(0, 60) : "";
      return desc || cmd;
    }
    case "Grep":
      return `"${String(input.pattern || "").slice(0, 40)}"${input.path ? ` in ${shortPath(String(input.path))}` : ""}`;
    case "Glob":
      return String(input.pattern || "");
    case "Agent":
      return `"${String(input.description || input.prompt || "").slice(0, 60)}"`;
    case "Skill":
      return String(input.skill || "");
    case "TodoWrite":
      return `${(input.todos as unknown[])?.length ?? "?"} items`;
    case "TaskCreate":
    case "TaskUpdate":
      return String(input.description || input.title || "").slice(0, 60);
    default:
      return name;
  }
}

/**
 * Shorten a file path to the last 2-3 components.
 */
function shortPath(fullPath: string): string {
  const parts = fullPath.split("/");
  if (parts.length <= 3) return fullPath;
  return parts.slice(-3).join("/");
}

/**
 * Format an Edit tool call's diff for inline display.
 * Shows removed/added lines, truncated for large edits.
 */
function formatEditDiff(input: Record<string, unknown>): string | null {
  const oldStr = String(input.old_string || "");
  const newStr = String(input.new_string || "");
  if (!oldStr && !newStr) return null;

  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const totalLines = oldLines.length + newLines.length;

  // For large edits, just show summary
  if (totalLines > 20) {
    return `\x1b[2m         ${oldLines.length} lines → ${newLines.length} lines\x1b[0m`;
  }

  const diffParts: string[] = [];
  for (const line of oldLines) {
    diffParts.push(`\x1b[31m         - ${line.slice(0, 120)}\x1b[0m`);
  }
  for (const line of newLines) {
    diffParts.push(`\x1b[32m         + ${line.slice(0, 120)}\x1b[0m`);
  }
  return diffParts.join("\n");
}

/**
 * Normalize tool result content to a string.
 */
function normalizeResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === "object" && b && "text" in b ? String((b as { text: string }).text) : JSON.stringify(b)))
      .join("\n");
  }
  return String(content ?? "");
}
