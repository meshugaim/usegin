import { Command } from "commander";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── ANSI helpers ────────────────────────────────────────────────────────────
// Self-contained so consumers don't need to provide their own color functions.

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

// ─── Core functions ──────────────────────────────────────────────────────────

/**
 * Parse YAML-like frontmatter from markdown.
 *
 * Expects the standard `---` delimiters. Returns parsed key/value pairs as
 * `meta` and the remaining markdown as `body`. Arrays in `[a, b]` syntax are
 * parsed into string arrays.
 */
export function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: content };
  }

  // Regex matched, so groups 1 and 2 are present. Default to empty string to
  // satisfy noUncheckedIndexedAccess without changing runtime behavior.
  const frontmatter = match[1] ?? "";
  const body = match[2] ?? "";
  const meta: Record<string, unknown> = {};

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

/**
 * Load docs from a specific directory.
 *
 * Reads every `.md` file, parses frontmatter, and returns only those with all
 * required fields (name, handle, type, context). Returns an empty array if the
 * directory doesn't exist or is unreadable.
 */
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
        meta: meta as unknown as DocMeta,
        content: body,
      });
    }
  } catch {
    // Directory might not exist or be readable
  }

  return docs;
}

/**
 * Find a doc by handle or 1-indexed number.
 */
export function findDoc(ref: string, docs: Doc[]): Doc | undefined {
  // Try as number first (1-indexed)
  const num = parseInt(ref, 10);
  if (!isNaN(num) && num > 0 && num <= docs.length) {
    return docs[num - 1];
  }

  // Otherwise treat as handle
  return docs.find((d) => d.meta.handle === ref);
}

/**
 * Format docs list in the standard 2-line format (plain text, no ANSI colors).
 *
 * Each doc gets two lines:
 *   `<num>  <name padded to 58>  [<type>]`
 *   `    <context>`
 * with a blank line between entries.
 */
export function formatDocsList(docs: Doc[]): string {
  const lines: string[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (!doc) continue;
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

// ─── Higher-level helpers ────────────────────────────────────────────────────

/**
 * Load user + internal docs using a caller-provided directory resolver.
 *
 * The `getDocsDir` callback receives `internal?: boolean` and returns the
 * appropriate directory path. Each CLI resolves this differently.
 */
export function loadAllDocs(getDocsDir: (internal?: boolean) => string): { user: Doc[]; internal: Doc[] } {
  return {
    user: loadDocsFromDir(getDocsDir(false)),
    internal: loadDocsFromDir(getDocsDir(true)),
  };
}

/**
 * Generate a compact docs summary suitable for `--help` output.
 *
 * Returns a multi-line string listing every doc's handle and name, or an empty
 * string when no docs exist.
 */
export function getDocsHelpText(cliName: string, getDocsDir: (internal?: boolean) => string): string {
  const { user, internal } = loadAllDocs(getDocsDir);
  const allDocs = [...user, ...internal];

  if (allDocs.length === 0) {
    return "";
  }

  const lines: string[] = ["", "Embedded Docs:"];
  for (const doc of allDocs) {
    lines.push(`  ${doc.meta.handle.padEnd(28)} ${doc.meta.name}`);
  }
  lines.push("");
  lines.push(`Use: ${cliName} docs show <handle>`);

  return lines.join("\n");
}

// ─── Commander integration ───────────────────────────────────────────────────

/**
 * Format and print a list of docs with ANSI colors.
 * Returns the next number to use for continuation numbering.
 */
function formatAndPrint(docs: Doc[], startNum = 1): number {
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (!doc) continue;
    const num = (startNum + i).toString().padStart(2);
    const typeTag = `[${doc.meta.type}]`;

    console.log(`${cyan(num)}  ${doc.meta.name.padEnd(58)} ${dim(typeTag)}`);
    console.log(dim(`    ${doc.meta.context}`));

    if (i < docs.length - 1) {
      console.log(); // blank line between items
    }
  }
  return startNum + docs.length;
}

/**
 * Create a Commander `docs` command for any CLI.
 *
 * @param cliName   - CLI name, used in hint text (e.g. "plan", "e2e")
 * @param getDocsDir - function returning the docs directory path;
 *                     receives `internal?: boolean` so each CLI can resolve
 *                     its own path layout.
 *
 * The returned command has `list` (aliased `ls`) and `show` (aliased `get`)
 * subcommands. Running `docs` with no subcommand defaults to `list`.
 */
export function createDocsCommand(cliName: string, getDocsDir: (internal?: boolean) => string): Command {
  function runList(): void {
    const { user, internal } = loadAllDocs(getDocsDir);

    if (user.length === 0 && internal.length === 0) {
      console.log(dim("No docs found."));
      console.log(dim(`Add docs to: ${getDocsDir()}`));
      return;
    }

    let nextNum = 1;

    // User-facing docs
    if (user.length > 0) {
      nextNum = formatAndPrint(user, nextNum);
    }

    // Internal/meta docs
    if (internal.length > 0) {
      if (user.length > 0) {
        console.log();
      }
      console.log(dim("─── internal ───"));
      console.log();
      nextNum = formatAndPrint(internal, nextNum);
    }

    console.log();
    console.log(dim(`Use: ${cliName} docs show <handle|number>`));
  }

  const listCmd = new Command("list")
    .alias("ls")
    .description("List available docs")
    .action(() => {
      runList();
    });

  const showCmd = new Command("show")
    .alias("get")
    .description("Show a doc by handle or number")
    .argument("<ref>", "Doc handle or number from list")
    .action((ref: string) => {
      const { user, internal } = loadAllDocs(getDocsDir);
      const allDocs = [...user, ...internal];
      const doc = findDoc(ref, allDocs);

      if (!doc) {
        console.error(`Doc not found: ${ref}\n`);
        if (allDocs.length > 0) {
          console.error("Available docs:");
          for (let i = 0; i < allDocs.length; i++) {
            const d = allDocs[i];
            if (!d) continue;
            console.error(dim(`  ${i + 1}  ${d.meta.handle}`));
          }
        } else {
          console.error(dim("No docs available."));
        }
        process.exit(1);
      }

      // Print the full doc content
      console.log(doc.content);
    });

  const cmd = new Command("docs")
    .description("Browse embedded documentation")
    .addCommand(listCmd)
    .addCommand(showCmd);

  // Default to list if no subcommand
  cmd.action(() => {
    runList();
  });

  return cmd;
}
