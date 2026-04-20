/**
 * GraphQL to PlanIssue transformation utilities
 */

import type { PlanIssue } from "../../types";

/**
 * GraphQL response type for issues with recursive children
 */
export interface GqlIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  state: { name: string } | null;
  assignee: { id: string; name: string; displayName: string } | null;
  parent?: { id: string; identifier: string } | null;
  labels: { nodes: Array<{ name: string }> };
  project: { name: string } | null;
  children?: { nodes: GqlIssue[] };
}

/**
 * Transform a GraphQL issue response to PlanIssue format recursively.
 * At the deepest level, children only have `id` - we count these but don't transform them.
 *
 * @param gqlIssue - The GraphQL issue to transform
 * @param parentInfo - Optional parent information to attach
 * @param statusFilter - Optional status filter to apply recursively to children.
 *   When undefined/null, defaults to excluding completed/canceled states.
 *   When explicitly set, only children matching that status are included.
 */
export function transformGqlIssue(
  gqlIssue: GqlIssue,
  parentInfo?: { id: string; identifier: string },
  statusFilter?: string | null
): PlanIssue {
  let children: PlanIssue[] = [];
  let childCount: number | undefined;

  if (gqlIssue.children?.nodes && gqlIssue.children.nodes.length > 0) {
    // Check if children have full data (identifier exists) or just IDs
    const firstChild = gqlIssue.children.nodes[0];
    if (firstChild.identifier) {
      // Full children - filter by status and transform recursively
      // Completed/canceled status types to exclude by default
      const completedStatuses = ["done", "canceled", "cancelled"];

      const filteredChildren = gqlIssue.children.nodes.filter((child) => {
        const childStatus = child.state?.name?.toLowerCase() ?? "";
        if (statusFilter) {
          // Explicit status filter: only include matching children
          return childStatus === statusFilter.toLowerCase();
        } else {
          // Default: exclude completed/canceled (match top-level behavior)
          return !completedStatuses.includes(childStatus);
        }
      });

      children = filteredChildren.map((child) =>
        transformGqlIssue(child, {
          id: gqlIssue.id,
          identifier: gqlIssue.identifier,
        }, statusFilter)
      ).sort((a, b) => a.sortOrder - b.sortOrder);
    } else {
      // Only IDs - this is the deepest level, just count them
      // Note: We can't filter these as they don't have status info
      childCount = gqlIssue.children.nodes.length;
    }
  }

  // Prefer the explicit parentInfo (set when transforming a recursively-fetched
  // child), but fall back to the GQL `parent` field for top-level rows. The
  // fallback matters in flat mode, where former sub-issues come back as their
  // own rows and we want their parent reference preserved in the output.
  const parent =
    parentInfo ??
    (gqlIssue.parent
      ? { id: gqlIssue.parent.id, identifier: gqlIssue.parent.identifier }
      : undefined);

  return {
    id: gqlIssue.id,
    identifier: gqlIssue.identifier,
    title: gqlIssue.title,
    description: gqlIssue.description ?? undefined,
    status: gqlIssue.state?.name ?? "Unknown",
    sortOrder: gqlIssue.sortOrder,
    createdAt: gqlIssue.createdAt,
    updatedAt: gqlIssue.updatedAt,
    assignee: gqlIssue.assignee
      ? {
          id: gqlIssue.assignee.id,
          name: gqlIssue.assignee.name,
          displayName: gqlIssue.assignee.displayName,
        }
      : undefined,
    parent,
    labels: gqlIssue.labels.nodes.map((l) => l.name),
    project: gqlIssue.project?.name,
    children,
    childCount,
  };
}
