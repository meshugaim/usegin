export type PlanMeta = {
  created_by_session?: string;
  created_at?: string;
  last_session?: string;
  updated_at?: string;
  sessions?: string[];
};

const META_REGEX = /\n?<!-- plan:meta\n([\s\S]*?)\n-->\s*$/;

const FIELD_ORDER = [
  "created_by_session",
  "created_at",
  "last_session",
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
        inSessions = true;
        sessionsList = [];
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
      lines.push("sessions:");
      for (const entry of arr) {
        lines.push(`  - ${entry}`);
      }
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
