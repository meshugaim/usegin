/**
 * CLI argument parsing for session-parser
 * Separated for testability
 */

import type { OutputFormat } from "./finder";

export interface FindArgs {
  allProjects: boolean;
  project?: string;
  output: OutputFormat;
  since?: string;
  noPreview: boolean;
  outputFile?: string;
}

export function parseFindArgs(args: string[]): FindArgs {
  const result: FindArgs = {
    allProjects: false,
    output: "path",
    noPreview: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--all-projects") {
      result.allProjects = true;
    } else if (arg === "--project") {
      result.project = args[++i];
    } else if (arg === "--output") {
      const val = args[++i] as OutputFormat;
      if (val === "path" || val === "id" || val === "json") {
        result.output = val;
      }
    } else if (arg === "--since") {
      result.since = args[++i];
    } else if (arg === "--no-preview") {
      result.noPreview = true;
    } else if (arg === "--output-file") {
      result.outputFile = args[++i];
    }
  }

  return result;
}

export type PickerMethod = "tmux" | "vsc" | "auto";

export interface PickArgs {
  allProjects: boolean;
  since?: string;
  method: PickerMethod;
}

export interface ListArgs {
  allProjects: boolean;
  project?: string;
  output: OutputFormat;
  since?: string;
  limit: number;
}

export function parseListArgs(args: string[]): ListArgs {
  const result: ListArgs = {
    allProjects: false,
    output: "path",
    limit: 10,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--all-projects") {
      result.allProjects = true;
    } else if (arg === "--project") {
      result.project = args[++i];
    } else if (arg === "--output") {
      const val = args[++i] as OutputFormat;
      if (val === "path" || val === "id" || val === "json") {
        result.output = val;
      }
    } else if (arg === "--since") {
      result.since = args[++i];
    } else if (arg === "--limit" || arg === "-n") {
      result.limit = parseInt(args[++i] || "10", 10);
    }
  }

  return result;
}

export function parsePickArgs(args: string[]): PickArgs {
  const result: PickArgs = {
    allProjects: false,
    method: "auto",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--all-projects") {
      result.allProjects = true;
    } else if (arg === "--since") {
      result.since = args[++i];
    } else if (arg === "--method") {
      const val = args[++i] as PickerMethod;
      if (val === "tmux" || val === "vsc" || val === "auto") {
        result.method = val;
      }
    }
  }

  return result;
}
