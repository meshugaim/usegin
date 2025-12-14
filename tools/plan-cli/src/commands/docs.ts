import { Command } from "commander";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { colors, dim } from "../lib/colors";

// Types for doc frontmatter
export interface DocMeta {
  name: string;
  handle: string;
  type: "tutorial" | "how-to" | "reference" | "explanation";
  context: string;
  tags?: string[];
}

export interface Doc {
  meta: DocMeta;
  content: string;
}

// Get the docs directory path (relative to CLI root)
function getDocsDir(): string {
  // Resolve from src/commands to root/docs
  return join(dirname(import.meta.dir), "..", "docs");
}

// Parse frontmatter from markdown
export function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: content };
  }

  const [, frontmatter, body] = match;
  const meta: Record<string, unknown> = {};

  // Simple YAML-like parsing for frontmatter
  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    // Handle arrays like [tag1, tag2]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim());
    }

    meta[key] = value;
  }

  return { meta, body: body.trim() };
}

// Load docs from a specific directory
export function loadDocsFromDir(docsDir: string): Doc[] {
  const docs: Doc[] = [];

  if (!existsSync(docsDir)) {
    return docs;
  }

  try {
    const files = readdirSync(docsDir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const content = readFileSync(join(docsDir, file), "utf-8");
      const { meta, body } = parseFrontmatter(content);

      // Validate required fields
      if (!meta.name || !meta.handle || !meta.type || !meta.context) {
        continue;
      }

      docs.push({
        meta: meta as DocMeta,
        content: body,
      });
    }
  } catch {
    // Directory might not exist or be readable
  }

  return docs;
}

// Load docs from the default docs directory
function loadDocs(): Doc[] {
  return loadDocsFromDir(getDocsDir());
}

// Format docs list output (2-line format)
export function formatDocsList(docs: Doc[]): string {
  const lines: string[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const num = (i + 1).toString().padStart(2);
    const typeTag = `[${doc.meta.type}]`;

    lines.push(`${num}  ${doc.meta.name.padEnd(58)} ${typeTag}`);
    lines.push(`    ${doc.meta.context}`);

    if (i < docs.length - 1) {
      lines.push(""); // blank line between items
    }
  }

  return lines.join("\n");
}

// Find a doc by handle or number
export function findDoc(ref: string, docs: Doc[]): Doc | undefined {
  // Try as number first (1-indexed)
  const num = parseInt(ref, 10);
  if (!isNaN(num) && num > 0 && num <= docs.length) {
    return docs[num - 1];
  }

  // Otherwise treat as handle
  return docs.find((d) => d.meta.handle === ref);
}

export function createDocsCommand(): Command {
  const cmd = new Command("docs")
    .description("Browse embedded documentation")
    .addCommand(createListSubcommand())
    .addCommand(createShowSubcommand());

  // Default to list if no subcommand
  cmd.action(() => {
    runList();
  });

  return cmd;
}

function runList(): void {
  const docs = loadDocs();

  if (docs.length === 0) {
    console.log(dim("No docs found."));
    console.log(dim(`Add docs to: ${getDocsDir()}`));
    return;
  }

  // Print formatted list
  const output = formatDocsList(docs);
  // Apply colors to the output
  const coloredOutput = output
    .split("\n")
    .map((line) => {
      // Color the number at the start
      const match = line.match(/^(\s*\d+)(\s+.*)$/);
      if (match) {
        return colors.identifier(match[1]) + match[2].replace(/\[(\w+-?\w*)\]/, dim("[$1]"));
      }
      // Context lines (indented)
      if (line.startsWith("    ")) {
        return dim(line);
      }
      return line;
    })
    .join("\n");

  console.log(coloredOutput);
}

function createListSubcommand(): Command {
  return new Command("list")
    .alias("ls")
    .description("List available docs")
    .action(() => {
      runList();
    });
}

function createShowSubcommand(): Command {
  return new Command("show")
    .alias("get")
    .description("Show a doc by handle or number")
    .argument("<ref>", "Doc handle or number from list")
    .action((ref: string) => {
      const docs = loadDocs();
      const doc = findDoc(ref, docs);

      if (!doc) {
        console.error(`Doc not found: ${ref}`);
        console.error(dim("Run 'plan docs list' to see available docs"));
        process.exit(1);
      }

      // Print the full doc content
      console.log(doc.content);
    });
}
