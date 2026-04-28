/**
 * case-loader.ts — Load and validate case JSON files for a given corpus.
 *
 * Validates required fields against case-schema.md:
 *   id, title, origin, created, authored-by, status, source (with kind),
 *   mental_model, dog_ref.
 *
 * Returns typed `EvalCase[]`. Strips `_comment*` fields silently.
 */

import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export type SourceKind = "transcript" | "prompt";

export interface TranscriptSource {
  kind: "transcript";
  uri: string;
  session_id?: string;
  captured_at?: string;
  turn_range?: [number, number];
  redactions?: Array<{ field: string; replacement: string }>;
}

export interface PromptSource {
  kind: "prompt";
  prompt: string;
  system_prompt_ref?: string;
  files?: string[];
  assertions: string[];
  agent_model_default?: string;
}

export type EvalSource = TranscriptSource | PromptSource;

export interface MentalModel {
  description: string;
  dataset_uri?: string;
  fixtures?: {
    tools_available?: string[];
    context?: Record<string, string>;
    time?: string;
  };
}

export interface ExpectedShape {
  tool_calls_must_include?: string[];
  tool_calls_must_not_include?: string[];
  citations_required?: boolean | number;
  no_pii?: boolean;
  shape_hints?: string[];
}

export interface EvalCase {
  id: string;
  title: string;
  origin: string;
  threads: string[];
  created: string;
  "authored-by": string;
  status: "active" | "retired";
  supersedes?: string;
  "retired-at"?: string;
  "retired-because"?: string;
  source: EvalSource;
  mental_model: MentalModel;
  dog_ref: string;
  expected: ExpectedShape;
  baseline_run_id?: string | null;
  tags?: string[];
  /** Absolute path this case was loaded from */
  _file_path: string;
}

export class CaseValidationError extends Error {
  constructor(
    public readonly filePath: string,
    message: string,
  ) {
    super(`case-loader: ${filePath}: ${message}`);
    this.name = "CaseValidationError";
  }
}

function stripCommentsValue(v: unknown): unknown {
  if (v !== null && typeof v === "object") {
    if (Array.isArray(v)) {
      return v.map(stripCommentsValue);
    }
    return stripComments(v as Record<string, unknown>);
  }
  return v;
}

function stripComments(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("_")) continue;
    out[k] = stripCommentsValue(v);
  }
  return out;
}

function validateCase(raw: Record<string, unknown>, filePath: string): EvalCase {
  const required = ["id", "title", "origin", "created", "authored-by", "status", "source", "mental_model", "dog_ref", "expected"];
  for (const field of required) {
    if (!(field in raw)) {
      throw new CaseValidationError(filePath, `missing required field: "${field}"`);
    }
  }

  const source = raw["source"] as Record<string, unknown>;
  if (!source || typeof source !== "object") {
    throw new CaseValidationError(filePath, `"source" must be an object`);
  }
  const kind = source["kind"];
  if (kind !== "transcript" && kind !== "prompt") {
    throw new CaseValidationError(
      filePath,
      `source.kind must be "transcript" or "prompt", got: ${JSON.stringify(kind)}`,
    );
  }
  if (kind === "transcript" && typeof source["uri"] !== "string") {
    throw new CaseValidationError(filePath, `transcript source requires "uri" string`);
  }
  if (kind === "prompt") {
    if (typeof source["prompt"] !== "string") {
      throw new CaseValidationError(filePath, `prompt source requires "prompt" string`);
    }
    if (!Array.isArray(source["assertions"]) || source["assertions"].length === 0) {
      throw new CaseValidationError(filePath, `prompt source requires non-empty "assertions" array`);
    }
  }

  const status = raw["status"];
  if (status !== "active" && status !== "retired") {
    throw new CaseValidationError(filePath, `status must be "active" or "retired"`);
  }

  return {
    ...(raw as unknown as EvalCase),
    _file_path: filePath,
  };
}

/**
 * Resolve the repo root as the parent of the tools/dx directory.
 * We go up from this file: tools/dx/src/evals/lib/case-loader.ts → repo root.
 */
function repoRoot(): string {
  // Import.meta.url gives us the current file path in ESM.
  // We navigate up 5 directories: lib → evals → src → dx → tools → repo root.
  const here = new URL(import.meta.url).pathname;
  // here = /repo/tools/dx/src/evals/lib/case-loader.ts
  const parts = here.split("/");
  // Remove filename + lib + evals + src + dx + tools = 6 parts
  return parts.slice(0, -6).join("/");
}

export function casesDir(corpus: string): string {
  return join(repoRoot(), "usegin", "evals", corpus, "cases");
}

export function dogsDir(corpus: string): string {
  return join(repoRoot(), "usegin", "evals", corpus, "dogs");
}

export function runsDir(corpus: string): string {
  return join(repoRoot(), "usegin", "evals", corpus, "runs");
}

/**
 * Load all cases from a corpus, optionally filtered to one case ID.
 */
export function loadCases(corpus: string, caseId?: string): EvalCase[] {
  const dir = casesDir(corpus);
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    throw new Error(`case-loader: cannot read cases dir: ${dir}`);
  }

  if (files.length === 0) {
    throw new Error(`case-loader: no .json files found in ${dir}`);
  }

  const cases: EvalCase[] = [];
  for (const file of files) {
    const filePath = join(dir, file);
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    } catch (err) {
      throw new CaseValidationError(filePath, `JSON parse error: ${String(err)}`);
    }
    const cleaned = stripComments(raw);
    const validated = validateCase(cleaned, filePath);
    if (caseId && validated.id !== caseId) continue;
    cases.push(validated);
  }

  if (caseId && cases.length === 0) {
    throw new Error(`case-loader: case "${caseId}" not found in ${dir}`);
  }

  return cases;
}
