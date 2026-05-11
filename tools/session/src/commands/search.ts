import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Semantic search across all local Claude session JSONLs.
 *
 * Shells out to experiments/session-semantic-search/ (fastembed + sqlite-vec).
 * Auto-installs the experiment's deps on first run.
 *
 *   session search "rls policy supabase"
 *   session search "rls policy" -k 5
 *   session search --index            # build / refresh the index
 *   session search --index --limit 30 # smoke run
 */
export async function runSearch(args: string[]) {
  const here = dirname(fileURLToPath(import.meta.url));
  const expDir = join(here, "..", "..", "..", "..", "experiments", "session-semantic-search");

  if (!existsSync(join(expDir, ".venv"))) {
    await run("uv", ["sync"], expDir, "inherit");
  }

  const isIndex = args[0] === "--index";
  const rest = isIndex ? args.slice(1) : args;
  const script = isIndex ? "index.py" : "search.py";
  const cmd = isIndex ? "nice" : "uv";
  const cmdArgs = isIndex
    ? ["-n", "19", "ionice", "-c", "3", "uv", "run", "python", script, ...rest]
    : ["run", "python", script, ...rest];

  const code = await run(cmd, cmdArgs, expDir, "inherit");
  process.exit(code);
}

function run(
  cmd: string,
  args: string[],
  cwd: string,
  stdio: "inherit" | "pipe",
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}
