/**
 * Determine whether JSON output should be used by default.
 *
 * Priority order:
 * 1. Explicit --json flag → always JSON
 * 2. PLAN_OUTPUT=json → force JSON
 * 3. PLAN_OUTPUT=human → force human (overrides all auto-detection)
 * 4. stdout IS a TTY → human (interactive session, even inside Claude Code)
 * 5. CLAUDECODE=1 + no TTY → JSON (sub-agent context)
 * 6. No TTY + no --fzf → JSON (piped/scripted usage)
 * 7. Otherwise → human
 */
export function shouldDefaultToJson(opts: {
  fzf?: boolean;
  json?: boolean;
  env?: Record<string, string | undefined>;
  isTTY?: boolean;
}): boolean {
  // Explicit --json flag always wins
  if (opts.json) return true;

  const env = opts.env ?? {};
  const planOutput = env.PLAN_OUTPUT;

  // Explicit PLAN_OUTPUT env var overrides everything else
  const planOutputLower = planOutput?.toLowerCase();
  if (planOutputLower === "json") return true;
  if (planOutputLower === "human") return false;

  // If stdout is a TTY (interactive terminal), default to human
  // even inside Claude Code — the human wants the table
  if (opts.isTTY) return false;

  // Non-TTY: check if we're in a Claude Code sub-agent
  if (env.CLAUDECODE === "1") return true;

  // Non-TTY, non-Claude: still default to JSON (piped output)
  if (!opts.fzf) return true;

  return false;
}
