import { Command } from "commander";
import { $ } from "bun";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

interface Worktree {
  name: string;
  path: string;
  branch: string;
}

interface LinearIssue {
  identifier: string;
  title: string;
  status: string;
}

interface DelegationStatus {
  id: string;
  worktree: "exists" | "missing";
  session: "active" | "idle" | "done" | "error" | "—";
  linear: string;
  lastActivity: string;
  commits: number;
}

async function getWorktrees(): Promise<Worktree[]> {
  try {
    const result = await $`worktree list --json`.quiet().text();
    return JSON.parse(result) as Worktree[];
  } catch {
    return [];
  }
}

async function getSessionStatus(issueId: string): Promise<{ status: DelegationStatus["session"]; lastActivity: string }> {
  // Session path follows pattern: ~/.claude/projects/-workspaces-test-mvp--worktrees-{id}
  const cwd = process.cwd().replace(/\//g, "-");
  const sessionDir = join(homedir(), ".claude", "projects", `${cwd}--worktrees-${issueId}`);

  try {
    const files = await readdir(sessionDir);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

    if (jsonlFiles.length === 0) {
      return { status: "—", lastActivity: "—" };
    }

    // Get most recent session file
    let latestMtime = 0;
    for (const file of jsonlFiles) {
      const fileStat = await stat(join(sessionDir, file));
      if (fileStat.mtimeMs > latestMtime) {
        latestMtime = fileStat.mtimeMs;
      }
    }

    const now = Date.now();
    const ageMs = now - latestMtime;
    const ageMinutes = Math.floor(ageMs / 60000);

    // Determine status based on age
    let status: DelegationStatus["session"];
    if (ageMinutes < 5) {
      status = "active";
    } else {
      status = "idle";
    }

    // Format last activity
    let lastActivity: string;
    if (ageMinutes < 1) {
      lastActivity = "just now";
    } else if (ageMinutes < 60) {
      lastActivity = `${ageMinutes}m ago`;
    } else {
      const hours = Math.floor(ageMinutes / 60);
      lastActivity = `${hours}h ago`;
    }

    return { status, lastActivity };
  } catch {
    return { status: "—", lastActivity: "—" };
  }
}

async function getLinearStatus(issueId: string): Promise<string> {
  try {
    const result = await $`plan show ${issueId} --json`.quiet().text();
    const issue = JSON.parse(result) as LinearIssue;
    return issue.status;
  } catch {
    return "Unknown";
  }
}

async function getCommitCount(issueId: string): Promise<number> {
  try {
    // Count commits on main that mention this issue ID
    const result = await $`git log --oneline --grep=${issueId} origin/main 2>/dev/null | wc -l`.quiet().text();
    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function getDelegationStatuses(): Promise<DelegationStatus[]> {
  const worktrees = await getWorktrees();
  const statuses: DelegationStatus[] = [];

  for (const wt of worktrees) {
    const sessionInfo = await getSessionStatus(wt.name);
    const linearStatus = await getLinearStatus(wt.name);
    const commits = await getCommitCount(wt.name);

    statuses.push({
      id: wt.name,
      worktree: "exists",
      session: sessionInfo.status,
      linear: linearStatus,
      lastActivity: sessionInfo.lastActivity,
      commits,
    });
  }

  return statuses;
}

function formatTable(statuses: DelegationStatus[]): string {
  if (statuses.length === 0) {
    return "No active delegations.";
  }

  // Column widths
  const cols = {
    id: Math.max(10, ...statuses.map((s) => s.id.length)),
    worktree: 8,
    session: 7,
    linear: Math.max(12, ...statuses.map((s) => s.linear.length)),
    lastActivity: 14,
    commits: 7,
  };

  // Header
  const header = [
    "ID".padEnd(cols.id),
    "Worktree".padEnd(cols.worktree),
    "Session".padEnd(cols.session),
    "Linear".padEnd(cols.linear),
    "Last Activity".padEnd(cols.lastActivity),
    "Commits".padEnd(cols.commits),
  ].join("  ");

  // Rows
  const rows = statuses.map((s) =>
    [
      s.id.padEnd(cols.id),
      s.worktree.padEnd(cols.worktree),
      s.session.padEnd(cols.session),
      s.linear.padEnd(cols.linear),
      s.lastActivity.padEnd(cols.lastActivity),
      String(s.commits).padEnd(cols.commits),
    ].join("  ")
  );

  return [header, ...rows].join("\n");
}

export function createStatusCommand(): Command {
  return new Command("status")
    .description("Show active delegations")
    .action(async () => {
      const statuses = await getDelegationStatuses();
      console.log(formatTable(statuses));
    });
}
