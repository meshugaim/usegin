/**
 * Linear issues client - handles all issue operations
 */

import type { LinearClient as LinearSDK } from "@linear/sdk";
import type { PlanIssue, PlanIssueDetail, PlanComment, ListOptions, IssueHistoryEntry } from "../../types";
import { buildIssueFields } from "../utils/graphql-builder";
import { transformGqlIssue, type GqlIssue } from "../utils/transformers";
import type { MetadataClient } from "./metadata";
import { addActorToDescription } from "../session-tracking";

export class IssuesClient {
  constructor(
    private sdk: LinearSDK,
    private graphql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>,
    private trackCall: () => void,
    private metadata: MetadataClient
  ) {}

  /**
   * List issues from Linear with pagination support
   */
  async listIssues(options: ListOptions = {}): Promise<PlanIssue[]> {
    // Build filter - always filter for top-level issues (no parent)
    const filterParts: string[] = [
      `parent: { null: true }`,
    ];

    if (options.team) {
      const team = await this.metadata.getTeamByKey(options.team);
      if (!team) {
        const teams = await this.metadata.getAllTeams();
        const available = teams.map((t) => t.key).join(", ");
        throw new Error(`Team "${options.team}" not found. Available teams: ${available}`);
      }
      filterParts.push(`team: { key: { eq: "${options.team}" } }`);
    }

    // Filter by status if specified, otherwise exclude completed/canceled by default
    if (options.status) {
      filterParts.push(`state: { name: { eqIgnoreCase: "${options.status}" } }`);
    } else {
      filterParts.push(`state: { type: { nin: ["completed", "canceled"] } }`);
    }

    // Filter by project
    if (options.project) {
      const projectId = await this.metadata.getProjectId(options.project);
      if (projectId) {
        filterParts.push(`project: { id: { eq: "${projectId}" } }`);
      }
    }

    // Filter by label(s)
    if (options.label && options.label.length > 0) {
      const labelList = options.label.map((l) => `"${l}"`).join(", ");
      filterParts.push(`labels: { name: { in: [${labelList}] } }`);
    }

    const filterStr = `filter: { ${filterParts.join(", ")} }`;

    // Build GraphQL query with dynamic depth for nested children
    const depth = options.depth ?? 0;
    const issueFields = buildIssueFields(depth);

    // Paginate through all results
    const allIssues: GqlIssue[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const afterClause = cursor ? `, after: "${cursor}"` : "";
      const query = `
        query ListIssues {
          issues(${filterStr}, first: 100${afterClause}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {${issueFields}
            }
          }
        }
      `;

      const data = await this.graphql<{
        issues: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: GqlIssue[];
        };
      }>(query);

      allIssues.push(...data.issues.nodes);
      hasNextPage = data.issues.pageInfo.hasNextPage;
      cursor = data.issues.pageInfo.endCursor;
    }

    // Transform to PlanIssue format (no need to filter by parent - done at GraphQL level)
    const planIssues: PlanIssue[] = [];

    for (const issue of allIssues) {
      // Apply search filter (client-side since GraphQL filter is limited)
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        const inTitle = issue.title.toLowerCase().includes(searchLower);
        const inDesc = issue.description?.toLowerCase().includes(searchLower);
        if (!inTitle && !inDesc) continue;
      }

