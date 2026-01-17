/**
 * GraphQL query builder utilities
 */

/**
 * Build the issue fields fragment for GraphQL, with nested children up to specified depth.
 * At the deepest level, we still fetch children IDs to show counts of hidden sub-issues.
 */
export function buildIssueFields(depth: number, currentDepth: number = 0): string {
  const baseFields = `
    id
    identifier
    title
    description
    sortOrder
    createdAt
    updatedAt
    state { name }
    assignee { id name displayName }
    labels { nodes { name } }
    project { name }`;

  // Add parent only at top level
  const parentField = currentDepth === 0 ? "\n    parent { id identifier }" : "";

  // Recursively add children if we haven't reached max depth
  if (currentDepth < depth) {
    const childFields = buildIssueFields(depth, currentDepth + 1);
    return `${baseFields}${parentField}
    children {
      nodes {${childFields}
      }
    }`;
  }

  // At max depth, still fetch children IDs to show count hint
  return `${baseFields}${parentField}
    children {
      nodes { id }
    }`;
}

/**
 * Build a paginated GraphQL query for issues
 */
export function buildPaginatedIssueQuery(
  filterStr: string,
  issueFields: string,
  cursor: string | null,
  pageSize: number = 100
): string {
  const afterClause = cursor ? `, after: "${cursor}"` : "";
  return `
    query ListIssues {
      issues(${filterStr}, first: ${pageSize}${afterClause}) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {${issueFields}
        }
      }
    }
  `;
}
