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
  // Reject purely-numeric handles — they collide with findByRef's positional lookup
  if (/^\d+$/.test(handle)) return null;
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
    const files = readdirSync(tipsDir)
      .filter((f) => f.endsWith(".md"))
      .sort();

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
// Filtering, searching, and lookup
// ---------------------------------------------------------------------------

/**
 * Filter tips where any tag matches the given tag (case-insensitive).
 */
export function filterByTag(tips: Tip[], tag: string): Tip[] {
  const needle = tag.toLowerCase();
  return tips.filter((tip) =>
    tip.tags.some((t) => t.toLowerCase() === needle),
  );
}

/**
 * Search tips across title, handle, tags, context, and body (case-insensitive).
 * Returns all tips where the search term appears in any of those fields.
 */
export function searchTips(tips: Tip[], term: string): Tip[] {
  const needle = term.toLowerCase();
  return tips.filter((tip) => {
    const haystack = [
      tip.title,
      tip.handle,
      ...tip.tags,
      tip.context ?? "",
      tip.body,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

/**
 * Find a tip by reference: either a handle (exact match) or a 1-indexed number.
 * Returns undefined for unknown handle, out-of-range number, or zero.
 */
export function findByRef(tips: Tip[], ref: string): Tip | undefined {
  // Numeric refs are interpreted as 1-indexed list positions, not handles.
  // parseTipFrontmatter rejects purely-numeric handles, so this is safe —
  // a numeric string can never collide with a real handle.
  if (/^\d+$/.test(ref)) {
    const idx = parseInt(ref, 10);
    if (idx < 1 || idx > tips.length) return undefined;
    return tips[idx - 1];
  }

  // Handle lookup (exact match)
  return tips.find((tip) => tip.handle === ref);
}

/**
 * Collect all unique tags from tips, sorted alphabetically.
 */
export function allTags(tips: Tip[]): string[] {
  const tagSet = new Set<string>();
  for (const tip of tips) {
    for (const tag of tip.tags) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort();
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

/**
 * Format tips as a numbered list for `tip list` output.
 *
 * Each entry shows: number, title, tags, and context (when present).
 */
export function formatTipList(tips: Tip[]): string {
  const lines: string[] = [];

  for (let i = 0; i < tips.length; i++) {
    const tip = tips[i]!;
    const num = String(i + 1).padStart(2);
    const tags = tip.tags.map((t) => yellow(t)).join(dim(", "));
    lines.push(`${dim(num)}  ${cyan(tip.title)}  ${dim(tip.handle)}  ${dim("[")}${tags}${dim("]")}`);
    if (tip.context) {
      lines.push(`      ${dim(tip.context)}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Statusline types
// ---------------------------------------------------------------------------

export interface StatuslineState {
  state: "showing" | "resting";
  tip_handle: string;
  transitioned_at: number;
}

export interface StatuslineContext {
  now: number;
  state: StatuslineState | null;
  tips: Tip[];
  showDuration: number;
  restDuration: number;
  enabled: boolean;
}

export interface StatuslineResult {
  output: string;
  newState: StatuslineState;
}

// ---------------------------------------------------------------------------
// Duration parsing
// ---------------------------------------------------------------------------

/**
 * Parse a human-friendly duration string into milliseconds.
 *
 * Supports `Nm` (minutes) and `Nh` (hours) where N is a non-negative integer.
 * Returns null for unrecognised formats.
 */
export function parseDuration(value: string): number | null {
  const match = value.match(/^(\d+)(m|h)$/);
  if (!match) return null;

  const amount = parseInt(match[1]!, 10);
  const unit = match[2]!;

  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;

  return null;
}

// ---------------------------------------------------------------------------
// Statusline state machine
// ---------------------------------------------------------------------------

/**
 * Pure function implementing the show/rest state machine for `tip statusline`.
 *
 * State transitions:
 *   - No prior state → pick a random tip, enter SHOWING
 *   - SHOWING within window → return the same tip
 *   - SHOWING expired → transition to RESTING (empty output)
 *   - RESTING within window → return empty
 *   - RESTING expired → pick a new tip, enter SHOWING
 *
 * Edge cases:
 *   - disabled → always empty output, preserve existing state
 *   - empty tips → always empty output
 */
export function resolveStatusline(context: StatuslineContext): StatuslineResult {
  const { now, state, tips, showDuration, restDuration, enabled } = context;

  // Disabled: return empty, preserve state as-is
  if (!enabled) {
    const preservedState = state ?? {
      state: "resting" as const,
      tip_handle: "",
      transitioned_at: now,
    };
    return { output: "", newState: preservedState };
  }

  // No tips available: nothing to show
  if (tips.length === 0) {
    const preservedState = state ?? {
      state: "resting" as const,
      tip_handle: "",
      transitioned_at: now,
    };
    return { output: "", newState: preservedState };
  }

  // First call — no prior state: start showing a random tip
  if (state === null) {
    const tip = pickRandom(tips)!;
    return {
      output: tip.title,
      newState: {
        state: "showing",
        tip_handle: tip.handle,
        transitioned_at: now,
      },
    };
  }

  const elapsed = now - state.transitioned_at;

  if (state.state === "showing") {
    if (elapsed < showDuration) {
      // Still within show window — return the same tip
      const tip = tips.find((t) => t.handle === state.tip_handle);
      const output = tip ? tip.title : "";
      return { output, newState: state };
    }

    // Show window expired → transition to resting
    return {
      output: "",
      newState: {
        state: "resting",
        tip_handle: state.tip_handle,
        transitioned_at: now,
      },
    };
  }

  // state.state === "resting"
  if (elapsed < restDuration) {
    // Still within rest window — stay quiet
    return { output: "", newState: state };
  }

  // Rest window expired → show a new tip
  const tip = pickRandom(tips)!;
  return {
    output: tip.title,
    newState: {
      state: "showing",
      tip_handle: tip.handle,
      transitioned_at: now,
    },
  };
}
