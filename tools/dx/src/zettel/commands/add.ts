import { Command } from "commander";
import { writeZettel, nextId, zettelsDir } from "../storage";
import type { Zettel, Edge, Author } from "../types";

export interface AddOptions {
  title: string;
  as?: Author;
  thread?: string[];
  placement?: string;
  json?: boolean;
}

export interface AddResult {
  id: string;
  path: string;
  title: string;
  authoredBy: Author;
  threads: Edge[];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function sessionId(): string {
  return process.env.CLAUDE_SESSION_ID ?? "manual";
}

function buildEdges(opts: AddOptions): Edge[] {
  const edges: Edge[] = [];
  if (opts.placement) edges.push({ to: opts.placement, kind: "placement" });
  for (const t of opts.thread ?? []) {
    edges.push({ to: t, kind: "cross" });
  }
  return edges;
}

export function addZettel(body: string, opts: AddOptions, dir: string = zettelsDir()): AddResult {
  if (!opts.title || !opts.title.trim()) throw new Error("dx zettel add: --title is required");
  if (!body || !body.trim()) throw new Error("dx zettel add: body is required (positional or stdin)");
  const id = nextId(dir);
  const z: Zettel = {
    id,
    title: opts.title.trim(),
    type: "zettel",
    authoredBy: opts.as ?? "human",
    threads: buildEdges(opts),
    created: todayISO(),
    session: sessionId(),
    body: body.endsWith("\n") ? body : body + "\n",
    path: "",
  };
  const path = writeZettel(z, dir);
  return { id: z.id, path, title: z.title, authoredBy: z.authoredBy, threads: z.threads };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

export function buildZettelAddCommand(): Command {
  return new Command("add")
    .description("Create a new zettel. Body is positional or stdin. --title required.")
    .argument("[body]", "zettel body markdown (omit to read from stdin)")
    .requiredOption("--title <text>", "atomic claim, served as the title")
    .option("--as <actor>", "author: human (default), usegin, consultant", "human")
    .option("--thread <id>", "cross-reference (repeatable)", (v: string, prev: string[] = []) => [...prev, v])
    .option("--placement <id>", "placement parent (one)")
    .option("--json", "emit JSON to stdout")
    .action(async (bodyArg: string | undefined, opts: AddOptions) => {
      const body = bodyArg ?? (await readStdin());
      const result = addZettel(body, opts);
      if (opts.json) {
        process.stdout.write(JSON.stringify(result) + "\n");
      } else {
        process.stderr.write(`Wrote ${result.id} → ${result.path}\n`);
      }
    });
}
