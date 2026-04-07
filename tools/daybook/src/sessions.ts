import { runLines } from "./shell";

export interface SessionInfo {
  id: string;
  date: string;
  path: string;
  source: "local" | "remote";
  username?: string;
}

/**
 * Collect sessions for a given date using the session CLI.
 */
export async function collectSessions(
  dateStr: string,
  includeRemote: boolean
): Promise<SessionInfo[]> {
  const baseArgs = ["session", "list", "--since", "7d", "-n", "100", "--output", "json"];
  const remoteArgs = includeRemote ? ["--remote"] : [];

  const lines = await runLines([...baseArgs, ...remoteArgs]);
  const sessions: SessionInfo[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const entryDate = entry.date?.slice(0, 10) ?? "";
      const pathDate = extractDateFromPath(entry.path ?? "");

      if (entryDate === dateStr || pathDate === dateStr) {
        sessions.push({
          id: entry.id,
          date: entry.date,
          path: entry.path,
          source: entry.source === "remote" ? "remote" : "local",
          username: entry.username,
        });
      }
    } catch {
      // skip malformed lines
    }
  }

  return sessions;
}

function extractDateFromPath(path: string): string {
  const match = path.match(/(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}
