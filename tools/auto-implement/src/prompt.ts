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

export interface HandoffWriterPromptOptions {
  killedSessionId: string;
  specId: string;
}

/**
 * Build a minimal test prompt for validating the multi-session loop.
 * The agent does trivial work, writes the handoff/complete signal file, and exits.
 */
export function buildTestPrompt(options: PromptOptions): string {
  const { sessionNumber, maxSessions, runId } = options;

  // Last session signals complete, earlier sessions signal handoff
  const isLast = sessionNumber >= maxSessions;
  const signal = isLast ? "complete" : "handoff";

  return `
## Auto-Implement Test Mode — Session ${sessionNumber}/${maxSessions} (${runId})

This is a test run to validate multi-session loop mechanics. Do the following:

1. Print: "Test session ${sessionNumber} starting"
2. Run: date
3. Run: echo '{"signal":"${signal}"}' > /tmp/auto-impl-signal.json
4. Print: "Test session ${sessionNumber} complete — ${signal} signal written"

Do NOT do any implementation work. Just execute the 4 steps above exactly as shown.
`.trim();
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

- **Under 20%**: Continue to next slice
- **20%+**: Do NOT start a new slice. Finish current if close, otherwise commit and hand off.
- **25%+**: MUST hand off immediately. No exceptions.

Check context with \`cctx\` after each slice and before starting a new one.

## Handoff Protocol

When handing off (at 60%+ or when a natural stopping point):

1. Commit and push all work
2. Update Linear issues (close completed slices, update parent slice map)
3. Run \`/handoff\` to write the handoff note
4. Signal the outer loop by writing the signal file:
   \`\`\`bash
   echo '{"signal":"handoff"}' > /tmp/auto-impl-signal.json
   \`\`\`

## Completion Protocol

When ALL slices are done (parent spec fully implemented):

1. Run cross-slice verification (full test suite, end-to-end check)
2. Update the parent spec issue to mark implementation complete
3. Signal the outer loop by writing the signal file:
   \`\`\`bash
   echo '{"signal":"complete"}' > /tmp/auto-impl-signal.json
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

/**
 * Build the prompt for a handoff writer agent.
 *
 * This is a focused, low-context task: read the killed session's transcript,
 * cross-reference with git log and Linear state, and write a handoff note.
 * The handoff writer does NOT implement anything — it only captures state.
 */
export function buildHandoffWriterPrompt(options: HandoffWriterPromptOptions): string {
  const { killedSessionId, specId } = options;

  return `
## Handoff Writer — Context Rotation Recovery

A previous implementing session (${killedSessionId}) was killed by the post-commit hook
because context utilization exceeded the threshold. Your job is to write a handoff note
capturing its state so the next session can continue seamlessly.

**You are NOT implementing anything.** You are only writing a handoff note.

## Steps

1. Read the killed session's transcript:
   \`\`\`
   session ${killedSessionId} --timeline
   \`\`\`

2. Check recent git activity to see what was committed:
   \`\`\`
   git log --oneline -20
   \`\`\`

3. Check Linear state to see which slices are done/in-progress:
   \`\`\`
   plan show ${specId} --tree
   \`\`\`

4. Check for any uncommitted work:
   \`\`\`
   git status
   git diff --stat
   \`\`\`

5. If there is uncommitted work that looks complete, commit and push it.

6. Write the handoff using \`/handoff\`. Include:
   - What slice was being worked on
   - What's done (committed)
   - What's in progress (uncommitted changes, if any)
   - What the next session should pick up
   - Any blockers or issues encountered

7. Signal the outer loop by writing the signal file:
   \`\`\`bash
   echo '{"signal":"handoff"}' > /tmp/auto-impl-signal.json
   \`\`\`
`.trim();
}
