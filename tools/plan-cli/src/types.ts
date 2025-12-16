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
  inbox?: boolean;
  all?: boolean;
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
}
