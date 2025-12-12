import { LinearClient as LinearSDK } from "@linear/sdk";
import type { PlanIssue, PlanIssueDetail, ListOptions } from "../types";
import {
  getCachedTeam,
  setCachedTeam,
  getCachedStates,
  setCachedStates,
  getCachedLabels,
  setCachedLabels,
  getCachedProject,
  setCachedProject,
  getCachedViewer,
  setCachedViewer,
} from "./cache";

export interface LinearClientOptions {
  apiKey: string;
}

export class LinearClient {
  private sdk: LinearSDK;
  private _apiCallCount = 0;

  constructor(options: LinearClientOptions) {
    if (!options.apiKey) {
      throw new Error("LINEAR_API_KEY is required");
    }
    this.sdk = new LinearSDK({ apiKey: options.apiKey });
  }

  /**
   * Get the number of API calls made
   */
  get apiCallCount(): number {
    return this._apiCallCount;
  }

  /**
   * Execute raw GraphQL query (tracks call count)
   */
  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    this._apiCallCount++;
    const result = await this.sdk.client.rawRequest<T>(query, variables);
    return result.data;
  }

  /**
   * Wrap SDK call to track count
   */
  private trackCall(): void {
    this._apiCallCount++;
  }

  /**
   * Get a team by its key (e.g., "ENG")
   */
  async getTeamByKey(key: string): Promise<{ id: string; key: string; name: string } | null> {
    // Check cache first
    const cached = await getCachedTeam(key);
    if (cached) return cached;

    this.trackCall();
    const teams = await this.sdk.teams();
    const team = teams.nodes.find((t) => t.key === key);
    if (!team) return null;

    const result = { id: team.id, key: team.key, name: team.name };
    await setCachedTeam(key, result);
    return result;
  }

  /**
   * Get the first available team (for default behavior)
   */
  async getDefaultTeam(): Promise<{ id: string; key: string; name: string } | null> {
    this.trackCall();
    const teams = await this.sdk.teams();
    const team = teams.nodes[0];
    if (!team) return null;
    return { id: team.id, key: team.key, name: team.name };
  }

  /**
   * Get current user (viewer) with caching
   */
  async getViewer(): Promise<{ id: string; name: string; displayName: string }> {
    const cached = await getCachedViewer();
    if (cached) return cached;

    this.trackCall();
    const me = await this.sdk.viewer;
    const result = { id: me.id, name: me.name, displayName: me.displayName };
    await setCachedViewer(result);
    return result;
  }

  /**
   * List issues from Linear (single GraphQL query)
   */
  async listIssues(options: ListOptions = {}): Promise<PlanIssue[]> {
    // Build filter
    const filterParts: string[] = [];

    if (options.team) {
      const team = await this.getTeamByKey(options.team);
      if (!team) {
        throw new Error(`Team "${options.team}" not found`);
      }
      filterParts.push(`team: { key: { eq: "${options.team}" } }`);
    }

    // Exclude completed/canceled by default
    filterParts.push(`state: { type: { nin: ["completed", "canceled"] } }`);

    // Filter by project
    if (options.project) {
      const projectId = await this.getProjectId(options.project);
      if (projectId) {
        filterParts.push(`project: { id: { eq: "${projectId}" } }`);
      }
    }

    // Filter by label(s)
    if (options.label && options.label.length > 0) {
      const labelList = options.label.map((l) => `"${l}"`).join(", ");
      filterParts.push(`labels: { name: { in: [${labelList}] } }`);
    }

    // Filter for inbox
    if (options.inbox) {
      filterParts.push(`labels: { name: { eq: "inbox" } }`);
    }

    const filterStr = filterParts.length > 0 ? `filter: { ${filterParts.join(", ")} }` : "";

    // Single GraphQL query with all nested relations
    const query = `
      query ListIssues {
        issues(${filterStr}, first: 100) {
          nodes {
            id
            identifier
            title
            description
            sortOrder
            state { name }
            assignee { id name displayName }
            parent { id identifier }
            labels { nodes { name } }
            project { name }
            children {
              nodes {
                id
                identifier
                title
                description
                sortOrder
                state { name }
                assignee { id name displayName }
                labels { nodes { name } }
                project { name }
              }
            }
          }
        }
      }
    `;

    interface GqlIssue {
      id: string;
      identifier: string;
      title: string;
      description: string | null;
      sortOrder: number;
      state: { name: string } | null;
      assignee: { id: string; name: string; displayName: string } | null;
      parent: { id: string; identifier: string } | null;
      labels: { nodes: Array<{ name: string }> };
      project: { name: string } | null;
      children: { nodes: GqlIssue[] };
    }

    const data = await this.graphql<{ issues: { nodes: GqlIssue[] } }>(query);

    // Transform to PlanIssue format
    const planIssues: PlanIssue[] = [];

    for (const issue of data.issues.nodes) {
      // Skip if has parent (we only want top-level)
      if (issue.parent) continue;

      // Apply search filter (client-side since GraphQL filter is limited)
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        const inTitle = issue.title.toLowerCase().includes(searchLower);
        const inDesc = issue.description?.toLowerCase().includes(searchLower);
        if (!inTitle && !inDesc) continue;
      }

      const children: PlanIssue[] = issue.children.nodes.map((child) => ({
        id: child.id,
        identifier: child.identifier,
        title: child.title,
        description: child.description ?? undefined,
        status: child.state?.name ?? "Unknown",
        sortOrder: child.sortOrder,
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

      planIssues.push({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description ?? undefined,
        status: issue.state?.name ?? "Unknown",
        sortOrder: issue.sortOrder,
        assignee: issue.assignee
          ? {
              id: issue.assignee.id,
              name: issue.assignee.name,
              displayName: issue.assignee.displayName,
            }
          : undefined,
        labels: issue.labels.nodes.map((l) => l.name),
        project: issue.project?.name,
        children: children.sort((a, b) => a.sortOrder - b.sortOrder),
      });
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
          state { name }
          assignee { id name displayName }
          parent { id identifier }
          labels { nodes { name } }
          project { name }
          team { id }
          children {
            nodes {
              id
              identifier
              title
              description
              sortOrder
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
      state: { name: string } | null;
      assignee: { id: string; name: string; displayName: string } | null;
      parent: { id: string; identifier: string } | null;
      labels: { nodes: Array<{ name: string }> };
      project: { name: string } | null;
      team: { id: string };
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

      // Get position from siblings (second query - unavoidable for position)
      const siblingsQuery = `
        query GetSiblings($teamId: ID!) {
          issues(filter: {
            team: { id: { eq: $teamId } },
            parent: { null: true },
            state: { type: { nin: ["completed", "canceled"] } }
          }, first: 100) {
            nodes { id sortOrder }
          }
        }
      `;
      const siblingsData = await this.graphql<{ issues: { nodes: Array<{ id: string; sortOrder: number }> } }>(
        siblingsQuery,
        { teamId: issue.team.id }
      );
      const sortedSiblings = siblingsData.issues.nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      const position = sortedSiblings.findIndex((i) => i.id === issue.id) + 1;

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description ?? undefined,
        status: issue.state?.name ?? "Unknown",
        sortOrder: issue.sortOrder,
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
   * Get labels by name for a team
   */
  async getLabelIds(teamId: string, labelNames: string[]): Promise<string[]> {
    // Check cache first
    let teamLabels = await getCachedLabels(teamId);
    let workspaceLabels = await getCachedLabels("_workspace");

    if (!teamLabels) {
      this.trackCall();
      const result = await this.sdk.issueLabels({
        filter: { team: { id: { eq: teamId } } },
      });
      teamLabels = result.nodes.map((l) => ({ id: l.id, name: l.name }));
      await setCachedLabels(teamId, teamLabels);
    }

    const labelIds: string[] = [];
    for (const name of labelNames) {
      const label = teamLabels.find(
        (l) => l.name.toLowerCase() === name.toLowerCase()
      );
      if (label) {
        labelIds.push(label.id);
      } else {
        // Try workspace-level labels
        if (!workspaceLabels) {
          this.trackCall();
          const result = await this.sdk.issueLabels();
          workspaceLabels = result.nodes.map((l) => ({ id: l.id, name: l.name }));
          await setCachedLabels("_workspace", workspaceLabels);
        }
        const workspaceLabel = workspaceLabels.find(
          (l) => l.name.toLowerCase() === name.toLowerCase()
        );
        if (workspaceLabel) {
          labelIds.push(workspaceLabel.id);
        }
      }
    }
    return labelIds;
  }

  /**
   * Get workflow state ID by name for a team
   */
  async getStateId(teamId: string, stateName: string): Promise<string | null> {
    // Check cache first
    let states = await getCachedStates(teamId);

    if (!states) {
      this.trackCall();
      const result = await this.sdk.workflowStates({
        filter: { team: { id: { eq: teamId } } },
      });
      states = result.nodes.map((s) => ({ id: s.id, name: s.name, type: s.type }));
      await setCachedStates(teamId, states);
    }

    const state = states.find(
      (s) => s.name.toLowerCase() === stateName.toLowerCase()
    );
    return state?.id ?? null;
  }

  /**
   * Get project by name or ID
   */
  async getProjectId(projectNameOrId: string): Promise<string | null> {
    // Check cache first (by name)
    const cached = await getCachedProject(projectNameOrId);
    if (cached) return cached.id;

    // Try by ID first
    try {
      this.trackCall();
      const project = await this.sdk.project(projectNameOrId);
      if (project) {
        await setCachedProject(project.name, { id: project.id, name: project.name });
        return project.id;
      }
    } catch {
      // Not a valid ID, try by name
    }

    // Search by name
    this.trackCall();
    const projects = await this.sdk.projects();
    const project = projects.nodes.find(
      (p) => p.name.toLowerCase() === projectNameOrId.toLowerCase()
    );
    if (project) {
      await setCachedProject(project.name, { id: project.id, name: project.name });
      return project.id;
    }
    return null;
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
  }): Promise<PlanIssue> {
    // Get team ID
    let teamId: string;
    if (options.team) {
      const team = await this.getTeamByKey(options.team);
      if (!team) {
        throw new Error(`Team "${options.team}" not found`);
      }
      teamId = team.id;
    } else {
      const defaultTeam = await this.getDefaultTeam();
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
    if (options.labels && options.labels.length > 0) {
      labelIds = await this.getLabelIds(teamId, options.labels);
    }

    // Resolve project
    let projectId: string | undefined;
    if (options.project) {
      const id = await this.getProjectId(options.project);
      if (!id) {
        throw new Error(`Project "${options.project}" not found`);
      }
      projectId = id;
    }

    // Resolve status/state
    let stateId: string | undefined;
    if (options.status) {
      const id = await this.getStateId(teamId, options.status);
      if (!id) {
        throw new Error(`Status "${options.status}" not found for this team`);
      }
      stateId = id;
    }

    // Create the issue
    this.trackCall();
    const result = await this.sdk.createIssue({
      teamId,
      title: options.title,
      description: options.description,
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
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? undefined,
      status: state?.name ?? "Unknown",
      sortOrder: issue.sortOrder,
      children: [],
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
    }
  ): Promise<PlanIssue> {
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

    if (options.description !== undefined) {
      input.description = options.description;
    }

    if (options.status !== undefined) {
      const stateId = await this.getStateId(teamId, options.status);
      if (!stateId) {
        throw new Error(`Status "${options.status}" not found for this team`);
      }
      input.stateId = stateId;
    }

    if (options.assignee !== undefined) {
      if (options.assignee === "@me") {
        const me = await this.getViewer();
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
          throw new Error(`User "${options.assignee}" not found`);
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

    if (options.labels !== undefined) {
      const labelIds = await this.getLabelIds(teamId, options.labels);
      input.labelIds = labelIds;
    }

    if (options.project !== undefined) {
      const projectId = await this.getProjectId(options.project);
      if (!projectId) {
        throw new Error(`Project "${options.project}" not found`);
      }
      input.projectId = projectId;
    }

    // Update the issue
    this.trackCall();
    await this.sdk.updateIssue(issue.id, input);

    // Return updated issue
    return (await this.getIssueByIdentifier(identifier))!;
  }

  /**
   * Add a blocking relationship (this issue blocks another)
   */
  async addBlocking(identifier: string, blocksIdentifier: string): Promise<void> {
    const issue = await this.getIssueByIdentifier(identifier);
    const blocks = await this.getIssueByIdentifier(blocksIdentifier);
    if (!issue) throw new Error(`Issue "${identifier}" not found`);
    if (!blocks) throw new Error(`Issue "${blocksIdentifier}" not found`);

    this.trackCall();
    await this.sdk.createIssueRelation({
      issueId: issue.id,
      relatedIssueId: blocks.id,
      type: "blocks",
    });
  }

  /**
   * Add a blocked-by relationship (this issue is blocked by another)
   */
  async addBlockedBy(identifier: string, blockedByIdentifier: string): Promise<void> {
    // In Linear, "blocks" is directional - so we reverse the relationship
    const issue = await this.getIssueByIdentifier(identifier);
    const blocker = await this.getIssueByIdentifier(blockedByIdentifier);
    if (!issue) throw new Error(`Issue "${identifier}" not found`);
    if (!blocker) throw new Error(`Issue "${blockedByIdentifier}" not found`);

    this.trackCall();
    await this.sdk.createIssueRelation({
      issueId: blocker.id,
      relatedIssueId: issue.id,
      type: "blocks",
    });
  }

  /**
   * Add a related-to relationship
   */
  async addRelatedTo(identifier: string, relatedIdentifier: string): Promise<void> {
    const issue = await this.getIssueByIdentifier(identifier);
    const related = await this.getIssueByIdentifier(relatedIdentifier);
    if (!issue) throw new Error(`Issue "${identifier}" not found`);
    if (!related) throw new Error(`Issue "${relatedIdentifier}" not found`);

    this.trackCall();
    await this.sdk.createIssueRelation({
      issueId: issue.id,
      relatedIssueId: related.id,
      type: "related",
    });
  }

  /**
   * Mark as duplicate of another issue
   */
  async markDuplicateOf(identifier: string, duplicateOfIdentifier: string): Promise<void> {
    const issue = await this.getIssueByIdentifier(identifier);
    const original = await this.getIssueByIdentifier(duplicateOfIdentifier);
    if (!issue) throw new Error(`Issue "${identifier}" not found`);
    if (!original) throw new Error(`Issue "${duplicateOfIdentifier}" not found`);

    this.trackCall();
    await this.sdk.createIssueRelation({
      issueId: issue.id,
      relatedIssueId: original.id,
      type: "duplicate",
    });
  }

  /**
   * Add a comment to an issue
   */
  async addComment(identifier: string, body: string): Promise<void> {
    const issue = await this.getIssueByIdentifier(identifier);
    if (!issue) throw new Error(`Issue "${identifier}" not found`);

    this.trackCall();
    await this.sdk.createComment({
      issueId: issue.id,
      body,
    });
  }

  /**
   * Get all top-level issues with sortOrder for reordering
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

    const query = `
      query GetIssuesForReordering {
        issues(filter: { ${filterParts.join(", ")} }, first: 100) {
          nodes {
            id
            identifier
            sortOrder
          }
        }
      }
    `;

    interface GqlIssue {
      id: string;
      identifier: string;
      sortOrder: number;
    }

    const data = await this.graphql<{ issues: { nodes: GqlIssue[] } }>(query);
    return data.issues.nodes;
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
}
