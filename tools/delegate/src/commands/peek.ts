import { Command } from "commander";
import { $ } from "bun";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

interface SessionInfo {
  path: string;
  mtime: number;
}

/**
 * Get the Claude project directory for a given issue ID
 */
function getProjectDir(issueId: string): string {
  // Handle both numeric IDs (424) and full IDs (ENG-424)
  const id = issueId.replace(/^ENG-/i, "");
  const cwd = process.cwd().replace(/\.worktrees\/\d+\/?$/, "").replace(/\/$/, "");
  const cwdEncoded = cwd.replace(/\//g, "-");
  return join(homedir(), ".claude", "projects", `${cwdEncoded}--worktrees-${id}`);
}

/**
 * Find the most recent main session file (excludes agent-*.jsonl subagent files)
 */
async function findMainSession(projectDir: string): Promise<SessionInfo | null> {
  try {
    const files = await readdir(projectDir);
    const mainSessions = files.filter(
      (f) => f.endsWith(".jsonl") && !f.startsWith("agent-")
    );

    if (mainSessions.length === 0) {
      return null;
    }

    let latest: SessionInfo | null = null;
    for (const file of mainSessions) {
      const filePath = join(projectDir, file);
      const fileStat = await stat(filePath);
      if (!latest || fileStat.mtimeMs > latest.mtime) {
        latest = { path: filePath, mtime: fileStat.mtimeMs };
      }
    }

    return latest;
  } catch {
    return null;
  }
}

/**
 * Format a timestamp as relative time
 */
function formatRelativeTime(mtime: number): string {
  const now = Date.now();
  const ageMs = now - mtime;
  const ageMinutes = Math.floor(ageMs / 60000);

  if (ageMinutes < 1) {
    return "just now";
  } else if (ageMinutes < 60) {
    return `${ageMinutes}m ago`;
  } else {
    const hours = Math.floor(ageMinutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
  }
}

export function createPeekCommand(): Command {
  return new Command("peek")
    .description("Show recent agent activity summary")
    .argument("<issue-id>", "Issue ID (e.g., 424 or ENG-424)")
    .option("-n, --lines <n>", "Number of lines to show", "50")
    .option("--tool-input", "Include tool call inputs")
    .option("--tool-output", "Include tool results")
    .action(async (issueId: string, options: { lines: string; toolInput?: boolean; toolOutput?: boolean }) => {
      const projectDir = getProjectDir(issueId);
      const session = await findMainSession(projectDir);

      if (!session) {
        console.error(`No session found for issue ${issueId}`);
        console.error(`Looked in: ${projectDir}`);
        process.exit(1);
      }

      const lastActivity = formatRelativeTime(session.mtime);
      console.log(`Session: ${session.path}`);
      console.log(`Last activity: ${lastActivity}`);
      console.log("---\n");

      // Build session-parser command
      const args = [session.path];
      if (options.toolInput) {
        args.push("--tool-input");
      }
      if (options.toolOutput) {
        args.push("--tool-output");
      }

      try {
        // Parse the session and show last N lines
        const result = await $`session-parser ${args}`.quiet().text();
        const lines = result.trim().split("\n");
        const numLines = parseInt(options.lines, 10) || 50;
        const lastLines = lines.slice(-numLines);
        console.log(lastLines.join("\n"));
      } catch (error) {
        console.error("Failed to parse session:", error);
        process.exit(1);
      }
    });
}
