import type { IssueHistoryEntry } from "../../types";
import {
  colors,
  colorizeStatus,
  dim,
} from "../colors";
import { formatRelativeTime } from "./shared";

/**
 * Options for describing a single field change
 */
interface ChangeDescription {
  from?: string | null;
  to?: string | null;
  fieldName: string;
  formatValue?: (v: string) => string;
  showRemoved?: boolean;
}

/**
 * Describe a single field change in a human-readable format
 */
export function describeChange(opts: ChangeDescription): string | null {
  const { from, to, fieldName, formatValue = (v) => v, showRemoved = false } = opts;

  if (!from && !to) return null;

  if (from && to) {
    return `${fieldName}: ${formatValue(from)} \u2192 ${formatValue(to)}`;
  }
  if (to) {
    return `${fieldName} set to ${formatValue(to)}`;
  }
  if (from && showRemoved) {
    return `${fieldName} removed`;
  }
  return null;
}

/**
 * Push a change description to the list if it's not null
 */
function pushChange(changes: string[], change: string | null): void {
  if (change !== null) {
    changes.push(change);
  }
}

/**
 * Describe what changed in a history entry
 */
export function describeHistoryChanges(entry: IssueHistoryEntry): string[] {
  const changes: string[] = [];

  // State change
  pushChange(changes, describeChange({
    from: entry.fromState,
    to: entry.toState,
    fieldName: "Status",
    formatValue: colorizeStatus,
  }));

  // Assignment change - special handling for unassignment
  if (entry.fromAssignee || entry.toAssignee) {
    if (entry.fromAssignee && entry.toAssignee) {
      changes.push(`Assignee: ${colors.assignee(`@${entry.fromAssignee}`)} \u2192 ${colors.assignee(`@${entry.toAssignee}`)}`);
    } else if (entry.toAssignee) {
      changes.push(`Assigned to ${colors.assignee(`@${entry.toAssignee}`)}`);
    } else if (entry.fromAssignee) {
      changes.push(`Unassigned from ${colors.assignee(`@${entry.fromAssignee}`)}`);
    }
  }

  // Title change - special handling for "changed" prefix
  if (entry.fromTitle || entry.toTitle) {
    if (entry.fromTitle && entry.toTitle) {
      changes.push(`Title changed: "${entry.fromTitle}" \u2192 "${entry.toTitle}"`);
    } else if (entry.toTitle) {
      changes.push(`Title set to "${entry.toTitle}"`);
    }
  }

  // Priority change - special handling for numeric to name mapping
  if (entry.fromPriority !== undefined || entry.toPriority !== undefined) {
    const priorityNames = ["No priority", "Urgent", "High", "Medium", "Low"];
    const from = entry.fromPriority !== undefined ? priorityNames[entry.fromPriority] ?? `P${entry.fromPriority}` : undefined;
    const to = entry.toPriority !== undefined ? priorityNames[entry.toPriority] ?? `P${entry.toPriority}` : undefined;
    pushChange(changes, describeChange({
      from,
      to,
      fieldName: "Priority",
    }));
  }

  // Estimate change
  pushChange(changes, describeChange({
    from: entry.fromEstimate?.toString(),
    to: entry.toEstimate?.toString(),
    fieldName: "Estimate",
    showRemoved: true,
  }));

  // Due date change
  pushChange(changes, describeChange({
    from: entry.fromDueDate,
    to: entry.toDueDate,
    fieldName: "Due date",
    showRemoved: true,
  }));

  // Parent change
  pushChange(changes, describeChange({
    from: entry.fromParent,
    to: entry.toParent,
    fieldName: "Parent",
    formatValue: colors.identifier,
    showRemoved: true,
  }));

  // Archive state
  if (entry.archived !== undefined) {
    changes.push(entry.archived ? "Archived" : "Unarchived");
  }

  return changes;
}

/**
 * Format history entries for human-readable output
 */
export function formatHistoryHuman(history: IssueHistoryEntry[]): string {
  if (history.length === 0) {
    return dim("(no history)");
  }

  const lines: string[] = [];

  for (const entry of history) {
    const changes = describeHistoryChanges(entry);
    if (changes.length === 0) continue;

    const timestamp = formatRelativeTime(entry.createdAt, { fallbackToAbsolute: true });
    const actor = entry.actor?.displayName ?? entry.actor?.name ?? "Unknown";

    lines.push(`  ${dim(timestamp)}  ${colors.assignee(`@${actor}`)}`);
    for (const change of changes) {
      lines.push(`    ${change}`);
    }
  }

  if (lines.length === 0) {
    return dim("(no meaningful changes recorded)");
  }

  return lines.join("\n");
}
