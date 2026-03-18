import type { PlanIssueDetail, PlanComment, IssueHistoryEntry } from "../../types";
import type { IssueTreeContext } from "./tree";
import {
  colors,
  colorizeStatus,
  dim,
  bold,
} from "../colors";
import { renderMarkdown } from "../markdown";
import { formatRelativeTime, formatListField } from "./shared";

/**
 * Format labels as a comma-separated string
 */
export function formatLabels(labels?: string[]): string {
  if (!labels || labels.length === 0) return "";
  return labels.join(", ");
}

/**
 * Format a single comment for display
 */
export function formatComment(comment: PlanComment): string {
  const lines: string[] = [];
  const author = comment.user
    ? colors.assignee(`@${comment.user.name}`)
    : dim("(unknown)");
  const date = formatRelativeTime(comment.createdAt);

  lines.push(`  ${author} ${dim(`\u00b7 ${date}`)}`);

  // Render markdown with terminal formatting and indent
  lines.push(renderMarkdown(comment.body, "  "));

  return lines.join("\n");
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
    // Render markdown with terminal formatting and indent
    lines.push(renderMarkdown(issue.description, "  "));
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
  lines.push(formatListField("Blocked by", issue.blockedBy));
  lines.push(formatListField("Blocks", issue.blocks));

  // Comments section
  if (issue.comments && issue.comments.length > 0) {
    // Full comments were loaded with --comments flag
    lines.push("");
    lines.push(colors.fieldName(`Comments (${issue.comments.length}):`));
    for (const comment of issue.comments) {
      lines.push("");
      lines.push(formatComment(comment));
    }
  } else if (issue.commentCount && issue.commentCount > 0) {
    // Show hint about comments when count > 0 but comments not loaded
    lines.push("");
    const countText = issue.commentCount === 1 ? "1 comment" : `${issue.commentCount} comments`;
    lines.push(`${colors.fieldName("Comments:")} ${countText} ${dim("(use --comments to view)")}`);
  }

  return lines.join("\n");
}

/**
 * Format a single issue for `plan show` - JSON output
 */
export function formatShowJson(issue: PlanIssueDetail, history?: IssueHistoryEntry[], treeContext?: IssueTreeContext): string {
  const output: Record<string, unknown> = {
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
    commentCount: issue.commentCount,
  };

  // Include comments if present
  if (issue.comments) {
    output.comments = issue.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      user: c.user,
    }));
  }

  // Include history if provided
  if (history) {
    output.history = history;
  }

  // Include tree context if provided
  if (treeContext) {
    output.treeContext = treeContext;
  }

  return JSON.stringify(output, null, 2);
}
