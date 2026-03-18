import type { PlanIssue } from "../../types";
import type { FormatOptions, FormatResult } from "./shared";
import {
  colors,
  colorizeStatus,
  dim,
  bold,
} from "../colors";
import {
  getTerminalWidth,
  truncate,
  wrapTitle,
  formatChildCount,
  calculateTitleWidth,
  formatRow,
  formatContinuationRow,
} from "./shared";

/**
 * Filter children based on showDone option
 */
export function filterChildren(children: PlanIssue[], showDone: boolean): PlanIssue[] {
  if (showDone) return children;
  return children.filter((child) => child.status !== "Done");
}

/**
 * Flatten issues tree into a list for column width calculation
 */
export function flattenIssues(issues: PlanIssue[], depth: number, showDone: boolean, currentDepth: number = 0): PlanIssue[] {
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

function formatLabels(labels?: string[]): string {
  if (!labels || labels.length === 0) return "";
  return labels.join(", ");
}

/**
 * Recursively render children with increasing indentation
 */
export function renderChildren(
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
  const prefix = `${indent}\u2514 `;
  const prefixLen = prefix.length;
  // For continuation lines, use spaces to align under the title (after the tree prefix)
  const continuationIndent = " ".repeat(prefixLen);

  for (const child of children) {
    const availableTitleLen = opts.titleLen - prefixLen;
    const [titleLine1, titleLine2] = wrapTitle(child.title, availableTitleLen);
    const childLabels = opts.hasLabels ? truncate(formatLabels(child.labels), opts.labelLen) : undefined;
    const more = formatChildCount(child.childCount, opts.hasHiddenChildren);

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
    const more = formatChildCount(issue.childCount, hasHiddenChildren);

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

// ============================================================================
// JSON Formatters
// ============================================================================

/**
 * Compact JSON shape for a single issue, omitting heavyweight fields
 * (id, description, timestamps) to reduce token cost for agents.
 */
function issueToCompactJson(issue: PlanIssue, showDone: boolean) {
  const children = filterChildren(issue.children, showDone);
  return {
    identifier: issue.identifier,
    title: issue.title,
    status: issue.status,
    assignee: issue.assignee?.displayName ?? null,
    labels: issue.labels ?? [],
    project: issue.project ?? null,
    parent: issue.parent?.identifier ?? null,
    sortOrder: issue.sortOrder,
    children: children.map((child) => ({
      identifier: child.identifier,
      title: child.title,
      status: child.status,
    })),
    ...(issue.childCount ? { childCount: issue.childCount } : {}),
  };
}

/**
 * Format issues as a JSON array with compact shape.
 * Omits id, description, createdAt, updatedAt to reduce token cost.
 */
export function formatListJson(
  issues: PlanIssue[],
  options: FormatOptions = {}
): string {
  const showDone = options.showDone ?? false;
  const output = issues.map((issue) => issueToCompactJson(issue, showDone));
  return JSON.stringify(output, null, 2);
}

/**
 * Group issues by a field, returning a sorted Map of group name -> issues.
 * Shared between human and JSON grouped formatters.
 */
function groupIssuesBy(
  issues: PlanIssue[],
  groupBy: "label" | "project" | "status"
): Map<string, PlanIssue[]> {
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

  // Return a new map with sorted keys
  const sorted = new Map<string, PlanIssue[]>();
  for (const key of Array.from(groups.keys()).sort()) {
    sorted.set(key, groups.get(key)!);
  }
  return sorted;
}

/**
 * Format issues grouped by a field as JSON.
 * Shape: { groups: [{ name: string, issues: [...] }] }
 */
export function formatGroupedListJson(
  issues: PlanIssue[],
  groupBy: "label" | "project" | "status",
  options: FormatOptions = {}
): string {
  const showDone = options.showDone ?? false;
  const groups = groupIssuesBy(issues, groupBy);

  const output = {
    groups: Array.from(groups.entries()).map(([name, groupIssues]) => ({
      name,
      issues: groupIssues.map((issue) => issueToCompactJson(issue, showDone)),
    })),
  };

  return JSON.stringify(output, null, 2);
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
  const groups = groupIssuesBy(issues, groupBy);

  const lines: string[] = [];

  for (const [key, groupIssues] of groups) {
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
