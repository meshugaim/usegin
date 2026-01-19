import { $ } from "bun";

/**
 * Issue details from Linear
 */
export interface IssueDetails {
  id: string;
  title: string;
  description: string;
  status: string;
}

/**
 * Result of creating a slice issue
 */
export interface CreateSliceResult {
  issueId: string;
}

/**
 * Options for creating a slice issue
 */
export interface CreateSliceOptions {
  independent?: boolean;
}

/**
 * Dependency injection for Linear operations
 */
export interface LinearDeps {
  planShow: (issueId: string) => Promise<{ exitCode: number; stdout: string; stderr?: string }>;
  planCreate: (
    title: string,
    options: { parent?: string; description?: string }
  ) => Promise<{ exitCode: number; stdout: string; issueId?: string }>;
  planUpdate: (
    issueId: string,
    description: string
  ) => Promise<{ exitCode: number; stderr?: string }>;
}

/**
 * Default implementation using actual plan CLI
 */
export function createDefaultLinearDeps(): LinearDeps {
  return {
    planShow: async (issueId: string) => {
      const result = await $`plan show ${issueId} --json`.nothrow();
      return {
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
      };
    },
    planCreate: async (title: string, options) => {
      const args = ["plan", "create", title];
      if (options.parent) {
        args.push("--parent", options.parent);
      }
      if (options.description) {
        // Write description to temp file for --description-file
        const tmpFile = `/tmp/team-create-${Date.now()}.md`;
        await Bun.write(tmpFile, options.description);
        args.push("--description-file", tmpFile);
      }

      const result = await $`${args}`.nothrow();
      const stdout = result.stdout.toString();

      // Parse issue ID from output like "Created: ENG-123 - title"
      const match = stdout.match(/Created:\s+([A-Z]+-\d+)/);
      const issueId = match ? match[1] : undefined;

      return {
        exitCode: result.exitCode,
        stdout,
        issueId,
      };
    },
    planUpdate: async (issueId: string, description: string) => {
      // Write description to temp file
      const tmpFile = `/tmp/team-update-${issueId}-${Date.now()}.md`;
      await Bun.write(tmpFile, description);

      const result = await $`plan update ${issueId} --description-file ${tmpFile}`.nothrow();
      return {
        exitCode: result.exitCode,
        stderr: result.stderr.toString(),
      };
    },
  };
}

/**
 * Get issue details from Linear
 */
export async function getIssueDetails(
  issueId: string,
  deps: LinearDeps
): Promise<IssueDetails> {
  const result = await deps.planShow(issueId);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to fetch issue ${issueId}: ${result.stderr || "Unknown error"}`);
  }

  const issue = JSON.parse(result.stdout);
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description || "",
    status: issue.status || "Unknown",
  };
}

/**
 * Create a slice sub-issue in Linear
 */
export async function createSliceIssue(
  parentIssueId: string,
  title: string,
  description: string,
  deps: LinearDeps,
  options: CreateSliceOptions = {}
): Promise<CreateSliceResult> {
  // Add independence marker to description
  const independenceMarker = options.independent
    ? "\n\n**Independent:** Yes - Can be developed in parallel with other slices"
    : "\n\n**Independent:** No - Depends on previous slices";

  const fullDescription = description + independenceMarker;

  const result = await deps.planCreate(title, {
    parent: parentIssueId,
    description: fullDescription,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to create slice issue: ${result.stdout}`);
  }

  if (!result.issueId) {
    throw new Error(`Failed to parse issue ID from create output: ${result.stdout}`);
  }

  return {
    issueId: result.issueId,
  };
}

/**
 * Update issue description in Linear
 */
export async function updateIssueDescription(
  issueId: string,
  description: string,
  deps: LinearDeps
): Promise<void> {
  const result = await deps.planUpdate(issueId, description);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to update issue ${issueId}: ${result.stderr || "Unknown error"}`);
  }
}