      planIssues.push(transformGqlIssue(issue, undefined, options.status));
    }

    // Sort by sortOrder
    return planIssues.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Get an issue by its identifier (e.g., "ENG-123")
   */
  async getIssueByIdentifier(identifier: string): Promise<PlanIssue | null> {
    try {
      this.trackCall();
      const issue = await this.sdk.issue(identifier);
      if (!issue) return null;

      const state = await issue.state;
      const assignee = await issue.assignee;
      const parent = await issue.parent;

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description ?? undefined,
        status: state?.name ?? "Unknown",
        sortOrder: issue.sortOrder,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        assignee: assignee
          ? {
              id: assignee.id,
              name: assignee.name,
              displayName: assignee.displayName,
            }
          : undefined,
        parent: parent
          ? { id: parent.id, identifier: parent.identifier }
          : undefined,
        children: [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Get detailed issue info for `plan show` including relationships
   */
  async getIssueDetail(identifier: string): Promise<PlanIssueDetail | null> {
    // Single GraphQL query for issue details
    const query = `
      query GetIssueDetail($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          sortOrder
          createdAt
          updatedAt
          url
          state { name }
          assignee { id name displayName }
          parent { id identifier }
          labels { nodes { name } }
          project { name }
          team { id }
          comments { nodes { id } }
          children {
            nodes {
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
              project { name }
            }
          }
          relations {
            nodes {
              type
              relatedIssue { id identifier title }
            }
          }
          inverseRelations {
            nodes {
              type
              issue { id identifier title }
            }
          }
        }
      }
    `;

    interface GqlRelation {
      type: string;
      relatedIssue?: { id: string; identifier: string; title: string };
      issue?: { id: string; identifier: string; title: string };
    }

    interface GqlChild {
      id: string;
      identifier: string;
      title: string;
      description: string | null;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
      state: { name: string } | null;
      assignee: { id: string; name: string; displayName: string } | null;
      labels: { nodes: Array<{ name: string }> };
      project: { name: string } | null;
    }

    interface GqlIssueDetail {
      id: string;
      identifier: string;
      title: string;
      description: string | null;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
      url: string;
      state: { name: string } | null;
      assignee: { id: string; name: string; displayName: string } | null;
      parent: { id: string; identifier: string } | null;
      labels: { nodes: Array<{ name: string }> };
      project: { name: string } | null;
      team: { id: string };
      comments: { nodes: Array<{ id: string }> };
      children: { nodes: GqlChild[] };
      relations: { nodes: GqlRelation[] };
      inverseRelations: { nodes: GqlRelation[] };
    }

    try {
      const data = await this.graphql<{ issue: GqlIssueDetail | null }>(query, { id: identifier });
      const issue = data.issue;
      if (!issue) return null;

      // Process blocking relationships
      const blocks = issue.relations.nodes
        .filter((rel) => rel.type === "blocks" && rel.relatedIssue)
        .map((rel) => ({
          id: rel.relatedIssue!.id,
          identifier: rel.relatedIssue!.identifier,
          title: rel.relatedIssue!.title,
        }));

      const blockedBy = issue.inverseRelations.nodes
        .filter((rel) => rel.type === "blocks" && rel.issue)
        .map((rel) => ({
          id: rel.issue!.id,
          identifier: rel.issue!.identifier,
          title: rel.issue!.title,
        }));

      // Process children
      const children: PlanIssue[] = issue.children.nodes.map((child) => ({
        id: child.id,
        identifier: child.identifier,
        title: child.title,
        description: child.description ?? undefined,
        status: child.state?.name ?? "Unknown",
        sortOrder: child.sortOrder,
        createdAt: child.createdAt,
        updatedAt: child.updatedAt,
        assignee: child.assignee
          ? {
              id: child.assignee.id,
              name: child.assignee.name,
              displayName: child.assignee.displayName,
            }
          : undefined,
        parent: { id: issue.id, identifier: issue.identifier },
        labels: child.labels.nodes.map((l) => l.name),
        project: child.project?.name,
        children: [],
      }));

      // Get position from siblings with pagination
      const allSiblings: Array<{ id: string; sortOrder: number }> = [];
      let siblingsHasNextPage = true;
      let siblingsCursor: string | null = null;

      while (siblingsHasNextPage) {
        const afterClause = siblingsCursor ? `, after: "${siblingsCursor}"` : "";
        const siblingsQuery = `
          query GetSiblings($teamId: ID!) {
            issues(filter: {
              team: { id: { eq: $teamId } },
              parent: { null: true },
              state: { type: { nin: ["completed", "canceled"] } }
            }, first: 100${afterClause}) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes { id sortOrder }
            }
          }
        `;
        const siblingsData = await this.graphql<{
          issues: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{ id: string; sortOrder: number }>;
          };
        }>(siblingsQuery, { teamId: issue.team.id });

        allSiblings.push(...siblingsData.issues.nodes);
        siblingsHasNextPage = siblingsData.issues.pageInfo.hasNextPage;
        siblingsCursor = siblingsData.issues.pageInfo.endCursor;
      }

      const sortedSiblings = allSiblings.sort((a, b) => a.sortOrder - b.sortOrder);
      const position = sortedSiblings.findIndex((i) => i.id === issue.id) + 1;

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description ?? undefined,
        status: issue.state?.name ?? "Unknown",
        sortOrder: issue.sortOrder,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        url: issue.url,
        position: position > 0 ? position : 1,
        assignee: issue.assignee
          ? {
              id: issue.assignee.id,
              name: issue.assignee.name,
              displayName: issue.assignee.displayName,
            }
          : undefined,
        parent: issue.parent
          ? { id: issue.parent.id, identifier: issue.parent.identifier }
          : undefined,
        labels: issue.labels.nodes.map((l) => l.name),
        project: issue.project?.name,
        children: children.sort((a, b) => a.sortOrder - b.sortOrder),
        blockedBy,
        blocks,
        commentCount: issue.comments.nodes.length,
      };
    } catch (error) {
      // Log error for debugging
      if (process.env.DEBUG) {
        console.error("getIssueDetail error:", error);
      }
      return null;
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(options: {
    title: string;
    description?: string;
    team?: string;
    parentId?: string;
    labels?: string[];
    project?: string;
    status?: string;
    createMissingLabels?: boolean;
  }): Promise<{ issue: PlanIssue; missingLabels: string[] }> {
    // Get team ID
    let teamId: string;
    if (options.team) {
      const team = await this.metadata.getTeamByKey(options.team);
      if (!team) {
        const teams = await this.metadata.getAllTeams();
        const available = teams.map((t) => t.key).join(", ");
        throw new Error(`Team "${options.team}" not found. Available teams: ${available}`);
      }
      teamId = team.id;
    } else {
      const defaultTeam = await this.metadata.getDefaultTeam();
      if (!defaultTeam) {
        throw new Error("No teams found. Please specify a team with --team");
      }
      teamId = defaultTeam.id;
    }

    // Resolve parent identifier to ID if provided
    let parentId: string | undefined;
    if (options.parentId) {
      // Check if it's already a UUID or an identifier
      if (options.parentId.includes("-") && options.parentId.length > 20) {
        parentId = options.parentId;
      } else {
        const parent = await this.getIssueByIdentifier(options.parentId);
        if (!parent) {
          throw new Error(`Parent issue "${options.parentId}" not found`);
        }
        parentId = parent.id;
      }
    }

    // Resolve labels
    let labelIds: string[] | undefined;
    const missingLabels: string[] = [];
    if (options.labels && options.labels.length > 0) {
      const result = await this.metadata.getLabelIds(teamId, options.labels);
      labelIds = result.ids;

      // Handle missing labels
      if (result.missing.length > 0) {
        if (options.createMissingLabels) {
          for (const name of result.missing) {
            const newLabel = await this.metadata.createLabel(teamId, name);
            labelIds.push(newLabel.id);
          }
        } else {
          missingLabels.push(...result.missing);
        }
      }
    }

    // Resolve project
    let projectId: string | undefined;
    if (options.project) {
      const id = await this.metadata.getProjectId(options.project);
      if (!id) {
        const projects = await this.metadata.getAllProjects();
        const available = projects.length > 0
          ? projects.map((p) => `"${p.name}"`).join(", ")
          : "(no projects found)";
        throw new Error(`Project "${options.project}" not found. Available projects: ${available}`);
      }
      projectId = id;
    }

    // Resolve status/state
    let stateId: string | undefined;
    if (options.status) {
      const id = await this.metadata.getStateId(teamId, options.status);
      if (!id) {
        const states = await this.metadata.getStatesForTeam(teamId);
        const available = states.map((s) => `"${s.name}"`).join(", ");
        throw new Error(`Status "${options.status}" not found. Available statuses: ${available}`);
      }
      stateId = id;
    }

    // Create the issue (with actor tracking in description)
    const trackedDescription = addActorToDescription(options.description, "created");
    this.trackCall();
    const result = await this.sdk.createIssue({
      teamId,
      title: options.title,
      description: trackedDescription,
      parentId,
      labelIds,
      projectId,
      stateId,
    });

    const issue = await result.issue;
    if (!issue) {
      throw new Error("Failed to create issue");
    }

    const state = await issue.state;

    return {
      issue: {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description ?? undefined,
        status: state?.name ?? "Unknown",
        sortOrder: issue.sortOrder,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        children: [],
      },
      missingLabels,
    };
  }

  /**
   * Update an existing issue
   */
  async updateIssue(
    identifier: string,
    options: {
      title?: string;
      description?: string;
      status?: string;
      assignee?: string;
      parentId?: string | null; // null to remove parent
      labels?: string[];
      project?: string;
      createMissingLabels?: boolean;
    }
  ): Promise<{ issue: PlanIssue; missingLabels: string[] }> {
    // Get the issue first
    const issue = await this.getIssueByIdentifier(identifier);
    if (!issue) {
      throw new Error(`Issue "${identifier}" not found`);
    }

    // Get team for state/label resolution
    this.trackCall();
    const rawIssue = await this.sdk.issue(identifier);
    const team = await rawIssue.team;
    const teamId = team.id;

    // Build update input
    const input: Record<string, unknown> = {};

    if (options.title !== undefined) {
      input.title = options.title;
    }

    // Actor tracking: add contributing actor to the description metadata footer.
    // If the caller provided a new description, track on that; otherwise track on current.
    {
      const baseDescription = options.description ?? issue.description;
      input.description = addActorToDescription(baseDescription, "contributed");
    }

    if (options.status !== undefined) {
      const stateId = await this.metadata.getStateId(teamId, options.status);
      if (!stateId) {
        const states = await this.metadata.getStatesForTeam(teamId);
        const available = states.map((s) => `"${s.name}"`).join(", ");
        throw new Error(`Status "${options.status}" not found. Available statuses: ${available}`);
      }
      input.stateId = stateId;
    }

    if (options.assignee !== undefined) {
      if (options.assignee === "@me") {
        const me = await this.metadata.getViewer();
        input.assigneeId = me.id;
      } else if (options.assignee === "" || options.assignee === "none") {
        input.assigneeId = null;
      } else {
        // Try to find user by name
        this.trackCall();
        const users = await this.sdk.users();
        const user = users.nodes.find(
          (u) => u.name.toLowerCase() === options.assignee!.toLowerCase() ||
                 u.displayName.toLowerCase() === options.assignee!.toLowerCase()
        );
        if (user) {
          input.assigneeId = user.id;
        } else {
          const available = users.nodes.map((u) => u.displayName || u.name).join(", ");
          throw new Error(`User "${options.assignee}" not found. Available users: ${available}. Use @me for yourself.`);
        }
      }
    }

    if (options.parentId !== undefined) {
      if (options.parentId === null) {
        input.parentId = null;
      } else {
        const parent = await this.getIssueByIdentifier(options.parentId);
        if (!parent) {
          throw new Error(`Parent issue "${options.parentId}" not found`);
        }
        input.parentId = parent.id;
      }
    }

    const missingLabels: string[] = [];
    if (options.labels !== undefined) {
      const result = await this.metadata.getLabelIds(teamId, options.labels);
      const labelIds = result.ids;

      // Handle missing labels
      if (result.missing.length > 0) {
        if (options.createMissingLabels) {
          for (const name of result.missing) {
            const newLabel = await this.metadata.createLabel(teamId, name);
            labelIds.push(newLabel.id);
          }
        } else {
          missingLabels.push(...result.missing);
        }
      }

      input.labelIds = labelIds;
    }

    if (options.project !== undefined) {
      const projectId = await this.metadata.getProjectId(options.project);
      if (!projectId) {
        const projects = await this.metadata.getAllProjects();
        const available = projects.length > 0
          ? projects.map((p) => `"${p.name}"`).join(", ")
          : "(no projects found)";
        throw new Error(`Project "${options.project}" not found. Available projects: ${available}`);
      }
      input.projectId = projectId;
    }

    // Update the issue
    this.trackCall();
    await this.sdk.updateIssue(issue.id, input);

    // Return updated issue
    const updatedIssue = await this.getIssueByIdentifier(identifier);
    return { issue: updatedIssue!, missingLabels };
  }

  /**
   * Remove a label from an issue by name
   */
  async removeLabel(identifier: string, labelName: string): Promise<void> {
    // Get full issue with labels
    this.trackCall();
    const rawIssue = await this.sdk.issue(identifier);
    if (!rawIssue) throw new Error(`Issue "${identifier}" not found`);

    const labels = await rawIssue.labels();
    const currentLabelIds = labels.nodes.map((l) => l.id);
    const labelToRemove = labels.nodes.find(
      (l) => l.name.toLowerCase() === labelName.toLowerCase()
    );

    if (!labelToRemove) {
      // Label not on issue, nothing to do
      return;
    }

    // Filter out the label to remove
    const newLabelIds = currentLabelIds.filter((id) => id !== labelToRemove.id);

    // Update the issue with new labels
    this.trackCall();
    await this.sdk.updateIssue(rawIssue.id, { labelIds: newLabelIds });
  }

  /**
   * Get all top-level issues with sortOrder for reordering (with pagination)
   */
  async getIssuesForReordering(teamKey?: string): Promise<Array<{
    id: string;
    identifier: string;
    sortOrder: number;
  }>> {
    // Build filter
    const filterParts = [
      `parent: { null: true }`,
      `state: { type: { nin: ["completed", "canceled"] } }`,
    ];

    if (teamKey) {
      filterParts.push(`team: { key: { eq: "${teamKey}" } }`);
    }

    interface GqlIssue {
      id: string;
      identifier: string;
      sortOrder: number;
    }

    const allIssues: GqlIssue[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const afterClause = cursor ? `, after: "${cursor}"` : "";
      const query = `
        query GetIssuesForReordering {
          issues(filter: { ${filterParts.join(", ")} }, first: 100${afterClause}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              identifier
              sortOrder
            }
          }
        }
      `;

      const data = await this.graphql<{
        issues: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: GqlIssue[];
        };
      }>(query);

      allIssues.push(...data.issues.nodes);
      hasNextPage = data.issues.pageInfo.hasNextPage;
      cursor = data.issues.pageInfo.endCursor;
    }

    return allIssues;
  }

  /**
   * Update an issue's sortOrder
   */
  async updateSortOrder(identifier: string, sortOrder: number): Promise<void> {
    const issue = await this.getIssueByIdentifier(identifier);
    if (!issue) throw new Error(`Issue "${identifier}" not found`);

    this.trackCall();
    await this.sdk.updateIssue(issue.id, { sortOrder });
  }

  /**
   * Get comments for an issue by identifier
   */
  async getIssueComments(identifier: string): Promise<PlanComment[]> {
    const query = `
      query GetIssueComments($id: String!) {
        issue(id: $id) {
          comments {
            nodes {
              id
              body
              createdAt
              user {
                id
                name
                displayName
              }
            }
          }
        }
      }
    `;

    interface GqlComment {
      id: string;
      body: string;
      createdAt: string;
      user: { id: string; name: string; displayName: string } | null;
    }

    interface GqlResponse {
      issue: {
        comments: {
          nodes: GqlComment[];
        };
      } | null;
    }

    const data = await this.graphql<GqlResponse>(query, { id: identifier });
    if (!data.issue) return [];

    return data.issue.comments.nodes.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      user: c.user
        ? {
            id: c.user.id,
            name: c.user.name,
            displayName: c.user.displayName,
          }
        : undefined,
    }));
  }

  /**
   * Get siblings of an issue (issues with same parent)
   */
  async getIssueSiblings(parentIdentifier: string): Promise<Array<{ id: string; identifier: string; title: string; sortOrder: number }>> {
    const query = `
      query GetIssueSiblings($id: String!) {
        issue(id: $id) {
          id
          children {
            nodes {
              id
              identifier
              title
              sortOrder
            }
          }
        }
      }
    `;

    interface GqlSibling {
      id: string;
      identifier: string;
      title: string;
      sortOrder: number;
    }

    try {
      const data = await this.graphql<{
        issue: {
          children: {
            nodes: GqlSibling[];
          };
        } | null;
      }>(query, { id: parentIdentifier });

      if (!data.issue) return [];

      return data.issue.children.nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    } catch (error) {
      if (process.env.DEBUG) {
        console.error("getIssueSiblings error:", error);
      }
      return [];
    }
  }

  /**
   * Get parent issue details
   */
  async getParentIssue(parentIdentifier: string): Promise<{ id: string; identifier: string; title: string } | null> {
    const query = `
      query GetParentIssue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
        }
      }
    `;

    try {
      const data = await this.graphql<{
        issue: {
          id: string;
          identifier: string;
          title: string;
        } | null;
      }>(query, { id: parentIdentifier });

      return data.issue;
    } catch (error) {
      if (process.env.DEBUG) {
        console.error("getParentIssue error:", error);
      }
      return null;
    }
  }

  /**
   * Search issues using Linear's API filters (server-side search)
   * Searches in title and description using 'contains' filter with 'or' logic
   */
  async searchIssues(options: {
    query: string;
    team?: string;
    includeCompleted?: boolean;
    limit?: number;
  }): Promise<PlanIssue[]> {
    const { query, team, includeCompleted = false, limit = 50 } = options;

    // Build filter parts
    const filterParts: string[] = [];

    // Team filter
    if (team) {
      const teamData = await this.metadata.getTeamByKey(team);
      if (!teamData) {
        const teams = await this.metadata.getAllTeams();
        const available = teams.map((t) => t.key).join(", ");
        throw new Error(`Team "${team}" not found. Available teams: ${available}`);
      }
      filterParts.push(`team: { key: { eq: "${team}" } }`);
    }

    // Exclude completed/canceled unless includeCompleted is true
    if (!includeCompleted) {
      filterParts.push(`state: { type: { nin: ["completed", "canceled"] } }`);
    }

    // Search filter using 'or' to match in title OR description
    const escapedQuery = query.replace(/"/g, '\\"');
    const searchFilter = `or: [
      { title: { containsIgnoreCase: "${escapedQuery}" } },
      { description: { containsIgnoreCase: "${escapedQuery}" } }
    ]`;
    filterParts.push(searchFilter);

    const filterStr = `filter: { ${filterParts.join(", ")} }`;

    // GraphQL query
    const gqlQuery = `
      query SearchIssues {
        issues(${filterStr}, first: ${limit}) {
          nodes {
            id
            identifier
            title
            description
            sortOrder
            createdAt
            updatedAt
            state { name }
            assignee { id name displayName }
            parent { id identifier }
            labels { nodes { name } }
            project { name }
          }
        }
      }
    `;

    interface GqlSearchResult {
      issues: {
        nodes: Array<{
          id: string;
          identifier: string;
          title: string;
          description: string | null;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
          state: { name: string } | null;
          assignee: { id: string; name: string; displayName: string } | null;
          parent: { id: string; identifier: string } | null;
          labels: { nodes: Array<{ name: string }> };
          project: { name: string } | null;
        }>;
      };
    }

    const data = await this.graphql<GqlSearchResult>(gqlQuery);

    return data.issues.nodes.map((issue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? undefined,
      status: issue.state?.name ?? "Unknown",
      sortOrder: issue.sortOrder,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      assignee: issue.assignee
        ? {
            id: issue.assignee.id,
            name: issue.assignee.name,
            displayName: issue.assignee.displayName,
          }
        : undefined,
      parent: issue.parent
        ? { id: issue.parent.id, identifier: issue.parent.identifier }
        : undefined,
      labels: issue.labels.nodes.map((l) => l.name),
      project: issue.project?.name,
      children: [],
    }));
  }

  /**
   * Get history entries for an issue
   */
  async getIssueHistory(identifier: string, limit: number = 20): Promise<IssueHistoryEntry[]> {
    const query = `
      query GetIssueHistory($id: String!, $first: Int!) {
        issue(id: $id) {
          history(first: $first) {
            nodes {
              id
              createdAt
              actor { name displayName }
              fromTitle
              toTitle
              fromState { name }
              toState { name }
              fromAssignee { name displayName }
              toAssignee { name displayName }
              fromPriority
              toPriority
              fromEstimate
              toEstimate
              fromDueDate
              toDueDate
              fromParent { identifier }
              toParent { identifier }
              addedLabelIds
              removedLabelIds
              archived
            }
          }
        }
      }
    `;

    interface GqlHistoryNode {
      id: string;
      createdAt: string;
      actor: { name: string; displayName: string } | null;
      fromTitle: string | null;
      toTitle: string | null;
      fromState: { name: string } | null;
      toState: { name: string } | null;
      fromAssignee: { name: string; displayName: string } | null;
      toAssignee: { name: string; displayName: string } | null;
      fromPriority: number | null;
      toPriority: number | null;
      fromEstimate: number | null;
      toEstimate: number | null;
      fromDueDate: string | null;
      toDueDate: string | null;
      fromParent: { identifier: string } | null;
      toParent: { identifier: string } | null;
      addedLabelIds: string[] | null;
      removedLabelIds: string[] | null;
      archived: boolean | null;
    }

    try {
      const data = await this.graphql<{
        issue: { history: { nodes: GqlHistoryNode[] } } | null;
      }>(query, { id: identifier, first: limit });

      if (!data.issue) return [];

      return data.issue.history.nodes.map((node) => ({
        id: node.id,
        createdAt: node.createdAt,
        actor: node.actor ?? undefined,
        fromTitle: node.fromTitle ?? undefined,
        toTitle: node.toTitle ?? undefined,
        fromState: node.fromState?.name,
        toState: node.toState?.name,
        fromAssignee: node.fromAssignee?.displayName ?? node.fromAssignee?.name,
        toAssignee: node.toAssignee?.displayName ?? node.toAssignee?.name,
        fromPriority: node.fromPriority ?? undefined,
        toPriority: node.toPriority ?? undefined,
        fromEstimate: node.fromEstimate ?? undefined,
        toEstimate: node.toEstimate ?? undefined,
        fromDueDate: node.fromDueDate ?? undefined,
        toDueDate: node.toDueDate ?? undefined,
        fromParent: node.fromParent?.identifier,
        toParent: node.toParent?.identifier,
        addedLabelIds: node.addedLabelIds ?? undefined,
        removedLabelIds: node.removedLabelIds ?? undefined,
        archived: node.archived ?? undefined,
      }));
    } catch (error) {
      if (process.env.DEBUG) {
        console.error("getIssueHistory error:", error);
      }
      return [];
    }
  }
}
