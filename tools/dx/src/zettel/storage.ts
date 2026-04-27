/**
 * dx zettel — storage layer (slice 1: markdown + git).
 *
 * Pure functions where possible (parse/serialize). Filesystem I/O isolated
 * to a small surface so slice 2's Supabase backend can swap it without
 * touching the parser.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import type { Zettel, ParsedFrontmatter, Edge, EdgeKind, Author } from "./types";

const ID_RE = /^z(\d{3,})\.md$|^z(\d{3,})-/;
const FRONT_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const THREAD_TOKEN_RE = /^([↑~])(.+)$/;

/** Find the repo's `usegin/zettel/zettels/` directory by walking up from cwd. */
export function zettelsDir(startFrom: string = process.cwd()): string {
  if (process.env.DX_ZETTELS_DIR) return process.env.DX_ZETTELS_DIR;
  let dir = startFrom;
  while (dir !== "/") {
    const candidate = resolve(dir, "usegin/zettel/zettels");
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error("dx zettel: could not find usegin/zettel/zettels in any parent of " + startFrom);
}

/** Parse a zettel markdown file (frontmatter + body). */
export function parseZettel(text: string, path: string = ""): Zettel {
  const m = FRONT_RE.exec(text);
  if (!m) throw new Error(`dx zettel: no frontmatter in ${path || "input"}`);
  const fm = parseFrontmatter(m[1]);
  return { ...fm, body: m[2], path };
}

export function parseFrontmatter(yaml: string): ParsedFrontmatter {
  const out: ParsedFrontmatter = {
    id: "",
    title: "",
    type: "zettel",
    authoredBy: "human",
    threads: [],
    created: "",
    session: "manual",
    extra: {},
  };
  for (const rawLine of yaml.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    switch (key) {
      case "id":
        out.id = val;
        break;
      case "title":
        out.title = val;
        break;
      case "type":
        out.type = val;
        break;
      case "authored-by":
        out.authoredBy = val as Author;
        break;
      case "threads":
        out.threads = parseThreadsList(val);
        break;
      case "created":
        out.created = val;
        break;
      case "session":
        out.session = val;
        break;
      default:
        out.extra[key] = val;
    }
  }
  if (!out.id) throw new Error("dx zettel: frontmatter missing id");
  if (!out.title) throw new Error(`dx zettel: frontmatter missing title (id=${out.id})`);
  return out;
}

/** Parse a `threads: [↑z003, ~z015, ~ENG-5379]`-style YAML inline list. */
export function parseThreadsList(raw: string): Edge[] {
  const trimmed = raw.replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!trimmed) return [];
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((tok): Edge => {
      const m = THREAD_TOKEN_RE.exec(tok);
      if (m) return { to: m[2].trim(), kind: m[1] === "↑" ? "placement" : "cross" };
      // Bare token (no prefix) defaults to cross-ref
      return { to: tok, kind: "cross" };
    });
}

export function serializeThreads(edges: Edge[]): string {
  if (!edges.length) return "[]";
  return "[" + edges.map((e) => (e.kind === "placement" ? "↑" : "~") + e.to).join(", ") + "]";
}

export function serializeZettel(z: Zettel): string {
  const fmLines = [
    "---",
    `id: ${z.id}`,
    `title: ${z.title}`,
    `type: ${z.type}`,
    `authored-by: ${z.authoredBy}`,
    `threads: ${serializeThreads(z.threads)}`,
    `created: ${z.created}`,
    `session: ${z.session}`,
    "---",
  ];
  // Always emit one blank line between frontmatter and body.
  // (Without the explicit "\n", round-tripping a body that starts on
  // its own line would collapse to "---\n## Heading" — bug fixed per
  // zettel z058.)
  return fmLines.join("\n") + "\n\n" + z.body.replace(/^\n+/, "");
}

export function listZettelFiles(dir: string = zettelsDir()): string[] {
  return readdirSync(dir)
    .filter((f) => ID_RE.test(f))
    .sort();
}

export function readAll(dir: string = zettelsDir()): Zettel[] {
  return listZettelFiles(dir).map((f) => {
    const path = join(dir, f);
    return parseZettel(readFileSync(path, "utf-8"), path);
  });
}

/** Find a zettel by full id ("z003") or numeric prefix ("3", "03", "003"). */
export function findById(id: string, dir: string = zettelsDir()): Zettel | null {
  const norm = normalizeId(id);
  for (const z of readAll(dir)) {
    if (z.id === norm) return z;
  }
  return null;
}

/** Normalize "3" / "03" / "z3" / "z03" / "z003" → "z003". Pads to 3 digits. */
export function normalizeId(input: string): string {
  const m = /^z?(\d+)$/.exec(input.trim());
  if (!m) return input;
  return "z" + m[1].padStart(3, "0");
}

/** Compute the next id given existing files. */
export function nextId(dir: string = zettelsDir()): string {
  let max = 0;
  for (const f of listZettelFiles(dir)) {
    const m = ID_RE.exec(f);
    if (m) {
      const n = parseInt(m[1] ?? m[2], 10);
      if (n > max) max = n;
    }
  }
  return "z" + String(max + 1).padStart(3, "0");
}

export function writeZettel(z: Zettel, dir: string = zettelsDir()): string {
  mkdirSync(dir, { recursive: true });
  const slug = z.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const path = join(dir, `${z.id}-${slug}.md`);
  writeFileSync(path, serializeZettel(z));
  return path;
}

export function updateThreads(zPath: string, newThreads: Edge[]): void {
  const text = readFileSync(zPath, "utf-8");
  const z = parseZettel(text, zPath);
  z.threads = newThreads;
  writeFileSync(zPath, serializeZettel(z));
}
