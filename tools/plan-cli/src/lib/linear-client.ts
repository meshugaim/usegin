import { LinearClient as LinearSDK } from "@linear/sdk";
import type { PlanIssue, PlanIssueDetail, ListOptions } from "../types";

export interface LinearClientOptions {
  apiKey: string;
}

export class LinearClient {
  private sdk: LinearSDK;

  constructor(options: LinearClientOptions) {
    if (!options.apiKey) {
      throw new Error("LINEAR_API_KEY is required");
    }
    this.sdk = new LinearSDK({ apiKey: options.apiKey });
  }

  /**
   * Get a team by its key (e.g., "ENG")
   */
  async getTeamByKey(key: string): Promise<{ id: string; key: string; name: string } | null> {
    const teams = await this.sdk.teams();
    const team = teams.nodes.find((t) => t.key === key);
    if (!team) return null;
    return { id: team.id, key: team.key, name: team.name };
  }

  /**
   * Get the first available team (for default behavior)
   */
  async getDefaultTeam(): Promise<{ id: string; key: string; name: string } | null> {
    const teams = await this.sdk.teams();
    const team = teams.nodes[0];
    if (!team) return null;
    return { id: team.id, key: team.key, name: team.name };
  }

  /**
   * List issues from Linear
   */
  async listIssues(options: ListOptions = {}): Promise<PlanIssue[]> {
    // Get team
    let teamId: string | undefined;
    if (options.team) {
      const team = await this.getTeamByKey(options.team);
      if (!team) {
        throw new Error(`Team "${options.team}" not found`);
      }
      teamId = team.id;
    }

    // Build filter
    const filter: Record<string, unknown> = {};

    if (teamId) {
      filter.team = { id: { eq: teamId } };
    }

    // Exclude completed/canceled by default
    filter.state = {
      type: { nin: ["completed", "canceled"] },
    };

    // Filter by project
    if (options.project) {
      const projectId = await this.getProjectId(options.project);
      if (projectId) {
        filter.project = { id: { eq: projectId } };
      }
    }

    // Filter by label(s)
    if (options.label && options.label.length > 0) {
      // Linear uses "or" for multiple labels by default
      filter.labels = {
        name: { in: options.label },
      };
    }

    // Search filter (title or description contains)
    if (options.search) {
      filter.or = [
        { title: { containsIgnoreCase: options.search } },
        { description: { containsIgnoreCase: options.search } },
      ];
    }

    // Fetch issues
    const issues = await this.sdk.issues({
      filter,
    });

    // Transform to PlanIssue format
    const planIssues: PlanIssue[] = [];

    for (const issue of issues.nodes) {
      const state = await issue.state;
      const assignee = await issue.assignee;
      const parent = await issue.parent;
      const labelsConnection = await issue.labels();
      const project = await issue.project;
      const childrenConnection = await issue.children();

      const labelNames = labelsConnection.nodes.map((l) => l.name);
      const projectName = project?.name;

      const children: PlanIssue[] = [];
      for (const child of childrenConnection.nodes) {
        const childState = await child.state;
        const childAssignee = await child.assignee;
        const childLabels = await child.labels();
        const childProject = await child.project;
        children.push({
          id: child.id,
          identifier: child.identifier,
          title: child.title,
          description: child.description ?? undefined,
          status: childState?.name ?? "Unknown",
          sortOrder: child.sortOrder,
          assignee: childAssignee
            ? {
                id: childAssignee.id,
                name: childAssignee.name,
                displayName: childAssignee.displayName,
              }
            : undefined,
          parent: parent
            ? { id: parent.id, identifier: parent.identifier }
            : undefined,
          labels: childLabels.nodes.map((l) => l.name),
          project: childProject?.name,
          children: [],
        });
      }

      // Only include top-level issues (no parent)
      if (!parent) {
        planIssues.push({
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
          labels: labelNames,
          project: projectName,
          children: children.sort((a, b) => a.sortOrder - b.sortOrder),
        });
      }
    }

    // Sort by sortOrder
    return planIssues.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Get an issue by its identifier (e.g., "ENG-123")
   */
  async getIssueByIdentifier(identifier: string): Promise<PlanIssue | null> {
    try {
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
    try {
      const issue = await this.sdk.issue(identifier);
      if (!issue) return null;

      const state = await issue.state;
      const assignee = await issue.assignee;
      const parent = await issue.parent;
      const labelsConnection = await issue.labels();
      const project = await issue.project;
      const childrenConnection = await issue.children();

      // Get relationships via inverse relations
      const relations = await issue.relations();
      const inverseRelations = await issue.inverseRelations();

      // Process blocking relationships
      const blockedBy: PlanIssueDetail["blockedBy"] = [];
      const blocks: PlanIssueDetail["blocks"] = [];

      // Relations where this issue is the source
      for (const rel of relations.nodes) {
        if (rel.type === "blocks") {
          const related = await rel.relatedIssue;
          blocks.push({
            id: related.id,
            identifier: related.identifier,
            title: related.title,
          });
        }
      }

      // Inverse relations where this issue is the target
      for (const rel of inverseRelations.nodes) {
        if (rel.type === "blocks") {
          const source = await rel.issue;
          blockedBy.push({
            id: source.id,
            identifier: source.identifier,
            title: source.title,
          });
        }
      }

      // Process children
      const children: PlanIssue[] = [];
      for (const child of childrenConnection.nodes) {
        const childState = await child.state;
        const childAssignee = await child.assignee;
        const childLabels = await child.labels();
        const childProject = await child.project;
        children.push({
          id: child.id,
          identifier: child.identifier,
          title: child.title,
          description: child.description ?? undefined,
          status: childState?.name ?? "Unknown",
          sortOrder: child.sortOrder,
          assignee: childAssignee
            ? {
                id: childAssignee.id,
                name: childAssignee.name,
                displayName: childAssignee.displayName,
              }
            : undefined,
          parent: { id: issue.id, identifier: issue.identifier },
          labels: childLabels.nodes.map((l) => l.name),
          project: childProject?.name,
          children: [],
        });
      }

      // Calculate position (fetch sibling issues to determine)
      const team = await issue.team;
      const siblingIssues = await this.sdk.issues({
        filter: {
          team: { id: { eq: team.id } },
          parent: { null: true },
          state: { type: { nin: ["completed", "canceled"] } },
        },
      });
      const sortedSiblings = siblingIssues.nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      const position = sortedSiblings.findIndex((i) => i.id === issue.id) + 1;

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description ?? undefined,
        status: state?.name ?? "Unknown",
        sortOrder: issue.sortOrder,
        position: position > 0 ? position : 1,
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
        labels: labelsConnection.nodes.map((l) => l.name),
        project: project?.name,
        children: children.sort((a, b) => a.sortOrder - b.sortOrder),
        blockedBy,
        blocks,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get labels by name for a team
   */
  async getLabelIds(teamId: string, labelNames: string[]): Promise<string[]> {
    const labels = await this.sdk.issueLabels({
      filter: { team: { id: { eq: teamId } } },
    });

    const labelIds: string[] = [];
    for (const name of labelNames) {
      const label = labels.nodes.find(
        (l) => l.name.toLowerCase() === name.toLowerCase()
      );
      if (label) {
        labelIds.push(label.id);
      } else {
        // Try to find workspace-level label (no team filter)
        const workspaceLabels = await this.sdk.issueLabels();
        const workspaceLabel = workspaceLabels.nodes.find(
          (l) => l.name.toLowerCase() === name.toLowerCase()
        );
        if (workspaceLabel) {
          labelIds.push(workspaceLabel.id);
        }
        // If not found, skip silently (or could throw)
      }
    }
    return labelIds;
  }

  /**
   * Get workflow state ID by name for a team
   */
  async getStateId(teamId: string, stateName: string): Promise<string | null> {
    const states = await this.sdk.workflowStates({
      filter: { team: { id: { eq: teamId } } },
    });

    const state = states.nodes.find(
      (s) => s.name.toLowerCase() === stateName.toLowerCase()
    );
    return state?.id ?? null;
  }

  /**
   * Get project by name or ID
   */
  async getProjectId(projectNameOrId: string): Promise<string | null> {
    // Try by ID first
    try {
      const project = await this.sdk.project(projectNameOrId);
      if (project) return project.id;
    } catch {
      // Not a valid ID, try by name
    }

    // Search by name
    const projects = await this.sdk.projects();
    const project = projects.nodes.find(
      (p) => p.name.toLowerCase() === projectNameOrId.toLowerCase()
    );
    return project?.id ?? null;
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
        const me = await this.sdk.viewer;
        input.assigneeId = me.id;
      } else if (options.assignee === "" || options.assignee === "none") {
        input.assigneeId = null;
      } else {
        // Try to find user by name
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

    await this.sdk.createComment({
      issueId: issue.id,
      body,
    });
  }
}
