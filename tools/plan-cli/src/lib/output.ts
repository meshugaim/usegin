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

export interface FormatOptions {
  depth?: number;
  showDone?: boolean;
  /** Whether depth was explicitly set by user (vs default) */
  depthExplicit?: boolean;
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
 * Format issues as a human-readable table
 */
export function formatListHuman(issues: PlanIssue[], options: FormatOptions = {}): FormatResult {
  const depth = options.depth ?? 0;
  const showDone = options.showDone ?? false;
  const lines: string[] = [];

  // Calculate column widths (need to apply filter for accurate column sizing)
  const allIssues = flattenIssues(issues, depth, showDone);
  const maxIdLen = Math.max(4, ...allIssues.map((i) => i.identifier.length));
  const maxTitleLen = Math.max(5, ...allIssues.map((i) => i.title.length));
  const maxStatusLen = Math.max(6, ...allIssues.map((i) => i.status.length));

  // Check if any issues have labels
  const hasLabels = allIssues.some((i) => i.labels && i.labels.length > 0);
  const maxLabelLen = hasLabels
    ? Math.max(6, ...allIssues.map((i) => formatLabels(i.labels).length))
    : 0;
  const labelLen = Math.min(maxLabelLen, 20);

  // Check if any issues have hidden children (childCount > 0)
  const hasHiddenChildren = allIssues.some((i) => i.childCount && i.childCount > 0);

  // Clamp title length for readability
  const titleLen = Math.min(maxTitleLen, hasLabels ? 35 : (hasHiddenChildren ? 38 : 40));

  // Header
  const header = formatRow(
    "#", "ID", "Title", "Status",
    hasLabels ? "Labels" : undefined,
    hasHiddenChildren ? "More" : undefined,
    {
      numWidth: 3,
      idWidth: maxIdLen,
      titleWidth: titleLen,
      statusWidth: maxStatusLen,
      labelWidth: labelLen,
      moreWidth: 5,
      isHeader: true,
    }
  );
  lines.push(header);

  // Issues
  let position = 0;
  for (const issue of issues) {
    position++;
    const posStr = String(position);

    const title = truncate(issue.title, titleLen);
    const labels = hasLabels ? truncate(formatLabels(issue.labels), labelLen) : undefined;
    const more = hasHiddenChildren
      ? (issue.childCount && issue.childCount > 0 ? `+${issue.childCount}` : "")
      : undefined;

    lines.push(
      formatRow(posStr, issue.identifier, title, issue.status, labels, more, {
        numWidth: 3,
        idWidth: maxIdLen,
        titleWidth: titleLen,
        statusWidth: maxStatusLen,
        labelWidth: labelLen,
        moreWidth: 5,
      })
    );

    // Children (if depth > 0)
    if (depth > 0 && issue.children.length > 0) {
      renderChildren(filterChildren(issue.children, showDone), 1, depth, lines, {
        maxIdLen,
        titleLen,
        maxStatusLen,
        labelLen,
        hasLabels,
        showDone,
        hasHiddenChildren,
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
    maxIdLen: number;
    titleLen: number;
    maxStatusLen: number;
    labelLen: number;
    hasLabels: boolean;
    showDone: boolean;
    hasHiddenChildren: boolean;
  }
): void {
  const indent = "  ".repeat(currentDepth);
  const prefix = `${indent}└ `;
  const prefixLen = prefix.length;

  for (const child of children) {
    const childTitle = truncate(child.title, opts.titleLen - prefixLen);
    const childLabels = opts.hasLabels ? truncate(formatLabels(child.labels), opts.labelLen) : undefined;
    const more = opts.hasHiddenChildren
      ? (child.childCount && child.childCount > 0 ? `+${child.childCount}` : "")
      : undefined;

    // Colorize the tree prefix and title
    const coloredPrefix = colors.tree(prefix);
    const coloredTitle = `${coloredPrefix}${childTitle}`;

    lines.push(
      formatRow("", child.identifier, coloredTitle, child.status, childLabels, more, {
        numWidth: 3,
        idWidth: opts.maxIdLen,
        titleWidth: opts.titleLen,
        statusWidth: opts.maxStatusLen,
        labelWidth: opts.labelLen,
        moreWidth: 5,
      })
    );

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
