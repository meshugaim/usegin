/**
 * Core types for plan-cli
 */

export interface PlanIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  status: string;
  sortOrder: number;
  assignee?: {
    id: string;
    name: string;
    displayName: string;
  };
  parent?: {
    id: string;
    identifier: string;
  };
  labels?: string[];
  project?: string;
  children: PlanIssue[];
  /** Count of children beyond the fetched depth (for display hints) */
  childCount?: number;
}

export interface ListOptions {
  depth?: number;
  status?: string;
  assignee?: string;
  team?: string;
  project?: string;
  label?: string[];
  search?: string;
  groupBy?: "label" | "project" | "status";
}

export interface ListResult {
  items: PlanIssue[];
}

/**
 * Comment on an issue
 */
export interface PlanComment {
  id: string;
  body: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    displayName: string;
  };
}

/**
 * Extended issue type for show command with relationships
 */
export interface PlanIssueDetail extends PlanIssue {
  url: string;
  position: number;
  blockedBy: Array<{ id: string; identifier: string; title: string }>;
  blocks: Array<{ id: string; identifier: string; title: string }>;
  comments?: PlanComment[];
  /** Number of comments on this issue (always fetched, unlike full comments) */
  commentCount?: number;
}

/**
 * A single history entry for an issue
 */
export interface IssueHistoryEntry {
  id: string;
  createdAt: string;
  actor?: {
    name: string;
    displayName: string;
  };
  // State changes
  fromState?: string;
  toState?: string;
  // Assignment changes
  fromAssignee?: string;
  toAssignee?: string;
  // Title changes
  fromTitle?: string;
  toTitle?: string;
  // Priority changes
  fromPriority?: number;
  toPriority?: number;
  // Estimate changes
  fromEstimate?: number;
  toEstimate?: number;
  // Due date changes
  fromDueDate?: string;
  toDueDate?: string;
  // Parent changes
  fromParent?: string;
  toParent?: string;
  // Label changes
  addedLabelIds?: string[];
  removedLabelIds?: string[];
  // Archive state
  archived?: boolean;
}
