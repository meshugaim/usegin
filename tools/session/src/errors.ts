/**
 * Custom error classes with actionable hints
 *
 * Design principles:
 * - Consistent format: Error message + blank line + suggestions
 * - Actionable: Every error has at least one thing the user can try
 * - Contextual: Include relevant details (file path, search location, etc.)
 * - Concise: 2-3 suggestions max
 *
 * Part of: ENG-1397
 */

/**
 * Base class for all session-related errors
 */
export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// =============================================================================
// SESSION NOT FOUND
// =============================================================================

export interface SessionNotFoundOptions {
  searchedLocation?: string;
}

/**
 * Thrown when a session ID cannot be resolved to a file path
 */
export class SessionNotFoundError extends SessionError {
  public readonly sessionId: string;
  public readonly searchedLocation?: string;

  constructor(sessionId: string, options: SessionNotFoundOptions = {}) {
    const { searchedLocation } = options;

    let message = `Session not found: ${sessionId}`;

    // Add context about where we searched
    if (searchedLocation) {
      message += `\n\nSearched: ${searchedLocation}`;
    }

    // Add actionable suggestions
    message += `\n\nTry:
  session list --all-projects    Search all projects
  session list --since 30d       Include older sessions`;

    super(message);
    this.name = "SessionNotFoundError";
    this.sessionId = sessionId;
    this.searchedLocation = searchedLocation;
  }
}

// =============================================================================
// NO SESSIONS FOUND
// =============================================================================

export interface NoSessionsFoundOptions {
  project?: string;
  allProjects?: boolean;
  since?: string;
}

/**
 * Thrown when session discovery returns empty results
 */
export class NoSessionsFoundError extends SessionError {
  public readonly project?: string;
  public readonly allProjects?: boolean;
  public readonly since?: string;

  constructor(options: NoSessionsFoundOptions = {}) {
    const { project, allProjects, since } = options;

    let message = "No sessions found";

    // Build search context
    const searchContext: string[] = [];
    if (project && !allProjects) {
      searchContext.push(`project: ${project}`);
    }
    if (allProjects) {
      searchContext.push("all projects");
    }
    if (since) {
      searchContext.push(`since: ${since}`);
    }

    if (searchContext.length > 0) {
      message += `\n\nSearched: ${searchContext.join(", ")}`;
    }

    // Build actionable suggestions based on current filters
    const suggestions: string[] = [];

    if (!allProjects) {
      suggestions.push("session list --all-projects    Search all projects");
    }

    if (since) {
      suggestions.push("session list --since 90d       Search further back");
    } else {
      suggestions.push("session list --since 7d        Limit to recent sessions");
    }

    if (suggestions.length > 0) {
      message += `\n\nTry:\n  ${suggestions.join("\n  ")}`;
    }

    super(message);
    this.name = "NoSessionsFoundError";
    this.project = project;
    this.allProjects = allProjects;
    this.since = since;
  }
}

// =============================================================================
// TMUX NOT AVAILABLE
// =============================================================================

/**
 * Thrown when tmux picker method is requested but not available
 */
export class TmuxNotAvailableError extends SessionError {
  constructor() {
    const message = `tmux not available

The session picker requires tmux to display an interactive popup.
You are not currently running inside a tmux session.

To start tmux:
  tmux new-session -s claude

Alternatively:
  Use VS Code: session pick --method vsc
  Use the list command: session list --all-projects`;

    super(message);
    this.name = "TmuxNotAvailableError";
  }
}

// =============================================================================
// PARSING TIMEOUT
// =============================================================================

export interface ParsingTimeoutOptions {
  fileSizeBytes?: number;
  filePath?: string;
}

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Thrown when parsing takes longer than the configured timeout
 */
export class ParsingTimeoutError extends SessionError {
  public readonly timeoutSeconds: number;
  public readonly fileSizeBytes?: number;
  public readonly filePath?: string;

  constructor(timeoutSeconds: number, options: ParsingTimeoutOptions = {}) {
    const { fileSizeBytes, filePath } = options;

    let message = `Parsing timed out after ${timeoutSeconds}s`;

    // Add file context if available
    const context: string[] = [];
    if (filePath) {
      context.push(`File: ${filePath}`);
    }
    if (fileSizeBytes !== undefined) {
      context.push(`Size: ${formatBytes(fileSizeBytes)}`);
    }

    if (context.length > 0) {
      message += `\n\n${context.join("\n")}`;
    }

    // Add actionable suggestions
    message += `\n\nTry:
  --debug         See where parsing is stuck
  --timeout 0     Disable timeout (wait indefinitely)
  --timeout 60    Increase timeout to 60 seconds`;

    super(message);
    this.name = "ParsingTimeoutError";
    this.timeoutSeconds = timeoutSeconds;
    this.fileSizeBytes = fileSizeBytes;
    this.filePath = filePath;
  }
}

// =============================================================================
// NO PICKER METHOD AVAILABLE
// =============================================================================

/**
 * Thrown when no interactive picker method (tmux or vsc) is available
 */
export class NoPickerMethodError extends SessionError {
  constructor() {
    const message = `No session picker method available

The session picker requires an interactive terminal. Choose one:

1. tmux (recommended)
   Run Claude inside a tmux session:
   tmux new-session -s claude

2. VS Code Bridge
   Install the vsc-bridge extension (check: vsc status)

Run with --method to force a specific method:
  session pick --method tmux
  session pick --method vsc`;

    super(message);
    this.name = "NoPickerMethodError";
  }
}
