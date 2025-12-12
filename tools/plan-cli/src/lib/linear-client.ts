import { LinearClient as LinearSDK } from "@linear/sdk";
import type { PlanIssue, ListOptions } from "../types";

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

    // Fetch issues
    const issues = await this.sdk.issues({
      filter,
      orderBy: LinearSDK.prototype.constructor.name ? undefined : undefined, // Placeholder
    });

    // Transform to PlanIssue format
    const planIssues: PlanIssue[] = [];

    for (const issue of issues.nodes) {
      const state = await issue.state;
      const assignee = await issue.assignee;
      const parent = await issue.parent;
      const childrenConnection = await issue.children();

      const children: PlanIssue[] = [];
      for (const child of childrenConnection.nodes) {
        const childState = await child.state;
        const childAssignee = await child.assignee;
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
          children: children.sort((a, b) => a.sortOrder - b.sortOrder),
        });
      }
    }

    // Sort by sortOrder
    return planIssues.sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
