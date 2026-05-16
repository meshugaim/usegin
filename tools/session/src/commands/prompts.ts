import { parseSession } from "../parser";
import {
  checkFzfAvailable,
  discoverSessions,
  getCurrentProjectHash,
} from "../finder";
import { FzfNotFoundError } from "../errors";
import {
  extractUserPrompts,
  dedupPrompts,
  formatPromptEntry,
  extractPromptFromSelection,
  formatPromptGrep,
  type UserPrompt,
} from "../prompt-history";

const DEFAULT_SINCE = "30d";

function printPromptsHelp() {
  console.log(`
session prompts - Browse and reuse user-typed prompts from past sessions

USAGE:
  session prompts list [options]    Print prompts (or --grep matches) to stdout
  session prompts pick [options]    Pick a prompt via fzf; print selection to stdout

By default scans sessions in the current project from the last 30 days, dedups
exact repeats (keeping the most recent), and orders newest-first.

OPTIONS:
  --since <filter>   Window of sessions to scan (e.g., 1d, 7d, 30d) [default: ${DEFAULT_SINCE}]
  --all-projects     Scan sessions across all projects, not just the current one
  --no-dedup         Keep every occurrence instead of collapsing exact repeats
  --grep <pattern>   (list only) Filter to prompts containing pattern (case-insensitive)
  --help, -h         Show this help

PICK BEHAVIOR:
  enter   Print the selected prompt to stdout (verbatim, newlines preserved)
  esc     Cancel — exit non-zero, print nothing

EXAMPLES:
  # Browse and pick a recent prompt (tmux popup wraps this with set-buffer)
  session prompts pick

  # Look across all projects, last week
  session prompts pick --all-projects --since 7d

  # Find prompts about supabase
  session prompts list --grep supabase

  # Compose with shell tools
  session prompts list --grep deploy | head -20
`);
}

interface PromptsOptions {
  since: string;
  allProjects: boolean;
  dedup: boolean;
  grep?: string;
}

function parsePromptsArgs(args: string[]): PromptsOptions {
  const opts: PromptsOptions = {
    since: DEFAULT_SINCE,
    allProjects: false,
    dedup: true,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--since") {
      opts.since = args[++i] ?? DEFAULT_SINCE;
    } else if (a === "--all-projects") {
      opts.allProjects = true;
    } else if (a === "--no-dedup") {
      opts.dedup = false;
    } else if (a === "--grep") {
      opts.grep = args[++i];
    }
  }
  return opts;
}

async function collectPrompts(opts: PromptsOptions): Promise<UserPrompt[]> {
  const project = opts.allProjects ? undefined : (getCurrentProjectHash() || undefined);
  const sessions = await discoverSessions({ project, since: opts.since });

  const all: UserPrompt[] = [];
  for (const info of sessions) {
    if (!info.path) continue; // API-remote rows have empty path; skip
    try {
      const session = await parseSession(info.path, { includeSubagents: false });
      all.push(...extractUserPrompts(session.turns, info.id));
    } catch {
      // skip unparseable sessions silently — one bad JSONL shouldn't kill the picker
    }
  }
  return opts.dedup ? dedupPrompts(all) : all;
}

export async function runPromptsList(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    printPromptsHelp();
    return;
  }
  const opts = parsePromptsArgs(args);
  const prompts = await collectPrompts(opts);

  if (opts.grep) {
    console.log(formatPromptGrep(prompts, opts.grep));
    return;
  }

  if (prompts.length === 0) {
    console.error(`No prompts found in the last ${opts.since}.`);
    return;
  }

  for (const p of prompts) {
    // Display-side only (display\tencoded → take field 1)
    const entry = formatPromptEntry(p);
    const display = entry.split("\t")[0];
    console.log(display);
  }
}

export async function runPromptsPick(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    printPromptsHelp();
    return;
  }
  const opts = parsePromptsArgs(args);

  if (!(await checkFzfAvailable())) {
    const error = new FzfNotFoundError();
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  const prompts = await collectPrompts(opts);
  if (prompts.length === 0) {
    console.error(`No prompts found in the last ${opts.since}.`);
    process.exit(1);
  }

  // NUL-separated entries so prompts with literal newlines stay one record.
  // Tab-separated fields inside each entry (display\tJSON-encoded original).
  const input = prompts.map(formatPromptEntry).join("\0");

  const fzfArgs = [
    "fzf",
    "--read0",
    "--ansi",
    "--delimiter=\t",
    "--with-nth=1",
    "--header", "enter: emit prompt │ esc: cancel",
    "--preview", "echo {2..} | head -1 | sed 's/^\"//;s/\"$//' | sed 's/\\\\n/\\n/g; s/\\\\t/\\t/g; s/\\\\\"/\"/g'",
    "--preview-window", "right:50%:wrap",
    "--bind", "ctrl-u:preview-half-page-up",
    "--bind", "ctrl-d:preview-half-page-down",
    "--tiebreak", "index",
  ];

  const childProcess = Bun.spawn(fzfArgs, {
    stdin: new Response(input),
    stdout: "pipe",
    stderr: "inherit",
  });

  const output = await new Response(childProcess.stdout).text();
  await childProcess.exited;

  const selection = output.trim();
  if (!selection) {
    process.exit(1);
  }

  const original = extractPromptFromSelection(selection);
  // Print verbatim, no trailing newline — caller composes (tmux set-buffer, xargs, ...)
  process.stdout.write(original);
}

export async function runPrompts(args: string[]) {
  const sub = args[0];
  if (sub === "list") {
    await runPromptsList(args.slice(1));
    return;
  }
  if (sub === "pick") {
    await runPromptsPick(args.slice(1));
    return;
  }
  if (!sub || sub === "--help" || sub === "-h") {
    printPromptsHelp();
    return;
  }
  console.error(`Unknown subcommand: prompts ${sub}`);
  console.error(`Try: session prompts --help`);
  process.exit(1);
}
