import type { PlanIssue, PlanIssueDetail } from "../types";

export interface FormatOptions {
  depth?: number;
}

/**
 * Format issues as a human-readable table
 */
export function formatListHuman(issues: PlanIssue[], options: FormatOptions = {}): string {
  const depth = options.depth ?? 0;
  const lines: string[] = [];

  // Calculate column widths
  const allIssues = flattenIssues(issues, depth);
  const maxIdLen = Math.max(4, ...allIssues.map((i) => i.identifier.length));
  const maxTitleLen = Math.max(5, ...allIssues.map((i) => i.title.length));
  const maxStatusLen = Math.max(6, ...allIssues.map((i) => i.status.length));

  // Check if any issues have labels
  const hasLabels = allIssues.some((i) => i.labels && i.labels.length > 0);
  const maxLabelLen = hasLabels
    ? Math.max(6, ...allIssues.map((i) => formatLabels(i.labels).length))
    : 0;
  const labelLen = Math.min(maxLabelLen, 20);

  // Clamp title length for readability
  const titleLen = Math.min(maxTitleLen, hasLabels ? 35 : 40);

  // Header
  const header = formatRow("#", "ID", "Title", "Status", hasLabels ? "Labels" : undefined, {
    numWidth: 3,
    idWidth: maxIdLen,
    titleWidth: titleLen,
    statusWidth: maxStatusLen,
    labelWidth: labelLen,
  });
  lines.push(header);

  // Issues
  let position = 0;
  for (const issue of issues) {
    position++;
    const posStr = String(position);
    const title = truncate(issue.title, titleLen);
    const labels = hasLabels ? truncate(formatLabels(issue.labels), labelLen) : undefined;

    lines.push(
      formatRow(posStr, issue.identifier, title, issue.status, labels, {
        numWidth: 3,
        idWidth: maxIdLen,
        titleWidth: titleLen,
        statusWidth: maxStatusLen,
        labelWidth: labelLen,
      })
    );

    // Children (if depth > 0)
    if (depth > 0 && issue.children.length > 0) {
      for (const child of issue.children) {
        const childTitle = truncate(child.title, titleLen - 2);
        const childLabels = hasLabels ? truncate(formatLabels(child.labels), labelLen) : undefined;
        lines.push(
          formatRow("", child.identifier, `└ ${childTitle}`, child.status, childLabels, {
            numWidth: 3,
            idWidth: maxIdLen,
            titleWidth: titleLen,
            statusWidth: maxStatusLen,
            labelWidth: labelLen,
          })
        );
      }
    }
  }

  return lines.join("\n");
}

function formatLabels(labels?: string[]): string {
  if (!labels || labels.length === 0) return "";
  return labels.join(", ");
}

/**
 * Format issues as JSON
 */
export function formatListJson(issues: PlanIssue[]): string {
  const items = issues.map((issue, index) => ({
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    position: index + 1,
    sortOrder: issue.sortOrder,
    assignee: issue.assignee,
    labels: issue.labels,
    project: issue.project,
    children: issue.children.map((child) => ({
      id: child.id,
      identifier: child.identifier,
      title: child.title,
      description: child.description,
      status: child.status,
      sortOrder: child.sortOrder,
      assignee: child.assignee,
      labels: child.labels,
      project: child.project,
    })),
  }));

  return JSON.stringify({ items }, null, 2);
}

/**
 * Format issues grouped by a field
 */
export function formatGroupedList(
  issues: PlanIssue[],
  groupBy: "label" | "project" | "status"
): string {
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
    lines.push(`\n## ${key} (${groupIssues.length})`);
    lines.push("");

    for (const issue of groupIssues) {
      lines.push(`  ${issue.identifier}  ${truncate(issue.title, 50)}  [${issue.status}]`);
    }
  }

  return lines.join("\n").trim();
}

// Helper functions

function flattenIssues(issues: PlanIssue[], depth: number): PlanIssue[] {
  const result: PlanIssue[] = [];
  for (const issue of issues) {
    result.push(issue);
    if (depth > 0) {
      result.push(...issue.children);
    }
  }
  return result;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

function formatRow(
  num: string,
  id: string,
  title: string,
  status: string,
  labels: string | undefined,
  widths: { numWidth: number; idWidth: number; titleWidth: number; statusWidth: number; labelWidth: number }
): string {
  const parts = [
    num.padStart(widths.numWidth),
    id.padEnd(widths.idWidth),
    title.padEnd(widths.titleWidth),
    status.padEnd(widths.statusWidth),
  ];

  if (labels !== undefined) {
    parts.push(labels);
  }

  return parts.join("   ");
}

/**
 * Format a single issue for `plan show` - human readable
 */
export function formatShowHuman(issue: PlanIssueDetail): string {
  const lines: string[] = [];

  // Header
  lines.push(`${issue.identifier}: ${issue.title}`);
  lines.push(`URL: ${issue.url}`);
  lines.push(`Status: ${issue.status}`);

  // Assignee
  const assigneeName = issue.assignee ? `@${issue.assignee.name}` : "(unassigned)";
  lines.push(`Assignee: ${assigneeName}`);

  // Position
  lines.push(`Position: #${issue.position}`);

  // Labels (if present)
  if (issue.labels && issue.labels.length > 0) {
    lines.push(`Labels: ${issue.labels.join(", ")}`);
  }

  // Project (if present)
  if (issue.project) {
    lines.push(`Project: ${issue.project}`);
  }

  // Description
  if (issue.description) {
    lines.push("");
    lines.push("Description:");
    // Indent description lines
    const descLines = issue.description.split("\n");
    for (const line of descLines) {
      lines.push(`  ${line}`);
    }
  }

  // Sub-issues
  if (issue.children.length > 0) {
    lines.push("");
    lines.push("Sub-issues:");
    for (const child of issue.children) {
      lines.push(`  ${child.identifier}  ${child.title}  [${child.status}]`);
    }
  }

  // Relationships
  lines.push("");
  if (issue.blockedBy.length > 0) {
    const blockers = issue.blockedBy.map((b) => b.identifier).join(", ");
    lines.push(`Blocked by: ${blockers}`);
  } else {
    lines.push("Blocked by: (none)");
  }

  if (issue.blocks.length > 0) {
    const blocking = issue.blocks.map((b) => b.identifier).join(", ");
    lines.push(`Blocks: ${blocking}`);
  } else {
    lines.push("Blocks: (none)");
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
