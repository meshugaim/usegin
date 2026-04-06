import { execSync } from "child_process";

export type PlanMeta = {
  created_by_session?: string;
  created_by_actor?: string;
  created_at?: string;
  last_session?: string;
  last_actor?: string;
  updated_at?: string;
  sessions?: string[];
};

const META_REGEX = /\n?<!-- plan:meta\n([\s\S]*?)\n-->\s*$/;

const FIELD_ORDER = [
  "created_by_session",
  "created_by_actor",
  "created_at",
  "last_session",
  "last_actor",
  "updated_at",
  "sessions",
] as const;

const QUOTED_FIELDS = new Set(["created_at", "updated_at"]);
const VALID_SCALAR_FIELDS = new Set<string>(FIELD_ORDER.filter(f => f !== "sessions"));

export function parseMeta(description: string): {
  description: string;
  meta: PlanMeta | null;
} {
  if (description == null) return { description: "", meta: null };

  const match = description.match(META_REGEX);
  if (!match) return { description, meta: null };

  const cleanDescription = description.slice(0, match.index!).replace(/\n+$/, "");
  const yamlBody = match[1];

  try {
    const meta: PlanMeta = {};
    const lines = yamlBody.split("\n");
    let inSessions = false;
    let sessionsList: string[] | undefined;

    for (const line of lines) {
      if (inSessions && line.match(/^\s+-\s+/)) {
        const value = line.replace(/^\s+-\s+/, "").trim();
        sessionsList!.push(stripQuotes(value));
        continue;
      }
      inSessions = false;

      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const key = line.slice(0, colonIdx).trim();
      const rawValue = line.slice(colonIdx + 1).trim();

      if (key === "sessions") {
        if (rawValue) {
          // Inline comma-separated format: sessions: id1, id2, id3
          sessionsList = rawValue.split(",").map(s => stripQuotes(s.trim())).filter(Boolean);
        } else {
          // YAML list format (legacy): sessions:\n  - id1\n  - id2
          inSessions = true;
          sessionsList = [];
        }
        continue;
      }

      if (VALID_SCALAR_FIELDS.has(key)) {
        (meta as any)[key] = stripQuotes(rawValue);
      }
    }

    if (sessionsList !== undefined) {
      meta.sessions = sessionsList;
    }

    if (Object.keys(meta).length === 0) return { description: cleanDescription, meta: null };

    return { description: cleanDescription, meta };
  } catch {
    return { description: cleanDescription, meta: null };
  }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function serializeMeta(meta: PlanMeta): string {
  const lines: string[] = ["<!-- plan:meta"];

  for (const field of FIELD_ORDER) {
    const value = meta[field];
    if (value == null) continue;

    if (field === "sessions") {
      const arr = value as string[];
      if (arr.length === 0) continue;
      // Use comma-separated inline format to avoid Linear markdown mangling
      // (Linear converts `  - item` YAML lists into `* item` markdown lists)
      lines.push(`sessions: ${arr.join(", ")}`);
      continue;
    }

    const strValue = value as string;
    if (QUOTED_FIELDS.has(field)) {
      lines.push(`${field}: "${strValue}"`);
    } else {
      lines.push(`${field}: ${strValue}`);
    }
  }

  lines.push("-->");
  return lines.join("\n");
}

export function attachMeta(description: string, meta: PlanMeta): string {
  const block = serializeMeta(meta);
  if (description === "") return block;
  return `${description}\n\n${block}`;
}

// Cache the resolved actor for the lifetime of the process
let cachedActor: string | null = null;

/**
 * Resolve the current actor identity.
 * Claude sessions: "claude:<first-8-chars-of-session-id>"
 * Humans: "gh:<github-login>" or "gh:<git-user-name>"
 * Fallback: "unknown"
 */
export function getActor(): string {
  if (cachedActor) return cachedActor;

  const sessionId = process.env.CLAUDE_SESSION_ID;
  if (sessionId) {
    cachedActor = `claude:${sessionId.slice(0, 8)}`;
    return cachedActor;
  }

  try {
    const email = execSync("git config user.email", { encoding: "utf-8" }).trim();
    const ghMatch = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/);
    if (ghMatch) {
      cachedActor = `gh:${ghMatch[1]}`;
      return cachedActor;
    }
  } catch {
    // git not available or no config
  }

  try {
    const name = execSync("git config user.name", { encoding: "utf-8" }).trim();
    if (name) {
      cachedActor = `gh:${name}`;
      return cachedActor;
    }
  } catch {
    // git not available
  }

  cachedActor = "unknown";
  return cachedActor;
}

/**
 * Reset cached actor (for testing).
 */
export function resetActorCache(): void {
  cachedActor = null;
}

/**
 * Build the final description with meta attached.
 * Reads CLAUDE_SESSION_ID from process.env.
 * - If session + existing meta: updates last_session, last_actor, updated_at, dedupes sessions
 * - If session + no meta: creates fresh meta with actor fields
 * - If no session + existing meta: preserves unchanged
 * - If no session + no meta: returns description as-is
 */
export function buildMetaDescription(
  description: string,
  existingMeta: PlanMeta | null,
): string {
  const sessionId = process.env.CLAUDE_SESSION_ID;

  if (sessionId && existingMeta) {
    const actor = getActor();
    const updatedMeta: PlanMeta = {
      ...existingMeta,
      last_session: sessionId,
      last_actor: actor,
      updated_at: new Date().toISOString(),
      sessions: [...new Set([...(existingMeta.sessions ?? []), sessionId])],
    };
    return attachMeta(description, updatedMeta);
  }

  if (sessionId && !existingMeta) {
    const actor = getActor();
    const now = new Date().toISOString();
    const freshMeta: PlanMeta = {
      created_by_actor: actor,
      created_at: now,
      last_session: sessionId,
      last_actor: actor,
      updated_at: now,
      sessions: [sessionId],
    };
    return attachMeta(description, freshMeta);
  }

  if (existingMeta) {
    return attachMeta(description, existingMeta);
  }

  return description;
}
