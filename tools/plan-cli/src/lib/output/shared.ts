import {
  colors,
  colorizeStatus,
  padEnd,
  padStart,
  dim,
} from "../colors";

// ============================================================================
// Constants
// ============================================================================

export const MIN_TITLE_WIDTH = 20;
export const MAX_TITLE_WIDTH = 60;
export const DEFAULT_TERMINAL_WIDTH = 100;
export const COLUMN_SEPARATOR = "   "; // 3 spaces between columns

// ============================================================================
// Shared Interfaces
// ============================================================================

/**
 * Base interface for column width specifications
 */
export interface ColumnWidths {
  numWidth: number;
  idWidth: number;
  titleWidth: number;
  statusWidth: number;
  labelWidth: number;
  moreWidth: number;
}

/**
 * Options for formatting a table row
 */
export interface RowOptions extends ColumnWidths {
  isHeader?: boolean;
}

/**
 * Options for formatting a continuation row (second line of wrapped title)
 */
export interface ContinuationRowOptions extends ColumnWidths {
  hasLabels: boolean;
  hasHiddenChildren: boolean;
}

export interface FormatOptions {
  depth?: number;
  showDone?: boolean;
  /** Whether depth was explicitly set by user (vs default) */
  depthExplicit?: boolean;
  /** Override terminal width (useful for testing) */
  terminalWidth?: number;
}

export interface FormatResult {
  output: string;
  /** True if there are hidden children beyond the displayed depth */
  hasHiddenChildren: boolean;
}

// ============================================================================
// Terminal Utilities
// ============================================================================

/**
 * Get the terminal width, with fallback for non-TTY environments
 */
export function getTerminalWidth(): number {
  return process.stdout.columns || DEFAULT_TERMINAL_WIDTH;
}

// ============================================================================
// String Utilities
// ============================================================================

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

/**
 * Wrap a title to at most two lines, truncating only if needed.
 * Returns [firstLine, secondLine | null]
 */
export function wrapTitle(str: string, maxLen: number): [string, string | null] {
  if (str.length <= maxLen) return [str, null];

  // Try to break at a word boundary near maxLen
  const breakPoint = findWordBreak(str, maxLen);
  const firstLine = str.slice(0, breakPoint).trimEnd();
  const remaining = str.slice(breakPoint).trimStart();

  if (remaining.length === 0) {
    return [firstLine, null];
  }

  // Second line: truncate if too long
  const secondLine = remaining.length <= maxLen
    ? remaining
    : remaining.slice(0, maxLen - 1) + "\u2026";

  return [firstLine, secondLine];
}

/**
 * Find a good word break point, preferring to break at spaces.
 * Falls back to maxLen if no good break point found.
 */
