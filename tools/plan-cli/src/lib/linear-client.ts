import { LinearClient as LinearSDK } from "@linear/sdk";
import type { PlanIssue, PlanIssueDetail, PlanComment, ListOptions, IssueHistoryEntry } from "../types";
import { MetadataClient } from "./clients/metadata";
import { IssuesClient } from "./clients/issues";
import { RelationsClient } from "./clients/relations";
import { buildIssueFields } from "./utils/graphql-builder";

export interface LinearClientOptions {
  apiKey: string;
}

export class LinearClient {
  private sdk: LinearSDK;
  private _apiCallCount = 0;
  private metadata: MetadataClient;
  private issues: IssuesClient;
  private relations: RelationsClient;

  constructor(options: LinearClientOptions) {
    if (!options.apiKey) {
      throw new Error("LINEAR_API_KEY is required");
    }
    this.sdk = new LinearSDK({ apiKey: options.apiKey });

    // Create bound trackCall function to share with clients
    const trackCall = () => this.trackCall();

    // Initialize specialized clients
    this.metadata = new MetadataClient(this.sdk, trackCall);
    this.issues = new IssuesClient(
      this.sdk,
      this.graphql.bind(this),
      trackCall,
      this.metadata
    );
    this.relations = new RelationsClient(
      this.sdk,
      this.graphql.bind(this),
      trackCall,
      this.issues.getIssueByIdentifier.bind(this.issues)
    );
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

  // ============================================================================
  // Metadata methods - delegated to MetadataClient
  // ============================================================================

  /**
   * Get a team by its key (e.g., "ENG")
   */
  async getTeamByKey(key: string): Promise<{ id: string; key: string; name: string } | null> {
    return this.metadata.getTeamByKey(key);
  }

  /**
   * Get the first available team (for default behavior)
   */
  async getDefaultTeam(): Promise<{ id: string; key: string; name: string } | null> {
    return this.metadata.getDefaultTeam();
  }

  /**
   * Get all available teams (for error messages)
   */
  async getAllTeams(): Promise<Array<{ id: string; key: string; name: string }>> {
    return this.metadata.getAllTeams();
  }

  /**
   * Get current user (viewer) with caching
   */
  async getViewer(): Promise<{ id: string; name: string; displayName: string }> {
    return this.metadata.getViewer();
  }

  /**
   * Get labels by name for a team, with info about missing labels
   */
  async getLabelIds(
    teamId: string,
    labelNames: string[]
  ): Promise<{ ids: string[]; missing: string[] }> {
    return this.metadata.getLabelIds(teamId, labelNames);
  }

  /**
   * Create a new label for a team
   */
  async createLabel(teamId: string, name: string): Promise<{ id: string; name: string }> {
    return this.metadata.createLabel(teamId, name);
  }

  /**
   * Get workflow state ID by name for a team
   */
  async getStateId(teamId: string, stateName: string): Promise<string | null> {
    return this.metadata.getStateId(teamId, stateName);
  }

  /**
   * Get all workflow states for a team (with caching)
   */
  async getStatesForTeam(teamId: string): Promise<Array<{ id: string; name: string; type: string }>> {
    return this.metadata.getStatesForTeam(teamId);
  }

  /**
   * Get all labels for a team (with caching)
   */
  async getLabelsForTeam(teamId: string): Promise<Array<{ id: string; name: string }>> {
    return this.metadata.getLabelsForTeam(teamId);
  }

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<Array<{ id: string; name: string }>> {
    return this.metadata.getAllProjects();
  }

  /**
   * Get workspace-level labels (not team-specific)
   */
  async getWorkspaceLabels(): Promise<Array<{ id: string; name: string }>> {
    return this.metadata.getWorkspaceLabels();
  }

  /**
   * Get project by name or ID
   */
  async getProjectId(projectNameOrId: string): Promise<string | null> {
    return this.metadata.getProjectId(projectNameOrId);
  }

  // ============================================================================
  // Issue methods - delegated to IssuesClient
  // ============================================================================

  /**
   * List issues from Linear with pagination support
   */
  async listIssues(options: ListOptions = {}): Promise<PlanIssue[]> {
    return this.issues.listIssues(options);
  }

  /**
   * Get an issue by its identifier (e.g., "ENG-123")
   */
  async getIssueByIdentifier(identifier: string): Promise<PlanIssue | null> {
    return this.issues.getIssueByIdentifier(identifier);
  }

  /**
   * Get detailed issue info for `plan show` including relationships
   */
  async getIssueDetail(identifier: string): Promise<PlanIssueDetail | null> {
    return this.issues.getIssueDetail(identifier);
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
    return this.issues.createIssue(options);
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
      parentId?: string | null;
      labels?: string[];
      project?: string;
      createMissingLabels?: boolean;
    }
  ): Promise<{ issue: PlanIssue; missingLabels: string[] }> {
    return this.issues.updateIssue(identifier, options);
  }

