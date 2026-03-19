/**
 * Git commit discovery for Claude Code sessions.
 *
 * Three-tier resolution strategy (most precise to broadest):
 * 1. **SHA-based** — exact commits extracted from session Bash tool output
 * 2. **Trailer-based** — commits tagged with "Claude-Session: <id>" trailer
 * 3. **Time-window** — all commits within the session's time range
 *
 * Design:
 * - Uses `Bun.spawn` to run `git log` with structured delimiters
 * - Parsing is separated into a pure function (`parseGitLogOutput`) for testability
 * - Graceful degradation: returns empty array if not a git repo, git not installed, etc.
 * - Small time buffer added to endTime to catch commits at session boundaries
 */

// ============================================================================
// TYPES
// ============================================================================

export interface GitCommit {
  /** Full 40-character SHA hash */
  hash: string;
  /** 7-character abbreviated hash */
  shortHash: string;
  /** First line of the commit message */
  subject: string;
  /** Author name */
  authorName: string;
  /** Author email */
  authorEmail: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Number of files changed (from --shortstat) */
  filesChanged?: number;
  /** Lines added (from --shortstat) */
  insertions?: number;
  /** Lines removed (from --shortstat) */
  deletions?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Sentinel lines that bracket each commit in structured output */
const COMMIT_START = "---COMMIT_START---";
const COMMIT_END = "---COMMIT_END---";

/**
 * Buffer added to endTime to catch commits that happen right at session end.
 * 60 seconds is generous enough to cover clock skew and delayed commits.
 */
const END_TIME_BUFFER_MS = 60_000;

/**
 * The git log format string using sentinel delimiters.
 *
 * Fields (one per line between sentinels):
 *   %H  - full hash
 *   %h  - abbreviated hash
 *   %s  - subject (first line of message)
 *   %aN - author name (respects .mailmap)
 *   %aE - author email (respects .mailmap)
 *   %aI - author date in strict ISO 8601 format
 */
const GIT_LOG_FORMAT = `${COMMIT_START}%n%H%n%h%n%s%n%aN%n%aE%n%aI%n${COMMIT_END}`;

// ============================================================================
// PARSING (pure, testable)
// ============================================================================

/**
 * Parse the structured output of `git log --format=... --shortstat`.
 *
 * The output alternates between commit blocks (delimited by sentinels)
 * and optional shortstat lines. A shortstat line looks like:
 *
 *   " 3 files changed, 10 insertions(+), 2 deletions(-)"
 *
 * Some commits (e.g., merge commits with no diff) have no shortstat line.
 *
 * @param raw - The raw stdout from `git log`
 * @returns Parsed commits sorted by timestamp ascending
 */
export function parseGitLogOutput(raw: string): GitCommit[] {
  if (!raw.trim()) return [];

  const commits: GitCommit[] = [];
  const lines = raw.split("\n");

  let i = 0;
  while (i < lines.length) {
    // Scan forward to the next COMMIT_START
    if (lines[i]!.trim() !== COMMIT_START) {
      i++;
      continue;
    }

    // We found a COMMIT_START. The next 6 lines should be the fields,
    // followed by COMMIT_END.
    const startIdx = i + 1;
    const endIdx = startIdx + 6; // COMMIT_END should be at this index

    // Bounds check: need at least 7 more lines (6 fields + COMMIT_END)
    if (endIdx >= lines.length) break;

    if (lines[endIdx]!.trim() !== COMMIT_END) {
      // Malformed block — skip this COMMIT_START and keep scanning
      i++;
      continue;
    }

    const hash = lines[startIdx]!.trim();
    const shortHash = lines[startIdx + 1]!.trim();
    const subject = lines[startIdx + 2]!.trim();
    const authorName = lines[startIdx + 3]!.trim();
    const authorEmail = lines[startIdx + 4]!.trim();
    const timestamp = lines[startIdx + 5]!.trim();

    // Validate: hash should be 40 hex chars
    if (!/^[0-9a-f]{40}$/i.test(hash)) {
      i = endIdx + 1;
      continue;
    }

    const commit: GitCommit = {
      hash,
      shortHash,
      subject,
      authorName,
      authorEmail,
      timestamp,
    };

    // Look for an optional shortstat line after COMMIT_END.
    // It may be preceded by blank lines.
    let statIdx = endIdx + 1;
    while (statIdx < lines.length && lines[statIdx]!.trim() === "") {
      statIdx++;
    }

    if (statIdx < lines.length) {
      const statLine = lines[statIdx]!.trim();
      const diffStats = parseShortstat(statLine);
      if (diffStats) {
        commit.filesChanged = diffStats.filesChanged;
        commit.insertions = diffStats.insertions;
        commit.deletions = diffStats.deletions;
        // Advance past the stat line
        i = statIdx + 1;
      } else {
        // Not a stat line — it's the next commit or something else
        i = endIdx + 1;
      }
    } else {
      i = endIdx + 1;
    }

    commits.push(commit);
  }

  // Sort by timestamp ascending (git log defaults to newest-first)
  commits.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return commits;
}

/**
 * Parse a single `--shortstat` line.
 *
 * Examples:
 *   " 3 files changed, 10 insertions(+), 2 deletions(-)"
 *   " 1 file changed, 5 insertions(+)"
 *   " 2 files changed, 3 deletions(-)"
 *
 * Returns undefined if the line doesn't match the expected pattern.
 */
function parseShortstat(
  line: string
): { filesChanged: number; insertions: number; deletions: number } | undefined {
  const filesMatch = /(\d+) files? changed/.exec(line);
  if (!filesMatch) return undefined;

  const insertionsMatch = /(\d+) insertions?\(\+\)/.exec(line);
  const deletionsMatch = /(\d+) deletions?\(-\)/.exec(line);

  return {
    filesChanged: parseInt(filesMatch[1]!, 10),
    insertions: insertionsMatch ? parseInt(insertionsMatch[1]!, 10) : 0,
    deletions: deletionsMatch ? parseInt(deletionsMatch[1]!, 10) : 0,
  };
}

// ============================================================================
// GIT LOG EXECUTION
// ============================================================================

/**
 * Add a time buffer to an ISO 8601 timestamp string.
 *
 * @param isoTime - ISO 8601 timestamp
 * @param bufferMs - Milliseconds to add
 * @returns New ISO 8601 timestamp string with the buffer applied
 */
function addBuffer(isoTime: string, bufferMs: number): string {
  const date = new Date(isoTime);
  date.setTime(date.getTime() + bufferMs);
  return date.toISOString();
}

/**
 * Query git history for commits within a session's time window.
 *
 * Runs `git log` with `--after`/`--before` flags and structured output format.
 * Returns an empty array gracefully if:
 * - The directory is not a git repository
 * - git is not installed
 * - The time window is invalid
 * - Any other error occurs
 *
 * @param options.cwd - Working directory (should be inside a git repo)
 * @param options.startTime - Session start time (ISO 8601)
 * @param options.endTime - Session end time (ISO 8601)
 * @returns Commits within the time window, sorted by timestamp ascending
 */
export async function getCommitsFromGitHistory(options: {
  cwd: string;
  startTime: string;
  endTime: string;
}): Promise<GitCommit[]> {
  const { cwd, startTime, endTime } = options;

  // Validate inputs
  if (!cwd || !startTime || !endTime) return [];

  const afterDate = new Date(startTime);
  const beforeDate = new Date(endTime);
  if (Number.isNaN(afterDate.getTime()) || Number.isNaN(beforeDate.getTime())) {
    return [];
  }

  // Add buffer to endTime to catch boundary commits
  const bufferedEndTime = addBuffer(endTime, END_TIME_BUFFER_MS);

  try {
    const proc = Bun.spawn(
      [
        "git",
        "log",
        "--all",
        `--after=${startTime}`,
        `--before=${bufferedEndTime}`,
        `--format=${GIT_LOG_FORMAT}`,
        "--shortstat",
      ],
      {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    // Non-zero exit typically means not a git repo or other git error
    if (exitCode !== 0) return [];

    return parseGitLogOutput(stdout);
  } catch {
    // git not installed, spawn failed, directory doesn't exist, etc.
    return [];
  }
}

/**
 * Get commits by their SHA hashes.
 *
 * Uses `git log --no-walk` with the same structured format as other strategies,
 * providing a single efficient command for all SHAs. This is the most precise
 * strategy — it returns exactly the commits requested, nothing more.
 *
 * Gracefully handles:
 * - Non-existent SHAs (amended/rebased away): skipped silently
 * - Empty SHA list: returns []
 * - Non-git directory: returns []
 * - Mix of valid and invalid SHAs: returns only the valid ones
 *
 * @param options.cwd - Working directory (should be inside a git repo)
 * @param options.shas - Array of commit SHAs (short 7-char or full 40-char)
 * @returns Enriched commits for the valid SHAs, sorted by timestamp ascending
 */
export async function getCommitsBySha(options: {
  cwd: string;
  shas: string[];
}): Promise<GitCommit[]> {
  const { cwd, shas } = options;

  if (!cwd || shas.length === 0) return [];

  // Deduplicate input SHAs to avoid redundant git lookups
  const uniqueShas = [...new Set(shas)];

  // Filter out obviously invalid SHAs (must be hex strings of reasonable length)
  const validShas = uniqueShas.filter((sha) => /^[0-9a-f]{7,40}$/i.test(sha));
  if (validShas.length === 0) return [];

  try {
    // --no-walk treats each SHA as a standalone commit (no traversal),
    // so we get exactly the commits we asked for
    const proc = Bun.spawn(
      [
        "git",
        "log",
        "--no-walk",
        `--format=${GIT_LOG_FORMAT}`,
        "--shortstat",
        ...validShas,
      ],
      {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    // git log --no-walk exits with 0 even when some SHAs are missing —
    // it just skips them. But if ALL SHAs are bad or the repo is invalid,
    // it may exit non-zero.
    if (exitCode !== 0) {
      // Try individual SHAs as a fallback: some may be valid while
      // the batch command fails because one bad SHA poisons the whole run
      return getCommitsByShaIndividually({ cwd, shas: validShas });
    }

    return parseGitLogOutput(stdout);
  } catch {
    return [];
  }
}

/**
 * Fallback: try each SHA individually when the batch command fails.
 * This handles the case where one bad SHA causes `git log --no-walk` to
 * exit non-zero, but other SHAs in the list are valid.
 */
async function getCommitsByShaIndividually(options: {
  cwd: string;
  shas: string[];
}): Promise<GitCommit[]> {
  const { cwd, shas } = options;
  const commits: GitCommit[] = [];

  for (const sha of shas) {
    try {
      const proc = Bun.spawn(
        [
          "git",
          "log",
          "--no-walk",
          `--format=${GIT_LOG_FORMAT}`,
          "--shortstat",
          sha,
        ],
        {
          cwd,
          stdout: "pipe",
          stderr: "pipe",
        }
      );

      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode === 0) {
        commits.push(...parseGitLogOutput(stdout));
      }
      // Non-zero exit for this SHA: skip it silently
    } catch {
      // Skip this SHA silently
    }
  }

  // Sort by timestamp ascending (same as parseGitLogOutput)
  commits.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return commits;
}

/**
 * Get commits tagged with a Claude-Session trailer for a specific session.
 * Uses git log --grep to find commits with "Claude-Session: <sessionId>" in the message.
 * Falls back to empty array on any error.
 */
export async function getCommitsByTrailer(options: {
  cwd: string;
  sessionId: string;
}): Promise<GitCommit[]> {
  const { cwd, sessionId } = options;
  if (!cwd || !sessionId) return [];

  try {
    const proc = Bun.spawn(
      [
        "git", "log", "--all",
        `--grep=Claude-Session: ${sessionId}`,
        `--format=${GIT_LOG_FORMAT}`,
        "--shortstat",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" }
    );

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) return [];

    return parseGitLogOutput(stdout);
  } catch {
    return [];
  }
}

/**
 * Get session commits using a three-tier resolution strategy.
 *
 * Resolution order (most precise to broadest):
 * 1. **SHA-based** — exact commits extracted from session Bash output
 * 2. **Trailer-based** — commits tagged with "Claude-Session: <id>"
 * 3. **Time-window** — all commits within the session's time range
 *
 * Each strategy falls through to the next if it returns no results.
 */
export async function getSessionCommits(options: {
  cwd: string;
  sessionId: string;
  startTime?: string;
  endTime?: string;
  shas?: string[];
}): Promise<GitCommit[]> {
  const { cwd, sessionId, startTime, endTime, shas } = options;

  // 1. SHA-based (most precise): exact commits from this session's Bash output
  if (shas && shas.length > 0) {
    const shaCommits = await getCommitsBySha({ cwd, shas });
    if (shaCommits.length > 0) return shaCommits;
  }

  // 2. Trailer-based (session-scoped): commits with Claude-Session trailer
  const trailerCommits = await getCommitsByTrailer({ cwd, sessionId });
  if (trailerCommits.length > 0) return trailerCommits;

  // 3. Time-window (broadest fallback): all commits in the time range
  if (startTime && endTime) {
    return getCommitsFromGitHistory({ cwd, startTime, endTime });
  }

  return [];
}
