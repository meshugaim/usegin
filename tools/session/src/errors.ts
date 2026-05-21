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
// AUTH REQUIRED
// =============================================================================

export type AuthRequiredCause = "missing" | "expired";

export interface AuthRequiredOptions {
  cause: AuthRequiredCause;
}

/**
 * Thrown when a cross-environment session fetch (`fetchSession` →
 * Supabase) can't proceed because Effi credentials are absent or stale.
 *
 * Distinct from `SessionNotFoundError`: the session might exist in
 * another env; we just can't ask. The remediation is always the same —
 * run `effi auth login` — but the message tailors the prose so the user
 * knows whether this is a first-time setup or a refresh.
 *
 * Part of: ENG-5862 step 7
 */
export class AuthRequiredError extends SessionError {
  public readonly sessionId: string;
  public override readonly cause: AuthRequiredCause;

  constructor(sessionId: string, options: AuthRequiredOptions) {
    const { cause } = options;

    let message: string;
    if (cause === "missing") {
      // First-time setup framing — the user has never authed on this
      // machine. Naming the session_id lets them paste it into a bug
      // report; naming `effi auth login` is the load-bearing remedy hint.
      message = `Session ${sessionId} requires authentication to fetch from Supabase.
Run \`effi auth login\` to set up credentials, then retry.`;
    } else {
      // Refresh framing — distinct prose so the user knows it isn't a
      // first-time setup problem (their token aged out or was revoked).
      message = `Session ${sessionId} credentials expired.
Run \`effi auth login\` to refresh, then retry.`;
    }

    super(message);
    this.name = "AuthRequiredError";
    this.sessionId = sessionId;
    this.cause = cause;
  }
}

// =============================================================================
// SUPABASE FETCH (TRANSPORT) FAILURE
// =============================================================================

export interface SupabaseFetchOptions {
  /** HTTP status the Supabase fetch returned (e.g. 400, 503). */
  status: number;
  /** Truncated response-body excerpt (already first-200-chars by the caller). */
  bodyPreview: string;
  /**
   * Optional "partial fetch" note appended verbatim to the message — names
   * what already landed on disk when a mid-subagent-loop failure leaves the
   * parent + N subagents cached. Empty/omitted when nothing partial happened.
   */
  partialNote?: string;
}

/**
 * Thrown when a cross-environment session fetch (`fetchSession` → Supabase)
 * fails at the transport layer — a bogus session id the server rejects with
 * HTTP 400, a 5xx, a body-shape mismatch, a signed-URL download failure, or
 * the env being offline. Distinct from:
 *   - `SessionNotFoundError` (server confirmed the row is nowhere — 404), and
 *   - `AuthRequiredError` (we have no usable credentials to even ask).
 *
 * This is its own class so callers can route on "we couldn't reach / didn't
 * get a usable response from Supabase" without sniffing the message string.
 * `code-history`'s session decorator catches it to degrade gracefully (omit
 * the session enrichment, keep rendering the commit) — a transport hiccup on
 * the optional cross-env fetch must not crash the whole command. Other
 * callers (`resume` / `fork` / `fetch`) still surface `.message` to the user
 * via their `instanceof Error` paths, unchanged.
 *
 * The message format (status + body excerpt + optional partial note) is the
 * user-facing contract pinned by `fetch.supabase.test.ts` — keep the `status`
 * and body excerpt in the prose so retry-worthiness and incident pattern-
 * matching stay possible.
 *
 * Part of: ENG-6137
 */
export class SupabaseFetchError extends SessionError {
  public readonly sessionId: string;
  public readonly status: number;

  constructor(sessionId: string, options: SupabaseFetchOptions) {
    const { status, bodyPreview, partialNote = "" } = options;
    super(
      `Cannot fetch session ${sessionId} from Supabase: server returned ${status}.\n\n${bodyPreview}${partialNote}`,
    );
    this.name = "SupabaseFetchError";
    this.sessionId = sessionId;
    this.status = status;
  }
}

// =============================================================================
// NO SESSIONS FOUND
// =============================================================================

export interface NoSessionsFoundOptions {
  project?: string;
  allProjects?: boolean;
  since?: string;
  projectsDirExists?: boolean; // Whether ~/.claude/projects exists
}

/**
 * Thrown when session discovery returns empty results
 */
export class NoSessionsFoundError extends SessionError {
  public readonly project?: string;
  public readonly allProjects?: boolean;
  public readonly since?: string;
  public readonly projectsDirExists?: boolean;

  constructor(options: NoSessionsFoundOptions = {}) {
    const { project, allProjects, since, projectsDirExists } = options;

    let message = "No sessions found";

    // Special message if the projects directory doesn't exist
    if (projectsDirExists === false) {
      message = `No sessions found

The Claude projects directory does not exist:
  ~/.claude/projects

This usually means Claude Code hasn't been used in this environment yet.
Run Claude Code to create your first session.`;

      // Early return with special message
      super(message);
      this.name = "NoSessionsFoundError";
      this.project = project;
      this.allProjects = allProjects;
      this.since = since;
      this.projectsDirExists = projectsDirExists;
      return;
    }

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
    this.projectsDirExists = projectsDirExists;
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

// =============================================================================
// FZF NOT FOUND
// =============================================================================

/**
 * Detect the current platform for install instructions
 */
function detectPlatform(): "macos" | "linux" | "windows" {
  const platform = process.platform;
  if (platform === "darwin") return "macos";
  if (platform === "win32") return "windows";
  return "linux";
}

/**
 * Thrown when fzf is not installed
 */
export class FzfNotFoundError extends SessionError {
  constructor() {
    const platform = detectPlatform();

    let installInstructions: string;
    switch (platform) {
      case "macos":
        installInstructions = `Install fzf:
  brew install fzf`;
        break;
      case "windows":
        installInstructions = `Install fzf:
  choco install fzf
  # or
  scoop install fzf`;
        break;
      case "linux":
      default:
        installInstructions = `Install fzf:
  apt install fzf        # Debian/Ubuntu
  dnf install fzf        # Fedora
  pacman -S fzf          # Arch`;
        break;
    }

    const message = `fzf not found

The session finder requires fzf for interactive browsing.

${installInstructions}

Alternatively, use non-interactive commands:
  session list           # List sessions without fzf
  session <id>           # Parse a specific session`;

    super(message);
    this.name = "FzfNotFoundError";
  }
}
