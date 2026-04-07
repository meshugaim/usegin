import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tip {
  title: string;
  handle: string;
  tags: string[];
  context?: string;
  body: string;
}

// ---------------------------------------------------------------------------
// ANSI color helpers (matching docs-registry convention)
// ---------------------------------------------------------------------------

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from markdown content into a Tip.
 *
 * Expects the standard `---` delimited frontmatter block followed by a body.
 * Returns null if any required field is missing or tags is empty.
 */
export function parseTipFrontmatter(content: string): Tip | null {
  // Normalize CRLF to LF before parsing (Windows-edited files)
  content = content.replace(/\r\n/g, "\n");

  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const [, frontmatter, rawBody] = match;
  const meta: Record<string, unknown> = {};

  // Simple YAML-like parsing — one key: value per line
  for (const line of frontmatter!.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    // Handle inline arrays like [tag1, tag2] or ["tag1", "tag2"]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter((s) => s.length > 0);
    }

    meta[key] = value;
  }

  // Validate required fields
  const title = meta.title;
  const handle = meta.handle;
  const tags = meta.tags;

  if (typeof title !== "string" || !title) return null;
  if (typeof handle !== "string" || !handle) return null;
  if (!Array.isArray(tags) || tags.length === 0) return null;

  const body = rawBody!.trim();
  if (!body) return null; // A tip without a body isn't actionable

  const tip: Tip = {
    title,
    handle,
    tags,
    body,
  };

  // Optional context
  if (typeof meta.context === "string" && meta.context) {
    tip.context = meta.context;
  }

  return tip;
}

// ---------------------------------------------------------------------------
// Loading tips from disk
// ---------------------------------------------------------------------------

/**
 * Read all `.md` files from a directory, parse each as a tip, and return
 * only the valid ones. Returns an empty array if the directory doesn't exist.
 */
export function loadTips(tipsDir: string): Tip[] {
  if (!existsSync(tipsDir)) return [];

  const tips: Tip[] = [];

  try {
    const files = readdirSync(tipsDir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = join(tipsDir, file);
      // Skip directories that happen to end in .md
      if (statSync(filePath).isDirectory()) continue;

      const content = readFileSync(filePath, "utf-8");
      const tip = parseTipFrontmatter(content);
      if (tip) {
        tips.push(tip);
      }
    }
  } catch (err: unknown) {
    // Tolerate expected filesystem errors (missing/unreadable directory).
    // Re-throw anything else so genuine bugs surface.
    if (err instanceof Error) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "EACCES") return tips;
    }
    throw err;
  }

  return tips;
}

// ---------------------------------------------------------------------------
// Random selection
// ---------------------------------------------------------------------------

/** Pick a random element from an array of tips, or null if empty. */
export function pickRandom(tips: Tip[]): Tip | null {
  if (tips.length === 0) return null;
  const idx = Math.floor(Math.random() * tips.length);
  return tips[idx]!;
}

// ---------------------------------------------------------------------------
// Terminal formatting
// ---------------------------------------------------------------------------

/**
 * Format a tip for terminal display using ANSI colors.
 *
 * Layout:
 *   Title (cyan, bold-ish)
 *   Context line (dim, only when present)
 *   Body
 *   Tags (yellow, dim)
 */
export function formatTipForTerminal(tip: Tip): string {
  const lines: string[] = [];

  lines.push(cyan(tip.title));

  if (tip.context) {
    lines.push(dim(tip.context));
  }

  lines.push(""); // blank separator
  lines.push(tip.body);
  lines.push(""); // blank separator

  const tagLine = tip.tags.map((t) => yellow(t)).join(dim(", "));
  lines.push(dim("Tags: ") + tagLine);

  return lines.join("\n");
}
