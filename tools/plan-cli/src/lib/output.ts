import type { PlanIssue, PlanIssueDetail } from "../types";
import {
  colors,
  colorizeStatus,
  padEnd,
  padStart,
  visibleLength,
  dim,
  bold,
} from "./colors";

// Column widths and constraints
const MIN_TITLE_WIDTH = 20;
const MAX_TITLE_WIDTH = 60;
const DEFAULT_TERMINAL_WIDTH = 100;
const COLUMN_SEPARATOR = "   "; // 3 spaces between columns

/**
 * Get the terminal width, with fallback for non-TTY environments
 */
export function getTerminalWidth(): number {
  return process.stdout.columns || DEFAULT_TERMINAL_WIDTH;
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

/**
 * Filter children based on showDone option
 */
function filterChildren(children: PlanIssue[], showDone: boolean): PlanIssue[] {
  if (showDone) return children;
  return children.filter((child) => child.status !== "Done");
}

/**
 * Calculate the dynamic title width based on terminal width and other column widths
 */
function calculateTitleWidth(
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

/**
 * Format issues as a human-readable table
 */
export function formatListHuman(issues: PlanIssue[], options: FormatOptions = {}): FormatResult {
  const depth = options.depth ?? 0;
  const showDone = options.showDone ?? false;
  const terminalWidth = options.terminalWidth ?? getTerminalWidth();
  const lines: string[] = [];

  // Calculate column widths (need to apply filter for accurate column sizing)
  const allIssues = flattenIssues(issues, depth, showDone);
  const maxIdLen = Math.max(4, ...allIssues.map((i) => i.identifier.length));
  const maxStatusLen = Math.max(6, ...allIssues.map((i) => i.status.length));

  // Check if any issues have labels
  const hasLabels = allIssues.some((i) => i.labels && i.labels.length > 0);
  const maxLabelLen = hasLabels
    ? Math.max(6, ...allIssues.map((i) => formatLabels(i.labels).length))
    : 0;
  const labelLen = Math.min(maxLabelLen, 20);

  // Check if any issues have hidden children (childCount > 0)
  const hasHiddenChildren = allIssues.some((i) => i.childCount && i.childCount > 0);

  // Calculate dynamic title width based on terminal width
  const numWidth = 3;
  const moreWidth = 5;
  const titleLen = calculateTitleWidth(
    terminalWidth,
    numWidth,
    maxIdLen,
    maxStatusLen,
    labelLen,
    hasLabels,
    hasHiddenChildren,
    moreWidth
  );

  // Header
  const header = formatRow(
    "#", "ID", "Title", "Status",
    hasLabels ? "Labels" : undefined,
    hasHiddenChildren ? "More" : undefined,
    {
      numWidth,
      idWidth: maxIdLen,
      titleWidth: titleLen,
      statusWidth: maxStatusLen,
      labelWidth: labelLen,
      moreWidth,
      isHeader: true,
    }
  );
  lines.push(header);

  // Issues
  let position = 0;
  for (const issue of issues) {
    position++;
    const posStr = String(position);

    const [titleLine1, titleLine2] = wrapTitle(issue.title, titleLen);
    const labels = hasLabels ? truncate(formatLabels(issue.labels), labelLen) : undefined;
    const more = hasHiddenChildren
      ? (issue.childCount && issue.childCount > 0 ? `+${issue.childCount}` : "")
      : undefined;

    lines.push(
      formatRow(posStr, issue.identifier, titleLine1, issue.status, labels, more, {
        numWidth,
        idWidth: maxIdLen,
        titleWidth: titleLen,
        statusWidth: maxStatusLen,
        labelWidth: labelLen,
        moreWidth,
      })
    );

    // Add continuation line for second part of title
    if (titleLine2) {
      lines.push(
        formatContinuationRow(titleLine2, {
          numWidth,
          idWidth: maxIdLen,
          titleWidth: titleLen,
          statusWidth: maxStatusLen,
          labelWidth: labelLen,
          moreWidth,
          hasLabels,
          hasHiddenChildren,
        })
      );
    }

    // Children (if depth > 0)
    if (depth > 0 && issue.children.length > 0) {
      renderChildren(filterChildren(issue.children, showDone), 1, depth, lines, {
        numWidth,
        maxIdLen,
        titleLen,
        maxStatusLen,
        labelLen,
        hasLabels,
        showDone,
        hasHiddenChildren,
        moreWidth,
      });
    }
  }

  return {
    output: lines.join("\n"),
    hasHiddenChildren,
  };
}

/**
 * Recursively render children with increasing indentation
 */
function renderChildren(
  children: PlanIssue[],
  currentDepth: number,
  maxDepth: number,
  lines: string[],
  opts: {
    numWidth: number;
    maxIdLen: number;
    titleLen: number;
    maxStatusLen: number;
    labelLen: number;
    hasLabels: boolean;
    showDone: boolean;
    hasHiddenChildren: boolean;
    moreWidth: number;
  }
): void {
  const indent = "  ".repeat(currentDepth);
  const prefix = `${indent}└ `;
  const prefixLen = prefix.length;
  // For continuation lines, use spaces to align under the title (after the tree prefix)
  const continuationIndent = " ".repeat(prefixLen);

  for (const child of children) {
    const availableTitleLen = opts.titleLen - prefixLen;
    const [titleLine1, titleLine2] = wrapTitle(child.title, availableTitleLen);
    const childLabels = opts.hasLabels ? truncate(formatLabels(child.labels), opts.labelLen) : undefined;
    const more = opts.hasHiddenChildren
      ? (child.childCount && child.childCount > 0 ? `+${child.childCount}` : "")
      : undefined;

    // Colorize the tree prefix and title
    const coloredPrefix = colors.tree(prefix);
    const coloredTitle = `${coloredPrefix}${titleLine1}`;

    lines.push(
      formatRow("", child.identifier, coloredTitle, child.status, childLabels, more, {
        numWidth: opts.numWidth,
        idWidth: opts.maxIdLen,
        titleWidth: opts.titleLen,
        statusWidth: opts.maxStatusLen,
        labelWidth: opts.labelLen,
        moreWidth: opts.moreWidth,
      })
    );

    // Add continuation line for second part of title
    if (titleLine2) {
      const coloredContinuation = `${colors.tree(continuationIndent)}${titleLine2}`;
      lines.push(
        formatContinuationRow(coloredContinuation, {
          numWidth: opts.numWidth,
          idWidth: opts.maxIdLen,
          titleWidth: opts.titleLen,
          statusWidth: opts.maxStatusLen,
          labelWidth: opts.labelLen,
          moreWidth: opts.moreWidth,
          hasLabels: opts.hasLabels,
          hasHiddenChildren: opts.hasHiddenChildren,
        })
      );
    }

    // Recurse if we have children and haven't reached max depth
    if (currentDepth < maxDepth && child.children.length > 0) {
      renderChildren(filterChildren(child.children, opts.showDone), currentDepth + 1, maxDepth, lines, opts);
    }
  }
}

function formatLabels(labels?: string[]): string {
  if (!labels || labels.length === 0) return "";
  return labels.join(", ");
}

/**
 * Format issues grouped by a field
 */
export function formatGroupedList(
  issues: PlanIssue[],
  groupBy: "label" | "project" | "status",
  _options: FormatOptions = {}
): string {
  // Note: grouped list currently only shows top-level issues, not children
  // _options.showDone would be relevant if we add child display
  const groups = new Map<string, PlanIssue[]>();

  for (const issue of issues) {
    let keys: string[];

    if (groupBy === "label") {
      keys = issue.labels && issue.labels.length > 0 ? issue.labels : ["(no label)"];
    } else if (groupBy === "project") {
      keys = [issue.project ?? "(no project)"];
    } else {
      keys = [issue.status];
    }

    for (const key of keys) {
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(issue);
    }
  }

  const lines: string[] = [];
  const sortedKeys = Array.from(groups.keys()).sort();

  for (const key of sortedKeys) {
    const groupIssues = groups.get(key)!;
    // Color the group header based on the groupBy type
    let coloredKey = key;
    if (groupBy === "label") {
      coloredKey = colors.label(key);
    } else if (groupBy === "status") {
      coloredKey = colorizeStatus(key);
    }
    lines.push(`\n${bold("##")} ${coloredKey} ${dim(`(${groupIssues.length})`)}`);
    lines.push("");

    for (const issue of groupIssues) {
      const statusColored = colorizeStatus(issue.status);
      lines.push(`  ${colors.identifier(issue.identifier)}  ${truncate(issue.title, 50)}  [${statusColored}]`);
    }
  }

  return lines.join("\n").trim();
}

// Helper functions

function flattenIssues(issues: PlanIssue[], depth: number, showDone: boolean, currentDepth: number = 0): PlanIssue[] {
  const result: PlanIssue[] = [];
  for (const issue of issues) {
    result.push(issue);
    if (currentDepth < depth && issue.children.length > 0) {
      const filtered = filterChildren(issue.children, showDone);
      result.push(...flattenIssues(filtered, depth, showDone, currentDepth + 1));
    }
  }
  return result;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/**
 * Wrap a title to at most two lines, truncating only if needed.
 * Returns [firstLine, secondLine | null]
 */
function wrapTitle(str: string, maxLen: number): [string, string | null] {
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
    : remaining.slice(0, maxLen - 1) + "…";

  return [firstLine, secondLine];
}

/**
 * Find a good word break point, preferring to break at spaces.
 * Falls back to maxLen if no good break point found.
 */
function findWordBreak(str: string, maxLen: number): number {
  // If there's a space in the first maxLen chars, break there
  const lastSpace = str.lastIndexOf(" ", maxLen);
  if (lastSpace > maxLen * 0.4) {
    // Only use the space if it's not too far back
    return lastSpace;
  }
  // Otherwise break at maxLen
  return maxLen;
}

interface RowOptions {
  numWidth: number;
  idWidth: number;
  titleWidth: number;
  statusWidth: number;
  labelWidth: number;
  moreWidth: number;
  isHeader?: boolean;
}

function formatRow(
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

interface ContinuationRowOptions {
  numWidth: number;
  idWidth: number;
  titleWidth: number;
  statusWidth: number;
  labelWidth: number;
  moreWidth: number;
  hasLabels: boolean;
  hasHiddenChildren: boolean;
}

/**
 * Format a continuation row for wrapped titles (second line)
 */
function formatContinuationRow(
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

/**
 * Format a single issue for `plan show` - human readable
 */
export function formatShowHuman(issue: PlanIssueDetail): string {
  const lines: string[] = [];

  // Header - identifier bold cyan, title bold
  lines.push(`${colors.identifier(bold(issue.identifier))}: ${bold(issue.title)}`);
  lines.push(`${colors.fieldName("URL:")} ${colors.url(issue.url)}`);
  lines.push(`${colors.fieldName("Status:")} ${colorizeStatus(issue.status)}`);

  // Assignee
  const assigneeName = issue.assignee
    ? colors.assignee(`@${issue.assignee.name}`)
    : dim("(unassigned)");
  lines.push(`${colors.fieldName("Assignee:")} ${assigneeName}`);

  // Position
  lines.push(`${colors.fieldName("Position:")} #${issue.position}`);

  // Labels (if present)
  if (issue.labels && issue.labels.length > 0) {
    const labelStr = issue.labels.map((l) => colors.label(l)).join(", ");
    lines.push(`${colors.fieldName("Labels:")} ${labelStr}`);
  }

  // Project (if present)
  if (issue.project) {
    lines.push(`${colors.fieldName("Project:")} ${issue.project}`);
  }

  // Description
  if (issue.description) {
    lines.push("");
    lines.push(colors.fieldName("Description:"));
    // Indent description lines
    const descLines = issue.description.split("\n");
    for (const line of descLines) {
      lines.push(`  ${line}`);
    }
  }

  // Sub-issues
  if (issue.children.length > 0) {
    lines.push("");
    lines.push(colors.fieldName("Sub-issues:"));
    for (const child of issue.children) {
      const statusColored = colorizeStatus(child.status);
      lines.push(`  ${colors.identifier(child.identifier)}  ${child.title}  [${statusColored}]`);
    }
  }

  // Relationships
  lines.push("");
  if (issue.blockedBy.length > 0) {
    const blockers = issue.blockedBy.map((b) => colors.identifier(b.identifier)).join(", ");
    lines.push(`${colors.fieldName("Blocked by:")} ${blockers}`);
  } else {
    lines.push(`${colors.fieldName("Blocked by:")} ${dim("(none)")}`);
  }

  if (issue.blocks.length > 0) {
    const blocking = issue.blocks.map((b) => colors.identifier(b.identifier)).join(", ");
    lines.push(`${colors.fieldName("Blocks:")} ${blocking}`);
  } else {
    lines.push(`${colors.fieldName("Blocks:")} ${dim("(none)")}`);
  }

  return lines.join("\n");
}

/**
 * Format a single issue for `plan show` - JSON output
 */
export function formatShowJson(issue: PlanIssueDetail): string {
  return JSON.stringify(
    {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      url: issue.url,
      description: issue.description,
      status: issue.status,
      sortOrder: issue.sortOrder,
      position: issue.position,
      assignee: issue.assignee,
      labels: issue.labels,
      project: issue.project,
      children: issue.children.map((child) => ({
        id: child.id,
        identifier: child.identifier,
        title: child.title,
        status: child.status,
      })),
      blockedBy: issue.blockedBy,
      blocks: issue.blocks,
    },
    null,
    2
  );
}
