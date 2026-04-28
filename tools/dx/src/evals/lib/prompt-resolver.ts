/**
 * prompt-resolver.ts — Resolve a prompt name/path to its text + source path.
 *
 * For Effi corpus:
 *   - A name (no "/" and not ending in ".md" with a "/") → usegin/evals/effi/prompts/<name>.md
 *   - A path (contains "/" — absolute or relative) → read directly.
 *   - Default name: "baseline"
 *
 * Path-mode requires "/" in the string. Bare filenames ending in ".md"
 * (e.g. "baseline.md") are still treated as names and resolved from
 * usegin/evals/<corpus>/prompts/<name>.md — they do NOT trigger path-mode.
 *
 * For Gin corpus:
 *   - The prompt is embedded in the case; --matrix prompt= is an error.
 *
 * Throws with a clear message so the CLI can surface it without stack traces.
 */

import { readFileSync, existsSync } from "fs";
import { join, isAbsolute } from "path";
import { casesDir } from "./case-loader";

export interface ResolvedPrompt {
  text: string;
  sourcePath: string;
}

function effiPromptsDir(): string {
  // casesDir gives us usegin/evals/<corpus>/cases; go up one to get corpus dir
  // then into prompts/. Reuse case-loader's repo-root derivation via casesDir.
  const cases = casesDir("effi"); // …/usegin/evals/effi/cases
  return join(cases, "..", "prompts");
}

/**
 * Resolve a prompt for a given corpus and name/path.
 *
 * @param corpus  "effi" or "gin"
 * @param nameOrPath  prompt name (resolved from effi/prompts/) or path (must contain "/")
 * @throws Error when corpus is "gin" (prompt is embedded in case)
 * @throws Error when the resolved file does not exist
 */
export function resolvePrompt(corpus: string, nameOrPath: string): ResolvedPrompt {
  if (corpus === "gin") {
    throw new Error(
      `--matrix prompt= is not supported for the gin corpus: ` +
        `Gin cases embed their prompt; --matrix prompt= is Effi-only.`,
    );
  }

  // Determine the file path.
  // Path-mode: nameOrPath contains "/" (absolute path or relative path with directory).
  // Bare names — even ones ending in ".md" — are resolved from effi/prompts/.
  let filePath: string;
  if (isAbsolute(nameOrPath) || nameOrPath.includes("/")) {
    filePath = isAbsolute(nameOrPath) ? nameOrPath : join(process.cwd(), nameOrPath);
  } else {
    // bare name (with or without .md suffix) → resolve from effi/prompts/
    const base = nameOrPath.endsWith(".md") ? nameOrPath.slice(0, -3) : nameOrPath;
    filePath = join(effiPromptsDir(), `${base}.md`);
  }

  if (!existsSync(filePath)) {
    throw new Error(
      `prompt-resolver: prompt file not found: ${filePath}\n` +
        `  Looked for name "${nameOrPath}" in ${effiPromptsDir()}`,
    );
  }

  const text = readFileSync(filePath, "utf-8");
  return { text, sourcePath: filePath };
}
