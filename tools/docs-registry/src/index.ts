#!/usr/bin/env bun
import { Command } from "commander";
import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join, dirname, basename, relative } from "path";

// Types for doc frontmatter
interface DocMeta {
  name: string;
  handle: string;
  type: "tutorial" | "how-to" | "reference" | "explanation";
  context: string;
  tags?: string[];
}

interface Doc {
  meta: DocMeta;
  content: string;
  source: string; // Which CLI this doc comes from
  internal: boolean; // Whether this is an internal doc
}

// Get the tools directory (where all CLIs live)
function getToolsDir(): string {
  // Walk up from src directory to find tools/
  let dir = dirname(import.meta.dir);
  while (dir !== "/" && basename(dir) !== "tools") {
    const toolsDir = join(dir, "tools");
    if (existsSync(toolsDir)) {
      return toolsDir;
    }
    dir = dirname(dir);
  }
  // If we're already in tools
  if (basename(dir) === "tools") {
    return dir;
  }
  // Default fallback
  return join(process.cwd(), "tools");
}

// Parse frontmatter from markdown
function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
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
function loadDocsFromDir(docsDir: string, source: string, internal: boolean): Doc[] {
  const docs: Doc[] = [];

  if (!existsSync(docsDir)) {
    return docs;
  }

  try {
    const files = readdirSync(docsDir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = join(docsDir, file);
      // Skip directories
      if (statSync(filePath).isDirectory()) continue;

      const content = readFileSync(filePath, "utf-8");
      const { meta, body } = parseFrontmatter(content);

      // Validate required fields
      if (!meta.name || !meta.handle || !meta.type || !meta.context) {
        continue;
      }

      docs.push({
        meta: {
          name: meta.name as string,
          handle: meta.handle as string,
          type: meta.type as DocMeta["type"],
          context: meta.context as string,
          tags: meta.tags as string[] | undefined,
        },
        content: body,
        source,
        internal,
      });
    }
  } catch {
    // Directory might not exist or be readable
  }

  return docs;
}

// Discover all CLIs with docs
function discoverCLIsWithDocs(toolsDir: string): string[] {
  const clis: string[] = [];

  try {
    const entries = readdirSync(toolsDir);
    for (const entry of entries) {
      const entryPath = join(toolsDir, entry);
      if (statSync(entryPath).isDirectory()) {
        const docsPath = join(entryPath, "docs");
        if (existsSync(docsPath) && statSync(docsPath).isDirectory()) {
          clis.push(entry);
        }
      }
    }
  } catch {
    // toolsDir might not exist
  }

  return clis.sort();
}

// Load all docs from all CLIs
function loadAllDocs(): { user: Doc[]; internal: Doc[] } {
  const toolsDir = getToolsDir();
  const clis = discoverCLIsWithDocs(toolsDir);

  const userDocs: Doc[] = [];
  const internalDocs: Doc[] = [];

  for (const cli of clis) {
    const docsPath = join(toolsDir, cli, "docs");

    // Load user-facing docs
    const userDocsFromCli = loadDocsFromDir(docsPath, cli, false);
    userDocs.push(...userDocsFromCli);

    // Load internal docs
    const internalDocsPath = join(docsPath, "internal");
    const internalDocsFromCli = loadDocsFromDir(internalDocsPath, cli, true);
    internalDocs.push(...internalDocsFromCli);
  }

  return { user: userDocs, internal: internalDocs };
}

// ANSI color helpers
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

// Format and print docs list
function formatAndPrint(docs: Doc[], startNum = 1): number {
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const num = (startNum + i).toString().padStart(2);
    const typeTag = `[${doc.meta.type}]`;
    const sourceTag = dim(`(${doc.source})`);

    console.log(`${cyan(num)}  ${doc.meta.name.padEnd(48)} ${dim(typeTag)} ${sourceTag}`);
    console.log(dim(`    ${doc.meta.context}`));

    if (i < docs.length - 1) {
      console.log(); // blank line between items
    }
  }
  return startNum + docs.length;
}

// Find a doc by handle or number
function findDoc(ref: string, docs: Doc[]): Doc | undefined {
  // Try as number first (1-indexed)
  const num = parseInt(ref, 10);
  if (!isNaN(num) && num > 0 && num <= docs.length) {
    return docs[num - 1];
  }

  // Otherwise treat as handle
  return docs.find((d) => d.meta.handle === ref);
}

// Search docs by term
function searchDocs(term: string, docs: Doc[]): Doc[] {
  const lowerTerm = term.toLowerCase();
  return docs.filter((doc) => {
    const searchableText = [
      doc.meta.name,
      doc.meta.handle,
      doc.meta.context,
      doc.meta.type,
      doc.source,
      ...(doc.meta.tags || []),
      doc.content,
    ]
      .join(" ")
      .toLowerCase();
    return searchableText.includes(lowerTerm);
  });
}

