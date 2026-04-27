/**
 * dx zettel — types for the dev-team 2nd brain.
 *
 * Slice 1 storage: markdown files in `usegin/zettel/zettels/`.
 * Slice 2 will lift to Supabase (per zettel z034).
 */

export type Author = "human" | "usegin" | "consultant" | string;
export type EdgeKind = "placement" | "cross";

export interface Edge {
  /** Token used in the threads list — e.g. "z003", "principle-01", "ENG-5379". */
  to: string;
  kind: EdgeKind;
}

export interface Zettel {
  /** Sequential id like "z028". */
  id: string;
  /** A complete claim (Matuschak: titles are like APIs). */
  title: string;
  /** Always "zettel" for now; future kinds can extend. */
  type: string;
  authoredBy: Author;
  /** Threads: placement first (↑), then cross-refs (~). */
  threads: Edge[];
  /** ISO date YYYY-MM-DD. */
  created: string;
  /** Originating Claude session id (or "manual"). */
  session: string;
  /** Body markdown — everything after the frontmatter. */
  body: string;
  /** Absolute path on disk (for slice-1 markdown storage). */
  path: string;
}

export interface ParsedFrontmatter {
  id: string;
  title: string;
  type: string;
  authoredBy: Author;
  threads: Edge[];
  created: string;
  session: string;
  /** Any extra YAML keys we don't normalize (kept verbatim). */
  extra: Record<string, string>;
}
