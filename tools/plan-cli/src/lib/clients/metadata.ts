/**
 * Linear metadata client - handles teams, projects, labels, and workflow states
 */

import type { LinearClient as LinearSDK } from "@linear/sdk";
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
} from "../cache";

export class MetadataClient {
  constructor(
    private sdk: LinearSDK,
    private trackCall: () => void
  ) {}

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
   * Get all available teams (for error messages)
   */
  async getAllTeams(): Promise<Array<{ id: string; key: string; name: string }>> {
    this.trackCall();
    const teams = await this.sdk.teams();
    return teams.nodes.map((t) => ({ id: t.id, key: t.key, name: t.name }));
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
   * Get labels by name for a team, with info about missing labels
   */
  async getLabelIds(
    teamId: string,
    labelNames: string[]
  ): Promise<{ ids: string[]; missing: string[] }> {
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
    const missing: string[] = [];

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
        } else {
          missing.push(name);
        }
      }
    }
    return { ids: labelIds, missing };
  }

  /**
   * Create a new label for a team
   */
  async createLabel(teamId: string, name: string): Promise<{ id: string; name: string }> {
    this.trackCall();
    const result = await this.sdk.createIssueLabel({
      teamId,
      name,
    });
    const label = await result.issueLabel;
    if (!label) {
      throw new Error(`Failed to create label "${name}"`);
    }

    // Invalidate cache
    await setCachedLabels(teamId, null as unknown as Array<{ id: string; name: string }>);

    return { id: label.id, name: label.name };
  }

  /**
   * Get workflow state ID by name for a team
   */
  async getStateId(teamId: string, stateName: string): Promise<string | null> {
    const states = await this.getStatesForTeam(teamId);
    const state = states.find(
      (s) => s.name.toLowerCase() === stateName.toLowerCase()
    );
    return state?.id ?? null;
  }

  /**
   * Get all workflow states for a team (with caching)
   */
  async getStatesForTeam(teamId: string): Promise<Array<{ id: string; name: string; type: string }>> {
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

    return states;
  }

  /**
   * Get all labels for a team (with caching)
   */
  async getLabelsForTeam(teamId: string): Promise<Array<{ id: string; name: string }>> {
    let teamLabels = await getCachedLabels(teamId);

    if (!teamLabels) {
      this.trackCall();
      const result = await this.sdk.issueLabels({
        filter: { team: { id: { eq: teamId } } },
      });
      teamLabels = result.nodes.map((l) => ({ id: l.id, name: l.name }));
      await setCachedLabels(teamId, teamLabels);
    }

    return teamLabels;
  }

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<Array<{ id: string; name: string }>> {
    this.trackCall();
    const projects = await this.sdk.projects();
    return projects.nodes.map((p) => ({ id: p.id, name: p.name }));
  }

  /**
   * Get workspace-level labels (not team-specific)
   */
  async getWorkspaceLabels(): Promise<Array<{ id: string; name: string }>> {
    let workspaceLabels = await getCachedLabels("_workspace");

    if (!workspaceLabels) {
      this.trackCall();
      const result = await this.sdk.issueLabels();
      workspaceLabels = result.nodes.map((l) => ({ id: l.id, name: l.name }));
      await setCachedLabels("_workspace", workspaceLabels);
    }

    return workspaceLabels;
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
}
