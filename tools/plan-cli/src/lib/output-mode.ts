import { shouldDefaultToJson as sharedShouldDefaultToJson } from "../../../lib/output-mode";

/**
 * plan-cli wrapper around the shared output-mode detection.
 * Passes "PLAN_OUTPUT" as the tool-specific env var name.
 */
export function shouldDefaultToJson(opts: {
  fzf?: boolean;
  json?: boolean;
  env?: Record<string, string | undefined>;
  isTTY?: boolean;
}): boolean {
  return sharedShouldDefaultToJson({ ...opts, envVarName: "PLAN_OUTPUT" });
}