export function findWordBreak(str: string, maxLen: number): number {
  // If there's a space in the first maxLen chars, break there
  const lastSpace = str.lastIndexOf(" ", maxLen);
  if (lastSpace > maxLen * 0.4) {
    // Only use the space if it's not too far back
    return lastSpace;
  }
  // Otherwise break at maxLen
  return maxLen;
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Options for formatting relative dates
 */
interface RelativeDateOptions {
  /** If true, show absolute date for entries > 7 days old */
  fallbackToAbsolute?: boolean;
}

/**
 * Format a date as a relative time string, optionally falling back to absolute format
 */
export function formatRelativeTime(isoDate: string, options: RelativeDateOptions = {}): string {
  const { fallbackToAbsolute = false } = options;
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  if (fallbackToAbsolute) {
    // For older entries, show absolute date
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  // Continue with relative format for older dates
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

// ============================================================================
// Field Formatting Helpers
// ============================================================================

/**
 * Format a field name and value pair for display
 */
export function formatField(name: string, value: string | null | undefined, emptyText = "(none)"): string {
  const displayValue = value || dim(emptyText);
  return `${colors.fieldName(`${name}:`)} ${displayValue}`;
}

/**
 * Format a list of items with identifiers as a field
 */
export function formatListField(
  name: string,
  items: Array<{ identifier: string }>,
  emptyText = "(none)"
): string {
  const value = items.length > 0
    ? items.map((b) => colors.identifier(b.identifier)).join(", ")
    : null;
  return formatField(name, value, emptyText);
}

/**
 * Format the child count for the "More" column
 */
export function formatChildCount(count: number | undefined, showColumn: boolean): string | undefined {
  if (!showColumn) return undefined;
  return count && count > 0 ? `+${count}` : "";
}

// ============================================================================
// Column Width Calculation
// ============================================================================

/**
 * Calculate the dynamic title width based on terminal width and other column widths
 */
export function calculateTitleWidth(
  terminalWidth: number,
  numWidth: number,
  idWidth: number,
  statusWidth: number,
  labelWidth: number,
  hasLabels: boolean,
  hasHiddenChildren: boolean,
  moreWidth: number
): number {
  // Calculate total fixed width used by other columns
  // Format: #   ID   Title   Status   [Labels]   [More]
  // Each column is separated by COLUMN_SEPARATOR (3 spaces)
  let columnCount = 4; // #, ID, Title, Status
  if (hasLabels) columnCount++;
  if (hasHiddenChildren) columnCount++;

  const separatorWidth = COLUMN_SEPARATOR.length * (columnCount - 1);
  let fixedWidth = numWidth + idWidth + statusWidth + separatorWidth;

  if (hasLabels) {
    fixedWidth += labelWidth;
  }
  if (hasHiddenChildren) {
    fixedWidth += moreWidth;
  }

  // Calculate available width for title
  const availableWidth = terminalWidth - fixedWidth;

  // Clamp to reasonable bounds
  return Math.max(MIN_TITLE_WIDTH, Math.min(availableWidth, MAX_TITLE_WIDTH));
}

// ============================================================================
// Row Formatting
// ============================================================================

export function formatRow(
  num: string,
  id: string,
  title: string,
  status: string,
  labels: string | undefined,
  more: string | undefined,
  widths: RowOptions
): string {
  if (widths.isHeader) {
    // Header row - dimmed
    const parts = [
      padStart(colors.header(num), widths.numWidth),
      padEnd(colors.header(id), widths.idWidth),
      padEnd(colors.header(title), widths.titleWidth),
      padEnd(colors.header(status), widths.statusWidth),
    ];

    if (labels !== undefined) {
      parts.push(padEnd(colors.header(labels), widths.labelWidth));
    }

    if (more !== undefined) {
      parts.push(colors.header(more));
    }

    return parts.join("   ");
  }

  // Data row - colorized
  const parts = [
    padStart(colors.position(num), widths.numWidth),
    padEnd(colors.identifier(id), widths.idWidth),
    padEnd(title, widths.titleWidth), // title may already have colors from tree prefix
    padEnd(colorizeStatus(status), widths.statusWidth),
  ];

  if (labels !== undefined) {
    parts.push(padEnd(labels ? colors.label(labels) : "", widths.labelWidth));
  }

  if (more !== undefined) {
    parts.push(more ? dim(more) : "");
  }

  return parts.join("   ");
}

/**
 * Format a continuation row for wrapped titles (second line)
 */
export function formatContinuationRow(
  titleContinuation: string,
  widths: ContinuationRowOptions
): string {
  // Empty columns for #, ID, then the title continuation, then empty status/labels/more
  const parts = [
    " ".repeat(widths.numWidth),
    " ".repeat(widths.idWidth),
    padEnd(titleContinuation, widths.titleWidth),
    " ".repeat(widths.statusWidth),
  ];

  if (widths.hasLabels) {
    parts.push(" ".repeat(widths.labelWidth));
  }

  if (widths.hasHiddenChildren) {
    parts.push(" ".repeat(widths.moreWidth));
  }

  return parts.join("   ");
}