// CLI commands
function runList(options: { source?: string }): void {
  const { user, internal } = loadAllDocs();

  // Filter by source if specified
  let filteredUser = user;
  let filteredInternal = internal;
  if (options.source) {
    filteredUser = user.filter((d) => d.source === options.source);
    filteredInternal = internal.filter((d) => d.source === options.source);
  }

  if (filteredUser.length === 0 && filteredInternal.length === 0) {
    if (options.source) {
      console.log(dim(`No docs found for source: ${options.source}`));
      console.log(dim("\nAvailable sources:"));
      const toolsDir = getToolsDir();
      const clis = discoverCLIsWithDocs(toolsDir);
      for (const cli of clis) {
        console.log(dim(`  - ${cli}`));
      }
    } else {
      console.log(dim("No docs found."));
      console.log(dim(`Add docs to: tools/<cli>/docs/`));
    }
    return;
  }

  let nextNum = 1;

  // User-facing docs
  if (filteredUser.length > 0) {
    nextNum = formatAndPrint(filteredUser, nextNum);
  }

  // Internal/meta docs
  if (filteredInternal.length > 0) {
    if (filteredUser.length > 0) {
      console.log();
    }
    console.log(dim("─── internal ───"));
    console.log();
    nextNum = formatAndPrint(filteredInternal, nextNum);
  }

  console.log();
  console.log(dim("Use: docs show <handle|number>"));
  if (!options.source) {
    console.log(dim("     docs list --source <cli>  # filter by CLI"));
  }
}

function runShow(ref: string): void {
  const { user, internal } = loadAllDocs();
  const allDocs = [...user, ...internal];
  const doc = findDoc(ref, allDocs);

  if (!doc) {
    console.error(`Doc not found: ${ref}\n`);
    if (allDocs.length > 0) {
      console.error("Available docs:");
      for (let i = 0; i < allDocs.length; i++) {
        console.error(dim(`  ${i + 1}  ${allDocs[i].meta.handle} (${allDocs[i].source})`));
      }
    } else {
      console.error(dim("No docs available."));
    }
    process.exit(1);
  }

  // Print header
  console.log(dim(`Source: ${doc.source}`));
  console.log(dim(`Type: ${doc.meta.type}`));
  if (doc.meta.tags && doc.meta.tags.length > 0) {
    console.log(dim(`Tags: ${doc.meta.tags.join(", ")}`));
  }
  console.log();

  // Print the full doc content
  console.log(doc.content);
}

function runSearch(term: string): void {
  const { user, internal } = loadAllDocs();
  const allDocs = [...user, ...internal];
  const matches = searchDocs(term, allDocs);

  if (matches.length === 0) {
    console.log(dim(`No docs matching: ${term}`));
    return;
  }

  console.log(yellow(`Found ${matches.length} doc(s) matching: ${term}`));
  console.log();

  // Show matches with their position in the full list
  for (const match of matches) {
    const idx = allDocs.indexOf(match);
    const num = (idx + 1).toString().padStart(2);
    const typeTag = `[${match.meta.type}]`;
    const sourceTag = dim(`(${match.source})`);

    console.log(`${cyan(num)}  ${match.meta.name.padEnd(48)} ${dim(typeTag)} ${sourceTag}`);
    console.log(dim(`    ${match.meta.context}`));
    console.log();
  }

  console.log(dim("Use: docs show <number|handle>"));
}

function runSources(): void {
  const toolsDir = getToolsDir();
  const clis = discoverCLIsWithDocs(toolsDir);

  if (clis.length === 0) {
    console.log(dim("No CLIs with docs found."));
    return;
  }

  console.log(yellow("CLIs with documentation:"));
  console.log();

  const { user, internal } = loadAllDocs();
  const allDocs = [...user, ...internal];

  for (const cli of clis) {
    const docCount = allDocs.filter((d) => d.source === cli).length;
    console.log(`  ${cyan(cli.padEnd(30))} ${dim(`${docCount} doc(s)`)}`);
  }

  console.log();
  console.log(dim("Use: docs list --source <cli>  # filter by CLI"));
}

// Main program
const program = new Command()
  .name("docs")
  .description("Central documentation registry - aggregates docs from all CLIs")
  .version("0.1.0");

// Default action (no subcommand) = list
program.action(() => {
  runList({});
});

program
  .command("list")
  .alias("ls")
  .description("List all docs from all CLIs")
  .option("-s, --source <cli>", "Filter docs by CLI source")
  .action((options) => {
    runList(options);
  });

program
  .command("show")
  .alias("get")
  .description("Show a doc by handle or number")
  .argument("<ref>", "Doc handle or number from list")
  .action((ref: string) => {
    runShow(ref);
  });

program
  .command("search")
  .alias("find")
  .description("Search across all docs")
  .argument("<term>", "Search term")
  .action((term: string) => {
    runSearch(term);
  });

program
  .command("sources")
  .description("List all CLIs with docs")
  .action(() => {
    runSources();
  });

program.parse();
