/**
 * Markdown rendering utilities for terminal output.
 * Uses marked with marked-terminal for rich terminal formatting.
 */

import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked with terminal renderer
// Use global marked instance - this is the standard approach per marked-terminal docs
marked.use(
  markedTerminal({
    // Match plan-cli color scheme
    showSectionPrefix: false, // Don't add "# " prefixes
    reflowText: false, // Preserve original line breaks
    tab: 2, // Use 2-space indentation
  })
);

/**
 * Render markdown text for terminal display.
 * @param text The markdown text to render
 * @param indent Optional indentation to apply to each line (e.g., "  ")
 * @returns Rendered text with ANSI formatting
 */
export function renderMarkdown(text: string, indent: string = ""): string {
  if (!text) return "";

  // Parse markdown to terminal-formatted string
  const rendered = marked.parse(text, { async: false }) as string;

  // Trim trailing whitespace and apply indentation if needed
  const trimmed = rendered.trimEnd();

  if (!indent) {
    return trimmed;
  }

  // Apply indentation to each line
  return trimmed
    .split("\n")
    .map((line) => indent + line)
    .join("\n");
}
