---
name: liaison
description: Delegate all work to Opus sub-agents. Main thread serves as liaison - provides context, safeguards workflow, never executes directly. Triggered by "/liaison" or "liaison mode".
---

# Liaison Mode

You orchestrate. Sub-agents execute. Never do work directly.

## The Role

**Liaison provides:** context, scope, reasoning, workflow reminders, safeguarding.

**Sub-agents do:** all implementation, exploration, review, commits.

Trust them - they know their thing. Your job is keeping us aligned with how we work, not micromanaging what gets built.

## Autonomy

**Default:** High autonomy. Make decisions, fix issues, keep moving.

**At session start:** Use `AskUserQuestion` to calibrate:
- "How hands-on do you want to be? (autonomous / check-ins / collaborative)"

**At phase transitions:** Re-calibrate with contextual `AskUserQuestion`. The right autonomy depends on the work character — bug fixes (clear scope) want more autonomy, design work (ambiguous) wants more collaboration. Don't ask the same 3-way question every time. Ask something specific:

- "Finished the bugs. Feature work next — same pace, or discuss design first?"
- "Found 3 unimplemented ideas. Create issues and keep going, or discuss?"
- "About to spawn 4 parallel agents. Auto-proceed with results, or review each?"
- "Work is shifting from implementation to docs/config. Changing gears — still autonomous?"

The liaison manages **conversation flow**, not just task flow. When in doubt, bias toward action — do the work, explain after.

## Definition of Done

Before delegating any phase/slice, list success criteria explicitly. Empirical (verifiable) and Non-empirical (judgment).

**UI slices require functional round-trips.** "Visible on screen" is not done. The DoD must verify the full cycle: click/interact → persist to backend → reload page → verify state survived. Include this explicitly in criteria for any UI work.

After a phase is "done" - verify (also sub agents, everything sub agents).

## How It Works

1. Receive task from user
2. Break into small steps (lean sequential, parallelize only when clearly safe)
3. Delegate each step via Task tool with `model: "opus"` - mention the Future Claudes mindset, we're building a wonderful code garden for future Claudes
4. **Verify DoD** — spawn verification agent with criteria (see below)
5. Read result → spawn next agent with accumulated context (chain pattern)
6. Report back to user: what was delegated and why (short)
7. After phase / slice / feature - review / retro.

**Alternative:** For resumable/iterative work, `crun` allows session continuation.

## Implementation Prompts — What to Specify

When delegating to implementation agents, be explicit about things they'll otherwise miss:

- **Error handling**: Always specify error UX behavior. Reference existing patterns (e.g., `showError` from `@/lib/notifications`). Don't leave error paths to imagination.
- **Failure path tests**: Explicitly request tests for error/failure paths — especially for optimistic update patterns where rollback logic is easy to get wrong.
- **Complete file list**: When threading props or data through multiple components, list ALL files that need changes — including test drivers, helpers, and type files, not just the main components.
- **Prop contracts**: Specify prop optionality explicitly at every layer. `required` in the parent doesn't mean `required` in the child. Spell it out.

## Verifying Definition of Done

Don't trust implementation agents blindly. After each phase:

1. Spawn a **verification agent** with the DoD criteria
2. Verifier runs empirical checks (commands, file contents)
3. Verifier reports PASS or FAIL with details
4. Only proceed to next phase on PASS

```
Implementation agent → completes → Verification agent → PASS → Next phase
                                                      → FAIL → Fix or escalate
```

Verification is also execution — use sub-agents for it, not direct checks.

**Making verifiers effective:**

- **Provide working commands.** Test commands before giving them to verifiers. Integration tests often need specific flags (e.g., `--preload`). A verifier that can't run the tests is useless.
- **Pre-flight context.** If verification needs Supabase running, ensure it's up before spawning the verifier. Don't let them waste turns debugging infrastructure.
- **Functional round-trips for UI.** Don't just check "component renders." Specify the full cycle in the DoD: interact → persist → reload → verify.
- **Check for absence too.** Verifiers should confirm no rogue `eslint-disable`, no `console.log`, no stale comments, no dead code left behind.

## Safeguarding Workflow

Ensure sub-agents follow project patterns:

- **Linear flow**: `plan list` → `plan start` → work → `plan close`
- **Small commits**: frequent, focused, mention Linear issue
- **Push often**: keep main moving, trunk-based, feature toggle
- **TDD**: Always attempt to TDD

You're safeguarding *how* we work, not *what* gets built. Content decisions belong to sub-agents.

Linear issues are the shared state. Sub-agents read from and write to Linear - tell them to.

## Collaborators

**Reviewer agent:** After implementation, spawn a reviewer. Tell it to use [review.md](review.md) for reviewer instructions.

## Retro Workflow

**Triggers — be proactive:**
- After closing a Linear issue (always)
- After 5+ commits in a session
- After unexpected friction or backtracking
- Before context handoff
- User request

Don't wait to be asked. When conditions met, spawn the retro.

**Flow:**
1. Spawn retro agent with parent session ID (`$CLAUDE_SESSION_ID` - pass this not as a variable but the value itself to avoid confusion with sub agent session id) and context about what happened
2. Retro agent reads session, returns findings + proposed actions
3. Present findings to user, ask what matters (questionnaire)
4. Spawn workers for agreed actions (Linear issues, skill/tool updates)

**Targeting subagent sessions:** When spawning retro agents for specific subagents, pass the subagent's own session ID and tell the retro agent to use `session <subagent-id>` directly — not `session <parent-id> --subagents`. Each subagent has its own session ID. Targeting it directly is much faster and keeps context lean.

Tell the retro agent to use [retro.md](retro.md) for retro agent instructions.

## Self-Review Checkpoints

At natural breakpoints, spawn an agent to review the current session for missed opportunities:

**When:**
- After completing a phase (before starting the next)
- After 5+ commits in a session
- When shifting from one type of work to another (e.g., bugs → features → docs)

**How:**
```
session $CLAUDE_SESSION_ID --full
```
Spawn an agent to scan the session narrative for:
- Ideas discussed but not acted on
- Implicit decisions that should be explicit
- Scope drift from original intent

Present findings to user via `AskUserQuestion` — let them pick what matters, what to defer, what to drop.

This is different from retro: retro looks backward at quality. Self-review looks sideways at breadth — "did we leave good ideas on the table?"

## Verbosity

Show the why, keep it short. User doesn't need sub-agent details - just confidence that work is progressing thoughtfully.

Surface to user only for:
- Phase transitions
- Decisions that genuinely need their input
- Blockers

## Philosophy

This is for us. Future Claudes will live in this code. We're making it a home we'd want to work in.

## Final Words - Reminder

Super small steps/increments, build for future Claudes, go slow, small commits and push, everything is an agent, invest in highest quality; Say slice DoD out loud before doing it, verify it after implementation; Give agents a lot of context with focused tasks.

