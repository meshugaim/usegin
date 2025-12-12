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
  children: PlanIssue[];
}

export interface ListOptions {
  json?: boolean;
  inbox?: boolean;
  all?: boolean;
  depth?: number;
  status?: string;
  assignee?: string;
  team?: string;
  project?: string;
}

export interface ListResult {
  items: PlanIssue[];
}
