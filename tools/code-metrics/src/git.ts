// Git analysis utilities
import { $ } from "bun";

export interface FileCommit {
  file: string;
  hash: string;
  author: string;
  date: Date;
  message: string;
}

export interface FileInfo {
  file: string;
  exists: boolean;
  lines: number;
}

/**
 * Get all commits for all files in the repository
 */
export async function getAllFileCommits(): Promise<Map<string, FileCommit[]>> {
  const result = await $`git log --name-only --pretty=format:%H%x00%an%x00%ad%x00%s --date=iso-strict --all`.quiet();

  const fileCommits = new Map<string, FileCommit[]>();
  const lines = result.stdout.toString().split("\n");

  let currentCommit: { hash: string; author: string; date: Date; message: string } | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Check if this is a commit header (contains null bytes)
    if (line.includes("\x00")) {
      const [hash, author, date, message] = line.split("\x00");
      currentCommit = {
        hash,
        author,
        date: new Date(date),
        message,
      };
    } else if (currentCommit) {
      // This is a file path
      const file = line.trim();
      if (!file) continue;

      if (!fileCommits.has(file)) {
        fileCommits.set(file, []);
      }

      fileCommits.get(file)!.push({
        file,
        ...currentCommit,
      });
    }
  }

  return fileCommits;
}

/**
 * Get line count for a file
 */
export async function getLineCount(file: string): Promise<number> {
  try {
    const result = await $`wc -l ${file}`.quiet().nothrow();
    if (result.exitCode !== 0) return 0;

    const match = result.stdout.toString().match(/^\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Get file info (existence and line count)
 */
export async function getFileInfo(files: string[]): Promise<Map<string, FileInfo>> {
  const info = new Map<string, FileInfo>();

  for (const file of files) {
    const exists = await Bun.file(file).exists();
    const lines = exists ? await getLineCount(file) : 0;

    info.set(file, { file, exists, lines });
  }

  return info;
}

/**
 * Check if a commit message indicates a bug fix
 */
export function isBugFix(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("fix") ||
    lower.includes("bug") ||
    lower.includes("hotfix") ||
    lower.includes("patch") ||
    lower.match(/\bfixes?\b/) !== null
  );
}

/**
 * Get unique authors for files
 */
export function getUniqueAuthors(commits: FileCommit[]): Set<string> {
  return new Set(commits.map((c) => c.author));
}

/**
 * Calculate recency weight for a commit
 * More recent commits get higher weight
 */
export function getRecencyWeight(commitDate: Date, now: Date = new Date()): number {
  const daysSince = (now.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24);

  // Exponential decay: weight halves every 90 days
  const halfLife = 90;
  return Math.pow(0.5, daysSince / halfLife);
}
