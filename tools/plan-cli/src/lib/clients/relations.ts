/**
 * Linear relations client - handles issue relationships (blocking, duplicate, related) and comments
 */

import { IssueRelationType } from "@linear/sdk";
import type { LinearClient as LinearSDK } from "@linear/sdk";
import type { PlanIssue } from "../../types";


export class RelationsClient {
  constructor(
    private sdk: LinearSDK,
    private graphql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>,
    private trackCall: () => void,
    private getIssueByIdentifier: (identifier: string) => Promise<PlanIssue | null>
  ) {}

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
      type: IssueRelationType.Blocks,
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
      type: IssueRelationType.Blocks,
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
      type: IssueRelationType.Related,
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
      type: IssueRelationType.Duplicate,
    });
  }

  /**
   * Remove a blocked-by relationship (this issue is no longer blocked by another)
   */
  async removeBlockedBy(identifier: string, blockedByIdentifier: string): Promise<void> {
    const issue = await this.getIssueByIdentifier(identifier);
    const blocker = await this.getIssueByIdentifier(blockedByIdentifier);
    if (!issue) throw new Error(`Issue "${identifier}" not found`);
    if (!blocker) throw new Error(`Issue "${blockedByIdentifier}" not found`);

    // "blocked by" is stored as: blocker --blocks--> issue
    // The blocked issue's inverseRelations contain incoming "blocks" relations.
    const data = await this.graphql<{
      issue: {
        inverseRelations: {
          nodes: Array<{ id: string; type: string; issue: { id: string } }>;
        };
      };
    }>(
      `query($issueId: String!) {
        issue(id: $issueId) {
          inverseRelations {
            nodes { id type issue { id } }
          }
        }
      }`,
      { issueId: issue.id }
    );

    const relation = data.issue.inverseRelations.nodes.find(
      (r) => r.type === "blocks" && r.issue.id === blocker.id
    );
    if (!relation) {
      throw new Error(
        `No blocked-by relationship found: ${identifier} is not blocked by ${blockedByIdentifier}`
      );
    }

    await this.graphql(
      `mutation($id: String!) { issueRelationDelete(id: $id) { success } }`,
      { id: relation.id }
    );
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
}
