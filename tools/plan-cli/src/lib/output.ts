import type { PlanIssue } from "../types";

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

  // Clamp title length for readability
  const titleLen = Math.min(maxTitleLen, 40);

  // Header
  const header = formatRow("#", "ID", "Title", "Status", {
    numWidth: 3,
    idWidth: maxIdLen,
    titleWidth: titleLen,
    statusWidth: maxStatusLen,
  });
  lines.push(header);

  // Issues
  let position = 0;
  for (const issue of issues) {
    position++;
    const posStr = String(position);
    const title = truncate(issue.title, titleLen);

    lines.push(
      formatRow(posStr, issue.identifier, title, issue.status, {
        numWidth: 3,
        idWidth: maxIdLen,
        titleWidth: titleLen,
        statusWidth: maxStatusLen,
      })
    );

    // Children (if depth > 0)
    if (depth > 0 && issue.children.length > 0) {
      for (const child of issue.children) {
        const childTitle = truncate(child.title, titleLen - 2);
        lines.push(
          formatRow("", child.identifier, `└ ${childTitle}`, child.status, {
            numWidth: 3,
            idWidth: maxIdLen,
            titleWidth: titleLen,
            statusWidth: maxStatusLen,
          })
        );
      }
    }
  }

  return lines.join("\n");
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
  widths: { numWidth: number; idWidth: number; titleWidth: number; statusWidth: number }
): string {
  return [
    num.padStart(widths.numWidth),
    id.padEnd(widths.idWidth),
    title.padEnd(widths.titleWidth),
    status,
  ].join("   ");
}