  /**
   * Remove a label from an issue by name
   */
  async removeLabel(identifier: string, labelName: string): Promise<void> {
    return this.issues.removeLabel(identifier, labelName);
  }

  /**
   * Get all top-level issues with sortOrder for reordering (with pagination)
   */
  async getIssuesForReordering(teamKey?: string): Promise<Array<{
    id: string;
    identifier: string;
    sortOrder: number;
  }>> {
    return this.issues.getIssuesForReordering(teamKey);
  }

  /**
   * Update an issue's sortOrder
   */
  async updateSortOrder(identifier: string, sortOrder: number): Promise<void> {
    return this.issues.updateSortOrder(identifier, sortOrder);
  }

  /**
   * Get comments for an issue by identifier
   */
  async getIssueComments(identifier: string): Promise<PlanComment[]> {
    return this.issues.getIssueComments(identifier);
  }

  /**
   * Get siblings of an issue (issues with same parent)
   */
  async getIssueSiblings(parentIdentifier: string): Promise<Array<{ id: string; identifier: string; title: string; sortOrder: number }>> {
    return this.issues.getIssueSiblings(parentIdentifier);
  }

  /**
   * Get parent issue details
   */
  async getParentIssue(parentIdentifier: string): Promise<{ id: string; identifier: string; title: string } | null> {
    return this.issues.getParentIssue(parentIdentifier);
  }

  /**
   * Search issues using Linear's API filters (server-side search)
   */
  async searchIssues(options: {
    query: string;
    team?: string;
    includeCompleted?: boolean;
    limit?: number;
  }): Promise<PlanIssue[]> {
    return this.issues.searchIssues(options);
  }

  /**
   * Get history entries for an issue
   */
  async getIssueHistory(identifier: string, limit: number = 20): Promise<IssueHistoryEntry[]> {
    return this.issues.getIssueHistory(identifier, limit);
  }

  // ============================================================================
  // Relations methods - delegated to RelationsClient
  // ============================================================================

  /**
   * Add a blocking relationship (this issue blocks another)
   */
  async addBlocking(identifier: string, blocksIdentifier: string): Promise<void> {
    return this.relations.addBlocking(identifier, blocksIdentifier);
  }

  /**
   * Add a blocked-by relationship (this issue is blocked by another)
   */
  async addBlockedBy(identifier: string, blockedByIdentifier: string): Promise<void> {
    return this.relations.addBlockedBy(identifier, blockedByIdentifier);
  }

  /**
   * Remove a blocked-by relationship
   */
  async removeBlockedBy(identifier: string, blockedByIdentifier: string): Promise<void> {
    return this.relations.removeBlockedBy(identifier, blockedByIdentifier);
  }

  /**
   * Add a related-to relationship
   */
  async addRelatedTo(identifier: string, relatedIdentifier: string): Promise<void> {
    return this.relations.addRelatedTo(identifier, relatedIdentifier);
  }

  /**
   * Mark as duplicate of another issue
   */
  async markDuplicateOf(identifier: string, duplicateOfIdentifier: string): Promise<void> {
    return this.relations.markDuplicateOf(identifier, duplicateOfIdentifier);
  }

  /**
   * Add a comment to an issue
   */
  async addComment(identifier: string, body: string): Promise<void> {
    return this.relations.addComment(identifier, body);
  }

  // ============================================================================
  // Exposed for testing - buildIssueFields
  // ============================================================================

  /**
   * Build the issue fields fragment for GraphQL (exposed for testing)
   * @private
   */
  private buildIssueFields(depth: number, currentDepth: number = 0): string {
    return buildIssueFields(depth, currentDepth);
  }
}
