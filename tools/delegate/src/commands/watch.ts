import { Command } from "commander";
import { spawn } from "child_process";
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

export function createWatchCommand(): Command {
  return new Command("watch")
    .description("Stream agent session in real-time")
    .argument("<issue-id>", "Issue ID (e.g., 424 or ENG-424)")
    .action(async (issueId: string) => {
      const projectDir = getProjectDir(issueId);
      const session = await findMainSession(projectDir);

      if (!session) {
        console.error(`No session found for issue ${issueId}`);
        console.error(`Looked in: ${projectDir}`);
        process.exit(1);
      }

      console.log(`Watching: ${session.path}`);
      console.log("Press Ctrl+C to stop\n");
      console.log("---\n");

      // Use tail -f piped to session --stream
      const tail = spawn("tail", ["-f", session.path], {
        stdio: ["ignore", "pipe", "inherit"],
      });

      const parser = spawn("session", ["--stream"], {
        stdio: ["pipe", "inherit", "inherit"],
      });

      tail.stdout.pipe(parser.stdin);

      // Handle cleanup
      const cleanup = () => {
        tail.kill();
        parser.kill();
        process.exit(0);
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      // Wait for processes to exit
      await Promise.all([
        new Promise<void>((resolve) => tail.on("close", resolve)),
        new Promise<void>((resolve) => parser.on("close", resolve)),
      ]);
    });
}
