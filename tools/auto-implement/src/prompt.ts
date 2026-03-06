/**
 * Prompt construction for auto-implement sessions.
 *
 * The prompt is intentionally thin — the implementing-specs skill
 * does the heavy lifting. The prompt just points the agent at the
 * right sources.
 */

export interface PromptOptions {
  specId: string;
  sessionNumber: number;
  maxSessions: number;
  runId: string;
  runDir: string;
}

/**
 * Build the prompt for a fresh implementing-specs session.
 *
 * Session 1 gets an "orient first" prompt.
 * Sessions 2+ get a "continue from handoff" prompt.
 */
export function buildPrompt(options: PromptOptions): string {
  const { specId, sessionNumber, maxSessions, runId, runDir } = options;

  const common = `
## Auto-Implement Session

You are session ${sessionNumber}/${maxSessions} of an auto-implement run (${runId}).

**Spec:** ${specId}
**Run log:** ${runDir}/manifest.jsonl

Follow the \`implementing-specs\` skill. This is your primary guide.

## Context Thresholds (non-negotiable)

- **Under 60%**: Continue to next slice
- **60%+**: Do NOT start a new slice. Finish current if close, otherwise commit and hand off.
- **70%+**: MUST hand off immediately. No exceptions.

Check context with \`cctx\` after each slice and before starting a new one.

## Handoff Protocol

When handing off (at 60%+ or when a natural stopping point):

1. Commit and push all work
2. Update Linear issues (close completed slices, update parent slice map)
3. Run \`/handoff\` to write the handoff note
4. After writing the handoff, output exactly this on its own line:
   \`\`\`
   AUTO_IMPLEMENT_HANDOFF
   \`\`\`

## Completion Protocol

When ALL slices are done (parent spec fully implemented):

1. Run cross-slice verification (full test suite, end-to-end check)
2. Update the parent spec issue to mark implementation complete
3. Output exactly this on its own line:
   \`\`\`
   AUTO_IMPLEMENT_COMPLETE
   \`\`\`
`.trim();

  if (sessionNumber === 1) {
    return `${common}

## Your Task (Session 1 — Orient & Start)

1. Read the spec: \`plan show ${specId} --tree\`
2. Follow the implementing-specs skill's Orient phase
3. Check if slices already exist (from slicing-specs)
4. Begin implementation from the first slice
5. Hand off when context thresholds are reached
`;
  }

  return `${common}

## Your Task (Session ${sessionNumber} — Continue)

1. Read the latest handoff: \`.claude/handoffs/latest.md\`
2. Check Linear state: \`plan show ${specId} --tree\`
3. Verify handoff matches Linear (Linear wins if they disagree)
4. If resuming mid-slice: check what code exists, pick up from recorded state
5. If starting a new slice: read the slice's sub-issue for acceptance criteria
6. Continue implementation
7. Hand off when context thresholds are reached
`;
}
